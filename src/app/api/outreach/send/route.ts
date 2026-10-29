import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticatedDatabase } from '@/services/applications';
import { sendUserApprovedEmail } from '@/services/gmail-sender';
import { demoEnabled } from '@/lib/demo';

const sendEmailRequestSchema = z.object({
  contactId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  approvalConfirmed: z.literal(true), // Strictly requires true
  operationKey: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  // 1. Strict restriction: demo mode cannot send real emails
  if (demoEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Sending real emails is disabled in demo mode. Please sign in with an authenticated account.',
      },
      { status: 403 },
    );
  }

  try {
    const { db, user } = await authenticatedDatabase();
    const json = await request.json();
    const parsed = sendEmailRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid send request: ${parsed.error.issues[0]?.message}`,
        },
        { status: 400 },
      );
    }

    const {
      contactId,
      campaignId: explicitCampaignId,
      recipientEmail,
      subject,
      body,
      approvalConfirmed,
      operationKey,
    } = parsed.data;

    // Resolve campaignId if not explicitly provided
    let campaignId = explicitCampaignId;
    if (!campaignId) {
      const { data: existingCamp } = await db
        .from('outreach_campaigns')
        .select('id')
        .eq('recruiter_contact_id', contactId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingCamp) {
        campaignId = existingCamp.id;
      } else {
        const { data: newCamp, error: campErr } = await db
          .from('outreach_campaigns')
          .insert({
            user_id: user.id,
            recruiter_contact_id: contactId,
            status: 'draft',
          })
          .select('id')
          .single();

        if (campErr || !newCamp) {
          throw new Error('Failed to resolve outreach campaign for contact.');
        }
        campaignId = newCamp.id;
      }
    }

    // Execute user-approved sending
    const result = await sendUserApprovedEmail({
      campaignId,
      contactId,
      recipientEmail,
      subject,
      body,
      approvalConfirmed,
      operationKey,
    });

    return NextResponse.json({
      ok: true,
      data: result,
      message: `Email successfully sent to ${recipientEmail} via Gmail.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send email';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
