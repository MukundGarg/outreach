import 'server-only';
import { authenticatedDatabase } from '@/services/applications';
import { nextFollowup } from '@/lib/domain';
import { logOutreachActivity } from './outreach-activity';

export interface FollowupScheduleRecord {
  id: string;
  user_id: string;
  message_id: string;
  campaign_id?: string;
  followup_number?: number;
  scheduled_at: string;
  skip_weekends: boolean;
  status: 'pending' | 'approved' | 'claimed' | 'completed' | 'cancelled' | 'failed';
  approved_at: string | null;
  claimed_at: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

/**
 * Schedule a follow-up for an outreach message.
 */
export async function scheduleFollowup({
  messageId,
  delayDays = 3,
  skipWeekends = true,
  autoApprove = false,
  followupNumber = 1,
}: {
  messageId: string;
  delayDays?: number;
  skipWeekends?: boolean;
  autoApprove?: boolean;
  followupNumber?: number;
}) {
  const { db, user } = await authenticatedDatabase();

  // 1. Fetch message and verify user ownership and 'sent' status
  const { data: message, error: msgError } = await db
    .from('email_messages')
    .select('id, user_id, status, campaign_id, sent_at')
    .eq('id', messageId)
    .single();

  if (msgError || !message) {
    throw new Error('Message not found or access denied');
  }

  if (message.status !== 'sent') {
    throw new Error(`Cannot schedule follow-up: message is in status '${message.status}', must be 'sent'`);
  }

  // 2. Fetch campaign and recruiter contact to verify not suppressed and maximum limits not exceeded
  const { data: campaign, error: campError } = await db
    .from('outreach_campaigns')
    .select('id, recruiter_contact_id, status, max_followups, followups_sent_count')
    .eq('id', message.campaign_id)
    .single();

  if (campError || !campaign) {
    throw new Error('Associated campaign not found');
  }

  if (['replied', 'completed', 'cancelled'].includes(campaign.status)) {
    throw new Error(`Cannot schedule follow-up: campaign is already in terminal state '${campaign.status}'`);
  }

  const maxFollowups = campaign.max_followups ?? 3;
  const currentSent = campaign.followups_sent_count ?? 0;
  if (currentSent >= maxFollowups) {
    throw new Error(`Cannot schedule follow-up: maximum configured limit of ${maxFollowups} follow-ups has already been reached`);
  }

  const { data: contact } = await db
    .from('recruiter_contacts')
    .select('id, is_suppressed, suppression_reason')
    .eq('id', campaign.recruiter_contact_id)
    .single();

  if (contact?.is_suppressed) {
    throw new Error(`Cannot schedule follow-up: Recruiter contact is suppressed (${contact.suppression_reason || 'Opted out'})`);
  }

  // 3. Check for existing active schedules for this message or campaign
  const { data: existingSchedules } = await db
    .from('followup_schedules')
    .select('id, status')
    .eq('message_id', messageId)
    .in('status', ['pending', 'approved', 'claimed']);

  if (existingSchedules && existingSchedules.length > 0) {
    throw new Error('An active follow-up schedule already exists for this message');
  }

  // 4. Calculate target date
  const startDate = message.sent_at ? new Date(message.sent_at) : new Date();
  const scheduledDate = nextFollowup(startDate, delayDays, skipWeekends);

  const nowIso = new Date().toISOString();
  const status = autoApprove ? 'approved' : 'pending';
  const approvedAt = autoApprove ? nowIso : null;

  const { data: created, error: insertError } = await db
    .from('followup_schedules')
    .insert({
      user_id: user.id,
      message_id: messageId,
      campaign_id: campaign.id,
      followup_number: followupNumber,
      scheduled_at: scheduledDate.toISOString(),
      skip_weekends: skipWeekends,
      status,
      approved_at: approvedAt,
    })
    .select()
    .single();

  if (insertError || !created) {
    throw new Error(insertError?.message || 'Failed to create follow-up schedule');
  }

  // Update campaign's next_followup_at
  await db
    .from('outreach_campaigns')
    .update({
      next_followup_at: scheduledDate.toISOString(),
      updated_at: nowIso,
    })
    .eq('id', campaign.id);

  // Log activity
  await logOutreachActivity({
    campaignId: campaign.id,
    recruiterContactId: campaign.recruiter_contact_id,
    messageId: messageId,
    activityType: 'followup_scheduled',
    title: `Follow-up #${followupNumber} Scheduled`,
    details: {
      scheduled_at: scheduledDate.toISOString(),
      status,
      auto_approved: autoApprove,
    },
  });

  return created;
}

/**
 * List follow-up schedules for current user.
 */
export async function listFollowupSchedules() {
  const { db, user } = await authenticatedDatabase();
  const { data, error } = await db
    .from('followup_schedules')
    .select('*, email_messages(subject, status, campaign_id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

/**
 * Cancel a specific follow-up schedule.
 */
export async function cancelFollowupSchedule(scheduleId: string, reason?: string) {
  const { db, user } = await authenticatedDatabase();

  const { data: schedule } = await db
    .from('followup_schedules')
    .select('id, campaign_id, message_id')
    .eq('id', scheduleId)
    .eq('user_id', user.id)
    .single();

  const { data, error } = await db
    .from('followup_schedules')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('user_id', user.id)
    .in('status', ['pending', 'approved'])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel follow-up schedule: ${error.message}`);
  }

  if (schedule?.campaign_id) {
    await db
      .from('outreach_campaigns')
      .update({ next_followup_at: null, updated_at: new Date().toISOString() })
      .eq('id', schedule.campaign_id);

    await logOutreachActivity({
      campaignId: schedule.campaign_id,
      messageId: schedule.message_id,
      activityType: 'followup_cancelled',
      title: 'Follow-up Cancelled',
      details: { reason: reason || 'Cancelled by user' },
    });
  }

  return { success: true, schedule: data, reason };
}

/**
 * Cancels all active follow-up schedules for a given campaign (e.g. when reply received, paused, completed).
 */
export async function cancelAllCampaignFollowups(
  campaignId: string,
  reason: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbOverride?: any,
  userIdOverride?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let uid = userIdOverride;

  if (dbOverride) {
    db = dbOverride;
  } else {
    const auth = await authenticatedDatabase();
    db = auth.db;
    uid = auth.user.id;
  }

  // Find all messages in this campaign
  const { data: msgs } = await db
    .from('email_messages')
    .select('id')
    .eq('campaign_id', campaignId);

  const messageIds = (msgs || []).map((m: { id: string }) => m.id);
  if (messageIds.length === 0) return;

  await db
    .from('followup_schedules')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .in('message_id', messageIds)
    .in('status', ['pending', 'approved', 'claimed']);

  await db
    .from('outreach_campaigns')
    .update({
      next_followup_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  await logOutreachActivity({
    userId: uid,
    campaignId,
    activityType: 'followup_cancelled',
    title: 'Pending Follow-ups Cancelled',
    details: { reason },
    clientOverride: { db, user: { id: uid } },
  });
}

/**
 * Approve a pending follow-up schedule so it is eligible to be processed when due.
 */
export async function approveFollowupSchedule(scheduleId: string) {
  const { db, user } = await authenticatedDatabase();

  const { data, error } = await db
    .from('followup_schedules')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Schedule not found or not in pending status');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatedRecord = data as any;
  if (updatedRecord.campaign_id) {
    await logOutreachActivity({
      campaignId: updatedRecord.campaign_id,
      messageId: updatedRecord.message_id,
      activityType: 'followup_approved',
      title: `Follow-up #${updatedRecord.followup_number || 1} Approved`,
      details: { scheduled_at: updatedRecord.scheduled_at },
    });
  }

  return data;
}
