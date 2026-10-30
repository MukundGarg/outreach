# ApplyPilot AI

**A focused workspace for managing job applications, understanding role requirements, and preparing personalized recruiter outreach.**

ApplyPilot AI is a full-stack web application designed for students, graduates, and early-career professionals who have to manage the same information across resumes, application forms, job descriptions, email drafts, and tracking spreadsheets. It brings those activities together in one place and adds AI-assisted preparation at the steps where candidates typically spend the most time.

The product is built around a simple principle: **AI helps prepare work; the candidate remains responsible for reviewing and taking action.** ApplyPilot does not claim to submit applications to every website or send recruiter messages without approval.

**Project status:** Functional hackathon MVP, with an authenticated workspace, database-backed records, AI-assisted workflows, and automated tests. Public production deployment and unrestricted live email sending should not be assumed.

[How it works](#how-applypilot-works) · [Features](#product-features) · [Architecture](#technical-architecture) · [Local setup](#getting-started) · [Current scope](#current-capabilities-and-limitations)

---

## Why this project exists

Applying for multiple jobs is not just about finding suitable openings. Candidates often repeat their profile information, compare lengthy job descriptions against a resume, prepare similar application answers, contact recruiters, and then track everything somewhere else.

These steps are related, but conventional workflows often treat them as separate tasks:

| Task | Typical friction | ApplyPilot's approach |
| --- | --- | --- |
| Maintain a resume and profile | Repeatedly re-enter qualifications | Keep a structured, editable candidate profile |
| Understand a job description | Manually assess skills and requirements | Generate an evidence-based role analysis |
| Prepare screening answers | Rewrite similar responses | Suggest answers grounded in candidate information |
| Contact a recruiter | Draft each email from scratch | Generate a personalized and editable outreach draft |
| Remember application progress | Scatter information across documents | Store applications, stages, contacts, and draft records |
| Follow up responsibly | Lose track of planned messages | Maintain follow-up schedule records for user review |

ApplyPilot's objective is to connect the workflow, not to replace the judgment of the applicant.

## How ApplyPilot works

The application connects candidate information to an opportunity and then to the communication and tracking steps around that opportunity.

~~~text
Candidate profile + PDF resume
              |
              v
Structured resume review
              |
              v
Job description analysis
              |
              v
Application preparation and suggested answers
              |
              v
Candidate reviews and copies/edits responses
              |
              v
Recruiter contact -> personalized outreach draft
              |
              v
Edit + save + explicitly approve
              |
              v
Gmail integration (authenticated mode only)
              |
              v
Application tracking and follow-up planning
~~~

A typical authenticated workflow looks like this:

1. **Sign in and create a profile.** The candidate supplies their details and preferences once.
2. **Upload a PDF resume.** The file is stored privately and its content can be analyzed to produce structured, editable profile data.
3. **Add a job application.** Record the role and company, review job requirements, and inspect which qualifications match or are missing.
4. **Prepare the application.** Generate suggested answers and form field values. The user reviews the suggestions and copies them into supported external application forms.
5. **Create a recruiter contact.** Keep the contact associated with an outreach campaign and optionally an application.
6. **Generate an outreach draft.** The AI workflow uses candidate and recruiter context to prepare an email with an editable subject and body.
7. **Save and revisit the draft.** In authenticated mode, message records are stored in PostgreSQL and loaded back into the interface.
8. **Review communication controls.** A connected Gmail account and an approved draft are required for real sending; suppression and duplicate-transmission safeguards are implemented.
9. **Manage progress.** Update application stages and maintain follow-up schedule records.

This is a guided, human-supervised sequence. The user is expected to verify factual claims, choose recipients, and decide what to submit or send.

## Product features

### 1. Candidate profile and preferences

The Profile workspace holds candidate information such as education, experience, skills, and projects. Preferences help organize the kinds of roles and arrangements the candidate is interested in.

The structured profile matters because downstream application and outreach suggestions need a consistent source of candidate information. Without it, each new prompt or form would require the user to reconstruct their background.

In authenticated mode, profile and preference records are stored per user in Supabase PostgreSQL.

### 2. Private PDF resume handling

Candidates can upload PDF resumes up to **10 MiB**. The authenticated workflow stores the original file in a **private Supabase Storage bucket**, while the database stores metadata such as the storage path and extraction status.

A resume intelligence operation can extract structured details for the candidate to inspect and edit. Extracted information is not treated as automatically verified truth.

Storage is user-scoped, and authorized downloads use short-lived access rather than public resume URLs.

### 3. Job description analysis

The job analysis workflow evaluates a target role's requirements against the candidate's known information. Its outputs may include:

- A match assessment or score for the provided role.
- Relevant skills and qualifications that appear supported.
- Missing or unverified requirements.
- Role-level or contextual insights useful for preparation.

These are **decision-support signals**, not hiring predictions. A match score is not a guarantee of interview selection, and users should review the underlying evidence.

### 4. Application preparation and form assistance

For application forms and screening questions, ApplyPilot prepares suggested field values and candidate-specific answers. More complex application workflows can identify unresolved questions and map available profile evidence to requested fields.

The current form assistant takes a **review-and-copy** approach: candidates can inspect suggested information and copy it into an application portal. This avoids claiming broad automated compatibility with third-party websites or bypassing their restrictions.

**The application does not autonomously submit job applications to external portals.**

### 5. Recruiter contact management

The Outreach workspace allows a signed-in candidate to create, select, and manage recruiter contacts. A contact can be associated with an outreach campaign and the candidate's application context.

Contact records are scoped to the authenticated user. A suppression flag can prevent sending to a recruiter who should no longer be contacted.

### 6. Personalized recruiter outreach

The outreach intelligence workflow creates a draft using relevant candidate and recruiter details. The user can:

- Generate an email subject and body.
- Review personalization details and recommendations.
- Edit the subject and message before saving.
- Save a draft to the authenticated database.
- Return to the workspace and retrieve saved content.
- Review an approval flow before using the Gmail sending integration.

The generated message is **a suggestion**, not a message that has already been sent. A recommendation to stop contacting a recruiter should be respected.

### 7. Gmail account connection and approved sending

The authenticated application includes an OAuth-based Gmail integration. It uses the Gmail API to transmit approved messages rather than requiring the user's email password.

The sending pipeline includes checks for user ownership, contact/recipient matching, suppression, persisted approval, content fingerprinting, and a stable message identity. Transmission outcomes that may be uncertain are intended to block blind retry and require reconciliation.

**Important distinction:** Gmail *Connected* means the authorization flow was completed; it does not establish that a message was sent or delivered. Gmail API acceptance is also not proof that a recruiter opened or read the email.

Credential rotation, deployment-specific OAuth configuration, and controlled live-send verification are required before general public use.

### 8. Application tracking and audit history

The Applications workspace holds the opportunities a candidate is managing. An application begins as a draft and can move through permitted stages such as:

`draft → ready_for_review → submitted → awaiting_response / under_review → interview → offer / rejected / closed`

Not every transition is permitted from every state. Application status rules are encoded in domain logic and enforced in the database. The database creates application events for state transitions, providing a history of changes within the user's workspace.

A status change in ApplyPilot records what the candidate marks in the tracker. It does **not** by itself submit information to an employer.

### 9. Follow-up scheduling foundation

ApplyPilot has data structures and service methods for scheduling, approving, listing, and canceling follow-up plans, including business-day calculations.

This is a **scheduling foundation**, not evidence of a running background worker that autonomously monitors the inbox and delivers messages. Full automatic follow-up execution is outside the verified MVP scope.

### 10. Separate, clearly labeled demo mode

Demo mode lets someone explore the interface without creating accounts or configuring external integrations. It uses fictional records and deterministic simulated AI output.

Demo state is kept in the browser session rather than written to the real user database. Resume selection in demo mode does not upload a private PDF to Supabase, and buttons that would trigger external side effects remain limited or disabled.

This is useful for a product walkthrough, but sample counts, example contacts, and simulated emails should **not** be represented as real-world usage or recruitment outcomes.

---

## Technical architecture

ApplyPilot is one Next.js application containing the frontend, API route handlers, and server-side integration services.

~~~mermaid
flowchart TD
    User["Candidate"] --> UI["Next.js / React workspace"]
    UI --> API["Authenticated API routes"]
    API --> DB["Supabase Auth + PostgreSQL + RLS"]
    API --> AI["AI task orchestration"]
    AI --> Resume["Resume analysis"]
    AI --> Job["Job matching"]
    AI --> App["Application intelligence"]
    AI --> Outreach["Outreach intelligence"]
    Resume --> Review["Structured output + human review"]
    Job --> Review
    App --> Review
    Outreach --> Review
    Review --> DB
    Review --> Email["Approved Gmail communication"]
    DB --> UI
~~~

### Frontend

The frontend uses **Next.js 16, React, TypeScript, and Tailwind CSS**. It provides the public landing and authentication pages plus the authenticated candidate workspace.

The visual design is intentionally calm and practical: a light background, sage-green accents, sidebar navigation, readable cards, and straightforward forms. The application prioritizes reviewing information and completing a workflow over presenting a dense analytics console.

**Main UI areas:** Dashboard, Profile, Preferences, Applications, Outreach, and Settings.

### Backend and service boundary

Next.js API routes handle requests from the UI. Server-side services perform the authenticated data operations, AI task routing, and Gmail integration. Validation is handled using **Zod** and TypeScript domain models.

The browser should never receive private AI credentials, Gmail client secrets, or the Gmail token-encryption key.

### AI orchestration

ApplyPilot combines several **task-specific LLM-powered workflows** rather than asking a single unstructured chat prompt to handle the whole product:

| Workflow | Input context | Intended output |
| --- | --- | --- |
| Resume intelligence | Candidate PDF | Structured profile details for review |
| Job analysis | Role description + candidate evidence | Match insights and missing requirements |
| Application intelligence | Candidate information + form questions | Field mappings, draft answers, unresolved questions |
| Outreach intelligence | Candidate + recruiter context | Personalized email draft and recommendation |
| Reply classification | Provided recruiter message text | Reply category and opt-out/interest signals |

The AI router selects the appropriate workflow and validates structured responses before the application uses them. AI execution metadata can be audited without retaining raw resume or message bodies in those execution logs.

These components integrate **external LLM capabilities** through the product's application logic. ApplyPilot does not claim to have trained its own foundational language model.

### Database and privacy model

The application's persistent entities are organized around the authenticated candidate:

| Table | Purpose |
| --- | --- |
| `profiles` | Candidate profile |
| `candidate_preferences` | Saved job-search preferences |
| `resumes` | Private file metadata and extraction state |
| `job_applications` | Opportunities and current pipeline state |
| `application_events` | Database-generated application status history |
| `recruiter_contacts` | Owned recruiter contact details |
| `outreach_campaigns` | Relationship between contact, application, and outreach |
| `email_messages` | Drafts, approvals, message status, Gmail identifiers |
| `followup_schedules` | Follow-up dates and workflow state |
| `agent_runs` | Safe AI execution metadata |
| `gmail_oauth_connections` | Encrypted Gmail OAuth connection records |

Supabase **Row Level Security** restricts candidate-owned records. Composite ownership references help prevent records belonging to separate users from being linked.

The initial schema is defined in `supabase/migrations/202610290001_foundation.sql`, with Gmail-specific extensions in `202610300001_gmail_oauth_sending.sql`.

See [the database schema reference](docs/SCHEMA.md) and [architecture documentation](docs/ARCHITECTURE.md) for implementation details. Some supporting documentation predates the latest integration work; the current code and migrations take precedence when details differ.

### Communication and send safety

The Gmail flow has several distinct stages:

1. **Connection:** The user authorizes Gmail through OAuth.
2. **Draft:** ApplyPilot prepares an editable message.
3. **Approval:** The reviewed message details are associated with a persisted approval and content hash.
4. **Claim:** A specific message operation moves into a sending state.
5. **Transmission:** The backend uses the Gmail API.
6. **Recording:** The application attempts to store Gmail's response and update workflow state.
7. **Reconciliation:** Ambiguous outcomes are held for review rather than blindly resent.

This is designed to reduce accidental or duplicated outreach. As with any external delivery system, local tests alone cannot guarantee exactly-once delivery across every network and database failure.

---

## Application modes

| Behavior | Demo mode | Authenticated mode |
| --- | --- | --- |
| Account required | No | Yes |
| Data | Fictional examples | User-owned records |
| Persistence | Browser session | Supabase PostgreSQL |
| AI output | Deterministic simulations | Configured live AI workflows |
| Resume upload | Metadata preview | Private PDF storage |
| Gmail sending | Disabled | Available with configuration and approval |
| Third-party form submission | Not performed | Not performed autonomously |

The two modes are intentionally separate. Judges or reviewers can use demo mode to learn the interface, but should use authenticated mode when evaluating real persistence or integrations.

---

## Getting started

### Prerequisites

- **Node.js 22+** and npm.
- A browser for the local application.
- **Optional for demo:** no Supabase project or AI credentials.
- **Required for authenticated integrations:** Supabase project, configured AI services, and optionally Gmail OAuth credentials.

### Run locally

~~~bash
git clone https://github.com/MukundGarg/outreach.git
cd outreach
npm ci
cp .env.example .env.local
npm run dev
~~~

Open **http://localhost:3000**.

By default, when the flag is absent, the application uses demo mode. To make that explicit, place the following in `.env.local`:

~~~dotenv
NEXT_PUBLIC_DEMO_MODE=true
~~~

### Configure authenticated mode

1. Create a Supabase project and apply the repository's SQL migrations in order.
2. Enable email/password authentication and configure the callback URL.
3. Ensure the `resumes` Storage bucket is private and its RLS policies are applied.
4. Configure the public Supabase values and private server-side integration credentials using [`.env.example`](.env.example).
5. Set the application mode:

~~~dotenv
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
~~~

6. Restart the development server after changing environment variables.
7. Sign in to the authenticated workspace.

For the full checklist, see [Deployment](docs/DEPLOYMENT.md) and [Gmail OAuth setup](docs/GMAIL_SETUP.md).

**Never commit a populated `.env.local`, OAuth tokens, private resumes, real test credentials, or API secrets.** Keep credentials outside source control and rotate previously exposed keys before live use.

---

## Testing and verification

The project includes TypeScript, ESLint, Node-based tests, Playwright browser coverage, and a production-build check.

~~~bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
~~~

Browser tests for authenticated flows require dedicated test-account credentials, configured as environment variables as described in `.env.example`. Do not hardcode passwords in test files.

**Latest reported development results:**

| Check | Reported result |
| --- | --- |
| Node unit/integration-oriented tests | 38 passed |
| Playwright browser tests | 6 passed |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed |

These figures were reported during development and are not an independent security certification. The browser tests cover key routes, persistence behavior, responsive layout, and unauthenticated API boundaries; they do not establish universal portal compatibility or real-world delivery success.

---

## Security and responsible use

ApplyPilot processes personal career information, so ownership and user review matter.

- **Access control:** Authenticated operations check account identity; Supabase RLS scopes database records.
- **Private files:** Resume documents remain in a private storage bucket.
- **Validated data:** Domain schemas and API input/output validation constrain requests and AI responses.
- **Editable AI output:** Users review extracted information, application answers, and outreach drafts.
- **Opt-out handling:** Suppressed recruiter contacts must not receive future outreach.
- **Controlled sending:** The application uses persisted approval, message identity, and safeguards for uncertain transmissions.
- **No unapproved application submission:** The form assistant suggests and copies content rather than bypassing third-party controls.
- **No automatic inbox monitoring:** Reply classification can operate on supplied text; a continuous monitoring service is not claimed.

**Release considerations:** Rotate any credentials exposed during development; validate OAuth configuration, live email reconciliation, authorization isolation, rate limits, and production error handling before a public rollout.

---

## Current capabilities and limitations

**Implemented in the MVP:** Authenticated workspace, profile and preferences, resume storage and extraction workflow, job analysis, application record management, application preparation, recruiter contacts, AI email drafting, draft persistence, Gmail OAuth and approved-send code paths, follow-up scheduling records, and a review-and-copy form assistant.

**Not established as complete:** A publicly verified production deployment, an always-on Gmail inbox monitor, a background follow-up delivery worker, universal automatic external application submission, production-scale user adoption, and a comprehensive security audit.

The distinction is intentional. A working MVP demonstrates a connected product and substantial implementation, but does not eliminate API costs, third-party restrictions, AI error cases, or operational maintenance.

## What comes next

The most useful next steps are operational rather than cosmetic: finalize credential rotation, validate real Gmail sending with controlled accounts, confirm the deployed Supabase and OAuth configuration, and run the full candidate-to-outreach flow in the deployed environment. Beyond that, the architecture can support richer application form assistance, approved follow-up execution, and more sophisticated role matching.

---

## Repository map

~~~text
src/
  app/                  Next.js pages, authentication screens, API routes
  components/           Dashboard, profile, application and outreach UI
  services/             Database operations, AI routing, Gmail, scheduling
  lib/                  Domain rules, validation, utilities, demo data

supabase/
  migrations/           PostgreSQL schema, RLS, Gmail extensions

tests/                  Node-based tests and integration-oriented checks
tests/browser/          Playwright browser tests
docs/                   Setup, architecture, deployment and demo guides
~~~

**Further reading:** [Architecture](docs/ARCHITECTURE.md) · [Schema](docs/SCHEMA.md) · [Gmail setup](docs/GMAIL_SETUP.md) · [Deployment](docs/DEPLOYMENT.md) · [Demo walkthrough](docs/DEMO_SCRIPT.md)

---

**ApplyPilot AI** — a practical, human-supervised approach to navigating applications, understanding opportunities, and preparing meaningful recruiter outreach.
