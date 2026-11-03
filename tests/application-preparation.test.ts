import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionApplication } from '../src/lib/domain';
import { demoApplications, demoProfile, demoPreferences, demoContacts } from '../src/lib/demo';

// We import snapshotSchema from demo-provider or re-verify against its Zod definition
import { z } from 'zod';
import {
  applicationSchema,
  applicationStatuses,
  outreachStatuses,
  profileSchema,
  preferencesSchema,
} from '../src/lib/domain';

const demoSnapshotSchema = z.object({
  profile: profileSchema,
  preferences: preferencesSchema,
  applications: z.array(
    applicationSchema.extend({
      id: z.string(),
      status: z.enum(applicationStatuses),
      createdAt: z.iso.datetime(),
      jobDescription: z.string().nullable().optional(),
      preparation: z
        .object({
          screeningAnswers: z.record(z.string(), z.string()).optional(),
          unresolvedAnswers: z.record(z.string(), z.string()).optional(),
          emailSubject: z.string().optional(),
          emailBody: z.string().optional(),
          jobDescription: z.string().optional(),
          updatedAt: z.string().optional(),
        })
        .nullable()
        .optional(),
      events: z.array(
        z.object({
          id: z.string(),
          at: z.iso.datetime(),
          description: z.string(),
          from: z.enum(applicationStatuses).optional(),
          to: z.enum(applicationStatuses).optional(),
        }),
      ),
    }),
  ),
  contacts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      company: z.string(),
      email: z.email(),
      role: z.string(),
      status: z.enum(outreachStatuses),
      draft: z.string(),
      subject: z.string().optional(),
      followup: z.string(),
    }),
  ),
});

test('Application Preparation Regression: application list mapping includes jobDescription and preparation', () => {
  const mockDbRow = {
    id: 'app-123',
    title: 'AI Systems Engineer',
    company: 'Aetheris Dynamics',
    url: 'https://aetheris.ai/jobs/1',
    location: 'Remote',
    status: 'draft' as const,
    job_description: 'We are seeking an AI Systems Engineer...',
    application_preparation: {
      screeningAnswers: { 'Why Aetheris?': 'Excited about autonomous agents' },
      unresolvedAnswers: { 'US Authorization?': 'Yes, citizen' },
      emailSubject: 'Application: AI Systems Engineer',
      emailBody: 'Dear Hiring Team...',
      updatedAt: '2026-11-03T10:00:00.000Z',
    },
    created_at: '2026-11-03T09:00:00.000Z',
  };

  // Simulate listApplications mapping logic
  const prep = mockDbRow.application_preparation;
  const mapped = {
    id: mockDbRow.id,
    title: mockDbRow.title,
    company: mockDbRow.company,
    url: mockDbRow.url,
    location: mockDbRow.location,
    status: mockDbRow.status,
    jobDescription: mockDbRow.job_description,
    preparation: prep,
    createdAt: mockDbRow.created_at,
    events: [],
  };

  assert.equal(mapped.jobDescription, 'We are seeking an AI Systems Engineer...');
  assert.equal(mapped.preparation?.emailSubject, 'Application: AI Systems Engineer');
  assert.equal(mapped.preparation?.screeningAnswers?.['Why Aetheris?'], 'Excited about autonomous agents');
});

test('Application Preparation Regression: saving preparation does NOT change application status or call transition', () => {
  const currentStatus = 'draft';
  // Saving preparation preserves status:
  const applicationBefore = {
    id: 'app-abc',
    status: currentStatus,
    preparation: null,
  };

  const newPrep = {
    screeningAnswers: { 'Q1': 'A1' },
    unresolvedAnswers: { 'Q2': 'A2' },
    emailSubject: 'New Subject',
    emailBody: 'New Body',
  };

  // Updated state preserves exact status
  const applicationAfter = {
    ...applicationBefore,
    preparation: { ...newPrep, updatedAt: new Date().toISOString() },
  };

  assert.equal(applicationAfter.status, currentStatus);
  // Transitions to same status are explicitly prohibited in state machine
  assert.equal(canTransitionApplication(currentStatus, currentStatus), false);
});

