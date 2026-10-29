-- Forward-only migration for Gmail OAuth and user-approved email sending
-- Extends foundation schema with encrypted OAuth connections, recipient suppression, and approval audit

-- 1. Create gmail_oauth_connections table
create table if not exists public.gmail_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  email text not null,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, user_id)
);

alter table public.gmail_oauth_connections enable row level security;
create policy owner_select on public.gmail_oauth_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.gmail_oauth_connections for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.gmail_oauth_connections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_delete on public.gmail_oauth_connections for delete to authenticated using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.gmail_oauth_connections for each row execute function public.touch_updated_at();

-- 2. Add suppression and opt-out support to recruiter_contacts
alter table public.recruiter_contacts
  add column if not exists is_suppressed boolean not null default false,
  add column if not exists suppression_reason text,
  add column if not exists suppressed_at timestamptz;

-- 3. Enhance email_messages with recipient, approval fingerprint, and error categorization
alter table public.email_messages
  add column if not exists recipient_email text,
  add column if not exists approved_content_hash text,
  add column if not exists send_error_category text,
  add column if not exists send_error_details text;
