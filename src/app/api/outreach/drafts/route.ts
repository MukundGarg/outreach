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

    // Save or update draft email message (prevent uncontrolled duplicate drafts)
    const { data: existingDraft } = await db
      .from('email_messages')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let draftMessageId: string;
    let draftCreatedAt: string;

    if (existingDraft) {
      const { data: updated, error: updateErr } = await db
        .from('email_messages')
        .update({
          subject,
          body,
          recipient_email: contact.email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDraft.id)
        .eq('user_id', user.id)
        .select('id, created_at, status')
        .single();

      if (updateErr || !updated) {
        throw new Error(`Failed to update draft message: ${updateErr?.message}`);
      }
      draftMessageId = updated.id;
      draftCreatedAt = updated.created_at;
    } else {
      const { data: inserted, error: msgErr } = await db
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

      if (msgErr || !inserted) {
        throw new Error(`Failed to save draft message: ${msgErr?.message}`);
      }
      draftMessageId = inserted.id;
      draftCreatedAt = inserted.created_at;
    }

    return NextResponse.json({
      ok: true,
      data: {
        draftId: draftMessageId,
        campaignId,
        createdAt: draftCreatedAt,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save draft';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
