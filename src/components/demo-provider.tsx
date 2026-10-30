'use client';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { demoApplications, demoProfile, demoPreferences, demoContacts } from '@/lib/demo';
import {
  applicationSchema,
  applicationStatuses,
  outreachStatuses,
  profileSchema,
  preferencesSchema,
  canTransitionApplication,
  type ApplicationStatus,
  type JobApplication,
  type CandidateProfile,
  type Preferences,
  type RecruiterContact,
} from '@/lib/domain';
type Data = {
  profile: CandidateProfile;
  preferences: Preferences;
  applications: JobApplication[];
  contacts: RecruiterContact[];
};
const initial: Data = {
  profile: demoProfile,
  preferences: demoPreferences,
  applications: demoApplications,
  contacts: demoContacts,
};
const snapshotSchema = z.object({
  profile: profileSchema,
  preferences: preferencesSchema,
  applications: z.array(
    applicationSchema.extend({
      id: z.string(),
      status: z.enum(applicationStatuses),
      createdAt: z.iso.datetime(),
      events: z.array(
        z.object({
          id: z.string(),
          at: z.iso.datetime(),
          description: z.string(),
          from: z.enum(applicationStatuses).optional(),
          to: z.enum(applicationStatuses).optional(),
        }),
      ),
    }),
  ),
  contacts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      company: z.string(),
      email: z.email(),
      role: z.string(),
      status: z.enum(outreachStatuses),
      draft: z.string(),
      subject: z.string().optional(),
      followup: z.string(),
    }),
  ),
});
const storageKey = 'applypilot-demo-v1';
let snapshot = initial;
let loaded = false;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getSnapshot() {
  if (!loaded) {
    loaded = true;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = snapshotSchema.safeParse(JSON.parse(raw));
        if (parsed.success) snapshot = parsed.data;
      }
    } catch {
      /* Storage can be unavailable; retain the in-memory demo. */
    }
  }
  return snapshot;
}
function update(change: (data: Data) => Data) {
  snapshot = change(getSnapshot());
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    /* In-memory editing remains available when storage is blocked. */
  }
  listeners.forEach((listener) => listener());
}
const Context = createContext<{
  data: Data;
  setProfile: (v: CandidateProfile) => void;
  setPreferences: (v: Preferences) => void;
  addApplication: (v: unknown) => string;
  transition: (id: string, status: ApplicationStatus) => void;
  updateDraft?: (contactId: string, subject: string, draft: string) => void;
  reset: () => void;
} | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  function addApplication(input: unknown) {
    const value = applicationSchema.parse(input);
    const id = crypto.randomUUID();
    const at = new Date().toISOString();
    update((d) => ({
      ...d,
      applications: [
        {
          ...value,
          id,
          status: 'draft',
          createdAt: at,
          events: [
            { id: crypto.randomUUID(), at, description: 'Added locally in demo mode', to: 'draft' },
          ],
        },
        ...d.applications,
      ],
    }));
    return id;
  }
  function transition(id: string, status: ApplicationStatus) {
    update((d) => ({
      ...d,
      applications: d.applications.map((a) =>
        a.id === id && canTransitionApplication(a.status, status)
          ? {
              ...a,
              status,
              events: [
                ...a.events,
                {
                  id: crypto.randomUUID(),
                  at: new Date().toISOString(),
                  description: `Demo status changed to ${status.replaceAll('_', ' ')}`,
                  from: a.status,
                  to: status,
                },
              ],
            }
          : a,
      ),
    }));
  }
  return (
    <Context.Provider
      value={{
        data,
        setProfile: (profile) => update((d) => ({ ...d, profile: profileSchema.parse(profile) })),
        setPreferences: (preferences) =>
          update((d) => ({ ...d, preferences: preferencesSchema.parse(preferences) })),
        addApplication,
        transition,
        updateDraft: (contactId: string, subject: string, draft: string) => {
          update((d) => ({
            ...d,
            contacts: d.contacts.map((c) =>
              c.id === contactId ? { ...c, subject, draft } : c,
            ),
          }));
        },
        reset: () => update(() => initial),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDemo() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('Demo provider is required');
  return ctx;
}
