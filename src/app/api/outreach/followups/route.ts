import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  scheduleFollowup,
  listFollowupSchedules,
  cancelFollowupSchedule,
  approveFollowupSchedule,
} from '@/services/followup-scheduler';

const scheduleSchema = z.object({
  messageId: z.string().uuid(),
  delayDays: z.number().int().min(1).max(30).default(3),
  skipWeekends: z.boolean().default(true),
  autoApprove: z.boolean().default(false),
});

const actionSchema = z.object({
  scheduleId: z.string().uuid(),
  action: z.enum(['approve', 'cancel']),
  reason: z.string().max(200).optional(),
});

export async function GET() {
  try {
    const schedules = await listFollowupSchedules();
    return NextResponse.json({ ok: true, data: schedules });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch follow-up schedules';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = scheduleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const created = await scheduleFollowup(parsed.data);
    return NextResponse.json({ ok: true, data: created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to schedule follow-up';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid action parameters', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    if (parsed.data.action === 'approve') {
      const updated = await approveFollowupSchedule(parsed.data.scheduleId);
      return NextResponse.json({ ok: true, data: updated });
    } else {
      const cancelled = await cancelFollowupSchedule(
        parsed.data.scheduleId,
        parsed.data.reason
      );
      return NextResponse.json({ ok: true, data: cancelled });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
