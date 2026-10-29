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

### Milestone 03: Live Integration Testing + Secure Gmail OAuth + User-Approved Sending (Completed)
- Live verification of Google Gemini (`gemini-3.5-flash-lite`) across extraction, job analysis, screening answers, and opt-out reply classification.
- Live verification of Dify Agent 1 and Agent 2 via streaming SSE parser, validating structured responses and stop/suppression conditions.
- Secure Gmail OAuth 2.0 connection flow with minimal scopes (`gmail.send` + `userinfo.email`), CSRF state validation, and identity verification.
- AES-256-GCM token encryption at rest with random IVs and integrity tags using `GMAIL_TOKEN_ENCRYPTION_KEY`.
- Database migration `202610300001_gmail_oauth_sending.sql` for connections, suppression status, and email messages.
- Authoritative backend candidate profile and recruiter contact retrieval in `ai-router.ts`.
- RFC 5322 MIME message formatting with UTF-8 base64 subjects and base64url encoding.
- User-approved sending pipeline with mandatory confirmation dialog, SHA-256 content fingerprinting, opt-out suppression blocking, and idempotency key protection.
- Extended Outreach UI with Gmail connect/disconnect, draft saving to Supabase, Dify draft generation, and send confirmation dialog.
- 25 automated unit/integration tests passed (`npm test`), strict TypeScript and ESLint verified, and production build succeeded.

## Upcoming milestones

1. **Task 04: Follow-up Scheduling & Inbox Reply Monitoring.**
   - Persistent UTC/timezone-aware schedules, weekend rules, automatic cancellation on reply.
   - Background worker claims/retries, thread reconciliation.
   - Incremental OAuth consent for `gmail.readonly` and inbox monitoring for replies.
2. **Task 05: Supported Form Assistance.**
   - User-initiated preparation and explicit submission approvals on supported sites.
   - Stop at login/CAPTCHA/restrictions; zero unauthorized scraping or automation.

## Before any public deployment

Exercise actual Auth and redirects, RLS and Storage policies, rate limiting, security headers, accessible keyboard/mobile flows, dependency audit and production observability without private payload logging. Browser end-to-end tests and integration tests should grow with real persistence. Do not expand feature count until the authenticated workflow is reliable.
