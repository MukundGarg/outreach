# Roadmap

## Completed foundation

- Responsive landing, authentication UI and all requested workspace screens.
- Credential-free, labeled local demo; editable profile/preferences, application creation/filter/detail/history, chart, export and outreach previews.
- Strict domain schemas, state transition helpers, deterministic three-agent adapter contract.
- Supabase server Auth structure, cookie refresh, callback/logout and authenticated application list/create API.
- Ten-entity SQL migration, RLS, private resume bucket, audit triggers and unique operation keys.
- Server-only integration interfaces and follow-up date utility.

## Completed milestones

### Milestone 01: Authenticated Persistence & Private Resume Upload (Completed)
- Clean provider separation: Isolated local demo (`sessionStorage`) and production Supabase-backed workspace.
- Production workspace connecting all screens with loading, empty, error, and retry states.
- Authenticated, user-scoped persistence for profile, preferences, job applications, transition history, and recruiter contacts.
- Strict mapping between frontend domain schemas and PostgreSQL tables with explicit serializers/deserializers.
- Secure private PDF resume upload (max 10 MB, `%PDF-` buffer validation, user-scoped storage path, signed short-lived download URLs, and safe replacement/deletion).
- Explicit candidate review and approval requirement for application stage transitions to submitted or active pipeline.
- 9 passing unit/domain tests, 5 passing Playwright smoke tests, and reproducible integration script for disposable Supabase projects.

### Milestone 02: Hybrid Gemini + Dify AI Integration (Completed)
- Integrated official `@google/genai` SDK for Google Gemini tasks: structured resume PDF parsing via `pdf-parse`, job description qualification analysis, candidate-job matching, and recruiter reply classification with opt-out detection.
- Integrated Dify API for deep workflow intelligence: Agent 1 (Application Intelligence for form mapping & screening questions) and Agent 2 (Outreach Intelligence for personalized emails, follow-up delay calculation, and stop/suppression recommendations).
- Implemented explicit TypeScript AI Task Router (`src/services/ai-router.ts`) dispatching tasks with safe execution logging in `agent_runs`.
- Interactive UI controls: "Analyze Resume" with editable modal preview in `ProfileForm`, "Analyze Job" & "Prepare Application" in `Applications`, and "Generate Recruiter Email" & "Classify Message" in `Outreach`.
- Complete demo mode preservation: Deterministic mock fixtures (`src/lib/ai-mocks.ts`) with zero network overhead in demo mode.
- 17 unit tests passed (`npm test`), strict TypeScript and ESLint verified, and production build succeeded.

## Upcoming milestones

1. **Task 03: Gmail OAuth & Manual Approved Sending.**
   - Secure encrypted token lifecycle, minimum scopes, disconnect/revocation.
   - Explicit preview/approval, atomic idempotency claim, and provider outcome reconciliation.
   - Opt-out suppression enforcement during message generation and sending.
3. **Task 04: Scheduling & Reply Monitoring.**
   - Persistent UTC/timezone-aware schedules, weekend rules, cancellation on reply.
   - Safe worker claims/retries, thread reconciliation, human-reviewed reply classification.
4. **Task 05: Supported Form Assistance.**
   - User-initiated preparation and explicit submission approvals on supported sites.
   - Stop at login/CAPTCHA/restrictions; zero unauthorized scraping or automation.

## Before any public deployment

Exercise actual Auth and redirects, RLS and Storage policies, rate limiting, security headers, accessible keyboard/mobile flows, dependency audit and production observability without private payload logging. Browser end-to-end tests and integration tests should grow with real persistence. Do not expand feature count until the authenticated workflow is reliable.
