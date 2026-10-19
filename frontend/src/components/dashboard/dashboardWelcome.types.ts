export interface DashboardReadiness {
  profile: boolean;
  resume: boolean;
  jobs: boolean;
  applications: boolean;
  careerIntelligence: boolean;
  isReady: boolean;
  error: string | null;
}

export const INITIAL_READINESS: DashboardReadiness = {
  profile: false,
  resume: false,
  jobs: false,
  applications: false,
  careerIntelligence: false,
  isReady: false,
  error: null
};

export interface ValueMessage {
  title: string;
  description: string;
}

export const ROTATING_VALUE_MESSAGES: ValueMessage[] = [
  {
    title: 'Find better opportunities.',
    description: 'Discover verified jobs matching your real competencies and experience.'
  },
  {
    title: 'Build a stronger profile.',
    description: 'Keep your verified career information ready for every targeted application.'
  },
  {
    title: 'Close your skill gaps.',
    description: 'Understand industry requirements and focus on the skills that unlock more roles.'
  },
  {
    title: 'Prepare with confidence.',
    description: 'Practice tailored interview preparation designed for your target position.'
  },
  {
    title: 'Helping you make smarter career moves.',
    description: 'AI-guided guidance to help you move closer to the right opportunity.'
  }
];
