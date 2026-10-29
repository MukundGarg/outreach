import { NextResponse } from 'next/server';
import { demoEnabled } from '@/lib/demo';
import { getLatestResume, uploadResume, deleteResume } from '@/services/resumes';

export async function GET() {
  if (demoEnabled) {
    return NextResponse.json({ error: 'Demo mode uses local previews.' }, { status: 409 });
  }
  try {
    const resume = await getLatestResume();
    return NextResponse.json({ data: resume });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to fetch resume';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  if (demoEnabled) {
    return NextResponse.json({ error: 'Demo mode uses local previews.' }, { status: 409 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    const result = await uploadResume(file);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (demoEnabled) {
    return NextResponse.json({ error: 'Demo mode uses local previews.' }, { status: 409 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Resume id is required' }, { status: 400 });
    }
    await deleteResume(id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Deletion failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
