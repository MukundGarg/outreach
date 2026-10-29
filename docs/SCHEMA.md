# Supabase schema

Migration: `supabase/migrations/202610290001_foundation.sql`. UUIDs, creation/update timestamps, ownership indexes, foreign keys and RLS are defined for all ten entities.

| Entity                | Responsibility                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| profiles              | One profile per Auth user; structured education/experience/projects; verification timestamp reserved |
| candidate_preferences | One set per user; roles, locations, compensation, arrangement and follow-up defaults                 |
| resumes               | PDF metadata only, private object path, size and extraction state                                    |
| job_applications      | Opportunity, state, approval timestamp and unique submission operation key                           |
| application_events    | Immutable to client roles; trigger-generated application status audit                                |
| recruiter_contacts    | Per-user contacts with unique email                                                                  |
| outreach_campaigns    | Links an owned contact and optional application; state and approval                                  |
| email_messages        | Drafts, direction, Gmail IDs/thread IDs, classification, approval and unique operation key           |
| followup_schedules    | Due time, claim metadata, approval, status and unique operation key                                  |
| agent_runs            | Independent agent kind, mode, safe execution metadata; no raw private payload                        |

The `profiles.id` and other tables' `user_id` reference auth.users directly. Profile creation can be an authenticated insert; there is no signup trigger requiring profile creation to succeed. Child references use composite owner foreign keys so cross-user relationships cannot be created even when a UUID is known.

All tables have owner SELECT policies. All except application_events have owner INSERT/UPDATE/DELETE policies. Audit events are created only by a security-definer trigger with a fixed empty search path and fully qualified table names; clients cannot edit or invent them. Application deletion cascades audit history (this is not a compliance-grade immutable audit archive). Application changes and event insertion are one transaction. Application and outreach transition graphs match the TypeScript helpers. New entities start as drafts. Submission/outreach/send states enforce approval metadata, but real approval verification must be implemented by the future server workflow: a client-provided timestamp alone does not prove consent.

The `resumes` bucket is private, PDF-only, maximum 10 MiB. Storage policies require the first object path segment to equal auth.uid(). Metadata has the same ownership path check. MIME/size declarations are not malware or content validation. Future upload handlers must inspect actual files and safely reconcile object/metadata cleanup. Never expose a public bucket URL for resumes.

Future OAuth tokens are deliberately absent. Use a vault/encryption design before Gmail integration. Gmail message/thread IDs and classifications can be added to owned message records after an authorized read. Future scheduling workers need service-side atomic claims and terminal-state handling. `idempotency_key` uniqueness is a foundation for duplicate prevention, not a remote-send implementation.

## Validation before deploying

Apply on a fresh Supabase project. Create users A and B; verify every table's read/write isolation and cross-owner FK rejection. Verify Storage read/write/delete isolation and private bucket behavior. Check valid/invalid transitions, approval constraints, audit insertion atomicity, duplicate operation-key rejection, and cascade cleanup. These checks require a live disposable database and have not yet been executed here.
