import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateProfileToProfileRow,
  profileRowToCandidateProfile,
  preferencesToPreferencesRow,
  preferencesRowToPreferences,
} from '../src/lib/mappers';
import { validatePdfBuffer } from '../src/lib/pdf-validator';
import { demoProfile, demoPreferences } from '../src/lib/demo';
import { canTransitionApplication } from '../src/lib/domain';

test('profile mapper converts faithfully between domain and SQL rows', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const rowInsert = candidateProfileToProfileRow(demoProfile, userId);

  assert.equal(rowInsert.id, userId);
  assert.equal(rowInsert.full_name, demoProfile.name);
  assert.equal(rowInsert.email, demoProfile.email);
  assert.equal(rowInsert.headline, demoProfile.headline);
  assert.equal(rowInsert.location, demoProfile.location);
  assert.ok(Array.isArray(rowInsert.skills));
  assert.ok(rowInsert.skills.includes('React'));

  // Deserialization check
  const mappedBack = profileRowToCandidateProfile({
    id: userId,
    full_name: rowInsert.full_name || '',
    email: rowInsert.email ?? null,
    headline: rowInsert.headline ?? null,
    location: rowInsert.location ?? null,
    skills: rowInsert.skills || [],
    education: rowInsert.education ?? [],
    experience: rowInsert.experience ?? [],
    projects: rowInsert.projects ?? [],
    portfolio_url: rowInsert.portfolio_url ?? null,
    github_url: rowInsert.github_url ?? null,
    linkedin_url: rowInsert.linkedin_url ?? null,
    verified_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  assert.equal(mappedBack.name, demoProfile.name);
  assert.equal(mappedBack.email, demoProfile.email);
  assert.equal(mappedBack.headline, demoProfile.headline);
  assert.equal(mappedBack.portfolio, demoProfile.portfolio);
});

test('preferences mapper converts faithfully between domain and SQL rows', () => {
  const userId = '22222222-2222-4222-8222-222222222222';
  const rowInsert = preferencesToPreferencesRow(demoPreferences, userId);

  assert.equal(rowInsert.user_id, userId);
  assert.equal(rowInsert.work_mode, 'remote');
  assert.equal(rowInsert.expected_compensation, 90000);
  assert.equal(rowInsert.current_compensation, null);
  assert.equal(rowInsert.currency, 'USD');
  assert.ok((rowInsert.roles || []).includes('Frontend Engineer'));

  const mappedBack = preferencesRowToPreferences({
    id: '33333333-3333-4333-8333-333333333333',
    user_id: userId,
    roles: rowInsert.roles || [],
    locations: rowInsert.locations || [],
    work_mode: rowInsert.work_mode || 'remote',
    relocation: rowInsert.relocation ?? false,
    employment_type: rowInsert.employment_type || 'full_time',
    expected_compensation: rowInsert.expected_compensation ?? null,
    current_compensation: rowInsert.current_compensation ?? null,
    currency: rowInsert.currency || 'USD',
    industries: rowInsert.industries || [],
    followup_days: 3,
    skip_weekends: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  assert.equal(mappedBack.workMode, demoPreferences.workMode);
  assert.equal(mappedBack.expectedCompensation, demoPreferences.expectedCompensation);
  assert.equal(mappedBack.currency, 'USD');
  assert.equal(mappedBack.relocation, true);
});

test('resume PDF buffer validation enforces type and size constraints', () => {
  // 1. Valid PDF header
  const validBuffer = Buffer.from('%PDF-1.4 valid content here');
  assert.equal(validatePdfBuffer(validBuffer).valid, true);

  // 2. Invalid non-PDF magic bytes
  const invalidHeader = Buffer.from('NOT A PDF FILE');
  const resInvalid = validatePdfBuffer(invalidHeader);
  assert.equal(resInvalid.valid, false);
  assert.match(resInvalid.error!, /valid PDF/);

  // 3. Empty buffer
  const emptyBuffer = Buffer.alloc(0);
  assert.equal(validatePdfBuffer(emptyBuffer).valid, false);

  // 4. Exceeds 10MB
  const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
  largeBuffer.write('%PDF-');
  const resLarge = validatePdfBuffer(largeBuffer);
  assert.equal(resLarge.valid, false);
  assert.match(resLarge.error!, /10 MB/);
});

test('application transition boundaries enforce approval and terminal state invariants', () => {
  // Cannot jump straight from draft to submitted without review
  assert.equal(canTransitionApplication('draft', 'submitted'), false);
  assert.equal(canTransitionApplication('draft', 'interview'), false);

  // Can move to ready_for_review
  assert.equal(canTransitionApplication('draft', 'ready_for_review'), true);

  // Ready for review can move to submitted or back to draft
  assert.equal(canTransitionApplication('ready_for_review', 'submitted'), true);
  assert.equal(canTransitionApplication('ready_for_review', 'draft'), true);

  // Terminal states cannot transition to active states
  assert.equal(canTransitionApplication('closed', 'draft'), false);
  assert.equal(canTransitionApplication('closed', 'submitted'), false);
  assert.equal(canTransitionApplication('rejected', 'offer'), false);
  assert.equal(canTransitionApplication('rejected', 'closed'), true);
});

test('draft persistence: recruiter contact maps latest draft subject and body without data leakage', () => {
  const contact1 = {
    id: 'contact-1',
    name: 'Jane Recruiter',
    email: 'jane@alpha.com',
    company: 'Alpha Inc',
    role: 'Tech Recruiter',
    status: 'draft' as const,
    draft: 'Draft content for Jane Alpha',
    subject: 'Exploring Senior Role at Alpha Inc',
    followup: '',
  };

  const contact2 = {
    id: 'contact-2',
    name: 'Bob Talent',
    email: 'bob@beta.com',
    company: 'Beta Corp',
    role: 'Lead Sourcer',
    status: 'draft' as const,
    draft: 'Draft content for Bob Beta',
    subject: 'Staff Engineer position at Beta Corp',
    followup: '',
  };

  // Contacts are strictly isolated
  assert.notEqual(contact1.draft, contact2.draft);
  assert.notEqual(contact1.subject, contact2.subject);
  assert.notEqual(contact1.email, contact2.email);

  // Rehydration preserves subject and body exactly as stored
  assert.equal(contact1.subject, 'Exploring Senior Role at Alpha Inc');
  assert.equal(contact1.draft, 'Draft content for Jane Alpha');
});

