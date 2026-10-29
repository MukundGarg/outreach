import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applicationSchema,
  profileSchema,
  preferencesSchema,
  applicationStatuses,
  canTransitionApplication,
  canTransitionOutreach,
  nextFollowup,
} from '../src/lib/domain';
import { demoProfile, demoPreferences, demoApplications } from '../src/lib/demo';
test('demo fixtures conform to validation contracts', () => {
  assert.ok(profileSchema.safeParse(demoProfile).success);
  assert.ok(preferencesSchema.safeParse(demoPreferences).success);
  for (const app of demoApplications) assert.ok(applicationSchema.safeParse(app).success);
});
test('rejects empty roles, unsafe URLs, negative compensation, invalid emails', () => {
  assert.equal(
    applicationSchema.safeParse({
      title: '',
      company: 'A',
      url: 'javascript:alert(1)',
      location: '',
    }).success,
    false,
  );
  assert.equal(
    applicationSchema.safeParse({
      title: 'Engineer',
      company: 'Company',
      url: 'ftp://example.com',
      location: '',
    }).success,
    false,
  );
  assert.equal(profileSchema.safeParse({ ...demoProfile, email: 'invalid' }).success, false);
  assert.equal(
    preferencesSchema.safeParse({ ...demoPreferences, expectedCompensation: -1 }).success,
    false,
  );
});
test('applications cannot skip approval or leave closed state', () => {
  assert.equal(canTransitionApplication('draft', 'submitted'), false);
  assert.equal(canTransitionApplication('draft', 'ready_for_review'), true);
  assert.equal(canTransitionApplication('ready_for_review', 'submitted'), true);
  for (const status of applicationStatuses)
    assert.equal(canTransitionApplication('closed', status), false);
  assert.equal(canTransitionApplication('interview', 'offer'), true);
});
test('outreach requires approval stage and terminal statuses cannot restart', () => {
  assert.equal(canTransitionOutreach('draft', 'sent'), false);
  assert.equal(canTransitionOutreach('draft', 'awaiting_approval'), true);
  assert.equal(canTransitionOutreach('awaiting_approval', 'scheduled'), true);
  assert.equal(canTransitionOutreach('cancelled', 'scheduled'), false);
  assert.equal(canTransitionOutreach('completed', 'draft'), false);
});
test('weekend skipping uses UTC and validates intervals', () => {
  assert.equal(
    nextFollowup(new Date('2026-10-30T10:00:00Z'), 1).toISOString(),
    '2026-11-02T10:00:00.000Z',
  );
  assert.equal(
    nextFollowup(new Date('2026-10-30T10:00:00Z'), 1, false).toISOString(),
    '2026-10-31T10:00:00.000Z',
  );
  assert.throws(() => nextFollowup(new Date(), 0));
  assert.throws(() => nextFollowup(new Date(), 1.5));
});
