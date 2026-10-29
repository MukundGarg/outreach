import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractedProfileSchema,
  jobAnalysisSchema,
  replyClassificationSchema,
  difyApplicationIntelligenceSchema,
  difyOutreachIntelligenceSchema,
  aiTaskRequestSchema,
} from '../src/lib/ai-schemas';
import { mockAIResults } from '../src/lib/ai-mocks';
import { parseDifyJsonAnswer } from '../src/services/dify';

test('AI Schemas: validates extractedProfileSchema with complete and partial data', () => {
  const valid = {
    name: 'Sarah Jenkins',
    email: 'sarah@example.com',
    headline: 'Senior Full Stack Engineer',
    location: 'San Francisco, CA',
    skills: 'TypeScript, React, Node.js',
    education: 'BS Computer Science, UC Berkeley',
    experience: 'Staff Engineer at TechCorp',
    projects: 'ApplyPilot AI',
  };
  const parsed = extractedProfileSchema.safeParse(valid);
  assert.ok(parsed.success);
  assert.equal(parsed.data.name, 'Sarah Jenkins');

  // Should default empty strings gracefully
  const empty = extractedProfileSchema.safeParse({});
  assert.ok(empty.success);
  assert.equal(empty.data.headline, '');
});

test('AI Schemas: validates jobAnalysisSchema and score bounds', () => {
  const validJobAnalysis = {
    job_summary: 'Senior TypeScript engineer for cloud application platform.',
    requirements: ['5+ years TS', 'Next.js', 'PostgreSQL'],
    matched_requirements: ['5+ years TS', 'Next.js'],
    missing_requirements: ['PostgreSQL'],
    match_score: 85,
    key_technologies: ['TypeScript', 'Next.js', 'React'],
    role_level: 'Senior',
    recommendations: ['Emphasize PostgreSQL experience in interview.'],
  };

  const parsed = jobAnalysisSchema.safeParse(validJobAnalysis);
  assert.ok(parsed.success);

  // Rejects out-of-range match_score
  assert.equal(
    jobAnalysisSchema.safeParse({ ...validJobAnalysis, match_score: 150 }).success,
    false,
  );
  assert.equal(
    jobAnalysisSchema.safeParse({ ...validJobAnalysis, match_score: -5 }).success,
    false,
  );
});

test('AI Schemas: validates replyClassificationSchema with opt_out and interview categories', () => {
  const optOut = {
    classification: 'opt_out',
    summary: 'Candidate requested to be removed from recruiting list.',
    confidence: 0.98,
    needs_human_review: false,
    suggested_action: 'Do not contact. Suppress future messages.',
    evidence: 'Please unsubscribe me from your emails.',
  };
  const parsedOptOut = replyClassificationSchema.safeParse(optOut);
  assert.ok(parsedOptOut.success);
  assert.equal(parsedOptOut.data.classification, 'opt_out');

  const interview = {
    classification: 'interview_invitation',
    summary: 'Recruiter invited candidate for 30min intro call.',
    confidence: 0.95,
    needs_human_review: false,
    suggested_action: 'Select a time slot and respond with availability.',
  };
  assert.ok(replyClassificationSchema.safeParse(interview).success);

  // Rejects unknown category
  assert.equal(
    replyClassificationSchema.safeParse({ ...interview, classification: 'unknown_cat' }).success,
    false,
  );
});

test('AI Schemas: validates Dify Agent 1 application intelligence contract', () => {
  const agent1Output = {
    job_summary: 'Staff Software Engineer at Acme',
    requirements: ['React', 'Postgres', 'Distributed Systems'],
    matched_requirements: ['React', 'Postgres'],
    missing_requirements: ['Distributed Systems'],
    field_mappings: [
      {
        field_name: 'full_name',
        proposed_value: 'Jane Doe',
        evidence: 'Resume header',
        requires_review: false,
      },
      {
        field_name: 'years_experience',
        proposed_value: '7',
        evidence: 'Work history 2017-2024',
        requires_review: true,
      },
    ],
    screening_answers: [
      {
        question: 'Why this role?',
        answer: 'Passionate about distributed storage and UI engineering.',
        evidence: 'Past work at DataCorp',
        requires_review: true,
      },
    ],
    unresolved_questions: ['Desired salary expectations?'],
    ready_for_review: true,
    recommended_next_action: 'Review proposed answers before submission.',
  };

  const parsed = difyApplicationIntelligenceSchema.safeParse(agent1Output);
  assert.ok(parsed.success);
  assert.equal(parsed.data.field_mappings.length, 2);
  assert.equal(parsed.data.screening_answers[0].requires_review, true);
});

test('AI Schemas: validates Dify Agent 2 outreach intelligence contract and stop recommendation', () => {
  const agent2Output = {
    recommended_action: 'stop',
    subject: null,
    email_body: null,
    personalization_evidence: ['Recipient explicitly requested no further contact'],
    reasoning_summary: 'Recruiter replied asking to stop emails.',
    reply_interpretation: 'Opt-out notice',
    followup_eligible: false,
    suggested_delay_business_days: null,
    warnings: ['DO NOT SEND: Candidate opt-out detected.'],
    requires_user_approval: true,
  };

  const parsed = difyOutreachIntelligenceSchema.safeParse(agent2Output);
  assert.ok(parsed.success);
  assert.equal(parsed.data.recommended_action, 'stop');
  assert.equal(parsed.data.followup_eligible, false);
});

test('Dify JSON Parser: correctly unwraps markdown fences and raw text', () => {
  const fenced = '```json\n{"recommended_action":"draft_initial","subject":"Hello","email_body":"Hi there","personalization_evidence":["Tech background"],"reasoning_summary":"Good fit","reply_interpretation":null,"followup_eligible":true,"suggested_delay_business_days":3,"warnings":[],"requires_user_approval":true}\n```';
  const parsed = parseDifyJsonAnswer(fenced, difyOutreachIntelligenceSchema);
  assert.equal(parsed.subject, 'Hello');
  assert.equal(parsed.recommended_action, 'draft_initial');

  // Throws actionable error on malformed JSON
  assert.throws(
    () => parseDifyJsonAnswer('Not JSON at all', difyOutreachIntelligenceSchema),
    /AI service returned non-JSON text/,
  );
});

test('Task Router: demo mode produces deterministic visibly labeled mock results', () => {
  const resumeMock = mockAIResults.resume_extract;
  assert.equal(resumeMock.name, 'Alex Morgan');

  const jobMock = mockAIResults.job_analyze;
  assert.ok(jobMock.match_score > 0);
  assert.ok(Array.isArray(jobMock.matched_requirements));

  const dify1Mock = mockAIResults.complex_application;
  assert.ok(dify1Mock.ready_for_review);
  assert.ok(dify1Mock.field_mappings.length > 0);

  const dify2Mock = mockAIResults.outreach_plan;
  assert.equal(dify2Mock.requires_user_approval, true);
  assert.ok(dify2Mock.email_body?.includes('Alex'));

  const replyMock = mockAIResults.reply_classify;
  assert.equal(replyMock.classification, 'interview_invitation');
});

test('AI Task Request Schema: enforces strict validation and prevents malicious payload sizes', () => {
  assert.equal(
    aiTaskRequestSchema.safeParse({
      task: 'job_analyze',
      jobDescription: 'x'.repeat(100000), // Exceeds 50k character limit
    }).success,
    false,
  );

  assert.equal(
    aiTaskRequestSchema.safeParse({
      task: 'unknown_task_kind' as unknown,
    }).success,
    false,
  );
});
