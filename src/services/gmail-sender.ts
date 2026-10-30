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

  // 6. Enforce server-persisted approval record:
  // Must have an existing email_messages draft for this user and campaign that was explicitly approved on the server.
  // Look up by campaign_id or contact's campaign
  const { data: approvedDraft, error: draftQueryErr } = await db
    .from('email_messages')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .in('status', ['approved', 'sending', 'sent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftQueryErr || !approvedDraft) {
    throw new Error(
      'No server-persisted approval record found for this draft. You must save and approve the draft before sending.',
    );
  }

  // Verify that server approval timestamp and content hash exist and match current content
  if (!approvedDraft.approved_at || !approvedDraft.approved_content_hash) {
    throw new Error(
      'Draft approval record is incomplete or unverified. Please re-approve the draft on the server.',
    );
  }

  if (approvedDraft.approved_content_hash !== contentHash) {
    throw new Error(
      'Server-persisted approved content hash does not match the draft content being transmitted. Re-approval is required.',
    );
  }

  if ((approvedDraft.recipient_email || '').toLowerCase().trim() !== cleanRecipient) {
    throw new Error(
      'Server-persisted approved recipient does not match the destination email address.',
    );
  }

  // 7. Stable server-associated idempotency key:
  // Require and use the stable idempotency_key already associated with the approved message record.
  const stableIdempotencyKey = approvedDraft.idempotency_key;
  if (operationKey && operationKey !== stableIdempotencyKey) {
    // If a caller specified a key, verify it matches the stable key
    // Reject arbitrary client-generated keys that deviate from the server record
    throw new Error(
      'Idempotency key mismatch: Sending must use the stable server-associated idempotency key for this approved message.',
    );
  }

  // Check if message is already sent or in-flight
  if (approvedDraft.status === 'sent') {
    return {
      messageId: approvedDraft.id,
      gmailMessageId: approvedDraft.gmail_message_id || '',
      gmailThreadId: approvedDraft.gmail_thread_id || '',
      sentAt: approvedDraft.sent_at || approvedDraft.created_at,
    };
  }

  if (approvedDraft.status === 'sending') {
    throw new Error('This email transmission is currently in progress. Please wait for completion.');
  }

  const messageRecordId = approvedDraft.id;

  // 8. Atomic transition: mark status as 'sending' only if currently 'approved'
  // Prevents concurrent transmission of the same approved message
  const { data: lockRow, error: lockErr } = await db
    .from('email_messages')
    .update({ status: 'sending' })
    .eq('id', messageRecordId)
    .eq('status', 'approved')
    .select('id')
    .single();

  if (lockErr || !lockRow) {
    throw new Error('Could not acquire sending lock on message draft. It may already be sending.');
  }

  // 9. Get valid sender Gmail access token
  const { accessToken, senderEmail } = await getValidAccessTokenForUser(user.id);

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

  let gmailAccepted = false;

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
    gmailAccepted = true;
    const sentAt = new Date().toISOString();

    // 11. Update message as sent with Gmail IDs
    try {
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
        throw sentUpdateErr;
      }

      // Update campaign status to 'sent'
      await db
        .from('outreach_campaigns')
        .update({ status: 'sent', approved_at: approvedDraft.approved_at })
        .eq('id', campaignId);
    } catch (postAcceptDbErr) {
      // Gmail accepted the message, but local DB update failed!
      // Requirement 5: Preserve a reconciliation-required state for uncertain outcomes and prohibit automatic retries.
      // Do NOT overwrite the status as 'failed'.
      const dbErrText = postAcceptDbErr instanceof Error ? postAcceptDbErr.message : String(postAcceptDbErr);
      try {
        await db
          .from('email_messages')
          .update({
            gmail_message_id: gmailData.id || null,
            gmail_thread_id: gmailData.threadId || null,
            send_error_category: 'RECONCILIATION_REQUIRED',
            send_error_details: `Gmail accepted message (ID: ${gmailData.id}), but subsequent database update encountered error: ${dbErrText.slice(0, 300)}`,
          })
          .eq('id', messageRecordId);
      } catch {
        // Best effort to preserve reconciliation state
      }

      throw new Error(
        `Email was successfully accepted by Gmail API (Message ID: ${gmailData.id}), but updating the local database record failed. Message is preserved in RECONCILIATION_REQUIRED state. Do not retry sending.`,
      );
    }

    return {
      messageId: messageRecordId,
      gmailMessageId: gmailData.id,
      gmailThreadId: gmailData.threadId,
      sentAt,
    };
  } catch (sendErr: unknown) {
    clearTimeout(sendTimeout);

    // If Gmail already accepted the email, we MUST NOT overwrite status as failed!
    if (gmailAccepted) {
      throw sendErr;
    }

    const isTimeout =
      (sendErr instanceof Error && sendErr.name === 'AbortError') ||
      String(sendErr).toLowerCase().includes('timeout');

    // For timeouts, delivery outcome is uncertain: use RECONCILIATION_REQUIRED and prohibit automatic retries
    const errCategory = isTimeout ? 'RECONCILIATION_REQUIRED' : 'SEND_EXCEPTION';
    const errText = sendErr instanceof Error ? sendErr.message : String(sendErr);

    try {
      await db
        .from('email_messages')
        .update({
          status: isTimeout ? 'sending' : 'failed', // If timeout, keep out of definitively failed to prevent blind re-sends
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
