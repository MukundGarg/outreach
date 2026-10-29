import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listContacts, createContact, deleteContact } from '@/services/applications';
import { demoEnabled } from '@/lib/demo';

const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  company: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
});

export async function GET() {
  if (demoEnabled) {
    return NextResponse.json({ ok: true, data: [] });
  }

  try {
    const contacts = await listContacts();
    return NextResponse.json({ ok: true, data: contacts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve recruiter contacts';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (demoEnabled) {
    return NextResponse.json(
      { ok: false, error: 'Cannot create contacts in demo mode through this API endpoint.' },
      { status: 400 },
    );
  }

  try {
    const json = await request.json();
    const parsed = createContactSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: `Invalid contact data: ${parsed.error.issues[0]?.message}` },
        { status: 400 },
      );
    }

    const contact = await createContact(parsed.data);
    return NextResponse.json({ ok: true, data: contact });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create recruiter contact';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (demoEnabled) {
    return NextResponse.json(
      { ok: false, error: 'Cannot delete contacts in demo mode through this API endpoint.' },
      { status: 400 },
    );
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing contact id parameter' }, { status: 400 });
    }

    await deleteContact(id);
    return NextResponse.json({ ok: true, message: 'Contact deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete contact';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
