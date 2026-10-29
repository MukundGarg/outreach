import { NextResponse } from 'next/server';
import { demoEnabled } from '@/lib/demo';
import { getProfile, upsertProfile } from '@/services/applications';

export async function GET() {
  if (demoEnabled) {
    return NextResponse.json({ error: 'Demo data lives only in this browser.' }, { status: 409 });
  }
  try {
    const profile = await getProfile();
    return NextResponse.json({ data: profile });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to load profile';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  if (demoEnabled) {
    return NextResponse.json({ error: 'Use the isolated demo workspace.' }, { status: 409 });
  }
  try {
    const body = await request.json();
    const profile = await upsertProfile(body);
    return NextResponse.json({ data: profile }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid profile payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
