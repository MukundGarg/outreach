import crypto from 'node:crypto';

/**
 * Encodes a string or buffer to RFC 4648 Base64URL (no padding, url-safe).
 */
export function base64UrlEncode(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Builds an RFC 5322 compliant MIME email message.
 */
export function buildRfc5322Message(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const cleanSubject = params.subject.replace(/[\r\n]+/g, ' ').trim();
  const utf8Subject = `=?UTF-8?B?${Buffer.from(cleanSubject, 'utf-8').toString('base64')}?=`;

  const lines = [
    `From: <${params.from}>`,
    `To: <${params.to}>`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.body.trim(),
  ];

  return lines.join('\r\n');
}

/**
 * Calculates a SHA-256 fingerprint of approved recipient, subject, and body content.
 */
export function calculateContentHash(recipient: string, subject: string, body: string): string {
  return crypto
    .createHash('sha256')
    .update(`${recipient.toLowerCase().trim()}|${subject.trim()}|${body.trim()}`)
    .digest('hex');
}

/**
 * Validates approval confirmation, recipient format, suppression status, and content hash.
 * Throws an explicit error if any safety check fails.
 */
export function validateSendingPrerequisites(params: {
  approvalConfirmed: boolean;
  recipientEmail: string;
  subject: string;
  body: string;
  approvedContentHash?: string;
  isContactSuppressed?: boolean;
  suppressionReason?: string | null;
}) {
  const {
    approvalConfirmed,
    recipientEmail,
    subject,
    body,
    approvedContentHash,
    isContactSuppressed,
    suppressionReason,
  } = params;

  // 1. Mandatory approval check
  if (!approvalConfirmed) {
    throw new Error('Cannot send email without explicit user approval confirmation.');
  }

  // 2. Email format validation
  const cleanRecipient = recipientEmail.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanRecipient)) {
    throw new Error(`Invalid recipient email address: "${cleanRecipient}"`);
  }

  // 3. Suppression check
  if (isContactSuppressed) {
    throw new Error(
      `Cannot send email: Recruiter contact is marked as OPT-OUT / SUPPRESSED (${suppressionReason || 'Opt-out'}). All further outreach is blocked.`,
    );
  }

  // 4. Content fingerprint validation if supplied
  if (approvedContentHash) {
    const currentHash = calculateContentHash(cleanRecipient, subject, body);
    if (currentHash !== approvedContentHash) {
      throw new Error(
        'Approved content fingerprint does not match the transmitted content. The draft was modified after approval.',
      );
    }
  }
}
