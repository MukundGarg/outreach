import { NextResponse } from 'next/server';
import { z } from 'zod';
import { demoEnabled } from '@/lib/demo';
import { applicationStatuses, type ApplicationStatus } from '@/lib/domain';
import { getApplication, transitionApplication, saveApplicationPreparation } from '@/services/applications';

const patchSchema = z.union([
  z.object({
    type: z.literal('preparation'),
    preparation: z.object({
      screeningAnswers: z.record(z.string(), z.string()).optional(),
      unresolvedAnswers: z.record(z.string(), z.string()).optional(),
      emailSubject: z.string().optional(),
      emailBody: z.string().optional(),
      jobDescription: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('transition').optional(),
    status: z.enum(applicationStatuses),
    approved: z.boolean().optional(),
  }),
]);

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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    if ('type' in parsed.data && parsed.data.type === 'preparation') {
      const updated = await saveApplicationPreparation(id, parsed.data.preparation);
      return NextResponse.json({ data: updated });
    }

    const updated = await transitionApplication(id, parsed.data.status as ApplicationStatus, {
      approved: parsed.data.approved,
    });
    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