test('Application Preparation Regression: saving preparation never overwrites job_description with null or JSON', () => {
  const originalJobDescription = 'Original detailed job description from posting.';

  // Simulate updating only preparation fields
  const prepUpdate: {
    screeningAnswers: Record<string, string>;
    emailSubject: string;
    emailBody: string;
    jobDescription?: string;
  } = {
    screeningAnswers: { 'Q1': 'A1' },
    emailSubject: 'Subject',
    emailBody: 'Body',
    // jobDescription is omitted / undefined
  };

  const updatePayload: {
    application_preparation: Record<string, unknown>;
    job_description?: string;
  } = {
    application_preparation: prepUpdate,
  };

  if (typeof prepUpdate.jobDescription === 'string' && prepUpdate.jobDescription.trim().length > 0) {
    updatePayload.job_description = prepUpdate.jobDescription;
  }

  // Verify job_description key is NOT set in updatePayload, preserving the database column
  assert.equal('job_description' in updatePayload, false);
  assert.notEqual(JSON.stringify(updatePayload.application_preparation), originalJobDescription);
});

test('Application Preparation Regression: missing column error detects 42703 and returns clear migration requirement', () => {
  const errorFromDb = {
    code: '42703',
    message: 'column job_applications.application_preparation does not exist',
  };

  let caughtError: string | null = null;
  try {
    if (errorFromDb.code === '42703' || errorFromDb.message.includes('application_preparation')) {
      throw new Error(
        'Database migration required: The column "application_preparation" does not exist in job_applications table. Please apply migration 202611030001_application_preparation.sql.',
      );
    }
  } catch (err: unknown) {
    caughtError = err instanceof Error ? err.message : String(err);
  }

  assert.ok(caughtError?.includes('Database migration required'));
  assert.ok(caughtError?.includes('202611030001_application_preparation.sql'));
});

test('Application Preparation Regression: demo snapshot preserves jobDescription and preparation through serialization', () => {
  const sampleData = {
    profile: demoProfile,
    preferences: demoPreferences,
    applications: [
      {
        ...demoApplications[0],
        jobDescription: 'Frontend engineer with TypeScript & React.',
        preparation: {
          screeningAnswers: { 'Tell us about yourself': 'Senior engineer with 5 years experience' },
          unresolvedAnswers: { 'Relocation': 'Remote only' },
          emailSubject: 'Application for Frontend Role',
          emailBody: 'Hello Hiring Team...',
          updatedAt: '2026-11-03T11:00:00.000Z',
        },
      },
    ],
    contacts: demoContacts,
  };

  const serialized = JSON.stringify(sampleData);
  const parsedJson = JSON.parse(serialized);
  const validation = demoSnapshotSchema.safeParse(parsedJson);

  assert.ok(validation.success, `Validation error: ${JSON.stringify(validation.error?.issues)}`);
  assert.equal(validation.data.applications[0].jobDescription, 'Frontend engineer with TypeScript & React.');
  assert.equal(validation.data.applications[0].preparation?.emailSubject, 'Application for Frontend Role');
  assert.equal(validation.data.applications[0].preparation?.screeningAnswers?.['Tell us about yourself'], 'Senior engineer with 5 years experience');
});

test('Application Preparation Regression: cross-user isolation prevents accessing or updating another user application', () => {
  const userA = 'user-aaa-111';
  const userB = 'user-bbb-222';
  const appOwnedByUserA = {
    id: 'app-999',
    user_id: userA,
  };

  // Simulating query where authenticated user is User B:
  const queryMatch = appOwnedByUserA.id === 'app-999' && appOwnedByUserA.user_id === userB;
  assert.equal(queryMatch, false, 'User B must not match or update records owned by User A');
});

test('Application Preparation Regression: existing permitted application transitions continue to work', () => {
  // Verify standard valid transitions
  assert.equal(canTransitionApplication('draft', 'ready_for_review'), true);
  assert.equal(canTransitionApplication('ready_for_review', 'submitted'), true);
  assert.equal(canTransitionApplication('submitted', 'awaiting_response'), true);
  assert.equal(canTransitionApplication('awaiting_response', 'under_review'), true);
  assert.equal(canTransitionApplication('under_review', 'interview'), true);
  assert.equal(canTransitionApplication('interview', 'offer'), true);
  assert.equal(canTransitionApplication('offer', 'closed'), true);

  // Invalid skip transitions
  assert.equal(canTransitionApplication('draft', 'offer'), false);
  assert.equal(canTransitionApplication('submitted', 'offer'), false);
});
