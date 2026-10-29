import { NextResponse } from 'next/server';
import { authenticatedDatabase } from '@/services/applications';
import { demoEnabled } from '@/lib/demo';

export async function GET(request: Request) {
  if (demoEnabled) {
    return NextResponse.json({ ok: true, data: [] });
  }

  try {
    const { db, user } = await authenticatedDatabase();
    const url = new URL(request.url);
    const contactId = url.searchParams.get('contactId');

    let query = db
      .from('email_messages')
      .select('id, campaign_id, recipient_email, subject, body, status, sent_at, created_at, gmail_message_id, gmail_thread_id, send_error_category')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (contactId) {
      // Find campaigns associated with this contact
      const { data: camps } = await db
        .from('outreach_campaigns')
        .select('id')
        .eq('recruiter_contact_id', contactId)
        .eq('user_id', user.id);

      const campaignIds = (camps || []).map((c) => c.id);
      if (campaignIds.length > 0) {
        query = query.in('campaign_id', campaignIds);
      } else {
        return NextResponse.json({ ok: true, data: [] });
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve messages';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
