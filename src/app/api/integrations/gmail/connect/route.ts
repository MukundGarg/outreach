import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { authenticatedDatabase } from '@/services/applications';
import { generateGoogleAuthUrl } from '@/services/gmail-oauth';

export async function GET() {
  try {
    const { user } = await authenticatedDatabase();

    // Create a random CSRF state token bound to the authenticated user ID
    const randomNonce = crypto.randomBytes(16).toString('hex');
    const state = `${user.id}:${randomNonce}`;

    const authUrl = generateGoogleAuthUrl(state);

    // Set HTTP-only cookie with state for verification in callback
    const response = NextResponse.json({ ok: true, authUrl });
    response.cookies.set('gmail_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to initiate Gmail connection';
    return NextResponse.json({ ok: false, error: msg }, { status: 401 });
  }
}
