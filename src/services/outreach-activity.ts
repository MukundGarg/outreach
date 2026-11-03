import 'server-only';
import { authenticatedDatabase } from './applications';

export type OutreachActivityType =
  | 'initial_drafted'
  | 'initial_approved'
  | 'initial_sent'
  | 'initial_failed'
  | 'followup_scheduled'
  | 'followup_approved'
  | 'followup_sent'
  | 'followup_failed'
  | 'reply_received'
  | 'reply_classified'
  | 'followup_paused'
  | 'followup_resumed'
  | 'followup_cancelled'
  | 'contact_opted_out'
  | 'outreach_completed';

export interface OutreachActivity {
  id: string;
  user_id: string;
  campaign_id: string;
  recruiter_contact_id: string | null;
  message_id: string | null;
  activity_type: OutreachActivityType;
  title: string;
  details: Record<string, unknown>;
  created_at: string;
}

export async function logOutreachActivity(params: {
  userId?: string;
  campaignId: string;
  recruiterContactId?: string | null;
  messageId?: string | null;
  activityType: OutreachActivityType;
  title: string;
  details?: Record<string, unknown>;
  clientOverride?: unknown;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let uid = params.userId;

  if (params.clientOverride) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db = (params.clientOverride as any).db || params.clientOverride;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uid = uid || (params.clientOverride as any).user?.id;
  } else {
    const auth = await authenticatedDatabase();
    db = auth.db;
    uid = uid || auth.user.id;
  }

  if (!uid) return null;

  try {
    const { data, error } = await db
      .from('outreach_activities')
      .insert({
        user_id: uid,
        campaign_id: params.campaignId,
        recruiter_contact_id: params.recruiterContactId ?? null,
        message_id: params.messageId ?? null,
        activity_type: params.activityType,
        title: params.title,
        details: params.details || {},
      })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[OutreachActivity] Non-fatal log failure (table may not exist in live DB yet):', error.message);
      return null;
    }
    return data;
  } catch (err: unknown) {
    console.warn('[OutreachActivity] Log catch (non-fatal):', err);
    return null;
  }
}

export async function listCampaignActivities(campaignId: string) {
  const { db, user } = await authenticatedDatabase();
  try {
    const { data, error } = await db
      .from('outreach_activities')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
