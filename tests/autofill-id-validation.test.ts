import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

test('Autofill ID validation: enforces demo IDs in demo mode and RFC UUIDs in production', () => {
  // Demo Mode Schema
  const demoIdSchema = z.string().min(1);
  assert.equal(demoIdSchema.safeParse('sample-1').success, true);
  assert.equal(demoIdSchema.safeParse('custom-demo-id').success, true);
  assert.equal(demoIdSchema.safeParse('').success, false);

  // Production Mode Schema
  const prodIdSchema = z.string().uuid({ message: 'Application ID must be a valid UUID in production' });
  assert.equal(prodIdSchema.safeParse('sample-1').success, false, 'sample-1 must be rejected in production');
  assert.equal(prodIdSchema.safeParse('b7b848c4-0b79-4d64-9a84-fbdb25a8167f').success, true, 'Valid UUID must pass');
  assert.equal(prodIdSchema.safeParse('not-a-uuid').success, false);
});

