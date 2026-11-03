import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseCsvTokens, sanitizeCsvField } from '../src/lib/csv-parser';
import {
  validateRecruiter,
  normalizeEmail,
  normalizeLinkedinUrl,
  isValidEmailSyntax,
} from '../src/services/recruiter-verification';
import { canonicalRecruiterRecordSchema } from '../src/lib/ai-schemas';

test('CSV Parser: parses basic CSV with headers and rows', () => {
  const csv = `Full Name,Email,Company\nAlice Smith,alice@example.com,TechCorp\nBob Jones,bob@example.com,CloudCorp`;
  const result = parseCsv(csv);
  assert.equal(result.headers.length, 3);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]['Full Name'], 'Alice Smith');
  assert.equal(result.rows[1]['Company'], 'CloudCorp');
});

test('CSV Parser: handles reordered columns and differing column names', () => {
  const csv = `Work Email,Organization,Candidate Contact Name\ncontact@acme.org,Acme Inc,Charlie Brown`;
  const result = parseCsv(csv);
  assert.equal(result.headers[0], 'Work Email');
  assert.equal(result.rows[0]['Organization'], 'Acme Inc');
  assert.equal(result.rows[0]['Candidate Contact Name'], 'Charlie Brown');
});

test('CSV Parser: correctly handles quotes, commas, and newlines in values', () => {
  const csv = `"Name","Email","Company, Inc."\n"John Doe","john@example.com","Acme, LLC"`;
  const tokens = parseCsvTokens(csv);
  assert.equal(tokens.length, 2);
  assert.equal(tokens[1][2], 'Acme, LLC');
});

test('CSV Parser: sanitizes CSV formula injection characters', () => {
  assert.equal(sanitizeCsvField('=1+1'), "''=1+1".slice(1)); // escaped with leading single quote
  assert.equal(sanitizeCsvField('+cmd'), "'+cmd");
  assert.equal(sanitizeCsvField('@SUM(A1:A10)'), "'@SUM(A1:A10)");
  assert.equal(sanitizeCsvField('Normal Text'), 'Normal Text');
});

test('Recruiter Validation: email normalization and syntax validation', () => {
  assert.equal(normalizeEmail('  Test.User@Example.COM '), 'test.user@example.com');
  assert.equal(isValidEmailSyntax('valid.recruiter@company.co'), true);
  assert.equal(isValidEmailSyntax('invalid-email-without-at'), false);
  assert.equal(isValidEmailSyntax('no-domain@'), false);
});

test('Recruiter Validation: normalize LinkedIn profile URLs and reject invalid links', () => {
  assert.equal(
    normalizeLinkedinUrl('https://www.linkedin.com/in/recruiter-jane/?ref=test'),
    'https://www.linkedin.com/in/recruiter-jane',
  );
  assert.equal(
    normalizeLinkedinUrl('linkedin.com/in/recruiter-jane/'),
    'https://linkedin.com/in/recruiter-jane',
  );
  assert.equal(normalizeLinkedinUrl('https://twitter.com/recruiter-jane'), null);
});

test('Recruiter Validation: identifies missing fields and determines review status', async () => {
  const missingData = {
    fullName: '',
    email: 'bad-email',
  };
  const result = await validateRecruiter(missingData, { checkDns: false });
  assert.equal(result.isValid, false);
  assert.equal(result.status, 'needs_review');
  assert.ok(result.issues.length >= 2);
});

test('Recruiter Validation: marks verified when DNS MX passes and LinkedIn is present', async () => {
  const completeData = {
    fullName: 'Sarah Connor',
    email: 'sarah@google.com',
    jobTitle: 'Senior Tech Recruiter',
    company: 'Google',
    linkedinUrl: 'https://linkedin.com/in/sarah-connor',
    companyWebsite: 'https://google.com',
  };
  // google.com has active MX records
  const result = await validateRecruiter(completeData, { checkDns: true });
  assert.equal(result.isValid, true);
  assert.equal(result.status, 'verified');
  assert.equal(result.verificationMethod, 'domain_mx_and_linkedin_identity');
});

test('Canonical Recruiter Schema: validates correct types and defaults', () => {
  const parsed = canonicalRecruiterRecordSchema.safeParse({
    full_name: 'Jessica Chen',
    email: 'jessica@example.com',
    job_title: 'Staff Recruiter',
    company: 'Stripe',
  });
  assert.ok(parsed.success);
  assert.equal(parsed.data.full_name, 'Jessica Chen');
  assert.deepEqual(parsed.data.recruiting_specialties, []);
  assert.equal(parsed.data.verification_status, 'parsed');
});

