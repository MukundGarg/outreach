/**
 * Reproducible integration test script for validating Supabase persistence,
 * two-user RLS isolation, storage isolation, and transition constraints
 * on a disposable Supabase project.
 *
 * Usage:
 *   TEST_SUPABASE_URL="https://your-project.supabase.co" \
 *   TEST_SUPABASE_ANON_KEY="your-anon-key" \
 *   TEST_USER_A_EMAIL="user_a@example.com" \
 *   TEST_USER_A_PASSWORD="Password123!" \
 *   TEST_USER_B_EMAIL="user_b@example.com" \
 *   TEST_USER_B_PASSWORD="Password123!" \
 *   npx tsx tests/integration-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/database.types';

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('[SKIPPED] Live Supabase integration test skipped: TEST_SUPABASE_URL and TEST_SUPABASE_ANON_KEY not provided.');
  console.log('Provide credentials to run against a disposable project.');
  process.exit(0);
}

const clientA = createClient<Database>(url, key);
const clientB = createClient<Database>(url, key);

async function run() {
  console.log('Starting Supabase integration validation...');

  const userAEmail = process.env.TEST_USER_A_EMAIL || `test_a_${Date.now()}@example.com`;
  const userBEmail = process.env.TEST_USER_B_EMAIL || `test_b_${Date.now()}@example.com`;
  const password = process.env.TEST_USER_A_PASSWORD || 'SecurePassword123!';

  // 1. Sign up User A and User B
  const authA = await clientA.auth.signUp({ email: userAEmail, password });
  const authB = await clientB.auth.signUp({ email: userBEmail, password });

  if (authA.error || !authA.data.user) throw new Error(`User A sign up failed: ${authA.error?.message}`);
  if (authB.error || !authB.data.user) throw new Error(`User B sign up failed: ${authB.error?.message}`);

  const userAId = authA.data.user.id;
  const userBId = authB.data.user.id;
  console.log(`✓ Created User A (${userAId}) and User B (${userBId})`);

  // 2. Profile RLS isolation
  await clientA.from('profiles').upsert({
    id: userAId,
    full_name: 'Alice Candidate',
    email: userAEmail,
    skills: ['TypeScript', 'React'],
  });

  const bReadAProfile = await clientB.from('profiles').select('*').eq('id', userAId);
  if (bReadAProfile.data && bReadAProfile.data.length > 0) {
    throw new Error('RLS Violation: User B read User A profile!');
  }
  console.log('✓ Profile RLS isolation verified: User B cannot read User A profile');

  // 3. Applications RLS isolation & audit trigger
  const appA = await clientA
    .from('job_applications')
    .insert({
      user_id: userAId,
      title: 'Frontend Engineer',
      company: 'TechCorp',
      status: 'draft',
    })
    .select()
    .single();

  if (appA.error || !appA.data) throw new Error(`App creation failed: ${appA.error?.message}`);

  const bReadAApp = await clientB.from('job_applications').select('*').eq('id', appA.data.id);
  if (bReadAApp.data && bReadAApp.data.length > 0) {
    throw new Error('RLS Violation: User B read User A job application!');
  }
  console.log('✓ Job Application RLS isolation verified: User B cannot read User A application');

  // Check audit event trigger created event
  const events = await clientA.from('application_events').select('*').eq('application_id', appA.data.id);
  if (!events.data || events.data.length === 0) {
    throw new Error('Trigger failure: application_state_audit did not record creation event');
  }
  console.log('✓ application_state_audit trigger verified: Audit row automatically generated');

  // 4. Invalid status transition rejection
  const invalidTransition = await clientA
    .from('job_applications')
    .update({ status: 'submitted' })
    .eq('id', appA.data.id);

  if (!invalidTransition.error) {
    throw new Error('Transition Guard Violation: Draft was able to jump directly to submitted without ready_for_review');
  }
  console.log('✓ DB transition guard verified: Invalid direct jump to submitted rejected');

  // 5. Private Storage Isolation
  const samplePdf = Buffer.from('%PDF-1.4 Minimal test PDF content');
  const pathA = `${userAId}/${Date.now()}.pdf`;

  const uploadA = await clientA.storage.from('resumes').upload(pathA, samplePdf, {
    contentType: 'application/pdf',
  });
  if (uploadA.error) throw new Error(`Storage upload failed: ${uploadA.error.message}`);

  // User B tries to read User A's object
  const bReadStorage = await clientB.storage.from('resumes').download(pathA);
  if (bReadStorage.data) {
    throw new Error('Storage Policy Violation: User B downloaded User A private resume!');
  }
  console.log('✓ Storage RLS isolation verified: User B cannot download User A resume');

  console.log('All Supabase integration checks passed successfully.');
}

run().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
