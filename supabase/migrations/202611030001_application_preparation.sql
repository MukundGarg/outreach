-- Add application_preparation column to store reviewed screening answers,
-- unresolved question responses, and Gemini email drafts.
alter table public.job_applications
add column if not exists application_preparation jsonb default null;

comment on column public.job_applications.application_preparation is
'Stores candidate application preparation including screening question answers, candidate answers to unresolved questions, and drafted application email (subject/body).';

