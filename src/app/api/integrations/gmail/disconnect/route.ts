import { NextResponse } from 'next/server';
import { authenticatedDatabase } from '@/services/applications';
import { disconnectGmailConnection } from '@/services/gmail-oauth';

export async function POST() {
  try {
    const { user } = await authenticatedDatabase();
    await disconnectGmailConnection(user.id);
    return NextResponse.json({ ok: true, message: 'Gmail disconnected successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to disconnect Gmail';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
