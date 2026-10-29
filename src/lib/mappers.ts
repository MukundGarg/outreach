import type { CandidateProfile, Preferences } from '@/lib/domain';
import type { Database } from './supabase/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type PreferencesRow = Database['public']['Tables']['candidate_preferences']['Row'];

/**
 * Parses JSON or string into string.
 */
function jsonToString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (!val) return '';
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join('\n');
  }
  return typeof val === 'object' ? JSON.stringify(val) : String(val);
}

/**
 * Maps a database profile row to the frontend CandidateProfile domain model.
 */
export function profileRowToCandidateProfile(row: ProfileRow): CandidateProfile {
  return {
    name: row.full_name || '',
    email: row.email || '',
    headline: row.headline || '',
    location: row.location || '',
    skills: Array.isArray(row.skills) ? row.skills.join(', ') : '',
    education: jsonToString(row.education),
    experience: jsonToString(row.experience),
    projects: jsonToString(row.projects),
    portfolio: row.portfolio_url || '',
    github: row.github_url || '',
    linkedin: row.linkedin_url || '',
  };
}

/**
 * Maps a CandidateProfile to a database profile insert/update object.
 */
export function candidateProfileToProfileRow(profile: CandidateProfile, userId: string): Database['public']['Tables']['profiles']['Insert'] {
  const skillsArray = profile.skills
    ? profile.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    id: userId,
    full_name: profile.name.trim(),
    email: profile.email.trim() || null,
    headline: profile.headline.trim() || null,
    location: profile.location.trim() || null,
    skills: skillsArray,
    education: profile.education.trim() ? [profile.education.trim()] : [],
    experience: profile.experience.trim() ? [profile.experience.trim()] : [],
    projects: profile.projects.trim() ? [profile.projects.trim()] : [],
    portfolio_url: profile.portfolio.trim() || null,
    github_url: profile.github.trim() || null,
    linkedin_url: profile.linkedin.trim() || null,
  };
}

/**
 * Maps a database preferences row to the frontend Preferences domain model.
 */
export function preferencesRowToPreferences(row: PreferencesRow): Preferences {
  const currency = (['USD', 'INR', 'EUR', 'GBP'].includes(row.currency)
    ? row.currency
    : 'USD') as 'USD' | 'INR' | 'EUR' | 'GBP';

  return {
    roles: Array.isArray(row.roles) ? row.roles.join(', ') : '',
    locations: Array.isArray(row.locations) ? row.locations.join(', ') : '',
    workMode: row.work_mode,
    relocation: row.relocation,
    employmentType: row.employment_type,
    expectedCompensation: row.expected_compensation ? Number(row.expected_compensation) : 0,
    currentCompensation: row.current_compensation ? Number(row.current_compensation) : null,
    currency,
    industries: Array.isArray(row.industries) ? row.industries.join(', ') : '',
  };
}

/**
 * Maps frontend Preferences to database preferences insert/update object.
 */
export function preferencesToPreferencesRow(
  prefs: Preferences,
  userId: string,
): Database['public']['Tables']['candidate_preferences']['Insert'] {
  const splitCommaList = (str: string) =>
    str
      ? str
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return {
    user_id: userId,
    roles: splitCommaList(prefs.roles),
    locations: splitCommaList(prefs.locations),
    work_mode: prefs.workMode,
    relocation: prefs.relocation,
    employment_type: prefs.employmentType,
    expected_compensation: prefs.expectedCompensation,
    current_compensation: prefs.currentCompensation,
    currency: prefs.currency,
    industries: splitCommaList(prefs.industries),
  };
}
