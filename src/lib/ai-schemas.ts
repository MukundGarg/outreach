import { z } from 'zod';
import { profileSchema } from './domain';

// --- Task 5: Gemini Structured Output Schemas ---

export const extractedProfileSchema = profileSchema.partial().extend({
  name: z.string().trim().min(1).default(''),
  email: z.string().trim().email().or(z.literal('')).default(''),
  headline: z.string().default(''),
  location: z.string().default(''),
  skills: z.string().default(''),
  education: z.string().default(''),
  experience: z.string().default(''),
  projects: z.string().default(''),
  portfolio: z.string().default(''),
  github: z.string().default(''),
  linkedin: z.string().default(''),
  confidence_score: z.number().min(0).max(1).optional(),
});
export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;

export const jobAnalysisSchema = z.object({
  job_summary: z.string(),
  requirements: z.array(z.string()),
  matched_requirements: z.array(z.string()),
  missing_requirements: z.array(z.string()),
  match_score: z.number().min(0).max(100),
  key_technologies: z.array(z.string()),
  role_level: z.string(),
  recommendations: z.array(z.string()),
});
export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

export const replyClassificationSchema = z.object({
  classification: z.enum([
    'interview_invitation',
    'positive_interest',
    'under_review',
    'rejection',
    'opt_out',
    'out_of_office',
    'neutral',
    'uncertain',
  ]),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
  suggested_action: z.string(),
  evidence: z.string().optional().default(''),
});
export type ReplyClassification = z.infer<typeof replyClassificationSchema>;

export const basicAnswerDraftSchema = z.object({
  question: z.string(),
  answer: z.string(),
  key_points_used: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type BasicAnswerDraft = z.infer<typeof basicAnswerDraftSchema>;

// --- Task 4 & 7: Dify Agent 1 (Application Intelligence) Schema ---

export const fieldMappingSchema = z.object({
  field_name: z.string(),
  proposed_value: z.string(),
  evidence: z.string(),
  requires_review: z.boolean(),
});
export type FieldMapping = z.infer<typeof fieldMappingSchema>;

export const screeningAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  evidence: z.string(),
  requires_review: z.boolean(),
});
export type ScreeningAnswer = z.infer<typeof screeningAnswerSchema>;

export const difyApplicationIntelligenceSchema = z.object({
  job_summary: z.string(),
  requirements: z.array(z.string()),
  matched_requirements: z.array(z.string()),
  missing_requirements: z.array(z.string()),
  field_mappings: z.array(fieldMappingSchema),
  screening_answers: z.array(screeningAnswerSchema),
  unresolved_questions: z.array(z.string()),
  ready_for_review: z.boolean(),
  recommended_next_action: z.string(),
});
export type DifyApplicationIntelligence = z.infer<typeof difyApplicationIntelligenceSchema>;

// --- Task 4 & 8: Dify Agent 2 (Outreach Intelligence) Schema ---

export const difyOutreachIntelligenceSchema = z.object({
  recommended_action: z.enum(['draft_initial', 'draft_followup', 'pause', 'stop', 'needs_review']),
  subject: z.string().nullable(),
  email_body: z.string().nullable(),
  personalization_evidence: z.array(z.string()),
  reasoning_summary: z.string(),
  reply_interpretation: z.string().nullable(),
  followup_eligible: z.boolean(),
  suggested_delay_business_days: z.number().int().nullable(),
  warnings: z.array(z.string()),
  requires_user_approval: z.literal(true),
});
export type DifyOutreachIntelligence = z.infer<typeof difyOutreachIntelligenceSchema>;

export const applicationEmailDraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});
export type ApplicationEmailDraft = z.infer<typeof applicationEmailDraftSchema>;

// --- Bulk Recruiter CSV Extraction Schema ---

export const canonicalRecruiterRecordSchema = z.object({
  full_name: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  job_title: z.string().nullable().default(null),
  company: z.string().nullable().default(null),
  linkedin_url: z.string().nullable().default(null),
  company_website: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  recruiting_specialties: z.array(z.string()).default([]),
  source_url: z.string().nullable().default(null),
  verification_status: z
    .enum(['parsed', 'needs_review', 'pending_verification', 'verified', 'rejected', 'stale'])
    .default('parsed'),
  validation_issues: z.array(z.string()).default([]),
});
export type CanonicalRecruiterRecord = z.infer<typeof canonicalRecruiterRecordSchema>;

