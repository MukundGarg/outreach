import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSensitiveField,
  mapProfileField,
  classifyFieldKind,
} from '../src/lib/autofill-mapping';
import {
  extractedFormFieldSchema,
  batchAutofillAnalysisSchema,
} from '../src/lib/ai-schemas';
import type { CandidateProfile } from '../src/lib/domain';

const sampleProfile: CandidateProfile = {
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  headline: 'Senior Full Stack Engineer',
  location: 'San Francisco, CA',
  skills: 'TypeScript, React, Node.js, PostgreSQL',
  education: 'BS in Computer Science',
  experience: 'Senior Engineer at TechCorp (2021-Present)',
  projects: 'ApplyPilot AI, OpenSource OSS',
  portfolio: 'https://alexmorgan.dev',
  github: 'https://github.com/alexmorgan',
  linkedin: 'https://linkedin.com/in/alexmorgan',
};

test('Autofill Mapping: correctly extracts and maps direct profile fields', () => {
  // First Name
  const firstNameField = {
    fieldId: 'first_name',
    fieldLabel: 'First Name',
    fieldType: 'text' as const,
    required: false,
  };
  const fnMatch = mapProfileField(firstNameField, sampleProfile);
  assert.equal(fnMatch.isMatch, true);
  assert.equal(fnMatch.value, 'Alex');

  // Last Name
  const lastNameField = {
    fieldId: 'last_name',
    fieldLabel: 'Last Name',
    fieldType: 'text' as const,
    required: false,
  };
  const lnMatch = mapProfileField(lastNameField, sampleProfile);
  assert.equal(lnMatch.isMatch, true);
  assert.equal(lnMatch.value, 'Morgan');

  // Email
  const emailField = {
    fieldId: 'email',
    fieldLabel: 'Work / Personal Email',
    fieldType: 'email' as const,
    required: true,
  };
  const emailMatch = mapProfileField(emailField, sampleProfile);
  assert.equal(emailMatch.isMatch, true);
  assert.equal(emailMatch.value, 'alex.morgan@example.com');

  // LinkedIn
  const linkedinField = {
    fieldId: 'linkedin',
    fieldLabel: 'LinkedIn Profile URL',
    fieldType: 'text' as const,
    required: false,
  };
  const liMatch = mapProfileField(linkedinField, sampleProfile);
  assert.equal(liMatch.isMatch, true);
  assert.equal(liMatch.value, 'https://linkedin.com/in/alexmorgan');
});

test('Autofill Mapping: does not invent missing profile information', () => {
  const profileMissingFields: CandidateProfile = {
    ...sampleProfile,
    portfolio: '',
    github: '',
  };

  const portfolioField = {
    fieldId: 'portfolio',
    fieldLabel: 'Personal Portfolio Link',
    fieldType: 'text' as const,
    required: false,
  };
  const match = mapProfileField(portfolioField, profileMissingFields);
  assert.equal(match.isMatch, false);
  assert.equal(match.value, '');
});

test('Autofill Sensitivity: strictly detects sensitive and legal declaration questions', () => {
  assert.equal(isSensitiveField('Are you authorized to work in the United States?'), true);
  assert.equal(isSensitiveField('Will you now or in the future require visa sponsorship?'), true);
  assert.equal(isSensitiveField('Voluntary Self-Identification of Disability'), true);
  assert.equal(isSensitiveField('Veteran Status (Protected Veteran)'), true);
  assert.equal(isSensitiveField('Have you ever been convicted of a felony?'), true);
  assert.equal(isSensitiveField('I certify that all statements made on this application are true'), true);

  // Non-sensitive questions
  assert.equal(isSensitiveField('First Name'), false);
  assert.equal(isSensitiveField('Why are you interested in this position?'), false);
  assert.equal(isSensitiveField('GitHub URL'), false);
});

test('Autofill Field Classification: classifies fields into profile, basic, complex, and sensitive', () => {
  assert.equal(
    classifyFieldKind({ fieldId: '1', fieldLabel: 'Authorized to work in US?', fieldType: 'select', required: true }),
    'sensitive',
  );
  assert.equal(
    classifyFieldKind({ fieldId: '2', fieldLabel: 'Full Name', fieldType: 'text', required: true }),
    'profile',
  );
  assert.equal(
    classifyFieldKind({ fieldId: '3', fieldLabel: 'Describe a difficult technical challenge you solved', fieldType: 'textarea', required: false }),
    'complex',
  );
  assert.equal(
    classifyFieldKind({ fieldId: '4', fieldLabel: 'Why do you want to join our team?', fieldType: 'textarea', required: false }),
    'basic',
  );
});

test('Autofill Schemas: validates extractedFormFieldSchema and batchAutofillAnalysisSchema', () => {
  const extractedField = {
    fieldId: 'job_app_first_name',
    fieldLabel: 'First Name *',
    fieldType: 'text',
    required: true,
  };
  const parsedField = extractedFormFieldSchema.safeParse(extractedField);
  assert.ok(parsedField.success);

  const batchPayload = {
    fields: [
      {
        fieldId: 'job_app_first_name',
        fieldLabel: 'First Name',
        fieldType: 'text',
        proposedValue: 'Alex',
        source: 'profile',
        category: 'profile',
        status: 'reviewed',
        confidence: 1.0,
        required: true,
      },
      {
        fieldId: 'work_auth',
        fieldLabel: 'Authorized to work in US?',
        fieldType: 'select',
        proposedValue: '',
        source: 'user',
        category: 'sensitive',
        status: 'user_required',
        confidence: 1.0,
        options: ['Yes', 'No'],
        required: true,
      },
    ],
  };
  const parsedBatch = batchAutofillAnalysisSchema.safeParse(batchPayload);
  assert.ok(parsedBatch.success);
});
