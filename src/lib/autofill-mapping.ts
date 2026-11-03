import type { CandidateProfile } from '@/lib/domain';
import type { ExtractedFormField } from '@/lib/ai-schemas';

/**
 * Standard sensitivity keywords that must NEVER be automated or guessed by AI.
 * Strict human user input required for compliance, legal attestations, and personal declarations.
 */
export const SENSITIVE_KEYWORDS = [
  'work authorization',
  'visa',
  'sponsorship',
  'authorized to work',
  'disability',
  'veteran',
  'race',
  'ethnicity',
  'gender',
  'sexual orientation',
  'felony',
  'criminal',
  'background check',
  'legal attestation',
  'certify',
  'i agree',
  'terms',
  'equal opportunity',
  'eeo',
  'affirmative action',
  'clearance',
];

export function isSensitiveField(label: string): boolean {
  const lower = label.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Common field aliases mapping to candidate profile fields.
 */
export function mapProfileField(
  formField: ExtractedFormField,
  profile: CandidateProfile | null,
): { value: string; isMatch: boolean; confidence: number } {
  if (!profile) return { value: '', isMatch: false, confidence: 0 };

  const label = formField.fieldLabel.toLowerCase().trim();
  const placeholder = (formField.placeholder || '').toLowerCase();
  const combined = `${label} ${placeholder}`;

  // 1. Email
  if (formField.fieldType === 'email' || combined.includes('email')) {
    return { value: profile.email || '', isMatch: !!profile.email, confidence: 1.0 };
  }

  // 2. Name
  const fullName = profile.name || '';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  if (combined.includes('first name') || combined.includes('given name')) {
    return { value: firstName, isMatch: !!firstName, confidence: 1.0 };
  }
  if (combined.includes('last name') || combined.includes('family name') || combined.includes('surname')) {
    return { value: lastName, isMatch: !!lastName, confidence: 1.0 };
  }
  if (combined.includes('full name') || (combined.includes('name') && !combined.includes('company') && !combined.includes('user'))) {
    return { value: fullName, isMatch: !!fullName, confidence: 0.95 };
  }

  // 3. Phone
  if (formField.fieldType === 'tel' || combined.includes('phone') || combined.includes('mobile')) {
    // Check if phone or location in profile
    return { value: '', isMatch: false, confidence: 0 }; // We don't invent phone
  }

  // 4. LinkedIn
  if (combined.includes('linkedin')) {
    return { value: profile.linkedin || '', isMatch: !!profile.linkedin, confidence: 1.0 };
  }

  // 5. GitHub
  if (combined.includes('github') || combined.includes('git repo')) {
    return { value: profile.github || '', isMatch: !!profile.github, confidence: 1.0 };
  }

  // 6. Portfolio / Website
  if (combined.includes('portfolio') || combined.includes('website') || combined.includes('personal site')) {
    return { value: profile.portfolio || '', isMatch: !!profile.portfolio, confidence: 0.95 };
  }

  // 7. Location / City / Address
  if (combined.includes('location') || combined.includes('city') || combined.includes('address')) {
    return { value: profile.location || '', isMatch: !!profile.location, confidence: 0.9 };
  }

  // 8. Headline / Summary
  if (combined.includes('headline') || combined.includes('professional summary')) {
    return { value: profile.headline || '', isMatch: !!profile.headline, confidence: 0.9 };
  }

  return { value: '', isMatch: false, confidence: 0 };
}

/**
 * Pure heuristic classification before calling Gemini.
 * Returns basic, complex, sensitive, or profile.
 */
export function classifyFieldKind(formField: ExtractedFormField): 'profile' | 'sensitive' | 'basic' | 'complex' {
  const label = formField.fieldLabel.toLowerCase();

  if (isSensitiveField(label)) {
    return 'sensitive';
  }

  // Common direct profile labels
  if (
    label.includes('name') ||
    label.includes('email') ||
    label.includes('linkedin') ||
    label.includes('github') ||
    label.includes('portfolio') ||
    label.includes('website') ||
    label.includes('phone') ||
    label.includes('location')
  ) {
    return 'profile';
  }

  // Complex behavioral or essay questions
  if (
    label.includes('challenge') ||
    label.includes('difficult') ||
    label.includes('conflict') ||
    label.includes('leadership') ||
    label.includes('significant project') ||
    label.includes('uniquely qualified') ||
    label.includes('proud of') ||
    label.includes('tell us about a time')
  ) {
    return 'complex';
  }

  // Basic open questions
  return 'basic';
}
