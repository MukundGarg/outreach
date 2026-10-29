-- Apply once with Supabase CLI or the SQL editor. Requires Supabase auth/storage schemas.
create type public.application_status as enum ('draft','ready_for_review','submitted','awaiting_response','under_review','interview','rejected','offer','closed');
create type public.outreach_status as enum ('draft','awaiting_approval','scheduled','sent','replied','paused','completed','cancelled');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', email text, headline text, location text,
 skills text[] not null default '{}', education jsonb not null default '[]',
 experience jsonb not null default '[]', projects jsonb not null default '[]',
 portfolio_url text, github_url text, linkedin_url text, verified_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.candidate_preferences (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 roles text[] not null default '{}', locations text[] not null default '{}',
 work_mode text not null default 'remote' check(work_mode in ('remote','hybrid','on_site')),
 relocation boolean not null default false,
 employment_type text not null default 'full_time' check(employment_type in ('full_time','part_time','contract','internship')),
 expected_compensation numeric check(expected_compensation>=0), current_compensation numeric check(current_compensation>=0),
 currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'), industries text[] not null default '{}',
 followup_days integer not null default 3 check(followup_days between 1 and 365), skip_weekends boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.resumes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null unique, file_name text not null, mime_type text not null check(mime_type='application/pdf'),
 size_bytes bigint not null check(size_bytes between 1 and 10485760),
 extraction_status text not null default 'pending' check(extraction_status in ('pending','completed','failed')),
 check(split_part(storage_path,'/',1)=user_id::text),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.job_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 2 and 160), company text not null check(length(company) between 2 and 160),
 url text not null default '', location text not null default '', job_description text,
 status public.application_status not null default 'draft',
 submission_idempotency_key uuid unique, submission_approved_at timestamptz, submitted_at timestamptz,
 check(status not in ('submitted','awaiting_response','under_review','interview','offer') or submission_approved_at is not null),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.application_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 application_id uuid not null, from_status public.application_status, to_status public.application_status not null,
 description text not null,
 foreign key(application_id,user_id) references public.job_applications(id,user_id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.recruiter_contacts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, email text not null, company text, role text, unique(user_id,email),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.outreach_campaigns (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 application_id uuid, recruiter_contact_id uuid not null, status public.outreach_status not null default 'draft',
 approved_at timestamptz,
 foreign key(application_id,user_id) references public.job_applications(id,user_id) on delete cascade,
 foreign key(recruiter_contact_id,user_id) references public.recruiter_contacts(id,user_id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.email_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 campaign_id uuid not null, gmail_message_id text, gmail_thread_id text,
 direction text not null default 'outbound' check(direction in ('inbound','outbound')),
 subject text not null, body text not null, status text not null default 'draft' check(status in ('draft','approved','sending','sent','failed','received')),
 idempotency_key uuid not null default gen_random_uuid() unique, approved_at timestamptz, sent_at timestamptz,
 reply_classification text check(reply_classification in ('interested','not_interested','out_of_office','other','needs_review')),
 unique(user_id,gmail_message_id),
 check(status not in ('sending','sent') or approved_at is not null),
 foreign key(campaign_id,user_id) references public.outreach_campaigns(id,user_id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.followup_schedules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 message_id uuid not null, scheduled_at timestamptz not null, skip_weekends boolean not null default true,
 status text not null default 'pending' check(status in ('pending','approved','claimed','completed','cancelled','failed')),
 approved_at timestamptz, claimed_at timestamptz, idempotency_key uuid not null default gen_random_uuid() unique,
 check(status not in ('approved','claimed','completed') or approved_at is not null),
 foreign key(message_id,user_id) references public.email_messages(id,user_id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.agent_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 application_id uuid, agent_kind text not null check(agent_kind in ('candidate','outreach','response')),
 mode text not null check(mode in ('mock','live')), status text not null default 'pending' check(status in ('pending','completed','failed')),
 external_run_id text, error_code text, completed_at timestamptz,
 foreign key(application_id,user_id) references public.job_applications(id,user_id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);

create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
alter table public.profiles enable row level security;
create policy owner_select on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy owner_insert on public.profiles for insert to authenticated with check ((select auth.uid())=id);
create policy owner_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy owner_delete on public.profiles for delete to authenticated using ((select auth.uid())=id);
create trigger touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
alter table public.candidate_preferences enable row level security;
create policy owner_select on public.candidate_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy owner_insert on public.candidate_preferences for insert to authenticated with check ((select auth.uid())=user_id);
create policy owner_update on public.candidate_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_delete on public.candidate_preferences for delete to authenticated using ((select auth.uid())=user_id);
create trigger touch_updated_at before update on public.candidate_preferences for each row execute function public.touch_updated_at();
create index candidate_preferences_owner_created_idx on public.candidate_preferences(user_id,created_at desc);
alter table public.resumes enable row level security;
create policy owner_select on public.resumes for select to authenticated using ((select auth.uid())=user_id);
create policy owner_insert on public.resumes for insert to authenticated with check ((select auth.uid())=user_id);
create policy owner_update on public.resumes for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_delete on public.resumes for delete to authenticated using ((select auth.uid())=user_id);
create trigger touch_updated_at before update on public.resumes for each row execute function public.touch_updated_at();
create index resumes_owner_created_idx on public.resumes(user_id,created_at desc);
alter table public.job_applications enable row level security;
create policy owner_select on public.job_applications for select to authenticated using ((select auth.uid())=user_id);
create policy owner_insert on public.job_applications for insert to authenticated with check ((select auth.uid())=user_id);
create policy owner_update on public.job_applications for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_delete on public.job_applications for delete to authenticated using ((select auth.uid())=user_id);
create trigger touch_updated_at before update on public.job_applications for each row execute function public.touch_updated_at();
create index job_applications_owner_created_idx on public.job_applications(user_id,created_at desc);
alter table public.application_events enable row level security;
create policy owner_select on public.application_events for select to authenticated using ((select auth.uid())=user_id);
create index application_events_owner_created_idx on public.application_events(user_id,created_at desc);
alter table public.recruiter_contacts enable row level security;
create policy owner_select on public.recruiter_contacts for select to authenticated using ((select auth.uid())=user_id);
create policy owner_insert on public.recruiter_contacts for insert to authenticated with check ((select auth.uid())=user_id);
create policy owner_update on public.recruiter_contacts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_delete on public.recruiter_contacts for delete to authenticated using ((select auth.uid())=user_id);
create trigger touch_updated_at before update on public.recruiter_contacts for each row execute function public.touch_updated_at();
create index recruiter_contacts_owner_created_idx on public.recruiter_contacts(user_id,created_at desc);
alter table public.outreach_campaigns enable row level security;
create policy owner_select on public.outreach_campaigns for select to authenticated using ((select auth.uid())=user_id);
create policy owner_insert on public.outreach_campaigns for insert to authenticated with check ((select auth.uid())=user_id);
create policy owner_update on public.outreach_campaigns for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_delete on public.outreach_campaigns for delete to authenticated using ((select auth.uid())=user_id);
create trigger touch_updated_at before update on public.outreach_campaigns for each row execute function public.touch_updated_at();
create index outreach_campaigns_owner_created_idx on public.outreach_campaigns(user_id,created_at desc);
alter table public.email_messages enable row level security;
create policy owner_select on public.email_messages for select to authenticated using ((select auth.uid())=user_id);
create policy owner_insert on public.email_messages for insert to authenticated with check ((select auth.uid())=user_id);
create policy owner_update on public.email_messages for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_delete on public.email_messages for delete to authenticated using ((select auth.uid())=user_id);
create trigger touch_updated_at before update on public.email_messages for each row execute function public.touch_updated_at();
create index email_messages_owner_created_idx on public.email_messages(user_id,created_at desc);
alter table public.followup_schedules enable row level security;
create policy owner_select on public.followup_schedules for select to authenticated using ((select auth.uid())=user_id);
create policy owner_insert on public.followup_schedules for insert to authenticated with check ((select auth.uid())=user_id);
create policy owner_update on public.followup_schedules for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_delete on public.followup_schedules for delete to authenticated using ((select auth.uid())=user_id);
create trigger touch_updated_at before update on public.followup_schedules for each row execute function public.touch_updated_at();
create index followup_schedules_owner_created_idx on public.followup_schedules(user_id,created_at desc);
alter table public.agent_runs enable row level security;
create policy owner_select on public.agent_runs for select to authenticated using ((select auth.uid())=user_id);
create policy owner_insert on public.agent_runs for insert to authenticated with check ((select auth.uid())=user_id);
create policy owner_update on public.agent_runs for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy owner_delete on public.agent_runs for delete to authenticated using ((select auth.uid())=user_id);
create trigger touch_updated_at before update on public.agent_runs for each row execute function public.touch_updated_at();
create index agent_runs_owner_created_idx on public.agent_runs(user_id,created_at desc);

create index applications_status_idx on public.job_applications(user_id,status);
create index events_application_idx on public.application_events(application_id,created_at);
create index campaigns_application_idx on public.outreach_campaigns(application_id);
create index campaigns_contact_idx on public.outreach_campaigns(recruiter_contact_id);
create index emails_campaign_idx on public.email_messages(campaign_id);
create index emails_thread_idx on public.email_messages(user_id,gmail_thread_id);
create index schedules_message_idx on public.followup_schedules(message_id);
create index schedules_due_idx on public.followup_schedules(status,scheduled_at);
create index runs_application_idx on public.agent_runs(application_id);

-- The trigger uses a fixed search_path and writes audit rows only for the changed application.
create function public.audit_application_state() returns trigger language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
 if tg_op='INSERT' then
   if new.status<>'draft' then raise exception 'New applications must begin as drafts'; end if;
 else
   if new.user_id<>old.user_id then raise exception 'Owner cannot change'; end if;
   if new.status=old.status then return new; end if;
   allowed=case old.status
    when 'draft' then new.status in ('ready_for_review','closed')
    when 'ready_for_review' then new.status in ('draft','submitted','closed')
    when 'submitted' then new.status in ('awaiting_response','under_review','interview','rejected','closed')
    when 'awaiting_response' then new.status in ('under_review','interview','rejected','closed')
    when 'under_review' then new.status in ('interview','rejected','offer','closed')
    when 'interview' then new.status in ('offer','rejected','closed')
    when 'rejected' then new.status='closed'
    when 'offer' then new.status='closed'
    else false end;
   if not allowed then raise exception 'Invalid application transition'; end if;
 end if;
 insert into public.application_events(user_id,application_id,from_status,to_status,description)
 values(new.user_id,new.id,case when tg_op='UPDATE' then old.status else null end,new.status,'Application status changed');
 return new;
end; $$;
create trigger application_state_audit after insert or update on public.job_applications for each row execute function public.audit_application_state();

create function public.guard_outreach_state() returns trigger language plpgsql set search_path='' as $$
declare allowed boolean;
begin
 if tg_op='INSERT' then
  if new.status<>'draft' then raise exception 'New outreach must begin as draft'; end if;
  return new;
 end if;
 if new.status=old.status then return new; end if;
 allowed=case old.status
 when 'draft' then new.status in ('awaiting_approval','cancelled')
 when 'awaiting_approval' then new.status in ('draft','scheduled','cancelled')
 when 'scheduled' then new.status in ('sent','paused','cancelled')
 when 'sent' then new.status in ('replied','paused','completed')
 when 'replied' then new.status='completed'
 when 'paused' then new.status in ('awaiting_approval','cancelled') else false end;
 if not allowed then raise exception 'Invalid outreach transition'; end if;
 if new.status in ('scheduled','sent') and new.approved_at is null then raise exception 'User approval required'; end if;
 return new;
end; $$;
create trigger outreach_state_guard before insert or update on public.outreach_campaigns for each row execute function public.guard_outreach_state();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('resumes','resumes',false,10485760,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
create policy resume_read on storage.objects for select to authenticated using(bucket_id='resumes' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy resume_insert on storage.objects for insert to authenticated with check(bucket_id='resumes' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy resume_update on storage.objects for update to authenticated using(bucket_id='resumes' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='resumes' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy resume_delete on storage.objects for delete to authenticated using(bucket_id='resumes' and (storage.foldername(name))[1]=(select auth.uid())::text);
