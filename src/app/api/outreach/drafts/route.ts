import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticatedDatabase } from '@/services/applications';
import { calculateContentHash } from '@/lib/email-utils';
import { demoEnabled } from '@/lib/demo';

const draftSaveSchema = z.object({
  contactId: z.string().uuid(),
  draftId: z.string().uuid().optional(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  applicationId: z.string().uuid().optional(),
  approved: z.boolean().optional(),
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

    const { contactId, draftId, subject, body, applicationId, approved } = parsed.data;

    // Verify contact ownership and non-suppression
    const { data: contact, error: cErr } = await db
      .from('recruiter_contacts')
      .select('id, email, name, is_suppressed, suppression_reason')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single();

    if (cErr || !contact) {
      return NextResponse.json({ ok: false, error: 'Recruiter contact not found' }, { status: 404 });
    }

    if (approved && contact.is_suppressed) {
      return NextResponse.json(
        { ok: false, error: `Cannot approve draft: Recruiter contact is marked as OPT-OUT / SUPPRESSED (${contact.suppression_reason || 'Opt-out'}).` },
        { status: 400 },
      );
    }

    // Upsert or retrieve active campaign for this contact
    let campaignId: string;
    const { data: existingCampaign } = await db
      .from('outreach_campaigns')
      .select('id, status')
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
        .select('id, status')
        .single();

      if (campErr || !newCamp) {
        throw new Error(`Failed to initialize campaign: ${campErr?.message}`);
      }
      campaignId = newCamp.id;
    }

    // 1. Requirement 1: Prevent a new approved email from being created/approved for a campaign
    // while an earlier transmission has an uncertain outcome (sending or RECONCILIATION_REQUIRED).
    const { data: uncertainTransmission } = await db
      .from('email_messages')
      .select('id, status, send_error_category')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .or('status.eq.sending,send_error_category.eq.RECONCILIATION_REQUIRED')
      .limit(1)
      .maybeSingle();

    if (uncertainTransmission) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Cannot save or approve draft: An earlier email transmission for this campaign has an uncertain delivery outcome and requires reconciliation before any new attempt.',
        },
        { status: 409 },
      );
    }

    // Calculate content hash
    const cleanRecipient = contact.email.toLowerCase().trim();
    const contentHash = calculateContentHash(cleanRecipient, subject, body);
    const approvedAt = approved ? new Date().toISOString() : null;
    const targetStatus = approved ? 'approved' : 'draft';

    // 2. Locate draft: if draftId is explicitly provided, look up that exact draft; otherwise find latest draft/approved
    let existingDraftQuery = db
      .from('email_messages')
      .select('id, idempotency_key, status')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id);

    if (draftId) {
      existingDraftQuery = existingDraftQuery.eq('id', draftId);
    } else {
      existingDraftQuery = existingDraftQuery
        .in('status', ['draft', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: existingDraft } = await existingDraftQuery.maybeSingle();

    let draftMessageId: string;
    let draftCreatedAt: string;
    let stableIdempotencyKey: string;

    if (existingDraft) {
      // Requirement 2: Conditional update on status IN ('draft', 'approved').
      // Concurrent save must never change a message from 'sending' back to 'approved'.
      const { data: updated, error: updateErr } = await db
        .from('email_messages')
        .update({
          subject,
          body,
          recipient_email: cleanRecipient,
          status: targetStatus,
          approved_at: approvedAt,
          approved_content_hash: approved ? contentHash : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDraft.id)
        .eq('user_id', user.id)
        .in('status', ['draft', 'approved']) // Strict optimistic concurrency check
        .select('id, created_at, status, idempotency_key')
        .single();

      if (updateErr || !updated) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Failed to update draft: message transmission may already be in progress or its outcome is uncertain.',
          },
          { status: 409 },
        );
      }
      draftMessageId = updated.id;
      draftCreatedAt = updated.created_at;
      stableIdempotencyKey = updated.idempotency_key;
    } else {
      const { data: inserted, error: msgErr } = await db
        .from('email_messages')
        .insert({
          user_id: user.id,
          campaign_id: campaignId,
          recipient_email: cleanRecipient,
          subject,
          body,
          status: targetStatus,
          approved_at: approvedAt,
          approved_content_hash: approved ? contentHash : null,
          direction: 'outbound',
        })
        .select('id, created_at, status, idempotency_key')
        .single();

      if (msgErr || !inserted) {
        throw new Error(`Failed to save draft message: ${msgErr?.message}`);
      }
      draftMessageId = inserted.id;
      draftCreatedAt = inserted.created_at;
      stableIdempotencyKey = inserted.idempotency_key;
    }

    // 3. Requirement 3: Guard campaign state transitions
    // When a draft is approved, ensure campaign reflects awaiting_approval if currently draft
    if (approved) {
      const { data: campCurrent } = await db
        .from('outreach_campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();

      if (campCurrent && campCurrent.status === 'draft') {
        const { error: campUpdateErr } = await db
          .from('outreach_campaigns')
          .update({ status: 'awaiting_approval' })
          .eq('id', campaignId);

        if (campUpdateErr) {
          throw new Error(`Failed to update campaign state to awaiting_approval: ${campUpdateErr.message}`);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        draftId: draftMessageId,
        campaignId,
        createdAt: draftCreatedAt,
        status: targetStatus,
        approvedAt,
        approvedContentHash: approved ? contentHash : null,
        idempotencyKey: stableIdempotencyKey,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save draft';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
