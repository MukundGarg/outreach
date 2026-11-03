-- Migration: Bulk Recruiter Import and Shared Recruiter Directory
-- Creates recruiter_directory, recruiter_import_batches, recruiter_import_records, and user_recruiters

-- 1. recruiter_directory: Shared professional recruiter information
create table if not exists public.recruiter_directory (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_email text not null,
  job_title text,
  company text,
  linkedin_url text,
  company_website text,
  location text,
  recruiting_specialties text[] not null default '{}',
  source_url text,
  verification_status text not null default 'pending_verification' 
    check(verification_status in ('parsed','needs_review','pending_verification','verified','rejected','stale')),
  verification_method text,
  verification_source text,
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(normalized_email)
);

create index if not exists recruiter_dir_email_idx on public.recruiter_directory(normalized_email);
create index if not exists recruiter_dir_linkedin_idx on public.recruiter_directory(linkedin_url);
create index if not exists recruiter_dir_company_idx on public.recruiter_directory(company);
create index if not exists recruiter_dir_status_idx on public.recruiter_directory(verification_status);

alter table public.recruiter_directory enable row level security;

-- Read policy: Only expose verified records to authenticated users
create policy shared_recruiter_directory_select on public.recruiter_directory
  for select to authenticated
  using (verification_status = 'verified');

create trigger touch_updated_at before update on public.recruiter_directory
  for each row execute function public.touch_updated_at();

-- 2. recruiter_import_batches: Tracks CSV imports per user
create table if not exists public.recruiter_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  rejected_rows integer not null default 0,
  status text not null default 'pending' check(status in ('pending','processing','completed','failed','cancelled')),
  share_consent boolean not null default false,
  created_at timestamptz not null default now(),
  unique(id, user_id)
);

alter table public.recruiter_import_batches enable row level security;
create policy owner_select on public.recruiter_import_batches for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.recruiter_import_batches for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.recruiter_import_batches for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_delete on public.recruiter_import_batches for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists recruiter_import_batches_owner_idx on public.recruiter_import_batches(user_id, created_at desc);

-- 3. recruiter_import_records: Stores individual import results and review state
create table if not exists public.recruiter_import_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check(status in ('pending','imported','rejected','skipped')),
  recruiter_id uuid,
  created_at timestamptz not null default now(),
  foreign key (batch_id, user_id) references public.recruiter_import_batches(id, user_id) on delete cascade,
  unique(id, user_id)
);

alter table public.recruiter_import_records enable row level security;
create policy owner_select on public.recruiter_import_records for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.recruiter_import_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.recruiter_import_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_delete on public.recruiter_import_records for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists recruiter_import_records_batch_idx on public.recruiter_import_records(batch_id, created_at asc);

-- 4. user_recruiters: Tracks user relationship with recruiters (links to recruiter_contacts or directory)
create table if not exists public.user_recruiters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recruiter_id uuid,
  contact_id uuid,
  personal_notes text,
  source text not null default 'manual' check(source in ('manual','csv_import','directory_discovery')),
  created_at timestamptz not null default now(),
  unique(id, user_id)
);

alter table public.user_recruiters enable row level security;
create policy owner_select on public.user_recruiters for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.user_recruiters for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.user_recruiters for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_delete on public.user_recruiters for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists user_recruiters_user_idx on public.user_recruiters(user_id, created_at desc);

