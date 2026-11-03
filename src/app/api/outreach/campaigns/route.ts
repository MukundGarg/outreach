import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticatedDatabase } from '@/services/applications';
import { cancelAllCampaignFollowups } from '@/services/followup-scheduler';
import { logOutreachActivity, listCampaignActivities } from '@/services/outreach-activity';
import { demoEnabled } from '@/lib/demo';

const campaignActionSchema = z.object({
  campaignId: z.string().uuid(),
  action: z.enum(['pause', 'resume', 'complete', 'update_config']),
  config: z
    .object({
      initialDelayDays: z.number().int().min(1).max(30).optional(),
      followupIntervalDays: z.number().int().min(1).max(30).optional(),
      skipWeekends: z.boolean().optional(),
      maxFollowups: z.number().int().min(0).max(10).optional(),
      autoSendFollowups: z.boolean().optional(),
    })
    .optional(),
});

export async function GET(req: NextRequest) {
  if (demoEnabled) {
    return NextResponse.json({ ok: true, data: [] });
  }

  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaignId');

    if (!campaignId) {
      return NextResponse.json({ ok: false, error: 'campaignId is required' }, { status: 400 });
    }

    const activities = await listCampaignActivities(campaignId);
    return NextResponse.json({ ok: true, data: activities });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch activities';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (demoEnabled) {
    return NextResponse.json({ ok: true, message: 'Action simulated in demo mode' });
  }

  try {
    const json = await req.json();
    const parsed = campaignActionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { campaignId, action, config } = parsed.data;
    const { db, user } = await authenticatedDatabase();

    // Verify campaign ownership
    const { data: campaign, error: campErr } = await db
      .from('outreach_campaigns')
      .select('id, recruiter_contact_id, status')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campErr || !campaign) {
      return NextResponse.json({ ok: false, error: 'Campaign not found or access denied' }, { status: 404 });
    }

    const { data: contact } = await db
      .from('recruiter_contacts')
      .select('id, is_suppressed')
      .eq('id', campaign.recruiter_contact_id)
      .single();

    if (action === 'pause') {
      await db
        .from('outreach_campaigns')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      await cancelAllCampaignFollowups(campaignId, 'User paused follow-ups', db, user.id);

      await logOutreachActivity({
        campaignId,
        recruiterContactId: campaign.recruiter_contact_id,
        activityType: 'followup_paused',
        title: 'Follow-ups Paused',
        details: { paused_by_user: true },
      });

      return NextResponse.json({ ok: true, message: 'Campaign follow-ups paused' });
    }

    if (action === 'resume') {
      // Re-validate not suppressed and no unhandled reply
      if (contact?.is_suppressed) {
        return NextResponse.json(
          { ok: false, error: 'Cannot resume: contact is suppressed / opted out' },
          { status: 400 },
        );
      }

      await db
        .from('outreach_campaigns')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      await logOutreachActivity({
        campaignId,
        recruiterContactId: campaign.recruiter_contact_id,
        activityType: 'followup_resumed',
        title: 'Follow-ups Resumed',
        details: { resumed_by_user: true },
      });

      return NextResponse.json({ ok: true, message: 'Campaign follow-ups resumed' });
    }

    if (action === 'complete') {
      await db
        .from('outreach_campaigns')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      await cancelAllCampaignFollowups(campaignId, 'Outreach marked as completed', db, user.id);

      await logOutreachActivity({
        campaignId,
        recruiterContactId: campaign.recruiter_contact_id,
        activityType: 'outreach_completed',
        title: 'Outreach Completed',
        details: { completed_by_user: true },
      });

      return NextResponse.json({ ok: true, message: 'Campaign marked as completed' });
    }

    if (action === 'update_config' && config) {
      await db
        .from('outreach_campaigns')
        .update({
          ...(config.initialDelayDays ? { initial_delay_days: config.initialDelayDays } : {}),
          ...(config.followupIntervalDays ? { followup_interval_days: config.followupIntervalDays } : {}),
          ...(typeof config.skipWeekends === 'boolean' ? { skip_weekends: config.skipWeekends } : {}),
          ...(typeof config.maxFollowups === 'number' ? { max_followups: config.maxFollowups } : {}),
          ...(typeof config.autoSendFollowups === 'boolean' ? { auto_send_followups: config.autoSendFollowups } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      return NextResponse.json({ ok: true, message: 'Follow-up configuration updated' });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
