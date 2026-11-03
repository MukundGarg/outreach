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

  return (appsRes.data || []).map((app) => {
    const recoveredPrep = parseStoredPreparation(app.application_preparation, app.job_description);
    let cleanedJobDesc = app.job_description;
    if (cleanedJobDesc && cleanedJobDesc.trim().startsWith('{') && recoveredPrep?.jobDescription) {
      cleanedJobDesc = recoveredPrep.jobDescription;
    }
    return {
      id: app.id,
      title: app.title,
      company: app.company,
      url: app.url,
      location: app.location,
      status: app.status,
      jobDescription: cleanedJobDesc,
      preparation: recoveredPrep,
      createdAt: app.created_at,
      events: eventsByApp[app.id] || [],
    };
  });
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

  const recoveredPrep = parseStoredPreparation(appRes.data.application_preparation, appRes.data.job_description);
  let cleanedJobDesc = appRes.data.job_description;

  // If job_description was previously polluted with JSON fallback, recover original text if possible
  if (cleanedJobDesc && cleanedJobDesc.trim().startsWith('{') && recoveredPrep?.jobDescription) {
    cleanedJobDesc = recoveredPrep.jobDescription;
  }

  return {
    id: appRes.data.id,
    title: appRes.data.title,
    company: appRes.data.company,
    url: appRes.data.url,
    location: appRes.data.location,
    status: appRes.data.status,
    jobDescription: cleanedJobDesc,
    preparation: recoveredPrep,
    createdAt: appRes.data.created_at,
    events,
  };
}

function parseStoredPreparation(
  prepColumn: unknown,
  jobDescColumn: string | null,
): import('@/lib/domain').ApplicationPreparation | null {
  if (prepColumn && typeof prepColumn === 'object') {
    return prepColumn as import('@/lib/domain').ApplicationPreparation;
  }

  // Gracefully recover preparation if previously written into job_description
  if (jobDescColumn && jobDescColumn.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(jobDescColumn);
      if (parsed && typeof parsed === 'object' && ('screening_answers' in parsed || 'email_draft' in parsed || 'screeningAnswers' in parsed || 'autofill' in parsed)) {
        return {
          screeningAnswers: parsed.screeningAnswers || parsed.screening_answers,
          unresolvedAnswers: parsed.unresolvedAnswers || parsed.unresolved_answers,
          emailSubject: parsed.emailSubject || parsed.email_draft?.subject,
          emailBody: parsed.emailBody || parsed.email_draft?.body,
          jobDescription: parsed.jobDescription || parsed.job_description,
          autofill: parsed.autofill,
          updatedAt: parsed.updatedAt || parsed.updated_at,
        };
      }
    } catch { }
  }

  return null;
}

/**
 * Saves application preparation (screening answers, unresolved answers, email draft, autofill)
 * without triggering an application status transition.
 * Persists preparation exclusively in `application_preparation`.
 * Preserves existing job descriptions and never overwrites job_description with JSON or null.
 */
