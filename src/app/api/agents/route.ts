import { NextResponse } from 'next/server';
import { demoEnabled } from '@/lib/demo';
import { agentInputSchema, runAgent } from '@/services/agents';
import { authenticatedDatabase } from '@/services/applications';
export async function POST(request: Request) {
  try {
    if (!demoEnabled) await authenticatedDatabase();
    const input = agentInputSchema.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: 'Invalid agent input' }, { status: 400 });
    const data = await runAgent(input.data);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: 'Agent unavailable. Check configuration and authentication.' },
      { status: 503 },
    );
  }
}
