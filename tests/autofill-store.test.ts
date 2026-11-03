import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDemoAutofill, setDemoAutofill } from '../src/lib/demo-autofill-store';

test('Demo Autofill Store: persists and retrieves autofill data for demo IDs', () => {
  const appId = 'sample-1';
  
  // Set demo data
  setDemoAutofill(appId, {
    applicationUrl: 'https://boards.greenhouse.io/acme/jobs/999',
    autofillStatus: 'analyzed',
    fields: [
      {
        fieldId: 'first_name',
        fieldLabel: 'First Name',
        fieldType: 'text',
        proposedValue: 'Alex',
        source: 'profile',
        category: 'profile',
        status: 'reviewed',
        confidence: 1.0,
      },
    ],
  });

  const retrieved = getDemoAutofill(appId);
  assert.ok(retrieved !== null, 'Data should be retrieved from store');
  assert.equal(retrieved.applicationUrl, 'https://boards.greenhouse.io/acme/jobs/999');
  assert.equal(retrieved.autofillStatus, 'analyzed');
  assert.equal(retrieved.fields.length, 1);
  assert.equal(retrieved.fields[0].proposedValue, 'Alex');

  // Update without overwriting
  setDemoAutofill(appId, {
    autofillStatus: 'completed',
  });

  const updated = getDemoAutofill(appId);
  assert.equal(updated?.autofillStatus, 'completed');
  assert.equal(updated?.fields.length, 1);
  assert.equal(updated?.fields[0].fieldLabel, 'First Name');
});

test('Autofill Route ID validation: accepts both string demo IDs and standard UUIDs', () => {
  const { z } = require('zod');
  const analyzeUrlSchema = z.object({
    action: z.literal('analyze_url'),
    applicationId: z.string().min(1),
    url: z.string().url(),
  });

  // Demo ID
  const demoResult = analyzeUrlSchema.safeParse({
    action: 'analyze_url',
    applicationId: 'sample-1',
    url: 'https://example.com/apply',
  });
  assert.equal(demoResult.success, true);

  // Real UUID
  const uuidResult = analyzeUrlSchema.safeParse({
    action: 'analyze_url',
    applicationId: 'b7b848c4-0b79-4d64-9a84-fbdb25a8167f',
    url: 'https://example.com/apply',
  });
  assert.equal(uuidResult.success, true);

  // Empty string rejected
  const emptyResult = analyzeUrlSchema.safeParse({
    action: 'analyze_url',
    applicationId: '',
    url: 'https://example.com/apply',
  });
  assert.equal(emptyResult.success, false);
});

