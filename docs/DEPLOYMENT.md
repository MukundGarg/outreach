# ApplyPilot AI — Production Deployment Guide

This guide covers deploying ApplyPilot AI to **Vercel** with **Supabase Database, Auth, and Storage**, along with Google OAuth (Gmail API), Google Gemini, and Dify integrations.

---

## 1. Prerequisites & Architecture Overview

ApplyPilot AI is built as a single, unified Next.js App Router project:
- **Frontend / API**: Next.js App Router (Node.js server runtime for authenticated operations, crypto, and Gmail API).
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) enabled on all tables, and Supabase Auth (`auth.users`).
- **File Storage**: Supabase Storage private bucket `resumes` (`<user_id>/<file_id>.pdf`).
- **AI Processing**: Google Gemini (`@google/genai`) and Dify Agents (`Dify Agent 1` and `Dify Agent 2`).
- **Email Sending**: Official Google OAuth 2.0 with Gmail API (`https://www.googleapis.com/auth/gmail.send`), using AES-256-GCM encrypted refresh tokens stored server-side.

---

## 2. Environment Variables Checklist

Configure the following variables in **Vercel Project Settings > Environment Variables**:

| Variable | Description | Exposed to Browser? | Example / Format |
|---|---|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | Set to `false` for authenticated production mode | Yes (`NEXT_PUBLIC_`) | `false` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes (`NEXT_PUBLIC_`) | `https://xyzcompany.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable anonymous key | Yes (`NEXT_PUBLIC_`) | `sb_publishable_...` |
| `GEMINI_API_KEY` | Google Gemini API Key | **NO (Server-only)** | `AIzaSy...` |
| `DIFY_API_BASE_URL` | Base URL for Dify API | **NO (Server-only)** | `https://api.dify.ai/v1` |
| `DIFY_APPLICATION_API_KEY` | Dify API key for Agent 1 (Application Intelligence) | **NO (Server-only)** | `app-...` |
| `DIFY_OUTREACH_API_KEY` | Dify API key for Agent 2 (Recruiter Outreach) | **NO (Server-only)** | `app-...` |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud OAuth Client ID | **NO (Server-only)** | `123...apps.googleusercontent.com` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud OAuth Client Secret | **NO (Server-only)** | `GOCSPX-...` |
| `GOOGLE_OAUTH_REDIRECT_URI` | Production OAuth Callback URL | **NO (Server-only)** | `https://your-domain.vercel.app/api/integrations/gmail/callback` |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | 32-byte (64 hex characters) encryption key for tokens | **NO (Server-only)** | 64-character hexadecimal string |

> [!IMPORTANT]
> **Zero Secrets in Browser**: Never prefix `GEMINI_API_KEY`, `DIFY_*`, `GOOGLE_OAUTH_*`, or `GMAIL_TOKEN_ENCRYPTION_KEY` with `NEXT_PUBLIC_`. These are server-only secrets used in secure Node.js API routes.

---

## 3. Supabase Database & Migration Setup

Run the migrations in sequential order against your Supabase database:
1. `supabase/migrations/202610290001_foundation.sql` (Creates `candidate_profiles`, `candidate_preferences`, `resumes`, `job_applications`, `application_events`, and RLS policies).
2. `supabase/migrations/202610300001_gmail_oauth_sending.sql` (Creates `recruiter_contacts`, `outreach_campaigns`, `email_messages`, `gmail_tokens`, `followup_schedules`, unique idempotency keys, and RLS policies).

### Storage Bucket Configuration:
- Create private bucket: `resumes`
- Set RLS policies: Users can only upload, read, and delete their own files under path `<auth.uid()>/*`.

### Supabase Auth URL Configuration:
- Navigate to **Supabase Dashboard > Authentication > URL Configuration**.
- **Site URL**: `https://your-domain.vercel.app`
- **Redirect URLs**:
  - `https://your-domain.vercel.app/auth/callback`
  - `https://your-domain.vercel.app/**`

---

## 4. Google Cloud Console OAuth Configuration

1. In **Google Cloud Console > APIs & Services > Credentials**:
   - Ensure **Gmail API** is enabled.
   - Authorized JavaScript origins: `https://your-domain.vercel.app`
   - Authorized redirect URIs: `https://your-domain.vercel.app/api/integrations/gmail/callback`
2. **OAuth Consent Screen**:
   - Scopes: `https://www.googleapis.com/auth/gmail.send`
   - While in Testing mode, add candidate tester email addresses to **Test users**.

---

## 5. Deployment Steps on Vercel

1. Push your latest verified branch to GitHub:
   ```bash
   git push origin main
   ```
2. In Vercel:
   - Click **Add New Project** and select `MukundGarg/outreach`.
   - Framework Preset: **Next.js**.
   - Input the Environment Variables listed in Section 2.
   - Click **Deploy**.

---

## 6. Post-Deployment Smoke Test Checklist

- [ ] **Auth Smoke Test**: Visit `/signup` or `/login`. Sign in and confirm redirect to `/dashboard`.
- [ ] **RLS Isolation Test**: Verify candidate profile, application history, and contacts load only for the signed-in user.
- [ ] **Outreach Draft Persistence**:
  1. Open `/outreach`.
  2. Select recruiter contact.
  3. Edit subject and body.
  4. Click **Save Draft to Database**.
  5. Refresh browser — confirm subject and body persist accurately.
- [ ] **Google OAuth Connect**: Click **Connect Gmail**, authorize, and verify green badge shows `Connected: your-email@gmail.com`.
- [ ] **Approval Safety Check**: Confirm the "Approve & Send via Gmail" button is strictly disabled until the candidate explicitly reviews and checks the human approval checkbox.
- [ ] **Send Verification**: Send an approved message to a controlled test email; confirm Supabase records `status: 'sent'` and Gmail message ID.
