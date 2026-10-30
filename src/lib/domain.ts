import { z } from 'zod';
export const applicationStatuses = [
  'draft',
  'ready_for_review',
  'submitted',
  'awaiting_response',
  'under_review',
  'interview',
  'rejected',
  'offer',
  'closed',
] as const;
export const outreachStatuses = [
  'draft',
  'awaiting_approval',
  'scheduled',
  'sent',
  'replied',
  'paused',
  'completed',
  'cancelled',
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];
export type OutreachStatus = (typeof outreachStatuses)[number];
const applicationTransitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  draft: ['ready_for_review', 'closed'],
  ready_for_review: ['draft', 'submitted', 'closed'],
  submitted: ['awaiting_response', 'under_review', 'interview', 'rejected', 'closed'],
  awaiting_response: ['under_review', 'interview', 'rejected', 'closed'],
  under_review: ['interview', 'rejected', 'offer', 'closed'],
  interview: ['offer', 'rejected', 'closed'],
  rejected: ['closed'],
  offer: ['closed'],
  closed: [],
};
const outreachTransitions: Record<OutreachStatus, readonly OutreachStatus[]> = {
  draft: ['awaiting_approval', 'cancelled'],
  awaiting_approval: ['draft', 'scheduled', 'cancelled'],
  scheduled: ['sent', 'paused', 'cancelled'],
  sent: ['replied', 'paused', 'completed'],
  replied: ['completed'],
  paused: ['awaiting_approval', 'cancelled'],
  completed: [],
  cancelled: [],
};
export const canTransitionApplication = (from: ApplicationStatus, to: ApplicationStatus) =>
  applicationTransitions[from].includes(to);
export const canTransitionOutreach = (from: OutreachStatus, to: OutreachStatus) =>
  outreachTransitions[from].includes(to);
const webUrl = z.union([
  z.literal(''),
  z
    .url()
    .max(2048)
    .refine((v) => /^https?:\/\//.test(v), 'Use an HTTP or HTTPS URL'),
]);
export const applicationSchema = z.object({
  title: z.string().trim().min(2).max(160),
  company: z.string().trim().min(2).max(160),
  url: webUrl,
  location: z.string().trim().max(120),
});
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  headline: z.string().max(160),
  location: z.string().max(120),
  skills: z.string().max(2000),
  education: z.string().max(4000),
  experience: z.string().max(8000),
  projects: z.string().max(8000),
  portfolio: webUrl,
  github: webUrl,
  linkedin: webUrl,
});
export const preferencesSchema = z.object({
  roles: z.string().min(2).max(1000),
  locations: z.string().max(1000),
  workMode: z.enum(['remote', 'hybrid', 'on_site']),
  relocation: z.boolean(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship']),
  expectedCompensation: z.number().nonnegative(),
  currentCompensation: z.number().nonnegative().nullable(),
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP']),
  industries: z.string().max(1000),
});
export type CandidateProfile = z.infer<typeof profileSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export interface ApplicationEvent {
  id: string;
  at: string;
  description: string;
  from?: ApplicationStatus;
  to?: ApplicationStatus;
}
export interface JobApplication extends z.infer<typeof applicationSchema> {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  events: ApplicationEvent[];
}
export interface RecruiterContact {
  id: string;
  name: string;
  company: string;
  email: string;
  role: string;
  status: OutreachStatus;
  draft: string;
  subject?: string;
  followup: string;
  reply?: string;
  isSuppressed?: boolean;
  suppressionReason?: string;
}
export function nextFollowup(start: Date, days: number, skipWeekends = true): Date {
  if (!Number.isInteger(days) || days < 1 || days > 365)
    throw new Error('Days must be between 1 and 365');
  const result = new Date(start);
  result.setUTCDate(result.getUTCDate() + days);
  while (skipWeekends && [0, 6].includes(result.getUTCDay()))
    result.setUTCDate(result.getUTCDate() + 1);
  return result;
}
export const label = (value: string) => value.replaceAll('_', ' ');
