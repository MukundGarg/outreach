# ApplyPilot AI — implementation handoff (Milestone 02)

## Exact status

ApplyPilot AI now features a production-ready Hybrid AI engine combining Google Gemini (`@google/genai`) for structured extraction and fast classification with Dify AI for deep application intelligence and recruiter outreach generation, while fully preserving its isolated client-side demonstration mode.

### Working now

- **Hybrid AI Engine (`@google/genai` & Dify APIs)**:
  - **Gemini Service (`src/services/gemini.ts`)**:
    - Resume structured information extraction (`resume_extract`) directly from private PDF storage via `pdf-parse` (`parsePdfBufferToText`).
    - Job description analysis (`job_analyze`) with match scoring, matched/missing requirements, and role level detection.
    - Screening question drafting (`simple_answer`) utilizing candidate profile evidence.
    - Recruiter reply classification (`reply_classify`) distinguishing interview invitations, rejections, interest, and explicit opt-outs.
  - **Dify Service (`src/services/dify.ts`)**:
    - Dify Agent 1 (`complex_application`): Multi-step form field mapping, screening question analysis with evidence citations, and missing qualifications analysis.
    - Dify Agent 2 (`outreach_plan`): Context-aware recruiter email generation, follow-up delay timing, and explicit `stop`/opt-out recommendations.
- **AI Task Router (`src/services/ai-router.ts`)**:
  - Deterministic routing to Gemini vs. Dify based on task complexity.
  - User and application-scoped execution logging in `agent_runs` table with safe error codes.
  - Support for explicit user-approved degraded fallback if Dify is temporarily unreachable or misconfigured.
  - Full demo mode preservation returning deterministic simulated results without network calls or credit consumption.
- **Interactive UI Integration**:
  - `ProfileForm`: "Analyze Resume" button downloads private resume from Supabase, runs Gemini structured extraction, and shows an editable preview modal before populating the form.
  - `Applications` (Detail): "Analyze Job (Gemini)" and "Prepare Application (Dify Agent 1)" with editable screening answers and required human approval confirmation.
  - `Outreach`: "Generate Recruiter Email (Dify Agent 2)" with editable subject/body, follow-up recommendations, and a dedicated Gemini "Classify Message" panel with automatic opt-out suppression alerts.
- **Testing & validation**:
  - 17 automated tests passing (`npm test`).
  - Strict TypeScript check passed (`npm run typecheck`).
  - ESLint passed with 0 errors (`npm run lint`).
  - Next.js production build succeeded (`npm run build`).

### Intentionally incomplete (Deferred to Task 03+)

- Gmail OAuth authorization flow and direct SMTP/API email dispatch.
- Background cron scheduler and automated polling workers.
- Third-party browser form submission (Playwright browser automation for job portals).

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

- `npm run typecheck`: passed (0 errors).
- `npm run lint`: passed (0 errors).
- `npm test`: 17 tests passed, 0 failures.
- `npm run build`: passed; all routes compiled and optimized.
- `npm run test:e2e`: 5 tests executed, 5 passed.
- `tests/integration-supabase.ts`: executable script created for disposable Supabase instances. When cloud credentials are not supplied, marked skipped as required.

## Next milestone (Antigravity Task 02/05)

Proceed to verified Lyzr transport and agent integration:
- Review official API contracts for the three Lyzr agents.
- Implement server-side agent adapters with input validation, timeout handling, and provenance tracking.
- Connect candidate intelligence and outreach drafting workflows to real agent outputs with mandatory human review.
