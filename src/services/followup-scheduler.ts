import 'server-only';
import { authenticatedDatabase } from '@/services/applications';
import { nextFollowup } from '@/lib/domain';

export interface FollowupScheduleRecord {
  id: string;
  message_id: string;
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
 * Schedule a follow-up for a sent email message.
 * Follows strict safety rules:
 * 1. Initial email message must be owned and in 'sent' status.
 * 2. Delay must be between 1 and 30 business/calendar days.
 * 3. Does not permit duplicate active pending/approved schedules for the same message.
 * 4. Recruiter contact must not be suppressed.
 */
export async function scheduleFollowup({
  messageId,
  delayDays = 3,
  skipWeekends = true,
  autoApprove = false,
}: {
  messageId: string;
  delayDays?: number;
  skipWeekends?: boolean;
  autoApprove?: boolean;
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

  // 2. Fetch campaign and recruiter contact to verify not suppressed
  const { data: campaign, error: campError } = await db
    .from('outreach_campaigns')
    .select('id, recruiter_contact_id')
    .eq('id', message.campaign_id)
    .single();

  if (campError || !campaign) {
    throw new Error('Associated campaign not found');
  }

  const { data: contact } = await db
    .from('recruiter_contacts')
    .select('id, is_suppressed, suppression_reason')
    .eq('id', campaign.recruiter_contact_id)
    .single();

  if (contact?.is_suppressed) {
    throw new Error(`Cannot schedule follow-up: Recruiter contact is suppressed (${contact.suppression_reason || 'Opted out'})`);
  }

  // 3. Check for existing active schedules for this message
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
 * Cancel a follow-up schedule (e.g. user manually cancels or recipient replied/opted-out).
 */
export async function cancelFollowupSchedule(scheduleId: string, reason?: string) {
  const { db, user } = await authenticatedDatabase();

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

  return { success: true, schedule: data, reason };
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
    })
    .eq('id', scheduleId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Schedule not found or not in pending status');
  }

  return data;
}
