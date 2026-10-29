# Roadmap

## Completed foundation

- Responsive landing, authentication UI and all requested workspace screens.
- Credential-free, labeled local demo; editable profile/preferences, application creation/filter/detail/history, chart, export and outreach previews.
- Strict domain schemas, state transition helpers, deterministic three-agent adapter contract.
- Supabase server Auth structure, cookie refresh, callback/logout and authenticated application list/create API.
- Ten-entity SQL migration, RLS, private resume bucket, audit triggers and unique operation keys.
- Server-only integration interfaces and follow-up date utility.

## Suggested next prompts

1. **Connect authenticated persistence.** Apply/verify migration in disposable Supabase, test two-user RLS, add generated DB types, connect profile/preferences/application UI, implement validated resume upload/private retrieval. Keep demo provider independent. Add explicit production approval record and status-change API with transactional audit tests.
2. **Verified Lyzr transport.** Obtain actual official API contracts for three configured agents; implement server adapter/response schemas, run provenance, timeout/error handling and user-reviewed outputs. No assumed endpoints.
3. **Gmail OAuth and manual approved sending.** Secure encrypted token lifecycle, minimum scopes, disconnect/revocation, explicit preview/approval, atomic idempotency claim and provider outcome reconciliation. Start with a single approved email, not automation.
4. **Scheduling and reply monitoring.** Persistent UTC/timezone-aware schedules, weekend rules, cancellation on reply, safe worker claims/retries, thread reconciliation, human-reviewed reply classification.
5. **Supported form assistance.** User-initiated preparation and explicit submission approvals on supported sites; stop at login/CAPTCHA/restrictions. Never add unauthorized LinkedIn automation.

## Before any public deployment

Exercise actual Auth and redirects, RLS and Storage policies, rate limiting, security headers, accessible keyboard/mobile flows, dependency audit and production observability without private payload logging. Browser end-to-end tests and integration tests should grow with real persistence. Do not expand feature count until the authenticated workflow is reliable.
