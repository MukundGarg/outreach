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

// --- Task 10: AI Router Typed Task Definitions ---

export type AITaskName =
  | 'resume_extract'
  | 'job_analyze'
  | 'candidate_match'
  | 'simple_answer'
  | 'reply_classify'
  | 'complex_application'
  | 'outreach_plan';

export const aiTaskRequestSchema = z.object({
  task: z.enum([
    'resume_extract',
    'job_analyze',
    'candidate_match',
    'simple_answer',
    'reply_classify',
    'complex_application',
    'outreach_plan',
  ]),
  jobDescription: z.string().max(50000).optional(),
  replyText: z.string().max(20000).optional(),
  resumeText: z.string().max(50000).optional(),
  screeningQuestions: z.array(z.string().max(1000)).max(50).optional(),
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
