import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import {
  candidateProfileToProfileRow,
  preferencesToPreferencesRow,
  profileRowToCandidateProfile,
  preferencesRowToPreferences,
} from '@/lib/mappers';
import {
  profileSchema,
  preferencesSchema,
  applicationSchema,
  canTransitionApplication,
  type CandidateProfile,
  type Preferences,
  type ApplicationStatus,
  type RecruiterContact,
} from '@/lib/domain';
import type { Database } from '@/lib/supabase/database.types';

export async function authenticatedDatabase() {
  const db = await supabaseServer();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error('Authentication required');
  return { db, user };
}

// ---------------- Profiles ----------------

export async function getProfile() {
  const { db, user } = await authenticatedDatabase();
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return profileRowToCandidateProfile(data);
}

export async function upsertProfile(input: unknown): Promise<CandidateProfile> {
  const profile = profileSchema.parse(input);
  const { db, user } = await authenticatedDatabase();
  const row = candidateProfileToProfileRow(profile, user.id);

  const { data, error } = await db
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return profileRowToCandidateProfile(data);
}

// ---------------- Preferences ----------------

export async function getPreferences() {
  const { db, user } = await authenticatedDatabase();
  const { data, error } = await db
    .from('candidate_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return preferencesRowToPreferences(data);
}

export async function upsertPreferences(input: unknown): Promise<Preferences> {
  const prefs = preferencesSchema.parse(input);
  const { db, user } = await authenticatedDatabase();
  const row = preferencesToPreferencesRow(prefs, user.id);

  const { data, error } = await db
    .from('candidate_preferences')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return preferencesRowToPreferences(data);
}

// ---------------- Applications ----------------

export async function listApplications() {
  const { db, user } = await authenticatedDatabase();
  const [appsRes, eventsRes] = await Promise.all([
    db.from('job_applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    db.from('application_events').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
  ]);

  if (appsRes.error) throw appsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const eventsByApp = (eventsRes.data || []).reduce((acc, ev) => {
    if (!acc[ev.application_id]) acc[ev.application_id] = [];
    acc[ev.application_id].push({
      id: ev.id,
      at: ev.created_at,
      description: ev.description,
      from: ev.from_status ?? undefined,
      to: ev.to_status,
    });
    return acc;
  }, {} as Record<string, Array<{ id: string; at: string; description: string; from?: ApplicationStatus; to?: ApplicationStatus }>>);

  return (appsRes.data || []).map((app) => ({
    id: app.id,
    title: app.title,
    company: app.company,
    url: app.url,
    location: app.location,
    status: app.status,
    createdAt: app.created_at,
    events: eventsByApp[app.id] || [],
  }));
}

export async function getApplication(id: string) {
  const { db, user } = await authenticatedDatabase();
  const [appRes, eventsRes] = await Promise.all([
    db.from('job_applications').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
    db.from('application_events').select('*').eq('application_id', id).eq('user_id', user.id).order('created_at', { ascending: true }),
  ]);

  if (appRes.error) throw appRes.error;
  if (!appRes.data) return null;
  if (eventsRes.error) throw eventsRes.error;

  const events = (eventsRes.data || []).map((ev) => ({
    id: ev.id,
    at: ev.created_at,
    description: ev.description,
    from: ev.from_status ?? undefined,
    to: ev.to_status,
  }));

  return {
    id: appRes.data.id,
    title: appRes.data.title,
    company: appRes.data.company,
    url: appRes.data.url,
    location: appRes.data.location,
    status: appRes.data.status,
    createdAt: appRes.data.created_at,
    events,
  };
}

export async function createApplication(input: unknown) {
  const value = applicationSchema.parse(input);
  const { db, user } = await authenticatedDatabase();
  const { data, error } = await db
    .from('job_applications')
    .insert({
      user_id: user.id,
      title: value.title,
      company: value.company,
      url: value.url,
      location: value.location,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    company: data.company,
    url: data.url,
    location: data.location,
    status: data.status,
    createdAt: data.created_at,
    events: [
      {
        id: crypto.randomUUID(),
        at: data.created_at,
        description: 'Application status changed',
        to: 'draft' as ApplicationStatus,
      },
    ],
  };
}

/**
 * Transitions an application's status with server-side validation and DB audit enforcement.
 * If moving to 'submitted' or beyond, requires an explicit user approval timestamp.
 */
export async function transitionApplication(
  id: string,
  targetStatus: ApplicationStatus,
  options?: { approved?: boolean },
) {
  const { db, user } = await authenticatedDatabase();

  // 1. Fetch current status
  const { data: current, error: fetchErr } = await db
    .from('job_applications')
    .select('id, status, submission_approved_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !current) throw new Error('Application not found');

  // 2. Validate allowed transition in domain
  if (!canTransitionApplication(current.status, targetStatus)) {
    throw new Error(`Cannot transition application from ${current.status} to ${targetStatus}`);
  }

  // 3. Check submission approval requirement
  const requiresApproval = [
    'submitted',
    'awaiting_response',
    'under_review',
    'interview',
    'offer',
  ].includes(targetStatus);

  const updates: Partial<Database['public']['Tables']['job_applications']['Update']> = {
    status: targetStatus,
  };

  if (requiresApproval) {
    if (!current.submission_approved_at) {
      if (!options?.approved) {
        throw new Error('Explicit user approval is required before transitioning to submitted or active pipeline status');
      }
      updates.submission_approved_at = new Date().toISOString();
    }
    if (targetStatus === 'submitted') {
      updates.submitted_at = new Date().toISOString();
    }
  }

  // 4. Update row; database trigger 'application_state_audit' validates transition and inserts application_events row
  const { data, error: updateErr } = await db
    .from('job_applications')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (updateErr) throw updateErr;

  return getApplication(data.id);
}

// ---------------- Contacts ----------------

export async function listContacts(): Promise<RecruiterContact[]> {
  const { db, user } = await authenticatedDatabase();
  const { data: contacts, error } = await db
    .from('recruiter_contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!contacts || contacts.length === 0) return [];

  // Fetch campaigns and latest drafts for each contact
  const contactIds = contacts.map((c) => c.id);
  const { data: campaigns } = await db
    .from('outreach_campaigns')
    .select('id, recruiter_contact_id, status')
    .eq('user_id', user.id)
    .in('recruiter_contact_id', contactIds);

  const campaignMap = new Map<string, { id: string; status: string }>();
  for (const camp of campaigns || []) {
    campaignMap.set(camp.recruiter_contact_id, { id: camp.id, status: camp.status });
  }

  // Fetch latest email messages for these campaigns
  const campaignIds = (campaigns || []).map((c) => c.id);
  const messagesMap = new Map<string, { body: string; subject: string; status: string }>();
  if (campaignIds.length > 0) {
    const { data: messages } = await db
      .from('email_messages')
      .select('campaign_id, body, subject, status, created_at')
      .eq('user_id', user.id)
      .in('campaign_id', campaignIds)
      .order('created_at', { ascending: false });

    for (const msg of messages || []) {
      if (!messagesMap.has(msg.campaign_id)) {
        messagesMap.set(msg.campaign_id, { body: msg.body, subject: msg.subject, status: msg.status });
      }
    }
  }

  return contacts.map((c) => {
    const camp = campaignMap.get(c.id);
    const msg = camp ? messagesMap.get(camp.id) : undefined;
    return {
      id: c.id,
      name: c.name,
      company: c.company || '',
      email: c.email,
      role: c.role || '',
      status: (camp?.status as RecruiterContact['status']) || 'draft',
      draft: msg?.body || '',
      followup: '',
      isSuppressed: c.is_suppressed || false,
      suppressionReason: c.suppression_reason || undefined,
    };
  });
}

export async function createContact(input: {
  name: string;
  email: string;
  company?: string;
  role?: string;
}): Promise<RecruiterContact> {
  const { db, user } = await authenticatedDatabase();
  const { data, error } = await db
    .from('recruiter_contacts')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      company: input.company?.trim() || null,
      role: input.role?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`A recruiter contact with email "${input.email}" already exists.`);
    }
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    company: data.company || '',
    email: data.email,
    role: data.role || '',
    status: 'draft',
    draft: '',
    followup: '',
    isSuppressed: false,
  };
}

export async function deleteContact(id: string): Promise<void> {
  const { db, user } = await authenticatedDatabase();
  const { error } = await db
    .from('recruiter_contacts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}
