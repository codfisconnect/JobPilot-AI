export const BILLING_CONSTANTS = {
  // Configurable Credit Costs for AI Operations
  CREDIT_COSTS: {
    RESUME_TAILOR: 5,
    INTERVIEW_SESSION_GEN: 3,
    INTERVIEW_EVALUATION: 2,
    CAREER_LEARNING_PLAN: 4
  },

  // Default initial starter credits granted to Free accounts on first creation
  DEFAULT_FREE_STARTER_CREDITS: 10,

  // Plan defaults
  PLANS: {
    FREE: {
      code: 'FREE',
      name: 'Free Starter',
      description: 'Foundational career tools with starter AI credits',
      price: 0,
      currency: 'INR',
      billingInterval: 'MONTHLY',
      creditAllowance: 10,
      resumeProfileLimit: 1,
      features: [
        '1 Resume Profile & parsing',
        'Deterministic job matching & scoring',
        '10 starter AI credits for tailoring & prep',
        'Application pipeline tracking'
      ],
      sortOrder: 1
    },
    BASIC: {
      code: 'BASIC',
      name: 'Career Accelerator (Basic)',
      description: 'Ideal for active job seekers needing multiple resumes and tailored prep',
      price: 49900, // ₹499
      currency: 'INR',
      billingInterval: 'MONTHLY',
      creditAllowance: 50,
      resumeProfileLimit: 2,
      features: [
        'Up to 2 Resume Profiles',
        '50 AI credits per month',
        'Advanced Resume Tailoring & Versioning',
        'Interview Preparation & Evaluation',
        'Personalized Learning Roadmap'
      ],
      sortOrder: 2
    },
    PRO: {
      code: 'PRO',
      name: 'Executive Copilot (Pro)',
      description: 'Maximum firepower for high-volume or cross-track career moves',
      price: 129900, // ₹1,299
      currency: 'INR',
      billingInterval: 'MONTHLY',
      creditAllowance: 150,
      resumeProfileLimit: 5,
      features: [
        'Up to 5 Resume Profiles',
        '150 AI credits per month',
        'Unlimited Resume Tailoring & ATS Analysis',
        'Comprehensive Interview Prep & Real-time Evaluation',
        'Full Career Intelligence & Skill Gap Roadmaps',
        'Priority AI model processing'
      ],
      sortOrder: 3
    }
  }
} as const;
