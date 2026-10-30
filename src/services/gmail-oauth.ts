import { authenticatedDatabase } from './applications';
import { encryptToken, decryptToken } from '@/lib/encryption';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Minimum necessary scopes: sending emails via Gmail API + userinfo.email for identity verification
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
export const REQUIRED_GMAIL_SCOPES = [GMAIL_SEND_SCOPE, USERINFO_EMAIL_SCOPE];

export interface GmailConnectionStatus {
  connected: boolean;
  email: string | null;
  scopes: string[];
  expiresAt: string | null;
}

/**
 * Generates an official Google OAuth 2.0 authorization URL with state CSRF protection.
 */
export function generateGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Google OAuth credentials (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_REDIRECT_URI) are not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: REQUIRED_GMAIL_SCOPES.join(' '),
    access_type: 'offline', // Requests refresh_token
    prompt: 'consent',       // Ensures refresh_token is returned
    state,
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchanges authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string[];
}> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth client configuration is missing');
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const scopes = (data.scope || '').split(' ').filter(Boolean);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
    scopes,
  };
}

/**
 * Fetches verified email for connected Google account using userinfo.email scope.
 */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to verify Google account identity (${res.status})`);
  }

  const data = await res.json();
  if (!data.email) {
    throw new Error('Google account returned no email address');
  }

  return data.email;
}

/**
 * Refreshes an expired access token using the stored encrypted refresh token.
 */
export async function refreshAccessToken(refreshTokenPlain: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshTokenPlain,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to refresh Google access token (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export async function getValidAccessTokenForUser(
  userId: string,
  dbClient?: SupabaseClient<Database> | unknown,
): Promise<{ accessToken: string; senderEmail: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (dbClient as any) || (await authenticatedDatabase()).db;

  const { data: conn, error } = await db
    .from('gmail_oauth_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !conn) {
    throw new Error('No Gmail account connected. Please connect your Gmail account in Outreach.');
  }

  const now = new Date();
  const expiresAt = new Date(conn.token_expires_at);

  // If token expires in less than 2 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 120000) {
    if (!conn.encrypted_refresh_token) {
      throw new Error('Gmail token expired and no refresh token available. Please reconnect Gmail.');
    }

    const refreshTokenPlain = decryptToken(conn.encrypted_refresh_token);
    const refreshed = await refreshAccessToken(refreshTokenPlain);

    const newEncryptedAccess = encryptToken(refreshed.accessToken);
    const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();

    await db
      .from('gmail_oauth_connections')
      .update({
        encrypted_access_token: newEncryptedAccess,
        token_expires_at: newExpiresAt,
      })
      .eq('user_id', userId);

    return { accessToken: refreshed.accessToken, senderEmail: conn.email };
  }

  const decryptedAccess = decryptToken(conn.encrypted_access_token);
  return { accessToken: decryptedAccess, senderEmail: conn.email };
}

/**
 * Stores or updates encrypted OAuth credentials for the authenticated user.
 */
export async function saveGmailConnection(params: {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string[];
}) {
  const { db } = await authenticatedDatabase();
  const encryptedAccess = encryptToken(params.accessToken);
  const encryptedRefresh = params.refreshToken ? encryptToken(params.refreshToken) : null;
  const tokenExpiresAt = new Date(Date.now() + params.expiresIn * 1000).toISOString();

  // Upsert on user_id
  const { error } = await db.from('gmail_oauth_connections').upsert(
    {
      user_id: params.userId,
      email: params.email,
      encrypted_access_token: encryptedAccess,
      ...(encryptedRefresh ? { encrypted_refresh_token: encryptedRefresh } : {}),
      token_expires_at: tokenExpiresAt,
      scopes: params.scopes,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
}

/**
 * Returns connection status without exposing tokens.
 */
export async function getGmailConnectionStatus(userId: string): Promise<GmailConnectionStatus> {
  const { db } = await authenticatedDatabase();

  const { data: conn, error } = await db
    .from('gmail_oauth_connections')
    .select('email, scopes, token_expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !conn) {
    return { connected: false, email: null, scopes: [], expiresAt: null };
  }

  return {
    connected: true,
    email: conn.email,
    scopes: conn.scopes || [],
    expiresAt: conn.token_expires_at,
  };
}

/**
 * Disconnects Gmail account and deletes stored credentials.
 */
export async function disconnectGmailConnection(userId: string) {
  const { db } = await authenticatedDatabase();
  const { error } = await db.from('gmail_oauth_connections').delete().eq('user_id', userId);
  if (error) throw error;
}
