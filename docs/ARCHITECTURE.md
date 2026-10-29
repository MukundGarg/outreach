# Architecture

## Runtime

A single Next.js application serves public landing/Auth pages, a workspace route group, server actions, and route handlers. CSS design tokens and reusable cards/forms produce a consistent responsive interface. Recharts is client-side; deterministic fixtures make server/client first renders consistent.

DemoProvider owns an isolated sessionStorage snapshot. Demo forms validate with the same Zod domain inputs used by the server. No demo data is written to Supabase. Authenticated mode checks `auth.getUser()` in the workspace layout and uses a separate account-connected screen until real UI repositories are connected. The proxy refreshes cookies; it is not the authorization boundary. Each database service independently verifies the user, and RLS enforces ownership.

## Data and services

`domain.ts` defines application/outreach states and explicit allowed transitions. `applications.ts` exposes authenticated list/create operations via the publishable-key client. New records begin as draft. Database triggers enforce transitions and append application events atomically. Demo transitions append events locally, explicitly labeled simulated.

The database owns referential integrity, per-user scope and unique operation keys. Composite `(id,user_id)` foreign keys prevent attaching another user's application/contact/message to an owned child record. See SCHEMA for entities and caveats.

## AI Engine (Hybrid Gemini + Dify)

The AI architecture adopts a clear division of responsibilities:
- **Google Gemini API (`@google/genai`)**: Dedicated to fast, structured extraction, text classification, and single-turn analysis:
  - Resume structured information extraction from private PDF storage (`resume_extract`)
  - Job description analysis and candidate-job qualification matching (`job_analyze`)
  - Recruiter reply classification and sentiment/opt-out intent detection (`reply_classify`)
  - Basic screening question drafting (`simple_answer`)
- **Dify Application Intelligence (Agent 1)**: Integrated via Dify Chat Messages API (`chat-messages`) with dedicated application key:
  - Multi-step form field mapping and requirements verification (`complex_application`)
  - Screening question answer drafting with explicit evidence citations
- **Dify Outreach Intelligence (Agent 2)**: Integrated via Dify Chat Messages API (`chat-messages`) with dedicated outreach key:
  - Context-aware recruiter email drafts and follow-up timing recommendations (`outreach_plan`)
  - Explicit `stop` and pause directives with suppression verification for candidate opt-outs

### AI Task Router (`src/services/ai-router.ts`)
- Explicit TypeScript router (`routeAITask`) dispatches tasks to Gemini or Dify.
- Enforces strict input validation using `aiTaskRequestSchema`.
- Logs execution provenance (model/agent ID, duration, status, safe error code) in the immutable `agent_runs` table without storing raw resumes or private correspondence.
- In Demo Mode (`NEXT_PUBLIC_DEMO_MODE=true`), all tasks return deterministic, visibly labeled mock fixtures from `src/lib/ai-mocks.ts` with zero external network or paid API usage.
- All AI suggestions require explicit human review and approval before database persistence. No external email or job application submission occurs automatically.

## Security and deployment

No external credentials are bundled in UI. Only Supabase public configuration and demo flag are public. Route handlers return safe error messages; raw provider content is not logged. Production mode does not show fixtures as real data. Public demo endpoints perform only bounded deterministic work, not paid external calls. For a public launch add platform rate limiting and CSP, verify Supabase Auth redirect policies and exercise two-user isolation.

No services are required for local demo. Supabase is required for real authentication/database mode. Live processes must restart after environment restoration; run the documented npm dev/start command rather than assuming a prior server survived.
