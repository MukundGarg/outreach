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

  if (contact.is_suppressed) {
    throw new Error(
      `Cannot send email: Recruiter contact is marked as OPT-OUT / SUPPRESSED (${contact.suppression_reason || 'Opt-out'}). All further outreach is blocked.`,
    );
  }

  // 4. Verify campaign ownership
  const { data: campaign, error: campErr } = await db
    .from('outreach_campaigns')
    .select('id, recruiter_contact_id')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single();

  if (campErr || !campaign) {
    throw new Error('Outreach campaign not found or access denied.');
  }

  // 5. Content fingerprinting
  const contentHash = calculateContentHash(cleanRecipient, subject, body);
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
    throw new Error('This email is currently in progress. Please wait for completion.');
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
    await db
      .from('email_messages')
      .update({
        status: 'approved',
        approved_at: approvedAt,
        approved_content_hash: contentHash,
      })
      .eq('id', messageRecordId);
  }

  // 9. Mark status as 'sending'
  await db
    .from('email_messages')
    .update({ status: 'sending' })
    .eq('id', messageRecordId);

  // 10. Build RFC 5322 MIME message & send to Gmail API
  const rawRfc = buildRfc5322Message({
    from: senderEmail,
    to: cleanRecipient,
    subject,
    body,
  });
  const encodedRaw = base64UrlEncode(rawRfc);

  try {
    const gmailRes = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedRaw }),
    });

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
    await db
      .from('email_messages')
      .update({
        status: 'sent',
        gmail_message_id: gmailData.id || null,
        gmail_thread_id: gmailData.threadId || null,
        sent_at: sentAt,
      })
      .eq('id', messageRecordId);

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
    const errText = sendErr instanceof Error ? sendErr.message : String(sendErr);
    // If error was not already handled
    try {
      await db
        .from('email_messages')
        .update({
          status: 'failed',
          send_error_category: 'SEND_EXCEPTION',
          send_error_details: errText.slice(0, 500),
        })
        .eq('id', messageRecordId);
    } catch {
      // Best-effort error recording
    }

    throw sendErr;
  }
}
