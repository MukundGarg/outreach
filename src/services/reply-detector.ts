import 'server-only';
import { getValidAccessTokenForUser } from './gmail-oauth';
import { routeAITask } from './ai-router';
import { logOutreachActivity } from './outreach-activity';
import { cancelAllCampaignFollowups } from './followup-scheduler';
import type { ReplyClassification } from '@/lib/ai-schemas';

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType: string;
  body?: {
    data?: string;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate: string;
  payload?: {
    headers: GmailMessageHeader[];
    body?: {
      data?: string;
    };
    parts?: GmailMessagePart[];
  };
}

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractTextBody(part?: GmailMessagePart): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts && Array.isArray(part.parts)) {
    for (const subPart of part.parts) {
      const text = extractTextBody(subPart);
      if (text) return text;
    }
  }
  return '';
}

/**
 * Polls Gmail for incoming recruiter replies to active outreach campaigns.
 * Thread-matched and sender-matched.
 */
export async function pollGmailRepliesForUser(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any,
): Promise<{
  checkedCount: number;
  repliesDetected: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  if (clientOverride) {
    db = clientOverride.db || clientOverride;
  } else {
    const { authenticatedDatabase } = await import('./applications');
    db = (await authenticatedDatabase()).db;
  }

  // 1. Fetch active campaigns with sent initial emails
  const { data: campaigns, error: campErr } = await db
    .from('outreach_campaigns')
    .select('id, recruiter_contact_id, status, recruiter_contacts(id, name, email, is_suppressed)')
    .eq('user_id', userId)
    .in('status', ['sent', 'scheduled', 'paused']);

  if (campErr || !campaigns || campaigns.length === 0) {
    return { checkedCount: 0, repliesDetected: 0, details: [] };
  }

  // 2. Fetch all known Gmail thread IDs for these campaigns
  const campaignIds = campaigns.map((c: { id: string }) => c.id);
  const { data: sentMessages } = await db
    .from('email_messages')
    .select('id, campaign_id, gmail_thread_id, gmail_message_id, recipient_email')
    .eq('user_id', userId)
    .in('campaign_id', campaignIds)
    .not('gmail_thread_id', 'is', null);

  if (!sentMessages || sentMessages.length === 0) {
    return { checkedCount: 0, repliesDetected: 0, details: [] };
  }

  // Get valid Google access token
  let tokenInfo: { accessToken: string; senderEmail: string };
  try {
    tokenInfo = await getValidAccessTokenForUser(userId, db);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gmail not connected or token expired';
    console.warn(`[ReplyDetection] Skipped user ${userId}: ${msg}`);
    return { checkedCount: 0, repliesDetected: 0, details: [{ error: msg }] };
  }

  const { accessToken, senderEmail } = tokenInfo;
  const processedDetails = [];
  let repliesCount = 0;

  // Group thread IDs by campaign
  const threadMap = new Map<string, { campaignId: string; contactEmail: string }>();
  for (const m of sentMessages) {
    if (m.gmail_thread_id && m.recipient_email) {
      threadMap.set(m.gmail_thread_id, {
        campaignId: m.campaign_id,
        contactEmail: m.recipient_email.toLowerCase().trim(),
      });
    }
  }

  // 3. For each active thread, query Gmail thread details
  for (const [threadId, meta] of threadMap.entries()) {
    try {
      const threadRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!threadRes.ok) {
        continue;
      }

      const threadData = await threadRes.json();
      const messages: GmailMessageDetail[] = threadData.messages || [];

      // Check messages in the thread
      for (const gMsg of messages) {
        const headers = gMsg.payload?.headers || [];
        const fromHeader = headers.find((h) => h.name.toLowerCase() === 'from')?.value || '';
        const subjectHeader = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';

        // Extract sender email
        const senderMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader];
        const extractedSender = (senderMatch[1] || fromHeader).toLowerCase().trim();

        // Skip our own outbound messages
        if (extractedSender === senderEmail.toLowerCase().trim()) {
          continue;
        }

        // Verify that the inbound sender matches the expected recruiter contact email for this campaign
        if (extractedSender !== meta.contactEmail) {
          continue;
        }

        // Check if message is already imported into database
        const { data: existingMsg } = await db
          .from('email_messages')
          .select('id')
          .eq('user_id', userId)
          .eq('gmail_message_id', gMsg.id)
          .maybeSingle();

        if (existingMsg) {
          continue; // Already processed
        }

        // Extract body text
        let bodyText = gMsg.snippet || '';
        if (gMsg.payload) {
          const fullBody = extractTextBody(gMsg.payload as unknown as GmailMessagePart);
          if (fullBody) bodyText = fullBody;
        }

        // Classify the reply with Gemini
        let classification: ReplyClassification = {
          classification: 'positive_interest',
          summary: bodyText.slice(0, 150),
          confidence: 0.9,
          needs_human_review: false,
          suggested_action: 'Reply to continue conversation',
          evidence: bodyText.slice(0, 100),
        };

        try {
          const aiClass = await routeAITask<ReplyClassification>(
            'reply_classify',
            { email_content: bodyText },
            { isDemo: false },
          );
          if (aiClass?.data) {
            classification = aiClass.data;
          }
        } catch (aiErr) {
          console.warn('[ReplyDetection] Classification error, defaulting to needs_review:', aiErr);
          classification = {
            classification: 'uncertain',
            summary: bodyText.slice(0, 150),
            confidence: 0.5,
            needs_human_review: true,
            suggested_action: 'Manually review incoming reply',
            evidence: '',
          };
        }

        // Map classification to DB enum
        let dbClassification: 'interested' | 'not_interested' | 'out_of_office' | 'other' | 'needs_review' = 'other';
        if (classification.classification === 'interview_invitation' || classification.classification === 'positive_interest') {
          dbClassification = 'interested';
        } else if (classification.classification === 'rejection') {
          dbClassification = 'not_interested';
        } else if (classification.classification === 'out_of_office') {
          dbClassification = 'out_of_office';
        } else if (classification.classification === 'opt_out') {
          dbClassification = 'not_interested';
        } else if (classification.needs_human_review || classification.classification === 'uncertain') {
          dbClassification = 'needs_review';
        }

        // 4. Save inbound message into email_messages
        const { data: savedMsg, error: insertErr } = await db
          .from('email_messages')
          .insert({
            user_id: userId,
            campaign_id: meta.campaignId,
            gmail_message_id: gMsg.id,
            gmail_thread_id: threadId,
            direction: 'inbound',
            subject: subjectHeader,
            body: bodyText,
            status: 'received',
            reply_classification: dbClassification,
            sender_email: extractedSender,
            recipient_email: senderEmail,
            sent_at: new Date(gMsg.internalDate ? parseInt(gMsg.internalDate, 10) : Date.now()).toISOString(),
            approved_at: new Date().toISOString(), // Received messages don't require approval
          })
          .select()
          .single();

        if (insertErr || !savedMsg) {
          console.error('[ReplyDetection] Insert failed:', insertErr);
          continue;
        }

        repliesCount++;

        // 5. CRITICAL: Stop and cancel all pending follow-ups for this campaign
        await cancelAllCampaignFollowups(meta.campaignId, `Recruiter reply received: ${dbClassification}`, db, userId);

        // Update campaign status
        const nextCampStatus = classification.classification === 'out_of_office' ? 'paused' : 'replied';
        await db
          .from('outreach_campaigns')
          .update({
            status: nextCampStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meta.campaignId)
          .eq('user_id', userId);

        // 6. Handle Opt-out suppression if classified as opt_out
        if (classification.classification === 'opt_out') {
          const camp = campaigns.find((c: { id: string }) => c.id === meta.campaignId);
          if (camp?.recruiter_contact_id) {
            await db
              .from('recruiter_contacts')
              .update({
                is_suppressed: true,
                suppression_reason: 'Recruiter requested opt-out in reply',
                suppressed_at: new Date().toISOString(),
              })
              .eq('id', camp.recruiter_contact_id)
              .eq('user_id', userId);

            await logOutreachActivity({
              userId,
              campaignId: meta.campaignId,
              recruiterContactId: camp.recruiter_contact_id,
              messageId: savedMsg.id,
              activityType: 'contact_opted_out',
              title: 'Contact Opted Out',
              details: { reason: 'Automatic classification detected opt-out request' },
              clientOverride: { db, user: { id: userId } },
            });
          }
        }

        // 7. Log activity
        await logOutreachActivity({
          userId,
          campaignId: meta.campaignId,
          messageId: savedMsg.id,
          activityType: 'reply_received',
          title: `Recruiter Reply: ${subjectHeader}`,
          details: {
            classification: classification.classification,
            dbCategory: dbClassification,
            summary: classification.summary,
            from: extractedSender,
          },
          clientOverride: { db, user: { id: userId } },
        });

        processedDetails.push({
          campaignId: meta.campaignId,
          gmailMessageId: gMsg.id,
          classification: classification.classification,
          sender: extractedSender,
        });
      }
    } catch (threadErr) {
      console.warn(`[ReplyDetection] Failed reading thread ${threadId}:`, threadErr);
    }
  }

  return {
    checkedCount: threadMap.size,
    repliesDetected: repliesCount,
    details: processedDetails,
  };
}
