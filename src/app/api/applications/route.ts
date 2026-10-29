import { NextResponse } from 'next/server';
import { demoEnabled } from '@/lib/demo';
import { createApplication, listApplications } from '@/services/applications';
export async function GET() {
  if (demoEnabled)
    return NextResponse.json({ error: 'Demo data lives only in this browser.' }, { status: 409 });
  try {
    const { data, error } = await listApplications();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: 'Unable to load applications; sign in and verify database setup.' },
      { status: 401 },
    );
  }
}
export async function POST(request: Request) {
  if (demoEnabled)
    return NextResponse.json({ error: 'Use the isolated demo workspace.' }, { status: 409 });
  try {
    const { data, error } = await createApplication(await request.json());
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request or authenticated database unavailable.' },
      { status: 400 },
    );
  }
}
