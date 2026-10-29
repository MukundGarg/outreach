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

## Browser checks

After building, run `npx playwright install chromium` once on a standard workstation, then `npm run test:e2e`. If Chromium or Google Chrome is already installed, select its executable:
```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
```
The suite starts a local production server and tests routes, local editing, mock boundaries, mobile navigation, and API boundary isolation.

## Supabase setup & migrations

1. Create a Supabase project. Apply `supabase/migrations/202610290001_foundation.sql` using the Supabase SQL editor or CLI migration tool.
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

| Variable                               | Purpose                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_DEMO_MODE`                | `true` for sample workspace; `false` for Supabase mode |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public project URL, needed for Auth/database           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public project key, protected by RLS                   |
| `LYZR_MODE`                            | Only `mock` supported                                  |
| `LYZR_API_KEY`                         | Future server-only Lyzr credential                     |
| `LYZR_CANDIDATE_AGENT_ID`              | Independent Candidate Intelligence agent               |
| `LYZR_OUTREACH_AGENT_ID`               | Independent Application & Outreach agent               |
| `LYZR_RESPONSE_AGENT_ID`               | Independent Recruiter Response agent                   |

## Limitations

This milestone focuses on authenticated data persistence and private file storage. Live external Lyzr execution, Gmail sending/OAuth token vaults, background follow-up dispatchers, and automated web form submissions remain deferred to future tasks. Application submission transitions require explicit manual user approval, ensuring no external side-effects happen autonomously.
