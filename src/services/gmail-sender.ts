import crypto from 'node:crypto';
import { authenticatedDatabase } from './applications';
import { getValidAccessTokenForUser } from './gmail-oauth';
import {
  base64UrlEncode,
  buildRfc5322Message,
  calculateContentHash,
  validateSendingPrerequisites,
} from '@/lib/email-utils';

export {
  base64UrlEncode,
  buildRfc5322Message,
  calculateContentHash,
  validateSendingPrerequisites,
};

const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export interface SendEmailResult {
  messageId: string;
  gmailMessageId: string;
  gmailThreadId?: string;
  sentAt: string;
}

/**
 * Sends an email via Gmail API with explicit user approval validation, recipient suppression check, and idempotency protection.
 */
export async function sendUserApprovedEmail(params: {
  campaignId: string;
  contactId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  approvalConfirmed: boolean;
  expectedApprovedHash?: string;
  operationKey?: string;
}): Promise<SendEmailResult> {
  const { db, user } = await authenticatedDatabase();

  const {
    campaignId,
    contactId,
    recipientEmail,
    subject,
    body,
    approvalConfirmed,
    expectedApprovedHash,
    operationKey = crypto.randomUUID(),
  } = params;

  // 1. Mandatory approval verification
  if (!approvalConfirmed) {
    throw new Error('Explicit user approval is required before sending recruiter emails.');
  }

  // 2. Recipient validation & format check
  const cleanRecipient = recipientEmail.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanRecipient)) {
    throw new Error(`Invalid recipient email address: "${cleanRecipient}"`);
  }

  // 3. Contact ownership and explicit opt-out suppression check
  const { data: contact, error: contactErr } = await db
    .from('recruiter_contacts')
    .select('id, email, is_suppressed, suppression_reason')
    .eq('id', contactId)
    .eq('user_id', user.id)
    .single();

  if (contactErr || !contact) {
    throw new Error('Recruiter contact not found or access denied.');
  }

  // Safety check: Destination email MUST strictly match the owned recruiter contact
  if (contact.email.toLowerCase().trim() !== cleanRecipient) {
    throw new Error(
      `Recipient email "${cleanRecipient}" does not match the contact record email "${contact.email}".`,
    );
  }

  if (contact.is_suppressed) {
    throw new Error(
      `Cannot send email: Recruiter contact is marked as OPT-OUT / SUPPRESSED (${contact.suppression_reason || 'Opt-out'}). All further outreach is blocked.`,
    );
  }

  // 4. Verify campaign ownership and ensure campaign belongs to THIS contact
  const { data: campaign, error: campErr } = await db
    .from('outreach_campaigns')
    .select('id, recruiter_contact_id')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single();

  if (campErr || !campaign) {
    throw new Error('Outreach campaign not found or access denied.');
  }

  if (campaign.recruiter_contact_id !== contactId) {
    throw new Error('Campaign does not belong to the selected recruiter contact.');
  }

  // 5. Content fingerprinting and approval hash validation
  const contentHash = calculateContentHash(cleanRecipient, subject, body);
  if (expectedApprovedHash && expectedApprovedHash !== contentHash) {
    throw new Error(
      'Draft content has changed since approval was granted. Please re-review and approve the updated draft.',
    );
  }

  const approvedAt = new Date().toISOString();

  // 6. Record or fetch existing email_messages row with idempotency_key
  const { data: existingMsg } = await db
    .from('email_messages')
    .select('*')
    .eq('idempotency_key', operationKey)
    .maybeSingle();

  if (existingMsg && (existingMsg.status === 'sent' || existingMsg.status === 'sending')) {
    if (existingMsg.status === 'sent') {
      return {
        messageId: existingMsg.id,
        gmailMessageId: existingMsg.gmail_message_id || '',
        gmailThreadId: existingMsg.gmail_thread_id || '',
        sentAt: existingMsg.sent_at || existingMsg.created_at,
      };
    }
    throw new Error('This email transmission is currently in progress. Please wait for completion.');
  }

  // 7. Get valid sender Gmail access token
  const { accessToken, senderEmail } = await getValidAccessTokenForUser(user.id);

  // 8. Insert or update draft into 'approved' state
  let messageRecordId = existingMsg?.id;
  if (!messageRecordId) {
    const { data: inserted, error: insertErr } = await db
      .from('email_messages')
      .insert({
        user_id: user.id,
        campaign_id: campaignId,
        recipient_email: cleanRecipient,
        subject,
        body,
        status: 'approved',
        idempotency_key: operationKey,
        approved_at: approvedAt,
        approved_content_hash: contentHash,
        direction: 'outbound',
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      throw new Error(`Failed to record approved message draft: ${insertErr?.message}`);
    }
    messageRecordId = inserted.id;
  } else {
    const { error: appErr } = await db
      .from('email_messages')
      .update({
        status: 'approved',
        approved_at: approvedAt,
        approved_content_hash: contentHash,
      })
      .eq('id', messageRecordId)
      .eq('user_id', user.id);

    if (appErr) {
      throw new Error(`Failed to update message to approved status: ${appErr.message}`);
    }
  }

  // 9. Atomic transition: mark status as 'sending' only if currently 'approved' or 'draft'
  const { data: lockRow, error: lockErr } = await db
    .from('email_messages')
    .update({ status: 'sending' })
    .eq('id', messageRecordId)
    .in('status', ['draft', 'approved'])
    .select('id')
    .single();

  if (lockErr || !lockRow) {
    throw new Error('Could not acquire sending lock on message draft. It may already be sending.');
  }

  // 10. Build RFC 5322 MIME message & send to Gmail API with strict 30s timeout
  const rawRfc = buildRfc5322Message({
    from: senderEmail,
    to: cleanRecipient,
    subject,
    body,
  });
  const encodedRaw = base64UrlEncode(rawRfc);

  const controller = new AbortController();
  const sendTimeout = setTimeout(() => controller.abort(), 30000);

  try {
    const gmailRes = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedRaw }),
      signal: controller.signal,
    });

    clearTimeout(sendTimeout);

    if (!gmailRes.ok) {
      const errBody = await gmailRes.text().catch(() => '');
      await db
        .from('email_messages')
        .update({
          status: 'failed',
          send_error_category: `HTTP_${gmailRes.status}`,
          send_error_details: errBody.slice(0, 500),
        })
        .eq('id', messageRecordId);

      throw new Error(`Gmail API returned error ${gmailRes.status}: ${errBody}`);
    }

    const gmailData = await gmailRes.json();
    const sentAt = new Date().toISOString();

    // 11. Update message as sent with Gmail IDs
    const { error: sentUpdateErr } = await db
      .from('email_messages')
      .update({
        status: 'sent',
        gmail_message_id: gmailData.id || null,
        gmail_thread_id: gmailData.threadId || null,
        sent_at: sentAt,
      })
      .eq('id', messageRecordId);

    if (sentUpdateErr) {
      throw new Error(`Email sent by Gmail API (ID: ${gmailData.id}) but failed to update database status: ${sentUpdateErr.message}`);
    }

    // Update campaign status to 'sent'
    await db
      .from('outreach_campaigns')
      .update({ status: 'sent', approved_at: approvedAt })
      .eq('id', campaignId);

    return {
      messageId: messageRecordId,
      gmailMessageId: gmailData.id,
      gmailThreadId: gmailData.threadId,
      sentAt,
    };
  } catch (sendErr: unknown) {
    clearTimeout(sendTimeout);
    const isTimeout =
      (sendErr instanceof Error && sendErr.name === 'AbortError') ||
      String(sendErr).toLowerCase().includes('timeout');

    const errCategory = isTimeout ? 'DELIVERY_UNCONFIRMED_TIMEOUT' : 'SEND_EXCEPTION';
    const errText = sendErr instanceof Error ? sendErr.message : String(sendErr);

    try {
      await db
        .from('email_messages')
        .update({
          status: 'failed',
          send_error_category: errCategory,
          send_error_details: errText.slice(0, 500),
        })
        .eq('id', messageRecordId);
    } catch {
      // Best-effort database recording
    }

    if (isTimeout) {
      throw new Error(
        'Gmail request timed out after 30 seconds. The delivery outcome is unconfirmed. Do not resend without reconciling Gmail status.',
      );
    }

    throw sendErr;
  }
}
