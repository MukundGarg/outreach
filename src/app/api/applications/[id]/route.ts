import { NextResponse } from 'next/server';
import { z } from 'zod';
import { demoEnabled } from '@/lib/demo';
import { applicationStatuses, type ApplicationStatus } from '@/lib/domain';
import { getApplication, transitionApplication } from '@/services/applications';

const transitionSchema = z.object({
  status: z.enum(applicationStatuses),
  approved: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (demoEnabled) {
    return NextResponse.json({ error: 'Demo data lives only in this browser.' }, { status: 409 });
  }
  try {
    const { id } = await params;
    const application = await getApplication(id);
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    return NextResponse.json({ data: application });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to load application';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (demoEnabled) {
    return NextResponse.json({ error: 'Use the isolated demo workspace.' }, { status: 409 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid transition request' }, { status: 400 });
    }

    const updated = await transitionApplication(id, parsed.data.status as ApplicationStatus, {
      approved: parsed.data.approved,
    });
    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transition failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
