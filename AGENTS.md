# ApplyPilot AI development contract

Preserve working behavior. Inspect callers and existing tests before changing code. Extend this single Next.js App Router app; do not replace the UI or introduce another backend, queue framework, or speculative infrastructure. Each cloud task is isolated: use the existing checkout, do not create a worktree unless explicitly requested.

## Responsibilities

- `src/app`: routes, layouts, server actions and HTTP boundaries.
- `src/components`: reusable/feature React UI. DemoProvider is local-only state, never a production repository.
- `src/lib/domain.ts`: Zod inputs, typed states, allowed transitions, date utilities.
- `src/lib/demo.ts`: fictional fixtures and explicit demo flag.
- `src/lib/supabase`: server-only request-scoped clients. Never put service-role keys in browser bundles.
- `src/services`: server business/data access, typed agent adapter and integration contracts.
- `supabase/migrations`: append-only schema history. Never edit an already-deployed migration; add another.
- `tests`: Node test runner through tsx; meaningful domain and boundary cases.
- `docs`: architecture, schema, scope and truthful handoff.

## Rules

Strict TypeScript. Validate all untrusted server input using Zod. Use Supabase `auth.getUser()` for authorization, not unverified cookie contents. Keep RLS enabled. Never log tokens, raw resumes, or private messages. Use private Storage paths `<auth-user-id>/<random-file-id>.pdf`. No service-role queries in user request flows. No secrets in Git, fixtures, error text, or saved scripts.

Keep demo data visibly labeled and separate from authenticated data. Do not claim sample events are actual submissions or sends. Do not silently use mocks for non-demo production processing. Lyzr agents have independent IDs and typed contracts; implement live transport only from verified official API documentation supplied for the actual service. Do not guess endpoint/schema details.

Submissions and outbound emails must require explicit user approval. Preserve valid transition graphs in both TypeScript and SQL. Future workers must atomically claim a unique operation key and reconcile ambiguous provider outcomes before retrying. Never bypass CAPTCHA, authentication or website restrictions; no LinkedIn scraping or mass email automation. Store future OAuth refresh tokens only using managed encryption/vault with restricted server access.

Prefer native elements and existing dependencies. Keep UI, server services, DB access, AI adapters and integrations separated without duplicating abstractions. Use `npm ci` with the committed lockfile. Avoid broad version changes unless compatibility/security requires them.

## Validation

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` after meaningful changes. Exercise affected routes and interactions. Add checks for new state/security/business branches. For database changes run migrations in a disposable Supabase database and verify two-user RLS isolation, Storage access, constraints and audit triggers. Report skipped/unavailable tests explicitly; do not substitute compilation for functional validation. Keep HANDOFF and ROADMAP current. No live email/form automation in this phase.
