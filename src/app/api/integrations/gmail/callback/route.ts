import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authenticatedDatabase } from '@/services/applications';
import {
  exchangeCodeForTokens,
  fetchGoogleUserEmail,
  saveGmailConnection,
} from '@/services/gmail-oauth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const outreachRedirect = new URL('/outreach', request.url);

  if (errorParam) {
    outreachRedirect.searchParams.set('gmail_error', `Google OAuth error: ${errorParam}`);
    return NextResponse.redirect(outreachRedirect);
  }

  if (!code || !state) {
    outreachRedirect.searchParams.set('gmail_error', 'Missing authorization code or state');
    return NextResponse.redirect(outreachRedirect);
  }

  try {
    const { user } = await authenticatedDatabase();

    // Verify state cookie
    const cookieStore = await cookies();
    const storedState = cookieStore.get('gmail_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      outreachRedirect.searchParams.set('gmail_error', 'Invalid or expired OAuth state parameter (CSRF protection)');
      return NextResponse.redirect(outreachRedirect);
    }

    // Verify user ID prefix in state matches authenticated session
    const [stateUserId] = state.split(':');
    if (stateUserId !== user.id) {
      outreachRedirect.searchParams.set('gmail_error', 'OAuth state user mismatch');
      return NextResponse.redirect(outreachRedirect);
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Fetch verified email from Google userinfo API
    const googleEmail = await fetchGoogleUserEmail(tokens.accessToken);

    // Save encrypted tokens to Supabase
    await saveGmailConnection({
      userId: user.id,
      email: googleEmail,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scopes: tokens.scopes,
    });

    outreachRedirect.searchParams.set('gmail_connected', googleEmail);
    const response = NextResponse.redirect(outreachRedirect);
    response.cookies.delete('gmail_oauth_state');
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to complete Gmail connection';
    outreachRedirect.searchParams.set('gmail_error', msg);
    return NextResponse.redirect(outreachRedirect);
  }
}
