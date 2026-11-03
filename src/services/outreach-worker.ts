import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { sendUserApprovedEmail } from './gmail-sender';
import { scheduleFollowup, cancelAllCampaignFollowups } from './followup-scheduler';
import { logOutreachActivity } from './outreach-activity';
import { pollGmailRepliesForUser } from './reply-detector';
import { routeAITask } from './ai-router';
import type { DifyOutreachIntelligence } from '@/lib/ai-schemas';

export interface ProcessDueFollowupsResult {
  processed: number;
  sent: number;
  failed: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any[];
}

/**
 * Worker function that processes due follow-up schedules across all users or a specific user.
 * 1. Atomically claims due schedules (status = 'approved', scheduled_at <= now, claimed_at IS NULL).
 * 2. Verifies the campaign and contact remain eligible (not replied, paused, completed, or suppressed).
 * 3. Contextually drafts the follow-up message using AI outreach router (if body not pre-approved).
 * 4. Transmits follow-up via Gmail API through sendUserApprovedEmail.
 * 5. Updates campaign follow-up counts, marks schedule as 'completed'.
 * 6. Schedules the next follow-up attempt if under the maximum count.
 */
export async function processDueFollowupSchedules(options?: {
  userId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any;
}): Promise<ProcessDueFollowupsResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  if (options?.clientOverride) {
    db = options.clientOverride.db || options.clientOverride;
  } else {
    db = await supabaseServer();
  }

  const nowIso = new Date().toISOString();

  // 1. Query for due approved schedules
  let query = db
    .from('followup_schedules')
    .select(`
      id,
      user_id,
      message_id,
      campaign_id,
      followup_number,
      scheduled_at,
      skip_weekends,
      status,
      idempotency_key
    `)
    .eq('status', 'approved')
    .lte('scheduled_at', nowIso)
    .is('claimed_at', null)
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data: dueSchedules, error: queryErr } = await query;
  if (queryErr) {
    console.error('[FollowupWorker] Error fetching due schedules:', queryErr);
    return { processed: 0, sent: 0, failed: 0, details: [{ error: queryErr.message }] };
  }

  if (!dueSchedules || dueSchedules.length === 0) {
    return { processed: 0, sent: 0, failed: 0, details: [] };
  }

  let sentCount = 0;
  let failedCount = 0;
  const executionDetails = [];

  for (const schedule of dueSchedules) {
    // ATOMIC CLAIM: Update claimed_at to lock this schedule from concurrent workers
    const claimTime = new Date().toISOString();
    const { data: claimed, error: claimErr } = await db
      .from('followup_schedules')
      .update({
        claimed_at: claimTime,
        status: 'claimed',
        updated_at: claimTime,
      })
      .eq('id', schedule.id)
      .eq('status', 'approved')
      .is('claimed_at', null)
      .select()
      .maybeSingle();

    if (claimErr || !claimed) {
      // Someone else claimed it concurrently
      continue;
    }

    try {
      // 2. Fetch original email message and campaign
      const { data: originalMsg } = await db
        .from('email_messages')
        .select('*')
        .eq('id', schedule.message_id)
        .single();

      if (!originalMsg) {
        throw new Error('Original message not found');
      }

      const campaignId = schedule.campaign_id || originalMsg.campaign_id;
      const { data: campaign } = await db
        .from('outreach_campaigns')
        .select('*, recruiter_contacts(*)')
        .eq('id', campaignId)
        .single();

      if (!campaign) {
        throw new Error('Associated outreach campaign not found');
      }

      const contact = campaign.recruiter_contacts;
      if (!contact) {
        throw new Error('Recruiter contact not found');
      }

      // Pre-send Invariants Verification
      if (contact.is_suppressed) {
        await cancelAllCampaignFollowups(campaign.id, 'Contact is suppressed', db, schedule.user_id);
        throw new Error(`Contact is suppressed (${contact.suppression_reason || 'Opt-out'})`);
      }

      if (['replied', 'completed', 'cancelled', 'paused'].includes(campaign.status)) {
        await cancelAllCampaignFollowups(campaign.id, `Campaign is in status ${campaign.status}`, db, schedule.user_id);
        throw new Error(`Campaign status is '${campaign.status}'; automatic send aborted`);
      }

      // Check max follow-ups
      const maxFollowups = campaign.max_followups ?? 3;
      const currentSent = campaign.followups_sent_count ?? 0;
      if (currentSent >= maxFollowups) {
        await cancelAllCampaignFollowups(campaign.id, `Reached max follow-ups (${maxFollowups})`, db, schedule.user_id);
        throw new Error(`Campaign reached maximum follow-ups (${maxFollowups})`);
      }

      // 3. Generate concise, contextual follow-up text using AI or fallback
      const followupNum = (campaign.followups_sent_count || 0) + 1;
      let followupSubject = originalMsg.subject.startsWith('Re:')
        ? originalMsg.subject
        : `Re: ${originalMsg.subject}`;
      let followupBody = '';

      try {
        const aiDraft = await routeAITask<DifyOutreachIntelligence>(
          'outreach_plan',
          {
            candidate_profile: {},
            job_opportunity: {
              company: contact.company || 'your team',
              title: contact.role || 'Opportunity',
            },
            recruiter_contact: {
              name: contact.name,
              role: contact.role,
              company: contact.company,
            },
            interaction_history: [
              `Previous outbound message (${originalMsg.sent_at || 'earlier'}): "${originalMsg.body.slice(0, 200)}..."`,
              `Goal: Polite follow-up #${followupNum} checking in without repetition.`,
            ],
          },
          { isDemo: false },
        );

        if (aiDraft?.data?.email_body) {
          followupBody = aiDraft.data.email_body;
          if (aiDraft.data.subject) {
            followupSubject = aiDraft.data.subject.startsWith('Re:')
              ? aiDraft.data.subject
              : `Re: ${aiDraft.data.subject}`;
          }
        }
      } catch (draftErr) {
        console.warn('[FollowupWorker] AI draft error, using concise template:', draftErr);
      }

      if (!followupBody) {
        followupBody = `Hi ${contact.name.split(' ')[0] || contact.name},\n\nFollowing up on my previous note regarding opportunities at ${contact.company || 'your team'}. I wanted to check if you had a moment to review my background or if there's a better time to connect.\n\nBest regards,`;
      }

      // 4. Send through Gmail sender with approval confirmed
      const sendResult = await sendUserApprovedEmail(
        {
          campaignId: campaign.id,
          contactId: contact.id,
          recipientEmail: contact.email,
          subject: followupSubject,
          body: followupBody,
          approvalConfirmed: true,
          operationKey: schedule.idempotency_key,
        },
        { db, user: { id: schedule.user_id } },
      );

      // 5. Update the new email_messages record with follow-up metadata
      await db
        .from('email_messages')
        .update({
          is_followup: true,
          followup_number: followupNum,
          in_reply_to_message_id: originalMsg.gmail_message_id || null,
        })
        .eq('id', sendResult.messageId);

      // 6. Mark schedule as 'completed'
      await db
        .from('followup_schedules')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule.id);

      // 7. Update Campaign counts
      const newSentCount = currentSent + 1;
      const sentTimeIso = sendResult.sentAt || new Date().toISOString();

      await db
        .from('outreach_campaigns')
        .update({
          followups_sent_count: newSentCount,
          last_followup_at: sentTimeIso,
          updated_at: sentTimeIso,
        })
        .eq('id', campaign.id);

      // 8. Log activity
      await logOutreachActivity({
        userId: schedule.user_id,
        campaignId: campaign.id,
        recruiterContactId: contact.id,
        messageId: sendResult.messageId,
        activityType: 'followup_sent',
        title: `Follow-up #${followupNum} Sent`,
        details: {
          gmail_message_id: sendResult.gmailMessageId,
          sent_at: sentTimeIso,
          followup_number: followupNum,
        },
        clientOverride: { db, user: { id: schedule.user_id } },
      });

      // 9. Schedule next follow-up attempt if under limit and auto-send is enabled
      if (newSentCount < maxFollowups && campaign.auto_send_followups) {
        const intervalDays = campaign.followup_interval_days || 3;
        const skipWeekends = campaign.skip_weekends ?? true;

        try {
          await scheduleFollowup({
            messageId: sendResult.messageId,
            delayDays: intervalDays,
            skipWeekends,
            autoApprove: true,
            followupNumber: newSentCount + 1,
          });
        } catch (nextErr) {
          console.warn('[FollowupWorker] Could not schedule subsequent follow-up:', nextErr);
        }
      } else if (newSentCount >= maxFollowups) {
        await db
          .from('outreach_campaigns')
          .update({
            next_followup_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaign.id);
      }

      sentCount++;
      executionDetails.push({
        scheduleId: schedule.id,
        campaignId: campaign.id,
        status: 'sent',
        followupNumber: followupNum,
      });
    } catch (err: unknown) {
      failedCount++;
      const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';

      await db
        .from('followup_schedules')
        .update({
          status: 'failed',
          execution_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule.id);

      if (schedule.campaign_id) {
        // Increment failed count
        const { data: currCamp } = await db
          .from('outreach_campaigns')
          .select('followups_failed_count')
          .eq('id', schedule.campaign_id)
          .single();

        await db
          .from('outreach_campaigns')
          .update({
            followups_failed_count: (currCamp?.followups_failed_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', schedule.campaign_id);

        await logOutreachActivity({
          userId: schedule.user_id,
          campaignId: schedule.campaign_id,
          activityType: 'followup_failed',
          title: `Follow-up Attempt Failed`,
          details: { error: errorMessage },
          clientOverride: { db, user: { id: schedule.user_id } },
        });
      }

      executionDetails.push({
        scheduleId: schedule.id,
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  return {
    processed: dueSchedules.length,
    sent: sentCount,
    failed: failedCount,
    details: executionDetails,
  };
}

/**
 * Combined worker execution: polls replies and processes due follow-ups.
 */
export async function runOutreachAutomationCycle(options?: {
  userId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  if (options?.clientOverride) {
    db = options.clientOverride.db || options.clientOverride;
  } else {
    db = await supabaseServer();
  }

  // 1. Determine users to process
  let userIds: string[] = [];
  if (options?.userId) {
    userIds = [options.userId];
  } else {
    const { data: conns } = await db
      .from('gmail_oauth_connections')
      .select('user_id');
    userIds = (conns || []).map((c: { user_id: string }) => c.user_id);
  }

  const replyResults = [];
  for (const uid of userIds) {
    const repRes = await pollGmailRepliesForUser(uid, db);
    replyResults.push({ userId: uid, ...repRes });
  }

  // 2. Process due follow-ups
  const followupResults = await processDueFollowupSchedules({
    userId: options?.userId,
    clientOverride: db,
  });

  return {
    timestamp: new Date().toISOString(),
    replies: replyResults,
    followups: followupResults,
  };
}
