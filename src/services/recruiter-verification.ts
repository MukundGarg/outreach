import dns from 'dns';

export type RecruiterVerificationStatus =
  | 'parsed'
  | 'needs_review'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'stale';

export interface RecruiterValidationResult {
  isValid: boolean;
  normalizedEmail: string;
  normalizedLinkedin: string | null;
  normalizedCompanyWebsite: string | null;
  issues: string[];
  status: RecruiterVerificationStatus;
  verificationMethod?: string;
  verificationSource?: string;
}

const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailSyntax(email: string): boolean {
  if (!email || email.length > 254) return false;
  return emailRegex.test(normalizeEmail(email));
}

export function normalizeLinkedinUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    let withProto = trimmed;
    if (!/^https?:\/\//i.test(trimmed)) {
      withProto = `https://${trimmed}`;
    }
    const parsed = new URL(withProto);
    if (!parsed.hostname.toLowerCase().includes('linkedin.com')) {
      return null;
    }
    // Clean query parameters and trailing slashes for standard identity matching
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `https://${parsed.hostname.toLowerCase()}${pathname}`;
  } catch {
    return null;
  }
}

export function normalizeWebsiteUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    let withProto = trimmed;
    if (!/^https?:\/\//i.test(trimmed)) {
      withProto = `https://${trimmed}`;
    }
    const parsed = new URL(withProto);
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/**
 * Perform server-side DNS MX record check for an email domain.
 * Strictly no SMTP probing or unsolicited verification emails.
 */
export async function checkDomainMx(domain: string): Promise<boolean> {
  if (!domain || domain.includes(' ') || !domain.includes('.')) return false;
  try {
    const mxRecords = await dns.promises.resolveMx(domain);
    return Array.isArray(mxRecords) && mxRecords.length > 0;
  } catch {
    return false;
  }
}

export interface CandidateForValidation {
  fullName: string;
  email: string;
  jobTitle?: string | null;
  company?: string | null;
  linkedinUrl?: string | null;
  companyWebsite?: string | null;
  location?: string | null;
  recruitingSpecialties?: string[];
  sourceUrl?: string | null;
}

/**
 * Validates recruiter record and determines baseline verification status.
 */
export async function validateRecruiter(
  candidate: CandidateForValidation,
  options: { checkDns?: boolean } = { checkDns: true },
): Promise<RecruiterValidationResult> {
  const issues: string[] = [];
  const normalizedEmail = normalizeEmail(candidate.email);
  const normalizedLinkedin = normalizeLinkedinUrl(candidate.linkedinUrl);
  const normalizedCompanyWebsite = normalizeWebsiteUrl(candidate.companyWebsite);

  // 1. Name check
  if (!candidate.fullName || candidate.fullName.trim().length < 2) {
    issues.push('Missing or invalid recruiter full name');
  }

  // 2. Email syntax check
  if (!isValidEmailSyntax(normalizedEmail)) {
    issues.push(`Invalid email address format: ${candidate.email}`);
  }

  // 3. LinkedIn format check
  if (candidate.linkedinUrl && !normalizedLinkedin) {
    issues.push(`Invalid LinkedIn profile URL: ${candidate.linkedinUrl}`);
  }

  // 4. Company & Job Title consistency
  if (!candidate.company || candidate.company.trim().length === 0) {
    issues.push('Missing company affiliation');
  }
  if (!candidate.jobTitle || candidate.jobTitle.trim().length === 0) {
    issues.push('Missing job title / role');
  }

  // 5. Domain DNS check if syntax passed
  let domainHasMx = false;
  if (isValidEmailSyntax(normalizedEmail) && options.checkDns) {
    const domain = normalizedEmail.split('@')[1];
    domainHasMx = await checkDomainMx(domain);
    if (!domainHasMx) {
      issues.push(`Domain "${domain}" does not have active MX records`);
    }
  }

  // Status determination
  let status: RecruiterVerificationStatus = 'parsed';
  let verificationMethod: string | undefined;

  if (issues.length > 0) {
    // If fatal syntax issues
    if (!isValidEmailSyntax(normalizedEmail) || !candidate.fullName) {
      status = 'needs_review';
    } else {
      status = 'needs_review';
    }
  } else {
    // Has valid name, email, company, job title, and active MX domain
    // If it has verified professional evidence (valid LinkedIn and MX)
    if (domainHasMx && normalizedLinkedin) {
      status = 'verified';
      verificationMethod = 'domain_mx_and_linkedin_identity';
    } else if (domainHasMx) {
      status = 'pending_verification';
      verificationMethod = 'domain_mx_syntax';
    } else {
      status = 'needs_review';
    }
  }

  return {
    isValid: issues.length === 0,
    normalizedEmail,
    normalizedLinkedin,
    normalizedCompanyWebsite,
    issues,
    status,
    verificationMethod,
  };
}
