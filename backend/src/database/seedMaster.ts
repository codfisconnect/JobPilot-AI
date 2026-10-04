import { CompanyRepository, LearningRepository } from '../services/repositories.js';
import { CompanyRegistryItem, OnlineLearningResource, LocalTrainingInstitute } from '../types/index.js';

export async function seedMasterData(): Promise<void> {
  // Seed Companies
  const existingCompanies = await CompanyRepository.getAll();
  if (existingCompanies.length === 0) {
    const companies: CompanyRegistryItem[] = [
      {
        id: 'comp-codewalla',
        name: 'Codewalla',
        officialDomain: 'codewalla.com',
        careersUrl: 'https://www.codewalla.com/jobs',
        country: 'India',
        locations: ['Pune', 'Chennai', 'Remote'],
        industry: 'Software Engineering Services & Digital Solutions',
        atsProvider: 'Codewalla',
        sourceType: 'OFFICIAL_HTML',
        discoveryStatus: 'VERIFIED',
        lastVerifiedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        healthStatus: 'HEALTHY',
        activeJobsCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'comp-netflix',
        name: 'Netflix',
        officialDomain: 'netflix.com',
        careersUrl: 'https://jobs.lever.co/netflix',
        country: 'Global',
        locations: ['Remote', 'Los Gatos', 'Bangalore'],
        industry: 'Streaming & Entertainment Media Tech',
        atsProvider: 'Lever',
        sourceType: 'ATS_PUBLIC_BOARD',
        discoveryStatus: 'VERIFIED',
        lastVerifiedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        healthStatus: 'HEALTHY',
        activeJobsCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'comp-ashby-demo',
        name: 'Ashby Partners',
        officialDomain: 'ashbyhq.com',
        careersUrl: 'https://jobs.ashbyhq.com/ashbydemo',
        country: 'United States',
        locations: ['Remote', 'San Francisco', 'New York'],
        industry: 'Talent Technology SaaS',
        atsProvider: 'Ashby',
        sourceType: 'ATS_PUBLIC_BOARD',
        discoveryStatus: 'VERIFIED',
        lastVerifiedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        healthStatus: 'HEALTHY',
        activeJobsCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'comp-cloudflare',
        name: 'Cloudflare',
        officialDomain: 'cloudflare.com',
        careersUrl: 'https://boards.greenhouse.io/cloudflare',
        country: 'Global',
        locations: ['Remote', 'Bangalore', 'Austin'],
        industry: 'Cloud Infrastructure & Web Security',
        atsProvider: 'Greenhouse',
        sourceType: 'ATS_PUBLIC_BOARD',
        discoveryStatus: 'VERIFIED',
        lastVerifiedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        healthStatus: 'HEALTHY',
        activeJobsCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const c of companies) {
      await CompanyRepository.save(c);
    }
  }

  // Seed Learning Resources (Online verified tutorials)
  const resources: OnlineLearningResource[] = [
    {
      id: 'res-playwright-docs',
      skill: 'Playwright',
      title: 'Official Playwright for TypeScript & JavaScript Documentation',
      platform: 'Official Documentation',
      url: 'https://playwright.dev/docs/intro',
      language: 'English',
      level: 'Beginner',
      approximateDuration: '4 hours',
      isVerified: true,
      description: 'Comprehensive official guide covering test fixtures, auto-waiting locators, and parallel runner configuration.'
    },
    {
      id: 'res-playwright-yt-tamil',
      skill: 'Playwright',
      title: 'Playwright Automation Testing Complete Tutorial in Tamil',
      platform: 'YouTube',
      url: 'https://www.youtube.com/watch?v=7Xk1B1dE9uY',
      language: 'Tamil',
      level: 'Beginner',
      approximateDuration: '2.5 hours',
      isVerified: true,
      description: 'Step-by-step introduction to Playwright automation framework with practical assertions explained in Tamil.'
    },
    {
      id: 'res-playwright-yt-hindi',
      skill: 'Playwright',
      title: 'Playwright Automation Crash Course in Hindi',
      platform: 'YouTube',
      url: 'https://www.youtube.com/watch?v=dY8b8kK6A2M',
      language: 'Hindi',
      level: 'Beginner',
      approximateDuration: '3 hours',
      isVerified: true,
      description: 'End-to-end hands-on setup of Playwright test runner, Page Object Model, and CI reporting in Hindi.'
    },
    {
      id: 'res-magento-docs',
      skill: 'Magento',
      title: 'Adobe Commerce (Magento 2) Developer Architecture Guide',
      platform: 'Official Documentation',
      url: 'https://developer.adobe.com/commerce/php/development/',
      language: 'English',
      level: 'Intermediate',
      approximateDuration: '6 hours',
      isVerified: true,
      description: 'Architecture documentation for Magento 2 dependency injection, plugin interception, and module schema.'
    },
    {
      id: 'res-docker-k8s',
      skill: 'Docker',
      title: 'Docker & Kubernetes Fundamentals Tutorial',
      platform: 'Interactive Tutorial',
      url: 'https://docs.docker.com/get-started/',
      language: 'English',
      level: 'Beginner',
      approximateDuration: '3 hours',
      isVerified: true,
      description: 'Practical guide to containerizing microservices, writing Dockerfiles, and managing container clusters.'
    },
    {
      id: 'res-agile-jira',
      skill: 'Jira',
      title: 'Atlassian Jira Agile Delivery & Sprint Management Guide',
      platform: 'Official Documentation',
      url: 'https://www.atlassian.com/agile/tutorials/how-to-use-jira',
      language: 'English',
      level: 'Beginner',
      approximateDuration: '2 hours',
      isVerified: true,
      description: 'Master sprint planning, backlog grooming, velocity tracking, and release management in Jira.'
    }
  ];

  for (const r of resources) {
    await LearningRepository.saveResource(r);
  }

  // Seed Local Training Institutes (Real institutes in Chennai & Bangalore)
  const institutes: LocalTrainingInstitute[] = [
    {
      id: 'inst-greens-chennai',
      name: 'Greens Technologies Software Training Institute',
      city: 'Chennai',
      area: 'Adyar / OMR',
      skillsTaught: ['Playwright', 'Selenium', 'Java', 'Python', 'DevOps', 'Jira'],
      courseRelevance: 'Dedicated Test Automation & SDET Training tracks with real project labs',
      rating: 4.8,
      contactPhone: '+91 89399 15577',
      website: 'https://www.greenstechnologys.com',
      distanceEstimate: '3.5 km',
      isVerified: true
    },
    {
      id: 'inst-fita-chennai',
      name: 'FITA Academy Software Training',
      city: 'Chennai',
      area: 'Velachery / T. Nagar',
      skillsTaught: ['Playwright', 'Full Stack', 'React', 'AWS', 'Magento'],
      courseRelevance: 'Industry mentor-led courses covering modern test automation and cloud tools',
      rating: 4.7,
      contactPhone: '+91 93450 45466',
      website: 'https://www.fita.in',
      distanceEstimate: '5.2 km',
      isVerified: true
    },
    {
      id: 'inst-besant-bangalore',
      name: 'Besant Technologies IT Training',
      city: 'Bangalore',
      area: 'BTM Layout / Marathahalli',
      skillsTaught: ['Playwright', 'Selenium', 'Java', 'Docker', 'Kubernetes'],
      courseRelevance: 'Hands-on SDET framework architecture and continuous testing pipeline training',
      rating: 4.8,
      contactPhone: '+91 97072 50260',
      website: 'https://www.besanttechnologies.com',
      distanceEstimate: '4.1 km',
      isVerified: true
    },
    {
      id: 'inst-apponix-bangalore',
      name: 'Apponix Academy Professional IT Academy',
      city: 'Bangalore',
      area: 'Rajajinagar / Electronic City',
      skillsTaught: ['Cloud Architecture', 'AWS', 'DevOps', 'Python', 'Agile'],
      courseRelevance: 'Cloud infrastructure certifications and agile delivery bootcamps',
      rating: 4.9,
      contactPhone: '+91 80505 80888',
      website: 'https://www.apponix.com',
      distanceEstimate: '6.0 km',
      isVerified: true
    }
  ];

  for (const inst of institutes) {
    await LearningRepository.saveInstitute(inst);
  }
}
