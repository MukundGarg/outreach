import { NextResponse } from 'next/server';
import { demoEnabled } from '@/lib/demo';
import { getPreferences, upsertPreferences } from '@/services/applications';

export async function GET() {
  if (demoEnabled) {
    return NextResponse.json({ error: 'Demo data lives only in this browser.' }, { status: 409 });
  }
  try {
    const prefs = await getPreferences();
    return NextResponse.json({ data: prefs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to load preferences';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  if (demoEnabled) {
    return NextResponse.json({ error: 'Use the isolated demo workspace.' }, { status: 409 });
  }
  try {
    const body = await request.json();
    const prefs = await upsertPreferences(body);
    return NextResponse.json({ data: prefs }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid preferences payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
