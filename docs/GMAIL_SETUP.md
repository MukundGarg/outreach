# Gmail API & OAuth 2.0 Configuration Guide

This guide provides step-by-step instructions for configuring Google Cloud Console OAuth 2.0 credentials and setting up user-approved Gmail sending for ApplyPilot AI.

---

## 1. Google Cloud Console Setup

### Step 1: Open Google Cloud Console
1. Navigate to [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with your Google account.
3. In the project dropdown at the top, select an existing project or click **New Project** (e.g. `ApplyPilot-Outreach`).

### Step 2: Enable the Gmail API
1. In the navigation menu (left sidebar), select **APIs & Services** > **Library**.
2. Search for `Gmail API`.
3. Select **Gmail API** and click **Enable**.

### Step 3: Configure OAuth Consent Screen
1. In the left sidebar, navigate to **APIs & Services** > **OAuth consent screen**.
2. Select **User Type**:
   - For private testing/development: Choose **External**.
3. Fill in required application details:
   - **App name**: `ApplyPilot AI`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. **Scopes Configuration**:
   - Click **Add or Remove Scopes**.
   - Filter and select:
     - `https://www.googleapis.com/auth/gmail.send` (Send email on your behalf)
     - `https://www.googleapis.com/auth/userinfo.email` (View your email address)
   - *Note: Do NOT add `gmail.readonly` or full mailbox read access at this stage; inbox monitoring is isolated to Task 04 with incremental consent.*
   - Click **Update** and **Save and Continue**.
6. **Test Users (Crucial for External / Testing status)**:
   - Under **Test users**, click **Add Users**.
   - Add the Gmail account you will use to test sending.
   - *Note: While the app is in "Testing" mode, only registered test users can connect via Google OAuth without encountering an "Access Blocked: Authorization Error".*
7. Click **Save and Continue** and return to dashboard.

### Step 4: Create OAuth 2.0 Credentials
1. In the left sidebar, navigate to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** at the top > select **OAuth client ID**.
3. Under **Application type**, select **Web application**.
4. Set **Name**: `ApplyPilot Web Client`.
5. Under **Authorized JavaScript origins**:
   - Add: `http://localhost:3000`
   - (For production, add your domain: `https://your-domain.com`)
6. Under **Authorized redirect URIs**:
   - Add: `http://localhost:3000/api/integrations/gmail/callback`
   - (For production: `https://your-domain.com/api/integrations/gmail/callback`)
7. Click **Create**.
8. A modal will display your **Client ID** and **Client Secret**. Copy both values.

---

## 2. Server Environment Setup

### Step 1: Generate Encryption Secret
OAuth access and refresh tokens are encrypted at rest using AES-256-GCM before storage in Supabase. Generate a cryptographically secure 32-byte key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Update `.env.local`
Add the credentials to your local `.env.local` file (never commit `.env.local` to Git):

```env
# Gmail OAuth Credentials
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/gmail/callback

# Token Encryption Secret (64 hex characters = 32 bytes)
GMAIL_TOKEN_ENCRYPTION_KEY=your-generated-64-char-hex-key
```

### Step 3: Run Database Migrations
Ensure the forward-only migration for Gmail connections and email sending metadata is applied to your Supabase project:

- Migration file: `supabase/migrations/202610300001_gmail_oauth_sending.sql`
- Run via Supabase CLI (`supabase db push`) or execute the SQL file directly in the Supabase Dashboard SQL Editor.

---

## 3. Testing the Gmail Flow

1. Restart the Next.js development server:
   ```bash
   npm run dev
   ```
2. Navigate to the Outreach screen: `http://localhost:3000/outreach`.
3. In authenticated mode (with `NEXT_PUBLIC_DEMO_MODE=false`), click **Connect Gmail**.
4. You will be redirected to Google's consent screen. Approve the requested permissions.
5. Upon redirect back to `/outreach?status=connected`, verify that:
   - The status badge shows **Connected**.
   - Your connected Gmail address is visible.
6. Generate or edit a draft. Click **Approve Draft**, then **Approve & Send**.
7. Review the modal showing exact recipient, subject, and body before clicking **Confirm & Send via Gmail**.

---

## 4. Troubleshooting Common Errors

### `redirect_uri_mismatch`
- **Cause**: The redirect URI in the request does not exactly match one of the authorized redirect URIs registered in Google Cloud Console.
- **Fix**: Verify that `GOOGLE_OAUTH_REDIRECT_URI` in `.env.local` exactly matches an entry under **Authorized redirect URIs** in Google Cloud Console (including protocol, port, and trailing slash).

### `access_denied` / `403: org_internal`
- **Cause**: The application is in "Testing" mode and the connecting Google account has not been added as an authorized test user.
- **Fix**: Open **APIs & Services** > **OAuth consent screen** > **Test users**, add the email address, and re-attempt.

### `invalid_grant` during token refresh
- **Cause**: The user revoked access, or the refresh token expired/was invalidated (in testing mode, refresh tokens for unverified apps expire after 7 days).
- **Fix**: Click **Disconnect Gmail** in ApplyPilot and reconnect to obtain a fresh refresh token.

### Scopes and Verification
- **App verification**: When transitioning from Testing to Production mode, requesting sensitive scopes such as `https://www.googleapis.com/auth/gmail.send` requires Google OAuth App Verification. During the hackathon/pilot stage, keeping the app in **Testing** status with registered test users avoids the verification review timeline.