export const csvRecruiterBatchAnalysisSchema = z.object({
  column_mapping: z.record(z.string(), z.string()),
  recruiters: z.array(canonicalRecruiterRecordSchema),
  confidence_score: z.number().min(0).max(1).default(1),
});
export type CsvRecruiterBatchAnalysis = z.infer<typeof csvRecruiterBatchAnalysisSchema>;

// --- Autofill Field Extraction & Question Classification Schemas ---

export const extractedFormFieldSchema = z.object({
  fieldId: z.string(),
  fieldLabel: z.string(),
  fieldType: z.enum(['text', 'textarea', 'email', 'tel', 'select', 'radio', 'checkbox']),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
});
export type ExtractedFormField = z.infer<typeof extractedFormFieldSchema>;

export const questionClassificationSchema = z.object({
  category: z.enum(['basic', 'complex', 'sensitive', 'profile_direct']),
  reason: z.string(),
  requiresHumanInput: z.boolean(),
  suggestedAnswer: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.9),
});
export type QuestionClassification = z.infer<typeof questionClassificationSchema>;

export const batchAutofillAnalysisSchema = z.object({
  fields: z.array(
    z.object({
      fieldId: z.string(),
      fieldLabel: z.string(),
      fieldType: z.enum(['text', 'textarea', 'email', 'tel', 'select', 'radio', 'checkbox']),
      proposedValue: z.string(),
      source: z.enum(['profile', 'gemini_basic', 'gemini_complex', 'user']),
      category: z.enum(['profile', 'mapped_answer', 'gemini_basic', 'complex_review', 'sensitive', 'missing']),
      status: z.enum(['reviewed', 'pending_review', 'user_required']),
      confidence: z.number().min(0).max(1),
      options: z.array(z.string()).optional(),
      required: z.boolean().default(false),
    }),
  ),
});
export type BatchAutofillAnalysis = z.infer<typeof batchAutofillAnalysisSchema>;

// --- Task 10: AI Router Typed Task Definitions ---

export type AITaskName =
  | 'resume_extract'
  | 'job_analyze'
  | 'candidate_match'
  | 'simple_answer'
  | 'reply_classify'
  | 'complex_application'
  | 'outreach_plan'
  | 'application_email_draft'
  | 'recruiter_csv_analyze'
  | 'autofill_classify_and_answer';

export const aiTaskRequestSchema = z.object({
  task: z.enum([
    'resume_extract',
    'job_analyze',
    'candidate_match',
    'simple_answer',
    'reply_classify',
    'complex_application',
    'outreach_plan',
    'application_email_draft',
    'recruiter_csv_analyze',
    'autofill_classify_and_answer',
  ]),
  jobDescription: z.string().max(50000).optional(),
  replyText: z.string().max(20000).optional(),
  resumeText: z.string().max(50000).optional(),
  screeningQuestions: z.array(z.string().max(1000)).max(50).optional(),
  screeningAnswers: z.record(z.string(), z.string()).optional(),
  unresolvedAnswers: z.record(z.string(), z.string()).optional(),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  csvRows: z.array(z.record(z.string(), z.string())).max(100).optional(),
  csvHeaders: z.array(z.string()).max(100).optional(),
  formFields: z.array(extractedFormFieldSchema).max(100).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  applicationId: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
  allowDegradedFallback: z.boolean().optional(),
}).passthrough();
export type AITaskRequest = z.infer<typeof aiTaskRequestSchema>;

export interface AIRouterRequest<T = unknown> {
  task: AITaskName;
  payload: T;
  applicationId?: string;
}

export interface AIRouterResponse<T = unknown> {
  task: AITaskName;
  provider: 'gemini' | 'dify' | 'mock';
  data: T;
  metadata: {
    modelOrAgent: string;
    completedAt: string;
    requiresApproval: boolean;
  };
}
