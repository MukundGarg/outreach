# ApplyPilot AI — implementation handoff

## Exact status

The previously empty repository now contains a single Next.js App Router application. All requested screens exist. The complete interactive workflow is currently an isolated **demo**. Authentication and database structure are prepared, but the real-user workspace is not yet wired to those repositories. Do not present the app as a production automation service.

### Working now

- Original sage/ivory dashboard, responsive sidebar and mobile navigation, public landing and login/signup pages.
- Dashboard metrics, pipeline chart, recent sample activity, upcoming sample follow-ups and JSON export.
- React Hook Form/Zod profile editor; validated preferences form. Session-scoped persistence with schema validation and graceful fallback when storage is unavailable.
- Searchable/filterable applications, local draft creation, details, valid state transitions and local event history. Reload preserves local drafts in the same session.
- Recruiter selection, sample email previews, deterministic mock agent endpoint. Disabled sends clearly explain that no email was sent.
- Local PDF metadata preview, UTC weekend-skipping follow-up preview, reset demo action.
- Server Auth actions, PKCE callback, logout, session-refresh proxy and independently authenticated application list/create services. Demo mode explicitly refuses database operations at its application API.
- SQL migration for ten entities with ownership RLS, composite owner FKs, private PDF bucket, workflow guards, audit events, approval fields and unique operation keys.
- Typed interfaces for three agents and all deferred integrations. No guessed external endpoints.

### Intentionally incomplete

- Live Supabase project, migration execution, live signup/login, two-user RLS/Storage verification.
- Production profile/preferences/outreach UI and durable status-change API. Non-demo authenticated users see an account-connected screen, not fake account data.
- Actual resume upload, extraction, profile verification and signed private downloads.
- Actual Lyzr execution. Mock summary contracts are deliberately small; add task-specific structured outputs once the verified real contracts are known.
- Gmail OAuth, encrypted token lifecycle, sends/reads, reply classification, background scheduler and website assistance.
- Follow-up settings persist nowhere yet; they are a clearly labeled calculation preview.
- Server approval records and atomic operation claims. Unique DB keys prepare deduplication but are not an exactly-once sending implementation.

## Commands

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
# Install a Playwright-managed browser on your workstation, or select a system Chromium:
npx playwright install chromium
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Use Node 22+; this environment uses Node 24.19.0. Demo mode requires no .env file; `.env.example` documents optional integrations. Do not copy tokens into source. Tests use Node's runner with tsx and Playwright for browser checks.

## Validation results

- Dependency installation: passed; clean `npm ci` also passed using package-lock.json.
- Strict TypeScript: passed.
- Prettier formatting: passed (generated Next.js declaration files excluded).
- ESLint: passed without warnings after fixes.
- Unit tests: 5 executed, 5 passed, 0 skipped (run outside this environment's restrictive process sandbox to observe actual named test execution).
- Production Next.js build: passed; 15 static pages generated and dynamic handlers compiled.
- Browser smoke tests: 5 executed, 5 passed. Verified landing and nine key routes with no page errors, application search/create/transitions/reload persistence, profile/preferences saving, labeled mock agent and disabled send behavior, visible nonzero chart bars, mobile navigation/no horizontal page overflow at 390 × 844, and API validation/demo isolation.
- Live Supabase SQL/Auth/RLS/Storage and external integrations: not run; no configured project or external credentials supplied.

Initial sandbox-only attempts blocked worker ports and proxy access; the same build succeeded using the environment's supported elevated execution. The normal project commands need no workaround on a standard local development machine. A sandbox test run reporting only one file-level result was not accepted as unit-test evidence; the verified run executed all five named checks.

## Next milestone

Start with authenticated persistence, not automation. Apply the migration to disposable Supabase, generate typed DB models, verify ownership/Storage/transition constraints, then connect existing forms and application pages through user-scoped services. Preserve the demo provider as a separate backend. Add durable explicit approvals before any external effects. Consult ARCHITECTURE, SCHEMA, ROADMAP and AGENTS before extending.
