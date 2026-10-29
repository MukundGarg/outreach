'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  ApplicationStatus,
  CandidateProfile,
  JobApplication,
  Preferences,
  RecruiterContact,
} from '@/lib/domain';

export interface ResumeMetadata {
  id: string;
  storagePath: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export interface WorkspaceData {
  profile: CandidateProfile;
  preferences: Preferences;
  applications: JobApplication[];
  contacts: RecruiterContact[];
  resume: { resume: ResumeMetadata; signedUrl: string } | null;
}

const emptyData: WorkspaceData = {
  profile: {
    name: '',
    email: '',
    headline: '',
    location: '',
    skills: '',
    education: '',
    experience: '',
    projects: '',
    portfolio: '',
    github: '',
    linkedin: '',
  },
  preferences: {
    roles: '',
    locations: '',
    workMode: 'remote',
    relocation: false,
    employmentType: 'full_time',
    expectedCompensation: 0,
    currentCompensation: null,
    currency: 'USD',
    industries: '',
  },
  applications: [],
  contacts: [],
  resume: null,
};

interface AuthenticatedContextValue {
  data: WorkspaceData;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setProfile: (profile: CandidateProfile) => Promise<void>;
  setPreferences: (preferences: Preferences) => Promise<void>;
  addApplication: (input: unknown) => Promise<string>;
  transition: (id: string, status: ApplicationStatus, options?: { approved?: boolean }) => Promise<void>;
  uploadResumeFile: (file: File) => Promise<void>;
  deleteUserResume: (id: string) => Promise<void>;
}

const Context = createContext<AuthenticatedContextValue | null>(null);

export function AuthenticatedWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<WorkspaceData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [profRes, prefRes, appsRes, resumeRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/preferences'),
        fetch('/api/applications'),
        fetch('/api/resumes'),
      ]);

      if (!profRes.ok || !prefRes.ok || !appsRes.ok) {
        throw new Error('Failed to load workspace data from database.');
      }

      const profJson = await profRes.json();
      const prefJson = await prefRes.json();
      const appsJson = await appsRes.json();
      const resumeJson = resumeRes.ok ? await resumeRes.json() : { data: null };

      setData({
        profile: profJson.data ?? emptyData.profile,
        preferences: prefJson.data ?? emptyData.preferences,
        applications: appsJson.data ?? [],
        contacts: [],
        resume: resumeJson.data ?? null,
      });
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to connect to database');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [profRes, prefRes, appsRes, resumeRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/preferences'),
          fetch('/api/applications'),
          fetch('/api/resumes'),
        ]);

        if (!active) return;
        if (!profRes.ok || !prefRes.ok || !appsRes.ok) {
          throw new Error('Failed to load workspace data from database.');
        }

        const profJson = await profRes.json();
        const prefJson = await prefRes.json();
        const appsJson = await appsRes.json();
        const resumeJson = resumeRes.ok ? await resumeRes.json() : { data: null };

        if (!active) return;
        setData({
          profile: profJson.data ?? emptyData.profile,
          preferences: prefJson.data ?? emptyData.preferences,
          applications: appsJson.data ?? [],
          contacts: [],
          resume: resumeJson.data ?? null,
        });
        setError(null);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to connect to database');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSetProfile = async (profile: CandidateProfile) => {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save profile');
    }
    const json = await res.json();
    setData((d) => ({ ...d, profile: json.data }));
  };

  const handleSetPreferences = async (preferences: Preferences) => {
    const res = await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save preferences');
    }
    const json = await res.json();
    setData((d) => ({ ...d, preferences: json.data }));
  };

  const handleAddApplication = async (input: unknown): Promise<string> => {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create application');
    }
    const json = await res.json();
    const newApp: JobApplication = json.data;
    setData((d) => ({ ...d, applications: [newApp, ...d.applications] }));
    return newApp.id;
  };

  const handleTransition = async (
    id: string,
    status: ApplicationStatus,
    options?: { approved?: boolean },
  ) => {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, approved: options?.approved }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to transition application');
    }
    const json = await res.json();
    const updated: JobApplication = json.data;
    setData((d) => ({
      ...d,
      applications: d.applications.map((a) => (a.id === id ? updated : a)),
    }));
  };

  const handleUploadResume = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/resumes', {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }
    const json = await res.json();
    setData((d) => ({ ...d, resume: json.data }));
  };

  const handleDeleteResume = async (id: string) => {
    const res = await fetch(`/api/resumes?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Delete failed');
    }
    setData((d) => ({ ...d, resume: null }));
  };

  return (
    <Context.Provider
      value={{
        data,
        loading,
        error,
        refresh: loadData,
        setProfile: handleSetProfile,
        setPreferences: handleSetPreferences,
        addApplication: handleAddApplication,
        transition: handleTransition,
        uploadResumeFile: handleUploadResume,
        deleteUserResume: handleDeleteResume,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAuthenticatedWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('AuthenticatedWorkspaceProvider is required');
  return ctx;
}
