import type {
  ExtractedProfile,
  JobAnalysis,
  ReplyClassification,
  BasicAnswerDraft,
  DifyApplicationIntelligence,
  DifyOutreachIntelligence,
} from './ai-schemas';

export const mockAIResults = {
  resume_extract: {
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    headline: 'Senior Full Stack Engineer',
    location: 'Bengaluru, India',
    skills: 'TypeScript, React, Next.js, Node.js, PostgreSQL, Supabase, Tailwind CSS',
    education: 'B.Tech in Computer Science · 2020–2024\nNational Institute of Technology',
    experience:
      'Senior Frontend Engineer · Studio North · 2024–present\nArchitected accessible UI design systems used by over 20k active developers.',
    projects:
      'Orbit — Open source real-time team workflow board with React, Next.js, and Supabase.',
    portfolio: 'https://example.com/alex',
    github: 'https://github.com/alexmorgan',
    linkedin: 'https://linkedin.com/in/alexmorgan',
    confidence_score: 0.98,
  } as ExtractedProfile,

  job_analyze: {
    job_summary:
      'High-growth tech team looking for a passionate Senior Frontend / Full-Stack Engineer to lead product craft.',
    requirements: [
      '3+ years production experience with React, TypeScript, and modern Next.js',
      'Strong eye for accessible UI design systems and micro-interactions',
      'Experience integrating PostgreSQL and REST / GraphQL APIs',
      'Clear communication and self-driven product ownership',
    ],
    matched_requirements: [
      'Proven expertise in React, TypeScript, and Next.js App Router',
      'Built accessible product design systems and component libraries',
      'Database experience with PostgreSQL and Supabase',
    ],
    missing_requirements: [
      'Direct team leadership or management experience not explicitly highlighted',
    ],
    match_score: 92,
    key_technologies: ['React', 'TypeScript', 'Next.js', 'PostgreSQL', 'Tailwind CSS'],
    role_level: 'Senior',
    recommendations: [
      'Emphasize your open-source projects and recent scale achievements in Studio North.',
      'Highlight testing and performance optimization in your screening answers.',
    ],
  } as JobAnalysis,

  reply_classify: {
    classification: 'interview_invitation' as const,
    summary: 'The recruiter is eager to schedule an initial 30-minute technical conversation.',
    confidence: 0.96,
    needs_human_review: false,
    suggested_action: 'Reply with your availability for the coming 2 business days.',
    evidence: '“Would you have 30 minutes this Thursday or Friday for an introductory chat?”',
  } as ReplyClassification,

  simple_answer: {
    question: 'Why are you interested in this role?',
    answer:
      'I have been following your team’s focus on craft and product quality. My background building accessible design systems and scalable web applications aligns directly with the mission, and I would love to contribute to shaping the core user experience.',
    key_points_used: ['Design system experience', 'Passion for engineering craft'],
    confidence: 0.95,
  } as BasicAnswerDraft,

  complex_application: {
    job_summary: 'Platform Engineer opportunity focusing on developer experience and reliable services.',
    requirements: [
      'TypeScript and React proficiency',
      'PostgreSQL data modeling',
      'Production deployment experience',
    ],
    matched_requirements: ['React and TypeScript proficiency', 'PostgreSQL database expertise'],
    missing_requirements: ['Specific Kubernetes orchestration experience'],
    field_mappings: [
      {
        field_name: 'Full Name',
        proposed_value: 'Alex Morgan',
        evidence: 'Candidate profile record',
        requires_review: false,
      },
      {
        field_name: 'Primary Work Authorization',
        proposed_value: 'Authorized to work without sponsorship',
        evidence: 'Profile location & defaults',
        requires_review: true,
      },
      {
        field_name: 'Notice Period',
        proposed_value: '30 days',
        evidence: 'Standard candidate preferences',
        requires_review: true,
      },
    ],
    screening_answers: [
      {
        question: 'Describe a complex technical challenge you solved recently.',
        answer:
          'At Studio North, I migrated our state management and data caching pipeline to Next.js App Router and Supabase, cutting initial render latency by 45% while ensuring 100% type safety across API boundaries.',
        evidence: 'Experience at Studio North & Orbit project architecture',
        requires_review: true,
      },
    ],
    unresolved_questions: [
      'Are you open to occasional travel to company quarterly meetups?',
    ],
    ready_for_review: true,
    recommended_next_action:
      'Review the proposed screening answers and confirm work authorization before saving.',
  } as DifyApplicationIntelligence,

  outreach_plan: {
    recommended_action: 'draft_initial' as const,
    subject: 'Exploring opportunities at your team · Alex Morgan',
    email_body:
      'Hi,\n\nI’ve been following your team’s recent engineering work and love the focus on craft and performance. As a frontend-oriented full-stack engineer with deep experience in TypeScript, React, and PostgreSQL, I’d love to connect for a brief chat about upcoming engineering roles.\n\nBest regards,\nAlex',
    personalization_evidence: [
      'Aligned technical stack: TypeScript, Next.js, and product-focused engineering',
      'Direct relevance of past projects to recruiter company domain',
    ],
    reasoning_summary:
      'Initial outreach highlighting shared tech stack and engineering craft with a polite, low-friction invitation to connect.',
    reply_interpretation: null,
    followup_eligible: true,
    suggested_delay_business_days: 3,
    warnings: [],
    requires_user_approval: true,
  } as DifyOutreachIntelligence,
};
