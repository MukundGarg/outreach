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
export async function sendUserApprovedEmail(
  params: {
    campaignId: string;
    contactId: string;
    recipientEmail: string;
    subject: string;
    body: string;
    approvalConfirmed: boolean;
    draftId?: string;
    expectedApprovedHash?: string;
    operationKey?: string;
  },
  clientOverride?: {
    db: unknown;
    user: { id: string; email?: string };
  },
): Promise<SendEmailResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { db, user } = (clientOverride as any) || (await authenticatedDatabase());

  const {
    campaignId,
    contactId,
    recipientEmail,
    subject,
    body,
    approvalConfirmed,
    draftId,
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
    .select('id, status, recruiter_contact_id')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single();

  if (campErr || !campaign) {
    throw new Error('Outreach campaign not found or access denied.');
  }

  if (campaign.recruiter_contact_id !== contactId) {
    throw new Error('Campaign does not belong to the selected recruiter contact.');
  }

  // Requirement 1: Prevent new approved email send while an earlier transmission has an uncertain outcome
  const { data: uncertainTransmission } = await db
    .from('email_messages')
    .select('id, status, send_error_category')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .or('status.eq.sending,send_error_category.eq.RECONCILIATION_REQUIRED')
    .limit(1)
    .maybeSingle();

  if (uncertainTransmission) {
    throw new Error(
      'Cannot send email: An earlier transmission for this campaign has an uncertain delivery outcome and requires reconciliation before any new attempt.',
    );
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
  // Requirement 6: Bind approval to a specific authenticated draft (draftId) if provided
  let draftQuery = db
    .from('email_messages')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id);

  if (draftId) {
    draftQuery = draftQuery.eq('id', draftId);
  } else {
    draftQuery = draftQuery
      .in('status', ['approved', 'sending', 'sent'])
      .order('created_at', { ascending: false })
      .limit(1);
  }

  const { data: approvedDraft, error: draftQueryErr } = await draftQuery.maybeSingle();

  if (draftQueryErr || !approvedDraft) {
    throw new Error(
      'No server-persisted approval record found for this draft. You must save and approve the draft before sending.',
    );
  }

  if (draftId && approvedDraft.id !== draftId) {
    throw new Error('Draft ID mismatch: the approved draft does not match the requested draft identifier.');
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

  // Requirement 3: Ensure campaign state transition to 'scheduled' adheres strictly to guard_outreach_state()
  // Campaign transition graph: draft -> awaiting_approval -> scheduled -> sent
  if (campaign.status === 'draft') {
    const { error: awaitErr } = await db
      .from('outreach_campaigns')
      .update({ status: 'awaiting_approval' })
      .eq('id', campaignId);
    if (awaitErr) {
      throw new Error(`Failed to advance campaign state to awaiting_approval: ${awaitErr.message}`);
    }
  }

  const { error: schedErr } = await db
    .from('outreach_campaigns')
    .update({ status: 'scheduled', approved_at: approvedDraft.approved_at })
    .eq('id', campaignId);

  if (schedErr) {
    throw new Error(`Failed to advance campaign state to scheduled: ${schedErr.message}`);
  }

  // 9. Get valid sender Gmail access token
  const { accessToken, senderEmail } = await getValidAccessTokenForUser(user.id, db);

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
  let rawFetchDispatched = false;

  try {
    rawFetchDispatched = true;
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
      // Definite non-2xx HTTP response from Google server: request was processed and rejected
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

    // Requirement 5: Verify successful Gmail response contains a valid non-empty string message ID before recording acceptance
    const gmailData = await gmailRes.json().catch(() => null);
    if (!gmailData || typeof gmailData.id !== 'string' || !gmailData.id.trim()) {
      throw new Error('Invalid Gmail API response: missing confirmed message ID');
    }

    gmailAccepted = true;
    const sentAt = new Date().toISOString();

    // 11. Update message as sent with Gmail IDs
    try {
      const { error: sentUpdateErr } = await db
        .from('email_messages')
        .update({
          status: 'sent',
          gmail_message_id: gmailData.id,
          gmail_thread_id: typeof gmailData.threadId === 'string' ? gmailData.threadId : null,
          sent_at: sentAt,
        })
        .eq('id', messageRecordId);

      if (sentUpdateErr) {
        throw sentUpdateErr;
      }

      // Update campaign status to 'sent' (transitioning from 'scheduled' to 'sent')
      const { error: campSentErr } = await db
        .from('outreach_campaigns')
        .update({ status: 'sent', approved_at: approvedDraft.approved_at })
        .eq('id', campaignId);

      if (campSentErr) {
        throw campSentErr;
      }
    } catch (postAcceptDbErr) {
      // Gmail accepted the message, but local DB update failed!
      // Requirement 5: Preserve a reconciliation-required state for uncertain outcomes and prohibit automatic retries.
      // Do NOT overwrite the status as 'failed'.
      const dbErrText = postAcceptDbErr instanceof Error ? postAcceptDbErr.message : String(postAcceptDbErr);
      try {
        await db
          .from('email_messages')
          .update({
            gmail_message_id: gmailData.id,
            gmail_thread_id: typeof gmailData.threadId === 'string' ? gmailData.threadId : null,
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

    // Requirement 4: Ensure ANY network error after a Gmail send request may have been transmitted
    // is treated conservatively as an uncertain outcome (RECONCILIATION_REQUIRED), not automatically safe to retry.
    // If the error occurred after raw fetch dispatch (timeout, socket hangup, conn reset, abort, fetch failed),
    // we cannot be certain Google did not receive and send the email.
    const errText = sendErr instanceof Error ? sendErr.message : String(sendErr);
    const isDefiniteHttpRejection = errText.startsWith('Gmail API returned error');

    const isUncertainNetworkOutcome = rawFetchDispatched && !isDefiniteHttpRejection;
    const errCategory = isUncertainNetworkOutcome ? 'RECONCILIATION_REQUIRED' : 'SEND_EXCEPTION';

    try {
      await db
        .from('email_messages')
        .update({
          status: isUncertainNetworkOutcome ? 'sending' : 'failed', // Keep out of definitively failed to prevent blind re-sends
          send_error_category: errCategory,
          send_error_details: errText.slice(0, 500),
        })
        .eq('id', messageRecordId);
    } catch {
      // Best-effort database recording
    }

    if (isUncertainNetworkOutcome) {
      throw new Error(
        `Gmail transmission network error (${errText}). The delivery outcome is unconfirmed. Message is preserved in an uncertain state requiring reconciliation. Do not resend without reconciling Gmail status.`,
      );
    }

    throw sendErr;
  }
}
