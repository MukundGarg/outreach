import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticatedDatabase } from '@/services/applications';
import { demoEnabled } from '@/lib/demo';

const draftSaveSchema = z.object({
  contactId: z.string().uuid(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  applicationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  if (demoEnabled) {
    return NextResponse.json({
      ok: true,
      message: 'Draft saved in demo mode (local state).',
    });
  }

  try {
    const { db, user } = await authenticatedDatabase();
    const json = await request.json();
    const parsed = draftSaveSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: `Invalid draft payload: ${parsed.error.issues[0]?.message}` },
        { status: 400 },
      );
    }

    const { contactId, subject, body, applicationId } = parsed.data;

    // Verify contact ownership
    const { data: contact, error: cErr } = await db
      .from('recruiter_contacts')
      .select('id, email, name')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single();

    if (cErr || !contact) {
      return NextResponse.json({ ok: false, error: 'Recruiter contact not found' }, { status: 404 });
    }

    // Upsert or retrieve active campaign for this contact
    let campaignId: string;
    const { data: existingCampaign } = await db
      .from('outreach_campaigns')
      .select('id')
      .eq('recruiter_contact_id', contactId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingCampaign) {
      campaignId = existingCampaign.id;
    } else {
      const { data: newCamp, error: campErr } = await db
        .from('outreach_campaigns')
        .insert({
          user_id: user.id,
          recruiter_contact_id: contactId,
          application_id: applicationId || null,
          status: 'draft',
        })
        .select('id')
        .single();

      if (campErr || !newCamp) {
        throw new Error(`Failed to initialize campaign: ${campErr?.message}`);
      }
      campaignId = newCamp.id;
    }

    // Save draft email message
    const { data: draftMessage, error: msgErr } = await db
      .from('email_messages')
      .insert({
        user_id: user.id,
        campaign_id: campaignId,
        recipient_email: contact.email,
        subject,
        body,
        status: 'draft',
        direction: 'outbound',
      })
      .select('id, created_at, status')
      .single();

    if (msgErr || !draftMessage) {
      throw new Error(`Failed to save draft message: ${msgErr?.message}`);
    }

    return NextResponse.json({
      ok: true,
      data: {
        draftId: draftMessage.id,
        campaignId,
        createdAt: draftMessage.created_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save draft';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
