import { NextResponse } from 'next/server';
import { listVerifiedRecruiters, recommendRecruiters } from '@/services/recruiter-directory';
import { getProfile, getPreferences } from '@/services/applications';
import { demoEnabled } from '@/lib/demo';
import type { CandidateProfile, Preferences } from '@/lib/domain';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'recommendations';
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '15', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // If browsing directory
    if (mode === 'directory') {
      const result = await listVerifiedRecruiters({ limit, offset, query });
      return NextResponse.json({
        ok: true,
        data: result,
      });
    }

    // Default: Recommendations matched against user's profile and preferences
    let profile = null;
    let preferences = null;

    if (!demoEnabled) {
      try {
        [profile, preferences] = await Promise.all([getProfile(), getPreferences()]);
      } catch {
        // Fall back to empty signals if unauthenticated or error
      }
    } else {
      // Demo signals
      profile = {
        name: 'Alex Morgan',
        skills: 'TypeScript, React, Next.js, PostgreSQL',
      } as CandidateProfile;
      preferences = {
        roles: 'Senior Full Stack Engineer, Frontend Engineer',
        locations: 'San Francisco, CA, Remote, Bengaluru',
        industries: 'Cloud Infrastructure, AI, SaaS',
      } as unknown as Preferences;
    }

    const recommendations = await recommendRecruiters(profile, preferences, { limit });

    return NextResponse.json({
      ok: true,
      data: {
        recommendations,
        total: recommendations.length,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve recruiter recommendations';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
