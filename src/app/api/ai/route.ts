import { NextResponse } from 'next/server';
import { demoEnabled } from '@/lib/demo';
import { routeAITask } from '@/services/ai-router';
import { extractResumeFromStorage } from '@/services/resume-extraction';
import { authenticatedDatabase } from '@/services/applications';
import { aiTaskRequestSchema, type AITaskName } from '@/lib/ai-schemas';

const routerRequestSchema = aiTaskRequestSchema;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = routerRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: `Invalid AI task request: ${parsed.error.issues[0]?.message}` },
        { status: 400 },
      );
    }

    const { task, applicationId, resumeId, payload: explicitPayload, ...restProps } = parsed.data;
    // Merge explicit payload or any top-level properties passed by clients
    const payload = (explicitPayload && Object.keys(explicitPayload).length > 0 ? explicitPayload : restProps) as Record<string, unknown>;

    // In demo mode: return deterministic simulated result
    if (demoEnabled) {
      const response = await routeAITask(task as AITaskName, payload, { isDemo: true });
      return NextResponse.json({ ok: true, data: response.data, metadata: response.metadata, provider: response.provider });
    }

    // In production mode: enforce authenticated user
    const { user } = await authenticatedDatabase();

    // Special handling for resume_extract when resumeId is supplied
    if (task === 'resume_extract' && resumeId) {
      const extracted = await extractResumeFromStorage(resumeId);
      return NextResponse.json({
        ok: true,
        data: extracted,
        metadata: {
          modelOrAgent: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
          completedAt: new Date().toISOString(),
          requiresApproval: true,
        },
        provider: 'gemini',
      });
    }

    const response = await routeAITask(task as AITaskName, payload, {
      isDemo: false,
      userId: user.id,
      applicationId,
    });

    return NextResponse.json({ ok: true, data: response.data, metadata: response.metadata, provider: response.provider });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI task processing failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
