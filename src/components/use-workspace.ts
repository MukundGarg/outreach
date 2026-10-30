'use client';
import { useDemo } from './demo-provider';
import { useAuthenticatedWorkspace } from './authenticated-provider';
import { useWorkspaceConfig } from './workspace-config';
import type {
  CandidateProfile,
  Preferences,
  JobApplication,
  RecruiterContact,
  ApplicationStatus,
} from '@/lib/domain';

export interface UnifiedWorkspaceContext {
  isDemo: boolean;
  loading: boolean;
  error: string | null;
  refresh?: () => Promise<void>;
  data: {
    profile: CandidateProfile;
    preferences: Preferences;
    applications: JobApplication[];
    contacts: RecruiterContact[];
    resume?: {
      resume: {
        id: string;
        storagePath: string;
        fileName: string;
        sizeBytes: number;
        createdAt: string;
      };
      signedUrl: string;
    } | null;
  };
  setProfile: (profile: CandidateProfile) => Promise<void> | void;
  setPreferences: (preferences: Preferences) => Promise<void> | void;
  addApplication: (input: unknown) => Promise<string> | string;
  transition: (
    id: string,
    status: ApplicationStatus,
    options?: { approved?: boolean },
  ) => Promise<void> | void;
  uploadResumeFile?: (file: File) => Promise<void>;
  deleteUserResume?: (id: string) => Promise<void>;
  addContact?: (input: { name: string; email: string; company?: string; role?: string }) => Promise<RecruiterContact>;
  deleteContact?: (id: string) => Promise<void>;
  updateDraft?: (contactId: string, subject: string, draft: string) => void;
  resetDemo?: () => void;
}

export function useWorkspace(overrideIsDemo?: boolean): UnifiedWorkspaceContext {
  const config = useWorkspaceConfig();
  const isDemo = overrideIsDemo ?? config.isDemo;

  if (isDemo) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const demo = useDemo();
    return {
      isDemo: true,
      loading: false,
      error: null,
      data: demo.data,
      setProfile: demo.setProfile,
      setPreferences: demo.setPreferences,
      addApplication: demo.addApplication,
      transition: (id, status) => demo.transition(id, status),
      updateDraft: demo.updateDraft,
      resetDemo: demo.reset,
    };
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuthenticatedWorkspace();
    return {
      isDemo: false,
      loading: auth.loading,
      error: auth.error,
      refresh: auth.refresh,
      data: auth.data,
      setProfile: auth.setProfile,
      setPreferences: auth.setPreferences,
      addApplication: auth.addApplication,
      transition: auth.transition,
      uploadResumeFile: auth.uploadResumeFile,
      deleteUserResume: auth.deleteUserResume,
      addContact: auth.addContact,
      deleteContact: auth.deleteContact,
    };
  }
}

