import {
  difyApplicationIntelligenceSchema,
  difyOutreachIntelligenceSchema,
  type DifyApplicationIntelligence,
  type DifyOutreachIntelligence,
} from '@/lib/ai-schemas';
import { cleanJsonFences, parseAiJsonResponse } from '@/lib/ai-json-parser';
import type { CandidateProfile, RecruiterContact } from '@/lib/domain';

const DIFY_API_BASE_URL = (process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').replace(/\/$/, '');

export const parseDifyJsonAnswer = parseAiJsonResponse;

/**
 * Executes a request to the Dify chat-messages API for an agent app with timeout and retry support.
 */
async function callDifyAgent(params: {
  apiKey: string;
  query: string;
  inputs?: Record<string, unknown>;
  user: string;
  conversationId?: string;
  timeoutMs?: number;
}): Promise<string> {
  const { apiKey, query, inputs = {}, user, conversationId, timeoutMs = 45000 } = params;

  if (!apiKey) {
    throw new Error('Dify API key is missing');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const endpoint = `${DIFY_API_BASE_URL}/chat-messages`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs,
        query,
        response_mode: 'blocking',
        user,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
      signal: controller.signal,
    });

    if (res.status === 401) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Dify API authentication failed (401 unauthorized): ${errBody}`);
    }
    if (res.status === 429) {
      throw new Error('Dify API rate limit exceeded. Please retry in a few moments.');
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Dify API request failed with status ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    if (!data || typeof data.answer !== 'string') {
      throw new Error('Unexpected Dify response format: missing answer field');
    }

    return data.answer;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Dify API request timed out after 45 seconds');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Runs Dify Agent 1: ApplyPilot Application Intelligence
 * Performs complex application preparation, field mappings, and multi-step screening question analysis.
 */
export async function runDifyApplicationIntelligence(params: {
  jobTitle: string;
  company: string;
  jobDescription: string;
  candidateProfile: CandidateProfile;
  screeningQuestions?: string[];
  userId: string;
}): Promise<DifyApplicationIntelligence> {
  const apiKey = process.env.DIFY_APPLICATION_API_KEY;
  if (!apiKey) {
    throw new Error('DIFY_APPLICATION_API_KEY is not configured');
  }

  const { jobTitle, company, jobDescription, candidateProfile, screeningQuestions = [], userId } = params;

  const query = `Analyze this application for ${jobTitle} at ${company}.
Job Description:
"""
${jobDescription.slice(0, 10000)}
"""

Candidate Profile:
${JSON.stringify({
  name: candidateProfile.name,
  headline: candidateProfile.headline,
  skills: candidateProfile.skills,
  experience: candidateProfile.experience,
  education: candidateProfile.education,
  projects: candidateProfile.projects,
})}

Screening Questions:
${screeningQuestions.length > 0 ? screeningQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') : 'None provided'}

Prepare a structured application recommendation in JSON format matching the schema:
{
  "job_summary": "summary",
  "requirements": ["req1"],
  "matched_requirements": ["match1"],
  "missing_requirements": ["missing1"],
  "field_mappings": [{"field_name": "name", "proposed_value": "value", "evidence": "evidence", "requires_review": false}],
  "screening_answers": [{"question": "q", "answer": "a", "evidence": "e", "requires_review": false}],
  "unresolved_questions": [],
  "ready_for_review": true,
  "recommended_next_action": "next step"
}`;

  const rawAnswer = await callDifyAgent({
    apiKey,
    query,
    user: `user_${userId.slice(0, 12)}`,
  });

  const cleaned = cleanJsonFences(rawAnswer);
  const parsed = JSON.parse(cleaned);
  return difyApplicationIntelligenceSchema.parse(parsed);
}

/**
 * Runs Dify Agent 2: ApplyPilot Outreach Intelligence
 * Generates personalized recruiter email drafts, follow-ups, and opt-out/suppression recommendations.
 */
export async function runDifyOutreachIntelligence(params: {
  recruiter: RecruiterContact;
  candidateProfile: CandidateProfile;
  jobContext?: string;
  priorCorrespondence?: string;
  userId: string;
}): Promise<DifyOutreachIntelligence> {
  const apiKey = process.env.DIFY_OUTREACH_API_KEY;
  if (!apiKey) {
    throw new Error('DIFY_OUTREACH_API_KEY is not configured');
  }

  const { recruiter, candidateProfile, jobContext = '', priorCorrespondence = '', userId } = params;

  const query = `Generate an outreach plan and draft for recruiter:
Recruiter: ${recruiter.name} (${recruiter.role || 'Recruiter'} at ${recruiter.company || 'Company'}), Email: ${recruiter.email}
Target Role/Context: ${jobContext || recruiter.role || 'Opportunity'}
Prior Correspondence: ${priorCorrespondence || 'None'}

Candidate Profile:
${JSON.stringify({
  name: candidateProfile.name,
  headline: candidateProfile.headline,
  skills: candidateProfile.skills,
  experience: candidateProfile.experience,
  portfolio: candidateProfile.portfolio,
})}

Respond with JSON strictly matching:
{
  "recommended_action": "draft_initial",
  "subject": "Exploring opportunities at ${recruiter.company || 'your team'}",
  "email_body": "Personalized draft email text",
  "personalization_evidence": ["Reason 1", "Reason 2"],
  "reasoning_summary": "Why this outreach angle was chosen",
  "reply_interpretation": null,
  "followup_eligible": true,
  "suggested_delay_business_days": 3,
  "warnings": [],
  "requires_user_approval": true
}`;

  const rawAnswer = await callDifyAgent({
    apiKey,
    query,
    user: `user_${userId.slice(0, 12)}`,
  });

  const cleaned = cleanJsonFences(rawAnswer);
  const parsed = JSON.parse(cleaned);
  return difyOutreachIntelligenceSchema.parse(parsed);
}