export async function saveApplicationPreparation(
  id: string,
  preparation: import('@/lib/domain').ApplicationPreparation,
) {
  const { db, user } = await authenticatedDatabase();

  const prepPayload = {
    ...preparation,
    updatedAt: new Date().toISOString(),
  };

  const updateData: {
    application_preparation: Database['public']['Tables']['job_applications']['Update']['application_preparation'];
    job_description?: string;
  } = {
    application_preparation: prepPayload as unknown as Database['public']['Tables']['job_applications']['Update']['application_preparation'],
  };

  // Only update job_description if an explicit non-null replacement description was provided
  if (typeof preparation.jobDescription === 'string' && preparation.jobDescription.trim().length > 0) {
    updateData.job_description = preparation.jobDescription;
  }

  const { error } = await db
    .from('job_applications')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    if (error.code === '42703' || error.message?.includes('application_preparation')) {
      throw new Error(
        'Database migration required: The column "application_preparation" does not exist in job_applications table. Please apply migration 202611030001_application_preparation.sql.',
      );
    }
    throw error;
  }

  return getApplication(id);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let campaigns: any[] = [];
  try {
    const { data, error: campError } = await db
      .from('outreach_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .in('recruiter_contact_id', contactIds);

    if (campError) {
      // Check if error is due to missing optional lifecycle columns (Postgres error 42703 or column error)
      const isMissingCol =
        campError.code === '42703' ||
        campError.message?.includes('does not exist') ||
        campError.message?.includes('column');

      if (isMissingCol) {
        // Fallback to core columns present in the baseline schema
        const { data: fallbackData, error: fallbackError } = await db
          .from('outreach_campaigns')
          .select('id, user_id, application_id, recruiter_contact_id, status, approved_at, created_at, updated_at')
          .eq('user_id', user.id)
          .in('recruiter_contact_id', contactIds);

        if (fallbackError) throw fallbackError;
        campaigns = fallbackData || [];
      } else {
        throw campError;
      }
    } else {
      campaigns = data || [];
    }
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj?.code === '42703' || errorObj?.message?.includes('column') || errorObj?.message?.includes('does not exist')) {
      const { data: fallbackData, error: fallbackError } = await db
        .from('outreach_campaigns')
        .select('id, user_id, application_id, recruiter_contact_id, status, approved_at, created_at, updated_at')
        .eq('user_id', user.id)
        .in('recruiter_contact_id', contactIds);

      if (fallbackError) throw fallbackError;
      campaigns = fallbackData || [];
    } else {
      throw err;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const campaignMap = new Map<string, any>();
  for (const camp of campaigns || []) {
    campaignMap.set(camp.recruiter_contact_id, camp);
  }

  // Fetch email messages for these campaigns
  const campaignIds = (campaigns || []).map((c) => c.id);
  interface MessageSummary {
    initialDraftBody: string;
    initialDraftSubject?: string;
    initialSentAt?: string;
    latestMsgBody: string;
    latestMsgSubject?: string;
    latestMsgStatus: string;
    latestSentAt?: string;
    latestReplyClassification?: string;
    latestReplyBody?: string;
  }
  const messagesMap = new Map<string, MessageSummary>();

  if (campaignIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let messages: any[] = [];
    try {
      const { data, error: msgError } = await db
        .from('email_messages')
        .select('campaign_id, body, subject, status, created_at, sent_at, reply_classification, direction, is_followup')
        .eq('user_id', user.id)
        .in('campaign_id', campaignIds)
        .order('created_at', { ascending: true }); // Process chronologically to find initial outbound, latest activity, and latest reply

      if (msgError) {
        // If is_followup is missing in older schemas (code 42703), fallback safely
        const isMissingCol =
          msgError.code === '42703' ||
          msgError.message?.includes('does not exist') ||
          msgError.message?.includes('is_followup');

        if (isMissingCol) {
          const { data: fallbackMsgs, error: fallbackErr } = await db
            .from('email_messages')
            .select('campaign_id, body, subject, status, created_at, sent_at, reply_classification, direction')
            .eq('user_id', user.id)
            .in('campaign_id', campaignIds)
            .order('created_at', { ascending: true });

          if (fallbackErr) throw fallbackErr;
          messages = fallbackMsgs || [];
        } else {
          throw msgError;
        }
      } else {
        messages = data || [];
      }
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === '42703' || errorObj?.message?.includes('is_followup') || errorObj?.message?.includes('does not exist')) {
        const { data: fallbackMsgs, error: fallbackErr } = await db
          .from('email_messages')
          .select('campaign_id, body, subject, status, created_at, sent_at, reply_classification, direction')
          .eq('user_id', user.id)
          .in('campaign_id', campaignIds)
          .order('created_at', { ascending: true });

        if (fallbackErr) throw fallbackErr;
        messages = fallbackMsgs || [];
      } else {
        throw err;
      }
    }

    for (const msg of messages || []) {
      let entry = messagesMap.get(msg.campaign_id);
      if (!entry) {
        entry = {
          initialDraftBody: '',
          initialDraftSubject: undefined,
          initialSentAt: undefined,
          latestMsgBody: msg.body,
          latestMsgSubject: msg.subject,
          latestMsgStatus: msg.status,
          latestSentAt: msg.sent_at || undefined,
          latestReplyClassification: undefined,
          latestReplyBody: undefined,
        };
        messagesMap.set(msg.campaign_id, entry);
      }

      // 1. Initial outreach draft preservation:
      // An outbound message that is not marked as a follow-up (or the earliest outbound message if is_followup is null/undefined)
      const isOutbound = msg.direction === 'outbound' || !msg.direction;
      const isExplicitFollowup = msg.is_followup === true;
      if (isOutbound && !isExplicitFollowup && !entry.initialDraftBody) {
        entry.initialDraftBody = msg.body;
        entry.initialDraftSubject = msg.subject || undefined;
        entry.initialSentAt = msg.sent_at || undefined;
      }

      // If initial draft is still empty and this is the first outbound message encountered (fallback)
      if (isOutbound && !entry.initialDraftBody) {
        entry.initialDraftBody = msg.body;
        entry.initialDraftSubject = msg.subject || undefined;
        entry.initialSentAt = msg.sent_at || undefined;
      }

      // 2. Latest activity tracking (chronologically ordered, so later items update latest)
      entry.latestMsgBody = msg.body;
      entry.latestMsgSubject = msg.subject;
      entry.latestMsgStatus = msg.status;
      if (msg.sent_at) {
        entry.latestSentAt = msg.sent_at;
      }

      // 3. Latest inbound reply tracking (for reply classification & reply info)
      if (msg.direction === 'inbound') {
        entry.latestReplyClassification = msg.reply_classification || entry.latestReplyClassification;
        entry.latestReplyBody = msg.body;
      } else if (msg.reply_classification) {
        entry.latestReplyClassification = msg.reply_classification;
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
      draft: msg?.initialDraftBody || (msg?.latestMsgBody && !msg?.latestReplyBody ? msg.latestMsgBody : ''),
      subject: msg?.initialDraftSubject || undefined,
      followup: camp?.next_followup_at || '',
      isSuppressed: c.is_suppressed || false,
      suppressionReason: c.suppression_reason || undefined,
      campaignId: camp?.id,
      initialSentAt: msg?.initialSentAt,
      followupsSentCount: typeof camp?.followups_sent_count === 'number' ? camp.followups_sent_count : 0,
      followupsFailedCount: typeof camp?.followups_failed_count === 'number' ? camp.followups_failed_count : 0,
      lastFollowupAt: camp?.last_followup_at ?? null,
      nextFollowupAt: camp?.next_followup_at ?? null,
      maxFollowups: typeof camp?.max_followups === 'number' ? camp.max_followups : 3,
      autoSendFollowups: typeof camp?.auto_send_followups === 'boolean' ? camp.auto_send_followups : false,
      replyClassification: msg?.latestReplyClassification,
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
