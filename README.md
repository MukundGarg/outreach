<div align="center">

# ◈ ApplyPilot AI

### One profile. More opportunities. Less application busywork.

**An intelligent career workspace for students, fresh graduates, and early-career professionals.**

[![Next.js](https://img.shields.io/badge/Next.js_16-20352E?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-27694E?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-486C55?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![AI / ML](https://img.shields.io/badge/Track-AI%20%2F%20ML-D9E8D8?style=for-the-badge&labelColor=27694E&color=D9E8D8)](#why-aiml)

**From opportunity discovery to thoughtful recruiter outreach — in one connected workspace.**

[Explore the workflow](#the-applypilot-experience) · [See what's built](#implementation-status) · [Run the demo](#run-it-locally) · [Architecture](#how-it-works-under-the-hood)

</div>

---

> **The idea:** Job applications shouldn't feel like managing six different tools. ApplyPilot AI connects candidate information, role insights, application preparation, personalized outreach, and tracking—while keeping the candidate in control.

## The challenge

The job-application journey is often fragmented:

| The friction | What it means for a candidate |
| :-- | :-- |
| **Repeated information** | Re-entering the same education, skills, and projects on multiple forms |
| **Unclear job fit** | Manually comparing every job description to a resume |
| **Blank-page screening questions** | Rewriting similar answers for different applications |
| **Generic recruiter outreach** | Preparing personalized messages from scratch |
| **Scattered tracking** | Managing applications, contacts, and next steps across tabs and spreadsheets |

### Our answer: one continuous workflow

**Upload → Understand → Analyze → Prepare → Personalize → Review → Track**

ApplyPilot AI uses LLM-powered assistance to prepare work and surface context; **the candidate reviews and decides**. It is not a bot that indiscriminately submits applications or emails recruiters.

---

## The ApplyPilot experience

<div align="center">

### A calm, focused workspace — designed around the candidate

**Sage-green navigation · clean white cards · clear next steps · review-first actions**

</div>

| Workspace | What a judge can explore |
| :-- | :-- |
| **Dashboard** | Application pipeline, activity, and a quick overview of career progress |
| **Candidate profile** | Editable experience, education, projects, skills, and stored resume details |
| **Preferences** | Preferred roles, locations, and job-search preferences |
| **Applications** | Role records, stage transitions, job insights, and suggested form answers |
| **Recruiter outreach** | Contacts, personalized email drafting, subject/body editing, saved drafts, Gmail connection |
| **Settings** | Account and integration settings; demo-state reset when applicable |

**A guided product tour**

| 01 / Understand | 02 / Prepare | 03 / Connect |
| :-- | :-- | :-- |
| Upload a PDF resume and review structured candidate details. | Analyze a target role, prepare application responses, and organize the opportunity. | Select a recruiter, generate a tailored email, edit it, save it, and review communication controls. |
| **Resume intelligence + job matching** | **Application intelligence + form assistance** | **Outreach intelligence + Gmail OAuth** |

<!-- PRODUCT SCREENSHOTS: Add genuine screenshots to docs/assets/ and insert them here.
     Suggested filenames: dashboard.png, application-workspace.png, outreach-draft.png.
     Capture fictional/demo data only. Do not add fabricated product screenshots. -->

**What the interface looks like:** a light, minimal career dashboard with sage-green highlights, a left navigation sidebar, application cards, and an editable outreach preview. The actual application—not a fabricated render—should be used for screenshots and live judging.

---

## What makes ApplyPilot different?

### Intelligence that connects the steps, not just a chatbot

| Capability | What it does | Candidate control |
| :-- | :-- | :-- |
| **Resume Intelligence** | Extracts structured qualifications from a PDF for review | Edit extracted information before saving |
| **Job Matching** | Compares candidate background against role requirements | Inspect matched and missing requirements |
| **Application Intelligence** | Suggests field mappings and evidence-grounded screening responses | Review and copy suggestions into external forms |
| **Recruiter Outreach Intelligence** | Drafts context-aware subjects, emails, and recommended next steps | Edit, save, approve, or stop |
| **Application Tracker** | Maintains records and status history in one workspace | Manage stages and contacts directly |
| **Follow-up Planning** | Prepares follow-up schedules and approval states | Scheduling foundation; not an autonomous sender |

### An actual end-to-end example

1. **Create a profile** and upload a PDF resume.
2. **Review extracted details** rather than accepting AI output blindly.
3. **Add an application** for a target role and examine relevant job requirements.
4. **Generate suggested application answers** with the Application Intelligence workflow.
5. **Add a fictional recruiter contact** and generate a personalized outreach draft.
6. **Edit and save the draft.** The authenticated workspace retrieves saved content after a refresh.
7. **Review Gmail connection and approval controls.** Real sending must be explicitly authorized; demo mode never sends.
8. **Track the opportunity** in the application pipeline.

> **Human-in-the-loop by design:** AI generates suggestions; users remain responsible for what is saved, sent, copied, or submitted.

---

## How it works under the hood

~~~mermaid
flowchart TD
    U["Candidate"] --> W["Next.js / React workspace"]
    W --> API["Authenticated Next.js API routes"]
    API --> AUTH["Supabase Auth + RLS"]
    API --> ORCH["LLM task orchestration"]
    ORCH --> R["Resume intelligence"]
    ORCH --> J["Job analysis"]
    ORCH --> A["Application intelligence"]
    ORCH --> O["Outreach intelligence"]
    R --> REVIEW["Editable human review"]
    J --> REVIEW
    A --> REVIEW
    O --> REVIEW
    REVIEW --> DB["Supabase PostgreSQL + private Storage"]
    REVIEW --> MAIL["Gmail OAuth + approved-send flow"]
    DB --> W
    classDef ui fill:#e7edde,stroke:#789966,color:#20352e
    classDef logic fill:#f6f7f2,stroke:#6d947c,color:#20352e
    classDef data fill:#e0eee6,stroke:#27694e,color:#20352e
    class U,W ui
    class API,ORCH,R,J,A,O,REVIEW logic
    class AUTH,DB,MAIL data
~~~

**Architectural principles**

- **One authenticated application:** Next.js App Router with typed server-side services.
- **Specialized AI workflows:** Task routing, contextual generation, and Zod-validated outputs.
- **User-scoped persistence:** Supabase PostgreSQL, authentication, Row Level Security, and private resume storage.
- **Communication with consent:** OAuth-based Gmail connection, exact-content approval, contact suppression, and idempotency safeguards.
- **Honest demo mode:** Deterministic fictional data with no paid AI requests, external mail sending, or third-party application submission.

### Technology at a glance

| Layer | Technology |
| :-- | :-- |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, Lucide, Recharts |
| **Backend** | Next.js App Router APIs, server-side TypeScript, Zod, React Hook Form |
| **Intelligence** | LLM integrations, task routing, document analysis, structured generation |
| **Database & auth** | Supabase Auth, PostgreSQL, Row Level Security |
| **Documents** | Private Supabase Storage, PDF parsing |
| **Communication** | Gmail API, OAuth 2.0, encrypted token storage |
| **Quality** | Node tests, Playwright browser tests, ESLint, TypeScript |
| **Deployment target** | Vercel + Supabase (deployment guide provided) |

---

## Why AI/ML?

**Selected hackathon track: AI/ML — Intelligent Systems, Automation, and Data-Driven Solutions.**

ApplyPilot tackles repetitive *cognitive* work, not only repetitive clicks:

- **Document understanding** turns a resume into structured, editable information.
- **Contextual matching** identifies how profile evidence maps to job requirements.
- **Language generation** helps prepare relevant application answers and recruiter outreach.
- **Task orchestration** links specialized intelligence to the right stage of the workflow.
- **Human oversight** keeps consequential actions reviewable and controlled.

**Our contribution is the integrated candidate workflow, task-specific application logic, data persistence, and human-centered experience—not a claim to have trained a foundational model.**

---

## Implementation status

This is a **functional hackathon MVP**, not a claim of production certification.

| Area | Status |
| :-- | :-- |
| Authentication and candidate workspace | **Implemented** |
| Resume upload and AI-assisted extraction | **Implemented** |
| Job analysis and application preparation | **Implemented** |
| Recruiter contacts and AI email drafting | **Implemented; browser flow manually verified** |
| Editable, saved outreach drafts | **Implemented; refresh persistence covered by browser test** |
| Gmail OAuth and approval-gated send pipeline | **Implemented; controlled testing and security review still advised** |
| Review-and-copy application form assistance | **Implemented** |
| Follow-up scheduling | **Foundation implemented; no automatic delivery worker verified** |
| Continuous Gmail inbox monitoring | **Not implemented as an autonomous service** |
| Universal automatic third-party application submission | **Not implemented** |
| Production deployment | **Prepared/documented; public live deployment not verified** |

### Engineering evidence

| Quality gate | Latest development report |
| :-- | :-- |
| Unit / integration tests | **38 passing** |
| Browser checks | **6 passing** |
| TypeScript | **Passed** |
| ESLint | **Passed** |
| Production build | **Passed** |

These are **development-reported results**, not a third-party audit. The browser suite exercises core workspace navigation, persistence, mobile layout, and unauthenticated boundaries; it is not a full certification of every external integration.

### Five milestones delivered

**01 Foundation** → **02 Intelligence** → **03 Gmail connection** → **04 Integrated outreach** → **05 Testing, hardening & demo preparation**

Latest security-hardening reference: [Gmail transmission integrity repairs](https://github.com/MukundGarg/outreach/commit/84e9fd3334000d830f1c86dea8ace68bf82fb0c7).

---

## Run it locally

**Prerequisite:** Node.js 22+ and npm.

~~~bash
git clone https://github.com/MukundGarg/outreach.git
cd outreach
npm ci
cp .env.example .env.local
npm run dev
~~~

Open **http://localhost:3000**.

### Start with the no-credentials demo

Demo mode is the fastest way for a judge to explore the interface:

~~~dotenv
NEXT_PUBLIC_DEMO_MODE=true
~~~

- Fictional data only, clearly labeled.
- Profile edits and draft-like interactions persist for the browser tab/session using session storage.
- AI responses are deterministic simulations.
- Real resume upload, paid AI requests, Gmail dispatch, and external application submission are disabled.

**Demo data is illustrative; it is not real outreach or recruitment activity.**

### Enable the authenticated workspace

1. Create a Supabase project and apply the SQL migrations in order.
2. Configure Supabase Auth redirect URLs and private resume storage.
3. Configure the required **server-only** AI and Gmail OAuth credentials according to [.env.example](.env.example), [Gmail setup](docs/GMAIL_SETUP.md), and [deployment guide](docs/DEPLOYMENT.md).
4. Set the following in your local environment:

~~~dotenv
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
~~~

5. Restart the application and sign in.

**Never commit real secrets, test passwords, tokens, private resumes, or a populated `.env.local`.** Public configuration belongs in `.env.example`; secret values remain outside version control.

### Quality checks

~~~bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
~~~

Authenticated Playwright tests need a dedicated **test account**, configured through the test-user environment variables documented in `.env.example`. Do not use a personal account for automated tests.

For detailed deployment instructions, see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. For a minute-by-minute live presentation, see **[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)**.

---

## Privacy, safety, and responsible automation

We designed ApplyPilot around **candidate consent and explicit review**.

- **Private resumes:** User-scoped storage and short-lived authorized download access.
- **Account isolation:** Authenticated database operations and Supabase RLS.
- **Verified input/output structure:** Zod-validated requests and AI responses.
- **Draft-first communication:** Recruiter messages are editable before approval.
- **Recipient protection:** Suppressed contacts are excluded from sending.
- **Ambiguous delivery handling:** Potentially transmitted messages require reconciliation rather than blind retries.
- **No dark automation:** No CAPTCHA bypass, uncontrolled bulk emailing, or unapproved portal submissions.

**Important:** OAuth tokens, external AI services, operational rate limits, and historical credential exposure require ongoing security management. A successful build or test run is not a security certification. Do not enable broad real-world outreach until keys are rotated and live sending is fully validated.

---

## Feasibility and roadmap

### Why this can work

The core candidate journey already runs in one application. Managed data services, modular intelligence workflows, and reusable typed APIs make it practical to add support for more use cases incrementally.

### What comes next

| Near-term | Longer-term |
| :-- | :-- |
| Final live deployment and OAuth verification | More supported application-form workflows |
| Credential rotation and production security checks | Recruiter reply synchronization |
| Controlled Gmail sending tests | Approved follow-up execution |
| More usability and edge-case testing | Better matching and application insights |

**Current limits:** External job portals have different rules and UI patterns; AI suggestions may be inaccurate; provider quotas and costs vary. Candidates must verify generated information before use.

---

## Repository guide

| Location | Purpose |
| :-- | :-- |
| `src/app/` | Pages, layouts, and API routes |
| `src/components/` | Workspace screens and interactive UI |
| `src/services/` | Database operations, AI routing, Gmail and follow-up logic |
| `src/lib/` | Domain types, schemas, utilities, mock data |
| `supabase/migrations/` | Database schema and RLS setup |
| `tests/` | Unit and integration-oriented tests |
| `tests/browser/` | Playwright browser coverage |
| `docs/ARCHITECTURE.md` | Technical architecture reference |
| `docs/DEMO_SCRIPT.md` | Five-minute demonstration |
| `docs/DEPLOYMENT.md` | Deployment and configuration |

---

<div align="center">

### Less repetition. More meaningful opportunities.

**ApplyPilot AI — From Opportunity to Outreach.**

[Project source](https://github.com/MukundGarg/outreach) · [Demo guide](docs/DEMO_SCRIPT.md) · [Technical architecture](docs/ARCHITECTURE.md)

<sub>Built for the AI/ML track • Functional hackathon MVP • Human-in-the-loop by design</sub>

</div>
