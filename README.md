# ApplyPilot AI

A calm career workspace for applications, candidate profiles, and thoughtful recruiter outreach. This MVP foundation runs without credentials in **explicitly labeled demo mode**. It never submits applications or sends messages.

## Stack

Next.js App Router, strict TypeScript, React, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, Zod, React Hook Form, Lucide, and Recharts. Node 22+ (validated using Node 24). The committed lockfile fixes compatible dependency versions.

## Run locally

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open the development server on port 3000. `/` is the landing page; `/dashboard` opens the sample workspace. `.env.local` is ignored. Demo mode defaults to enabled when `NEXT_PUBLIC_DEMO_MODE` is absent. Set it explicitly in deployments; public flags are compiled at build time, so rebuild after changing them.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

## Demo mode

All sample records are fictional and visibly labeled. Profile edits, preferences, new drafts, and application status history persist in **sessionStorage**, scoped to the browser tab/session. Reset them in Settings. Do not enter private information in a public demonstration. Charts derive from the local pipeline. Historical email/reply counts are fixed fictional metrics, not evidence of external activity. Sample job links point to example.com.

Resume selection previews file metadata only; bytes are not uploaded or extracted. Follow-up settings provide a UTC date calculation, not a persistent background schedule. Mock agent responses are deterministic and clearly labeled. Disabled integration buttons explain what is unavailable.

## Browser checks

After building, run `npx playwright install chromium` once on a standard workstation, then `npm run test:e2e`. If Chromium is already installed, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`. The suite starts a local production server and tests routes, local editing, mock boundaries and mobile navigation.

## Supabase setup

1. Create a Supabase project. Apply `supabase/migrations/202610290001_foundation.sql` using the SQL editor or your Supabase CLI migration workflow.
2. Enable email/password Auth. Configure your application URL and `/auth/callback` redirect URL in Supabase Auth settings.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to your project's public URL and publishable key. No service-role key is needed or accepted by this app.
4. Set `NEXT_PUBLIC_DEMO_MODE=false`, rebuild, and sign up. Confirm your email if required by project policy.
5. Authenticated mode currently shows an honest account-connected screen. `/api/applications` supports authenticated listing and draft creation; remaining database-backed UI is the next milestone. It does not silently fall back to sample records.

Supabase credentials and a live database were not supplied for this task. Migration execution, two-user RLS checks, email delivery, and live Auth must be validated against your project before production use. See `docs/SCHEMA.md`.

## Environment

| Variable                               | Purpose                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_DEMO_MODE`                | `true` for sample workspace; `false` for Auth boundary |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public project URL, needed for Auth/database           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public project key, protected by RLS                   |
| `LYZR_MODE`                            | Only `mock` supported                                  |
| `LYZR_API_KEY`                         | Future server-only Lyzr credential                     |
| `LYZR_CANDIDATE_AGENT_ID`              | Independent Candidate Intelligence agent               |
| `LYZR_OUTREACH_AGENT_ID`               | Independent Application & Outreach agent               |
| `LYZR_RESPONSE_AGENT_ID`               | Independent Recruiter Response agent                   |

No Lyzr or Gmail credentials are needed for the demo. Do not prefix credentials with `NEXT_PUBLIC_`. There are no guessed Lyzr endpoints or live adapters. Non-demo production execution rejects mock agent calls; live execution is unavailable even with IDs configured.

## Limitations

This is a foundation, not application or email automation. Production profile/preferences/outreach persistence, verified resume ingestion, approval UI, live Lyzr adapters, Gmail OAuth/token encryption, scheduling, reply monitoring, and form assistance are incomplete. Unique operation keys prepare for deduplication but do not provide exactly-once remote delivery. No plaintext OAuth tokens are stored. Accessibility and responsive layouts are implemented; automated browser/device coverage is documented in HANDOFF.
