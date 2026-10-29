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
import { authenticatedDatabase, getProfile } from './applications';
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

  // Retrieve authoritative candidate profile from Supabase
  const dbProfile = await getProfile();
  const authoritativeProfile: CandidateProfile = dbProfile || {
    name: user.email?.split('@')[0] || 'Candidate',
    email: user.email || '',
    headline: '',
    location: '',
    skills: '',
    education: '',
    experience: '',
    projects: '',
    portfolio: '',
    github: '',
    linkedin: '',
  };

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
        resultData = await analyzeJobDescription(jd, authoritativeProfile);
        provider = 'gemini';
        modelOrAgent = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        break;
      }

      case 'reply_classify': {
        const msg = String(payload.messageText || payload.replyText || '');
        resultData = await classifyRecruiterReply(msg);
        provider = 'gemini';
        modelOrAgent = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        break;
      }

      case 'simple_answer': {
        const q = String(payload.question || '');
        const jobContext = payload.jobContext as string | undefined;
        resultData = await draftBasicAnswer(q, authoritativeProfile, jobContext);
        provider = 'gemini';
        modelOrAgent = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        break;
      }

      case 'candidate_match': {
        const jd = String(payload.jobDescription || '');
        resultData = await analyzeJobDescription(jd, authoritativeProfile);
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
            candidateProfile: authoritativeProfile,
            screeningQuestions: (payload.screeningQuestions as string[]) || [],
            userId,
          });
        } catch (difyErr: unknown) {
          // If Dify credentials invalid / not set, provide structured error or explicit safe fallback if user requested
          const msg = difyErr instanceof Error ? difyErr.message : String(difyErr);
          if (payload.allowDegradedFallback && process.env.GEMINI_API_KEY) {
            // Degraded mode explicitly approved by client parameter
            const jd = String(payload.jobDescription || '');
            const analysis = await analyzeJobDescription(jd, authoritativeProfile);
            resultData = {
              job_summary: analysis.job_summary,
              requirements: analysis.requirements,
              matched_requirements: analysis.matched_requirements,
              missing_requirements: analysis.missing_requirements,
              field_mappings: [
                {
                  field_name: 'Full Name',
                  proposed_value: authoritativeProfile.name,
                  evidence: 'Profile',
                  requires_review: false,
                },
                {
                  field_name: 'Email',
                  proposed_value: authoritativeProfile.email,
                  evidence: 'Profile',
                  requires_review: false,
                },
              ],
              screening_answers: [],
              unresolved_questions: [],
              ready_for_review: true,
              recommended_next_action: 'Completed via Gemini fallback due to Dify service unavailability.',
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

        // Retrieve recruiter contact from database if contactId provided
        let recruiter = payload.recruiter as RecruiterContact | undefined;
        if (payload.contactId) {
          const { data: cRow } = await db
            .from('recruiter_contacts')
            .select('*')
            .eq('id', String(payload.contactId))
            .eq('user_id', user.id)
            .single();

          if (cRow) {
            recruiter = {
              id: cRow.id,
              name: cRow.name,
              email: cRow.email,
              company: cRow.company || '',
              role: cRow.role || '',
              status: 'draft',
              draft: '',
              followup: '',
            };
          }
        }

        if (!recruiter) {
          recruiter = payload.recruiterContact as RecruiterContact;
        }

        if (!recruiter) {
          throw new Error('Recruiter contact information is required for outreach planning');
        }

        try {
          resultData = await runDifyOutreachIntelligence({
            recruiter,
            candidateProfile: authoritativeProfile,
            jobContext: payload.jobContext as string | undefined,
            priorCorrespondence: payload.priorCorrespondence as string | undefined,
            userId,
          });
        } catch (difyErr: unknown) {
          const msg = difyErr instanceof Error ? difyErr.message : String(difyErr);
          if (payload.allowDegradedFallback && process.env.GEMINI_API_KEY) {
            // Live Gemini fallback drafting real content instead of static template
            const prompt = `Draft a personalized initial outreach email from candidate ${authoritativeProfile.name} (skills: ${authoritativeProfile.skills}) to recruiter ${recruiter.name} at ${recruiter.company}.`;
            const geminiDraft = await draftBasicAnswer(prompt, authoritativeProfile);
            resultData = {
              recommended_action: 'draft_initial',
              subject: `Exploring opportunities at ${recruiter.company || 'your team'} · ${authoritativeProfile.name}`,
              email_body: geminiDraft.answer,
              personalization_evidence: geminiDraft.key_points_used,
              reasoning_summary: 'Drafted via live Gemini fallback because Dify API was unreachable.',
              reply_interpretation: null,
              followup_eligible: true,
              suggested_delay_business_days: 3,
              warnings: ['Generated via Gemini degraded fallback'],
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
