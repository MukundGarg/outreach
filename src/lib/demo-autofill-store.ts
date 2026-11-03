import type { AutofillFieldMapping, ApplicationAutofillData } from './domain';

// Global in-memory storage for demo session autofill state
const demoAutofillStore = new Map<string, {
  applicationUrl: string;
  fields: AutofillFieldMapping[];
  autofillStatus: 'idle' | 'analyzed' | 'partially_filled' | 'completed';
  extractedAt?: string;
  lastAutofilledAt?: string;
}>();

export function getDemoAutofill(appId: string): ApplicationAutofillData | null {
  const data = demoAutofillStore.get(appId);
  return data ? { ...data } : null;
}

export function setDemoAutofill(appId: string, data: Partial<ApplicationAutofillData>) {
  const current = demoAutofillStore.get(appId) || {
    applicationUrl: '',
    fields: [],
    autofillStatus: 'idle',
  };
  demoAutofillStore.set(appId, {
    ...current,
    ...data,
  });
}
