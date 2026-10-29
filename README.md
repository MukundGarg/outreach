# ApplyPilot AI

A calm career workspace for applications, candidate profiles, and thoughtful recruiter outreach. This MVP foundation runs without credentials in **explicitly labeled demo mode**. It never submits applications or sends messages.

## Stack

Next.js App Router, strict TypeScript, React, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, Zod, React Hook Form, Lucide, and Recharts. Node 22+ (validated using Node 25). The committed lockfile fixes compatible dependency versions.

## Run locally

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open the development server on port 3000. `/` is the landing page; `/dashboard` opens the workspace. Demo mode defaults to enabled when `NEXT_PUBLIC_DEMO_MODE` is absent. Set `NEXT_PUBLIC_DEMO_MODE=false` in `.env.local` to enable full Supabase-backed authenticated persistence. Public flags are compiled at build time, so rebuild after changing them.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

## Demo mode

All sample records are fictional and visibly labeled. Profile edits, preferences, new drafts, and application status history persist in **sessionStorage**, scoped to the browser tab/session. Reset them in Settings. Do not enter private information in a public demonstration. Charts derive from the local pipeline. Historical email/reply counts are fixed fictional metrics, not evidence of external activity. Sample job links point to example.com.

In demo mode, resume selection previews file metadata only without server upload. Follow-up settings provide a UTC date calculation, not a persistent background schedule. Mock agent responses are deterministic and clearly labeled. Disabled integration buttons explain what is unavailable.

## Authenticated mode & persistence

When `NEXT_PUBLIC_DEMO_MODE=false`:
- Authenticated users access the real interactive workspace directly backed by Supabase.
- Candidate profiles and job preferences persist in `profiles` and `candidate_preferences` tables.
- Job applications, draft creation, and status transitions persist in `job_applications` with automatic immutable audit history in `application_events`.
- Transitioning to `submitted` or active pipeline stages requires explicit candidate approval in the application workspace before database records update.
- Authenticated PDF resumes (max 10 MB) upload to the private `resumes` Supabase Storage bucket with metadata recorded in the `resumes` table. Secure authorized downloads use short-lived signed URLs.

## Hybrid AI Engine (Google Gemini + Dify)

ApplyPilot AI implements a dual-engine architecture:
- **Google Gemini (`@google/genai`)**:
  - Structured PDF resume extraction (`resume_extract`) parsed server-side via `pdf-parse`. Extracted details are previewed in an interactive modal for candidate review before updating the profile.
  - Job description analysis (`job_analyze`) with match scoring, matched requirements, missing skills, and role level detection.
  - Recruiter reply classification (`reply_classify`) distinguishing interview invitations, rejections, positive interest, and explicit opt-outs.
  - Basic screening question drafting (`simple_answer`).
- **Dify AI Applications**:
  - **Agent 1 (Application Intelligence)**: Form field mappings, screening question analysis with supporting evidence citations, and unresolved questions list.
  - **Agent 2 (Outreach Intelligence)**: Context-aware personalized recruiter emails, business-day follow-up intervals, and explicit `stop` recommendations on opt-out.
- **AI Task Router (`src/services/ai-router.ts`)**:
  - Strongly typed task router enforcing strict Zod validation.
  - Execution metadata safely audited to `agent_runs` without logging raw resumes or confidential communications.
  - Demo mode returns deterministic mock fixtures with zero API calls.
  - Explicit user approval is enforced on all AI-generated drafts. No application or email is sent autonomously.

## Browser checks

After building, run `npx playwright install chromium` once on a standard workstation, then `npm run test:e2e`. If Chromium or Google Chrome is already installed, select its executable:
```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
```
The suite starts a local production server and tests routes, local editing, mock boundaries, mobile navigation, and API boundary isolation.

## Gmail OAuth 2.0 & User-Approved Sending

ApplyPilot AI connects securely to Gmail via Google OAuth 2.0:
- **Official Authorization Code Flow**: `/api/integrations/gmail/connect` initiates Google OAuth with CSRF state cookies and minimal necessary scopes (`gmail.send` + `userinfo.email`). Mailbox reading is intentionally excluded until Task 04.
- **AES-256-GCM Token Encryption**: Tokens are encrypted at rest with random 96-bit IVs and 128-bit authentication tags using `GMAIL_TOKEN_ENCRYPTION_KEY`.
- **Mandatory Human Approval**: Every email transmission requires explicit human confirmation via modal dialog showing sender, recipient, subject, and body.
- **Content Fingerprinting**: SHA-256 fingerprinting prevents transmission if the draft content was modified after approval.
- **Opt-Out Suppression**: Recruiter contacts flagged as `is_suppressed` unconditionally block outbound transmission.
- **Official Gmail API**: Transmits RFC 5322 MIME messages via `users.messages.send` and records Gmail message IDs.
- For complete Google Cloud Console setup instructions, see [docs/GMAIL_SETUP.md](docs/GMAIL_SETUP.md).

## Supabase setup & migrations

1. Create a Supabase project. Apply migrations in order:
   - `supabase/migrations/202610290001_foundation.sql` (Initial tables, RLS, storage buckets)
   - `supabase/migrations/202610300001_gmail_oauth_sending.sql` (Gmail OAuth connections, contact suppression, sending metadata)
2. Enable email/password Auth. Configure your application URL and `/auth/callback` redirect URL in Supabase Auth settings.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. No service-role key is needed or accepted by this app.
4. Set `NEXT_PUBLIC_DEMO_MODE=false`, build, and sign in.
5. To test two-user RLS isolation and private storage isolation on a disposable Supabase project:
```sh
TEST_SUPABASE_URL="https://your-project.supabase.co" \
TEST_SUPABASE_ANON_KEY="your-publishable-key" \
npx tsx tests/integration-supabase.ts
```

## Environment

| Variable                               | Purpose                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_DEMO_MODE`                | `true` for sample workspace; `false` for Supabase mode                  |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public project URL, needed for Auth/database                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public project key, protected by RLS                                    |
| `GEMINI_API_KEY`                       | Google Gemini API key for structured extraction & reply classification  |
| `GEMINI_MODEL`                         | Google Gemini model identifier (e.g. `gemini-3.5-flash-lite`)           |
| `DIFY_API_BASE_URL`                    | Dify API base URL (e.g. `https://api.dify.ai/v1`)                       |
| `DIFY_APPLICATION_API_KEY`             | Dify Application Intelligence Agent 1 API key                           |
| `DIFY_OUTREACH_API_KEY`                | Dify Outreach Intelligence Agent 2 API key                              |
| `GOOGLE_OAUTH_CLIENT_ID`               | Google Cloud OAuth 2.0 Web Application Client ID                        |
| `GOOGLE_OAUTH_CLIENT_SECRET`           | Google Cloud OAuth 2.0 Web Application Client Secret                    |
| `GOOGLE_OAUTH_REDIRECT_URI`           | Google OAuth redirect callback URL                                      |
| `GMAIL_TOKEN_ENCRYPTION_KEY`           | 32-byte hex key for AES-256-GCM token encryption at rest                |

## Limitations & Scope

Milestone 03 delivers verified live AI generation, secure Gmail OAuth 2.0 connection, AES-256-GCM encrypted token storage, and user-approved email dispatch via Gmail API. Background cron follow-up scheduling, automated inbox monitoring (`gmail.readonly`), and browser form automation remain deferred to Tasks 04 and 05. All outbound emails require explicit human confirmation in the UI modal.

