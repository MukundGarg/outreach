import { NextResponse } from 'next/server';
import { authenticatedDatabase } from '@/services/applications';
import { getGmailConnectionStatus } from '@/services/gmail-oauth';
import { demoEnabled } from '@/lib/demo';

export async function GET() {
  if (demoEnabled) {
    return NextResponse.json({
      ok: true,
      data: {
        connected: false,
        email: null,
        scopes: [],
        expiresAt: null,
        mode: 'demo',
      },
    });
  }

  try {
    const { user } = await authenticatedDatabase();
    const status = await getGmailConnectionStatus(user.id);
    return NextResponse.json({ ok: true, data: status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve connection status';
    return NextResponse.json({ ok: false, error: msg }, { status: 401 });
  }
}
