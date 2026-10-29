import type {
  AITaskName,
  AIRouterResponse,
} from '@/lib/ai-schemas';
import {
  extractCandidateProfile,
  analyzeJobDescription,
  classifyRecruiterReply,
  draftBasicAnswer,
} from './gemini';
import {
  runDifyApplicationIntelligence,
  runDifyOutreachIntelligence,
} from './dify';
import { authenticatedDatabase } from './applications';
import type { CandidateProfile, RecruiterContact } from '@/lib/domain';

import { mockAIResults } from '@/lib/ai-mocks';
export { mockAIResults };

/**
 * Explicit TypeScript AI Task Router
 * Dispatches to Gemini for simple tasks and Dify for complex workflows.
 */
export async function routeAITask<T>(
  task: AITaskName,
  payload: Record<string, unknown>,
  options?: { isDemo?: boolean; userId?: string; applicationId?: string },
): Promise<AIRouterResponse<T>> {
  const isDemo = options?.isDemo ?? false;

  // 1. In Demo Mode, return deterministic visibly labeled simulated results
  if (isDemo) {
    const mockData = (mockAIResults as Record<string, unknown>)[task];
    if (!mockData) {
      throw new Error(`No mock result defined for task: ${task}`);
    }
    return {
      task,
      provider: 'mock',
      data: mockData as T,
      metadata: {
        modelOrAgent: 'applypilot-mock-adapter',
        completedAt: new Date().toISOString(),
        requiresApproval: true,
      },
    };
  }

  // 2. Production Execution: Validate authenticated database session
  const { db, user } = await authenticatedDatabase();
  const userId = options?.userId || user.id;

  let resultData: unknown;
  let provider: 'gemini' | 'dify';
  let modelOrAgent: string;

  try {
    switch (task) {
      case 'resume_extract': {
        const text = String(payload.resumeText || '');
        resultData = await extractCandidateProfile(text);
        provider = 'gemini';
        modelOrAgent = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        break;
      }

      case 'job_analyze': {
        const jd = String(payload.jobDescription || '');
        const profile = payload.candidateProfile as CandidateProfile;
        resultData = await analyzeJobDescription(jd, profile);
        provider = 'gemini';
        modelOrAgent = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        break;
      }

      case 'reply_classify': {
        const msg = String(payload.messageText || '');
        resultData = await classifyRecruiterReply(msg);
        provider = 'gemini';
        modelOrAgent = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        break;
      }

      case 'simple_answer': {
        const q = String(payload.question || '');
        const profile = payload.candidateProfile as CandidateProfile;
        const jobContext = payload.jobContext as string | undefined;
        resultData = await draftBasicAnswer(q, profile, jobContext);
        provider = 'gemini';
        modelOrAgent = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        break;
      }

      case 'candidate_match': {
        const jd = String(payload.jobDescription || '');
        const profile = payload.candidateProfile as CandidateProfile;
        resultData = await analyzeJobDescription(jd, profile);
        provider = 'gemini';
        modelOrAgent = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        break;
      }

      case 'complex_application': {
        provider = 'dify';
        modelOrAgent = 'ApplyPilot-Application-Intelligence';
        try {
          resultData = await runDifyApplicationIntelligence({
            jobTitle: String(payload.jobTitle || 'Role'),
            company: String(payload.company || 'Company'),
            jobDescription: String(payload.jobDescription || ''),
            candidateProfile: payload.candidateProfile as CandidateProfile,
            screeningQuestions: (payload.screeningQuestions as string[]) || [],
            userId,
          });
        } catch (difyErr: unknown) {
          // If Dify credentials invalid / not set, provide structured error or explicit safe fallback if user requested
          const msg = difyErr instanceof Error ? difyErr.message : String(difyErr);
          if (payload.allowDegradedFallback && process.env.GEMINI_API_KEY) {
            // Degraded mode explicitly approved by client parameter
            const jd = String(payload.jobDescription || '');
            const profile = payload.candidateProfile as CandidateProfile;
            const analysis = await analyzeJobDescription(jd, profile);
            resultData = {
              job_summary: analysis.job_summary,
              requirements: analysis.requirements,
              matched_requirements: analysis.matched_requirements,
              missing_requirements: analysis.missing_requirements,
              field_mappings: [
                {
                  field_name: 'Full Name',
                  proposed_value: profile.name,
                  evidence: 'Profile',
                  requires_review: false,
                },
                {
                  field_name: 'Email',
                  proposed_value: profile.email,
                  evidence: 'Profile',
                  requires_review: false,
                },
              ],
              screening_answers: [],
              unresolved_questions: [],
              ready_for_review: true,
              recommended_next_action: 'Dify service unavailable; completed in degraded Gemini analysis mode.',
            };
            modelOrAgent = 'gemini-degraded-fallback';
            provider = 'gemini';
          } else {
            throw new Error(`Dify Agent 1 error: ${msg}`);
          }
        }
        break;
      }

      case 'outreach_plan': {
        provider = 'dify';
        modelOrAgent = 'ApplyPilot-Outreach-Intelligence';
        try {
          resultData = await runDifyOutreachIntelligence({
            recruiter: payload.recruiter as RecruiterContact,
            candidateProfile: payload.candidateProfile as CandidateProfile,
            jobContext: payload.jobContext as string | undefined,
            priorCorrespondence: payload.priorCorrespondence as string | undefined,
            userId,
          });
        } catch (difyErr: unknown) {
          const msg = difyErr instanceof Error ? difyErr.message : String(difyErr);
          if (payload.allowDegradedFallback && process.env.GEMINI_API_KEY) {
            // Degraded mode explicitly approved
            const recruiter = payload.recruiter as RecruiterContact;
            const profile = payload.candidateProfile as CandidateProfile;
            resultData = {
              recommended_action: 'draft_initial',
              subject: `Exploring opportunities at ${recruiter.company || 'your team'}`,
              email_body: `Hi ${recruiter.name},\n\nI’m a software engineer specializing in ${profile.skills.slice(0, 50)}. I’d love to connect to discuss opportunities at ${recruiter.company}.\n\nBest,\n${profile.name}`,
              personalization_evidence: ['Matched skills from profile'],
              reasoning_summary: 'Drafted via degraded Gemini fallback because Dify API was unreachable.',
              reply_interpretation: null,
              followup_eligible: true,
              suggested_delay_business_days: 3,
              warnings: ['Generated in degraded mode'],
              requires_user_approval: true,
            };
            modelOrAgent = 'gemini-degraded-fallback';
            provider = 'gemini';
          } else {
            throw new Error(`Dify Agent 2 error: ${msg}`);
          }
        }
        break;
      }

      default:
        throw new Error(`Unknown AI task: ${task}`);
    }

    // 3. Record execution metadata in existing agent_runs table
    try {
      await db.from('agent_runs').insert({
        user_id: user.id,
        application_id: options?.applicationId || null,
        agent_kind: task === 'outreach_plan' ? 'outreach' : task === 'reply_classify' ? 'response' : 'candidate',
        mode: 'live',
        status: 'completed',
        external_run_id: null,
        error_code: null,
        completed_at: new Date().toISOString(),
      });
    } catch {
      // Table insert is best-effort and should never block the user response
    }

    return {
      task,
      provider,
      data: resultData as T,
      metadata: {
        modelOrAgent,
        completedAt: new Date().toISOString(),
        requiresApproval: true,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Record failure in agent_runs
    try {
      await db.from('agent_runs').insert({
        user_id: user.id,
        application_id: options?.applicationId || null,
        agent_kind: task === 'outreach_plan' ? 'outreach' : task === 'reply_classify' ? 'response' : 'candidate',
        mode: 'live',
        status: 'failed',
        error_code: errorMsg.slice(0, 100),
        completed_at: new Date().toISOString(),
      });
    } catch {
      // Best-effort error logging
    }

    throw err;
  }
}
