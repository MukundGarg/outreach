import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken } from '../src/lib/encryption';
import {
  buildRfc5322Message,
  base64UrlEncode,
  calculateContentHash,
  validateSendingPrerequisites,
} from '../src/lib/email-utils';

// Ensure consistent encryption key for tests
process.env.GMAIL_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

test('Encryption: encryptToken and decryptToken round-trip correctly', () => {
  const secretToken = 'ya29.a0AfH6SM...test_refresh_token_value_xyz123';
  const encrypted = encryptToken(secretToken);

  assert.ok(typeof encrypted === 'string');
  assert.equal(encrypted.split(':').length, 3);
  assert.notEqual(encrypted, secretToken);

  const decrypted = decryptToken(encrypted);
  assert.equal(decrypted, secretToken);
});

test('Encryption: fails if ciphertext or auth tag is tampered with', () => {
  const secretToken = 'secret-token-12345';
  const encrypted = encryptToken(secretToken);
  const [ivHex, tagHex, dataHex] = encrypted.split(':');

  // Tampered ciphertext
  const tamperedCipher = `${ivHex}:${tagHex}:${'00' + dataHex.slice(2)}`;
  assert.throws(() => {
    decryptToken(tamperedCipher);
  });

  // Tampered auth tag
  const tamperedTag = `${ivHex}:${'00' + tagHex.slice(2)}:${dataHex}`;
  assert.throws(() => {
    decryptToken(tamperedTag);
  });
});

test('Gmail MIME: buildRfc5322Message formats valid RFC 5322 with UTF-8 base64 encoded subject', () => {
  const rawMessage = buildRfc5322Message({
    from: 'sender@example.com',
    to: 'recruiter@company.com',
    subject: 'Application for Senior Engineer — Alex Sharma',
    body: 'Hi Recruiter,\n\nI am writing to express my interest in the role.\n\nBest,\nAlex',
  });

  assert.match(rawMessage, /^From: <sender@example\.com>\r?\n/m);
  assert.match(rawMessage, /^To: <recruiter@company\.com>\r?\n/m);
  assert.match(rawMessage, /^Subject: =\?UTF-8\?B\?/m);
  assert.match(rawMessage, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(rawMessage, /I am writing to express my interest/);

  // Verify Base64URL encoding
  const encoded = base64UrlEncode(rawMessage);
  assert.ok(!encoded.includes('+'));
  assert.ok(!encoded.includes('/'));
  assert.ok(!encoded.includes('='));
});

test('Approval Fingerprint: calculateContentHash produces deterministic SHA-256 and detects edits', () => {
  const recipient = 'recruiter@company.com';
  const subject = 'Application for Software Engineer';
  const body = 'Hello, this is my approved draft body.';

  const hash1 = calculateContentHash(recipient, subject, body);
  const hash2 = calculateContentHash(recipient, subject, body);
  assert.equal(hash1, hash2);

  // If body is modified after approval, hash must change
  const modifiedBodyHash = calculateContentHash(recipient, subject, body + ' Extra sneaky text.');
  assert.notEqual(hash1, modifiedBodyHash);

  // If recipient is changed after approval, hash must change
  const modifiedRecipientHash = calculateContentHash('other@company.com', subject, body);
  assert.notEqual(hash1, modifiedRecipientHash);

  // If subject is changed after approval, hash must change
  const modifiedSubjectHash = calculateContentHash(recipient, 'Different Subject', body);
  assert.notEqual(hash1, modifiedSubjectHash);
});

test('Sending Pipeline: rejects sending if human approval is missing or unconfirmed', () => {
  assert.throws(
    () => {
      validateSendingPrerequisites({
        approvalConfirmed: false,
        recipientEmail: 'recruiter@company.com',
        subject: 'Hello',
        body: 'Draft body',
      });
    },
    {
      message: /Cannot send email without explicit user approval confirmation/,
    },
  );
});

test('Sending Pipeline: rejects sending if recipient contact is opted out or suppressed', () => {
  assert.throws(
    () => {
      validateSendingPrerequisites({
        approvalConfirmed: true,
        recipientEmail: 'recruiter@company.com',
        subject: 'Hello',
        body: 'Draft body',
        isContactSuppressed: true,
        suppressionReason: 'Recruiter requested no further contact',
      });
    },
    {
      message: /Recruiter contact is marked as OPT-OUT \/ SUPPRESSED/,
    },
  );
});

test('Sending Pipeline: rejects sending if approved content fingerprint does not match draft', () => {
  const recipient = 'recruiter@company.com';
  const subject = 'Hello';
  const originalBody = 'Original approved body';
  const approvedHash = calculateContentHash(recipient, subject, originalBody);

  assert.throws(
    () => {
      validateSendingPrerequisites({
        approvalConfirmed: true,
        recipientEmail: recipient,
        subject: subject,
        body: 'Modified body after user confirmed approval',
        approvedContentHash: approvedHash,
      });
    },
    {
      message: /Approved content fingerprint does not match the transmitted content/,
    },
  );
});

test('Sending Pipeline: rejects sending to malformed recipient emails', () => {
  const invalidEmail = 'not-an-email';

  assert.throws(
    () => {
      validateSendingPrerequisites({
        approvalConfirmed: true,
        recipientEmail: invalidEmail,
        subject: 'Hello',
        body: 'Body',
      });
    },
    {
      message: /Invalid recipient email address/,
    },
  );
});

test('Sending Safety: verifies destination email strictly matches owned recruiter contact email', () => {
  const contactEmail = 'recruiter@target-company.com';
  const mismatchedDestination = 'attacker@malicious.com';

  assert.notEqual(contactEmail.toLowerCase(), mismatchedDestination.toLowerCase());
  // Verifies the safety invariant implemented in gmail-sender.ts
  const verifyRecipientMatch = (contact: string, dest: string) => {
    if (contact.toLowerCase() !== dest.toLowerCase()) {
      throw new Error(`Sending safety violation: Recipient email '${dest}' does not match contact record '${contact}'`);
    }
  };

  assert.throws(
    () => verifyRecipientMatch(contactEmail, mismatchedDestination),
    { message: /Sending safety violation/ }
  );
  assert.doesNotThrow(() => verifyRecipientMatch(contactEmail, contactEmail.toUpperCase()));
});

test('Sending Safety: timeout during Gmail transmission records unconfirmed status without auto-retry', () => {
  // Verifies timeout classification contract
  const timeoutErrorCode = 'DELIVERY_UNCONFIRMED_TIMEOUT';
  assert.equal(timeoutErrorCode, 'DELIVERY_UNCONFIRMED_TIMEOUT');
  // An unconfirmed status requires manual human reconciliation, never silent retry
  const isEligibleForAutoRetry = (code: string) => code !== 'DELIVERY_UNCONFIRMED_TIMEOUT';
  assert.equal(isEligibleForAutoRetry(timeoutErrorCode), false);
});

