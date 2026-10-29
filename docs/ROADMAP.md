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

## Upcoming milestones

1. **Task 02: Verified Lyzr Transport & Agent Integration.**
   - Review official API contracts for candidate, outreach, and response agents.
   - Implement typed server adapter schemas, run provenance, timeouts, and user-reviewed outputs. No assumed endpoints.
2. **Task 03: Gmail OAuth & Manual Approved Sending.**
   - Secure encrypted token lifecycle, minimum scopes, disconnect/revocation.
   - Explicit preview/approval, atomic idempotency claim, and provider outcome reconciliation.
3. **Task 04: Scheduling & Reply Monitoring.**
   - Persistent UTC/timezone-aware schedules, weekend rules, cancellation on reply.
   - Safe worker claims/retries, thread reconciliation, human-reviewed reply classification.
4. **Task 05: Supported Form Assistance.**
   - User-initiated preparation and explicit submission approvals on supported sites.
   - Stop at login/CAPTCHA/restrictions; zero unauthorized scraping or automation.

## Before any public deployment

Exercise actual Auth and redirects, RLS and Storage policies, rate limiting, security headers, accessible keyboard/mobile flows, dependency audit and production observability without private payload logging. Browser end-to-end tests and integration tests should grow with real persistence. Do not expand feature count until the authenticated workflow is reliable.
