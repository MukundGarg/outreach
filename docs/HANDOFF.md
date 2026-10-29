# ApplyPilot AI — implementation handoff (Milestone 03)

## Exact status

ApplyPilot AI has completed **Milestone 03: Live Integration Testing + Secure Gmail OAuth 2.0 + User-Approved Sending**.
All live tests (Gemini G1–G4 and Dify D1–D3) have been verified with live API credentials. A secure Gmail OAuth 2.0 connection workflow with AES-256-GCM token encryption at rest and an explicit, human-approved recruiter email sending pipeline via official Gmail API have been implemented and verified. Outdated Lyzr references have been fully removed.

### Working now

- **Live AI Verification (Tested against configured APIs)**:
  - **Google Gemini (`gemini-3.5-flash-lite`)**:
    - `G1` (Resume Extraction): Extracted name, education, skills, and projects from PDF text without fabricating employment history. Validated against `extractedProfileSchema`.
    - `G2` (Job Analysis): Accurately identified React as matched, flagged missing experience requirements, and returned match score within [0, 100].
    - `G3` (Screening Answer): Formulated truthful answer based only on resume facts.
    - `G4` (Reply Classification): Successfully classified "Thank you for your interest, but please do not contact us again" as `opt_out`.
  - **Dify Agent Intelligence (Stream-parsed Agent App)**:
    - Updated Dify client to stream parsing (`response_mode: 'streaming'`) as required by Dify Agent Apps.
    - `D1` (Agent 1 Application Intelligence): Generated structured requirements analysis, matched/missing flags, and screening answer conforming to `difyApplicationIntelligenceSchema`.
    - `D2` (Agent 2 Outreach Intelligence): Generated personalized subject, recruiter body, and follow-up strategy conforming to `difyOutreachIntelligenceSchema`.
    - `D3` (Stop Condition): With explicit opt-out response, returned `recommended_action: 'stop'`, `email_body: null`, and `followup_eligible: false`.
- **Backend Security Hardening**:
  - `src/services/ai-router.ts` now loads authoritative candidate profiles directly from the authenticated user's database records (`getProfile()`) rather than trusting arbitrary client parameters.
  - Recruiter contacts are loaded directly from database records enforcing user ownership.
  - Removed misleading static fallback text; degraded fallback explicitly invokes genuine Gemini generation when requested.
- **Gmail OAuth 2.0 Integration**:
  - Authorization code flow (`/api/integrations/gmail/connect`, `callback`, `status`, `disconnect`).
  - Scopes restricted to minimal necessary: `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/userinfo.email`.
  - CSRF protection via user-bound, cryptographically signed HTTP-only state cookie.
  - Server-side token exchange and identity verification via Google UserInfo API (`/userinfo/v2/me`).
  - Disconnect endpoint revokes authorization with Google and removes stored credentials.
- **Token Encryption at Rest**:
  - AES-256-GCM authenticated encryption (`src/lib/encryption.ts`) using 32-byte secret derived from `GMAIL_TOKEN_ENCRYPTION_KEY`.
  - Nonce/IV and authentication tag stored alongside ciphertext; tampering is detected and rejected.
  - Tokens refreshed automatically when expired or within 2 minutes of expiration.
- **User-Approved Gmail Sending Pipeline**:
  - RFC 5322 MIME message formatting with UTF-8 base64 encoded subject line and base64url message payload for Google `users.messages.send` API.
  - Mandatory approval modal requiring explicit human review of recipient, subject, and body before sending.
  - SHA-256 content fingerprinting (`calculateContentHash`); editing draft after approval invalidates approval hash and prevents transmission.
  - Recruiter contact opt-out suppression check (`is_suppressed`); sending to suppressed contacts is strictly blocked.
  - Idempotency key protection on `email_messages` table prevents duplicate transmissions on retry or double-click.
  - Persists Gmail message ID, thread ID, and send timestamps in Supabase.
- **Outreach UI (`src/components/outreach.tsx`)**:
  - Gmail Connect/Disconnect button with live connection status badge and connected email address.
  - Save Draft button persisting to Supabase (`/api/outreach/drafts`).
  - Dify Agent 2 draft generation with true provider badge (`Dify Agent 2 Draft` vs `Gemini Fallback Draft`).
  - Final Send Confirmation dialog displaying exact sender, recipient, subject, and body.
  - Preserved Gemini reply classification and opt-out alert banner.
  - Demo mode completely isolated from external Gmail sending.

### Automated Test Suite

- `npm test`: 25 passing tests (0 failures).
  - 8 AI schema and parser validation tests.
  - 5 domain transition and constraint tests.
  - 8 Gmail OAuth encryption, RFC 5322 MIME, approval fingerprint, and sending safety tests.
  - 4 persistence and PDF validation tests.

### Intentionally incomplete (Deferred to Task 04/05)

- Scheduled follow-up email cron automation (Task 04).
- Automatic inbox polling and thread monitoring (Task 04).
- Automated browser job application submission via Playwright (Task 05).

## Commands

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

## Validation results

- `npm run typecheck`: passed (0 errors).
- `npm run lint`: passed (0 errors).
- `npm test`: 25 tests passed, 0 failures.
- `npm run build`: passed; all 26 routes compiled and optimized.

## Next milestone (Antigravity Task 04/05)

Proceed to scheduled follow-up automation and inbox monitoring:
- Background worker for follow-up schedule execution.
- Gmail inbox monitoring for recruiter replies using incremental OAuth consent (`gmail.readonly`).
- Automatic reply categorization and suppression trigger.
