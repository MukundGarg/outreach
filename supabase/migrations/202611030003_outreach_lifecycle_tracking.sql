-- Forward-only migration for complete outreach lifecycle tracking and follow-up automation
-- Adds outreach activities, follow-up configuration on campaigns, enhanced email message tracking, and reply detection

-- 1. Extend outreach_campaigns with follow-up automation settings and tracking counts
alter table public.outreach_campaigns
  add column if not exists initial_delay_days integer not null default 3 check(initial_delay_days between 1 and 30),
  add column if not exists followup_interval_days integer not null default 3 check(followup_interval_days between 1 and 30),
  add column if not exists skip_weekends boolean not null default true,
  add column if not exists max_followups integer not null default 3 check(max_followups between 0 and 10),
  add column if not exists auto_send_followups boolean not null default false,
  add column if not exists followups_sent_count integer not null default 0 check(followups_sent_count >= 0),
  add column if not exists followups_failed_count integer not null default 0 check(followups_failed_count >= 0),
  add column if not exists last_followup_at timestamptz,
  add column if not exists next_followup_at timestamptz;

-- 2. Extend email_messages with follow-up metadata and sender address
alter table public.email_messages
  add column if not exists sender_email text,
  add column if not exists is_followup boolean not null default false,
  add column if not exists followup_number integer default 0,
  add column if not exists in_reply_to_message_id text;

-- 3. Extend followup_schedules with execution logging and claimed worker metadata
alter table public.followup_schedules
  add column if not exists campaign_id uuid references public.outreach_campaigns(id) on delete cascade,
  add column if not exists followup_number integer not null default 1,
  add column if not exists execution_error text,
  add column if not exists attempted_at timestamptz;

-- Index for worker claiming due schedules atomically
create index if not exists idx_followup_schedules_due
  on public.followup_schedules (status, scheduled_at)
  where status in ('approved', 'pending');

-- 4. Create outreach_activities table for comprehensive audit trail
create table if not exists public.outreach_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  recruiter_contact_id uuid references public.recruiter_contacts(id) on delete set null,
  message_id uuid references public.email_messages(id) on delete set null,
  activity_type text not null check(activity_type in (
    'initial_drafted',
    'initial_approved',
    'initial_sent',
    'initial_failed',
    'followup_scheduled',
    'followup_approved',
    'followup_sent',
    'followup_failed',
    'reply_received',
    'reply_classified',
    'followup_paused',
    'followup_resumed',
    'followup_cancelled',
    'contact_opted_out',
    'outreach_completed'
  )),
  title text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.outreach_activities enable row level security;
create policy owner_select on public.outreach_activities for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.outreach_activities for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.outreach_activities for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_delete on public.outreach_activities for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists idx_outreach_activities_campaign
  on public.outreach_activities (campaign_id, created_at desc);
create index if not exists idx_outreach_activities_user
  on public.outreach_activities (user_id, created_at desc);

