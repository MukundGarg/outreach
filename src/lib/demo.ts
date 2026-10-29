import type { CandidateProfile, JobApplication, Preferences, RecruiterContact } from './domain';
export const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
export const demoProfile: CandidateProfile = {
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  headline: 'Product-minded frontend engineer',
  location: 'Bengaluru, India',
  skills: 'React, TypeScript, Next.js, Design systems, PostgreSQL',
  education: 'B.Tech in Computer Science · 2020–2024\nNational Institute of Technology',
  experience:
    'Frontend Engineer · Studio North · 2024–present\nBuilt accessible product experiences for a team serving 20,000 users.',
  projects:
    'Orbit — an open-source team planning app\nBuilt a collaborative workspace with React and Supabase.',
  portfolio: 'https://example.com',
  github: 'https://github.com',
  linkedin: 'https://linkedin.com',
};
export const demoPreferences: Preferences = {
  roles: 'Frontend Engineer, Product Engineer',
  locations: 'Bengaluru, London, Remote',
  workMode: 'remote',
  relocation: true,
  employmentType: 'full_time',
  expectedCompensation: 90000,
  currentCompensation: null,
  currency: 'USD',
  industries: 'Developer tools, Climate tech, Productivity',
};
const rows = [
  ['Linear', 'Product Engineer', 'interview', 'Remote · Europe'],
  ['Notion', 'Frontend Engineer', 'under_review', 'New York · Hybrid'],
  ['Vercel', 'Design Engineer', 'awaiting_response', 'Remote'],
  ['Figma', 'Software Engineer', 'ready_for_review', 'San Francisco'],
  ['Stripe', 'Frontend Engineer', 'submitted', 'Bengaluru'],
  ['Arc', 'Product Engineer', 'draft', 'Remote'],
  ['Ramp', 'UI Engineer', 'rejected', 'New York'],
  ['Supabase', 'Frontend Engineer', 'offer', 'Remote'],
] as const;
export const demoApplications: JobApplication[] = rows.map(
  ([company, title, status, location], i) => ({
    id: `sample-${i + 1}`,
    company,
    title,
    status,
    location,
    url: `https://example.com/jobs/${i + 1}`,
    createdAt: `2026-10-${String(12 + i).padStart(2, '0')}T10:00:00Z`,
    events: [
      {
        id: `event-${i}`,
        at: `2026-10-${String(12 + i).padStart(2, '0')}T10:00:00Z`,
        description: 'Sample application added',
        to: 'draft',
      },
      ...(status === 'draft'
        ? []
        : [
            {
              id: `event-${i}-2`,
              at: '2026-10-25T09:00:00Z',
              description: `Sample status: ${status.replaceAll('_', ' ')}`,
              to: status,
            },
          ]),
    ],
  }),
);
export const demoContacts: RecruiterContact[] = [
  {
    id: 'contact-1',
    name: 'Jamie Chen',
    company: 'Linear',
    email: 'jamie@example.com',
    role: 'Technical Recruiter',
    status: 'replied',
    draft:
      'Hi Jamie,\n\nI’m interested in the Product Engineer role at Linear. My experience building accessible React interfaces and design systems aligns with the team’s focus on craft. I’d love to share a few projects and learn more.\n\nBest,\nAlex',
    followup: '2026-11-02',
  },
  {
    id: 'contact-2',
    name: 'Sam Rivera',
    company: 'Vercel',
    email: 'sam@example.com',
    role: 'Talent Partner',
    status: 'awaiting_approval',
    draft:
      'Hi Sam,\n\nI’m a frontend engineer working with Next.js and TypeScript. I’d love to explore the Design Engineer opportunity at Vercel and share my portfolio.\n\nBest,\nAlex',
    followup: '2026-11-03',
  },
  {
    id: 'contact-3',
    name: 'Taylor Park',
    company: 'Notion',
    email: 'taylor@example.com',
    role: 'Engineering Recruiter',
    status: 'draft',
    draft:
      'Hi Taylor,\n\nI’m interested in building thoughtful product experiences at Notion. Could we connect about the frontend role?\n\nBest,\nAlex',
    followup: '2026-11-05',
  },
];
