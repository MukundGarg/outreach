import { NextRequest, NextResponse } from 'next/server';
import { runOutreachAutomationCycle } from '@/services/outreach-worker';

export const runtime = 'nodejs';

/**
 * Scheduled worker endpoint for processing due follow-ups and polling Gmail replies.
 * Protected by OUTREACH_WORKER_SECRET header/bearer token or authenticated session.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const workerSecretHeader = req.headers.get('x-worker-secret') || '';
    const expectedSecret = process.env.OUTREACH_WORKER_SECRET;

    let isAuthorized = false;

    // 1. Secret token auth (for external cron like Upstash, GitHub Actions, or Vercel Cron)
    if (expectedSecret && (workerSecretHeader === expectedSecret || authHeader === `Bearer ${expectedSecret}`)) {
      isAuthorized = true;
    } else {
      // 2. Authenticated user trigger (for testing / manual run from workspace UI)
      try {
        const { authenticatedDatabase } = await import('@/services/applications');
        const { user } = await authenticatedDatabase();
        if (user) {
          isAuthorized = true;
          // Run for this specific authenticated user
          const result = await runOutreachAutomationCycle({ userId: user.id });
          return NextResponse.json({ ok: true, data: result });
        }
      } catch {
        // Not authenticated as user
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ ok: false, error: 'Unauthorized: Missing or invalid worker secret' }, { status: 401 });
    }

    // Run global automation cycle across connected accounts
    const result = await runOutreachAutomationCycle();
    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Worker execution failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

