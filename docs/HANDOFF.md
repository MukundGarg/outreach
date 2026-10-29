# ApplyPilot AI — implementation handoff (Milestone 01)

## Exact status

ApplyPilot AI is now a functional authenticated application with persistent Supabase data services and private resume uploads, while fully preserving its isolated client-side demonstration mode.

### Working now

- **Production workspace & clean separation**:
  - In demo mode (`NEXT_PUBLIC_DEMO_MODE=true` default), the app continues using local sessionStorage with fictional sample data.
  - In authenticated mode (`NEXT_PUBLIC_DEMO_MODE=false`), real users authenticate through Supabase Auth (`/login` and `/signup`) and access the full workspace.
  - Loading, empty, error, and retry states are built into the authenticated data provider (`AuthenticatedWorkspaceProvider`).
  - No demo records are mixed with user records, and database failures never silently fall back to mock data.
- **Database persistence (Ten-table schema)**:
  - User-scoped persistence for candidate profiles (`profiles`), job preferences (`candidate_preferences`), job applications (`job_applications`), immutable trigger-managed application audit events (`application_events`), and recruiter contacts (`recruiter_contacts`).
  - Explicit serializers/deserializers (`src/lib/mappers.ts`) mapping frontend domain models to database columns with full strict typing (`database.types.ts`).
  - Server-side transition validation in `services/applications.ts` backed by PostgreSQL trigger enforcement in `202610290001_foundation.sql`.
- **Secure resume upload & private retrieval**:
  - PDF file buffer validation enforcing strict `%PDF-` magic byte inspection and 10 MB maximum limit (`src/lib/pdf-validator.ts`).
  - Scoped storage paths `<user_id>/<uuid>.pdf` in the private `resumes` bucket.
  - Metadata tracking in the `resumes` table.
  - Short-lived signed URLs for authorized retrieval and secure replacement/deletion.
  - Zero raw resume logging or public bucket exposure.
- **Explicit approval foundation (Task E)**:
  - Applications cannot transition to `submitted` or active pipeline stages without explicit user review and approval recorded with an authenticated server timestamp.
  - No client-fabricated timestamps accepted. External submission is intentionally withheld until authorized.
- **Testing & verification**:
  - 9 automated unit/domain tests passed (`npm test`).
  - Strict TypeScript check passed (`npm run typecheck`).
  - ESLint passed without errors or warnings (`npm run lint`).
  - Production Next.js build passed (`npm run build`).
  - 5 Playwright end-to-end browser tests passed (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="..." npm run test:e2e`).
  - Disposable Supabase integration test script provided (`tests/integration-supabase.ts`).

### Intentionally incomplete (Deferred to Task 02+)

- Live Lyzr agent execution (official API contracts required; mock mode preserved).
- Gmail OAuth token encryption/vault lifecycle and approved email sending.
- Background worker scheduling and automated reply classification.
- External browser form automation / LinkedIn scraping (strictly disallowed).

## Commands

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
```

## Validation results

- `npm ci`: passed without errors.
- `npm run typecheck`: passed (0 TypeScript errors).
- `npm run lint`: passed (0 ESLint errors/warnings).
- `npm test`: 9 tests executed, 9 passed, 0 failures.
- `npm run build`: passed; optimized production build generated with all dynamic/static routes.
- `npm run test:e2e`: 5 tests executed, 5 passed.
- `tests/integration-supabase.ts`: executable script created for disposable Supabase instances. When cloud credentials are not supplied, marked skipped as required.

## Next milestone (Antigravity Task 02/05)

Proceed to verified Lyzr transport and agent integration:
- Review official API contracts for the three Lyzr agents.
- Implement server-side agent adapters with input validation, timeout handling, and provenance tracking.
- Connect candidate intelligence and outreach drafting workflows to real agent outputs with mandatory human review.
