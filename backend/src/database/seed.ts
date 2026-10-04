import { getDb, saveDb } from './db.js';
import { CandidateRepository, JobRepository, ApplicationRepository } from '../services/repositories.js';
import { CandidateProfile, JobDescription, ApplicationRecord } from '../types/index.js';

export const demoCandidates: CandidateProfile[] = [
  {
    id: 'cand-demo-1',
    name: 'Aarav Sharma',
    email: 'aarav.sharma.test@jobpilot-demo.internal',
    phone: '+91 98765 43210',
    location: 'Bangalore, India',
    targetRoles: ['QA Automation Engineer', 'SDET', 'Lead QA Automation'],
    yearsOfExperience: 5.5,
    preferredLocations: ['Bangalore', 'Remote', 'Hyderabad'],
    expectedSalary: '₹22,00,000 INR',
    noticePeriod: '30 Days',
    workPreference: 'Hybrid',
    primarySkills: ['Java', 'Selenium', 'API Testing', 'Jenkins', 'SQL', 'Playwright'],
    secondarySkills: ['TestNG', 'Cucumber BDD', 'Git', 'RestAssured', 'Postman', 'Docker'],
    technologies: ['Java', 'Selenium', 'Playwright', 'TestNG', 'Cucumber', 'RestAssured', 'Postman', 'Jenkins', 'Git', 'SQL', 'JIRA', 'Maven'],
    companies: ['Infosys Technologies', 'Cognizant'],
    education: [
      {
        id: 'edu-1',
        degree: 'B.Tech in Computer Science & Engineering',
        institution: 'Visvesvaraya Technological University',
        year: '2019'
      }
    ],
    certifications: ['ISTQB Certified Tester - Advanced Level Test Automation Engineer', 'Oracle Certified Associate Java SE 8'],
    projects: [
      {
        id: 'proj-1',
        name: 'Enterprise FinTech Core Automation Framework',
        description: 'Architected modular hybrid automation framework using Java, Playwright, and TestNG. Reduced regression test suite cycle time by 62%.',
        technologies: ['Java', 'Playwright', 'TestNG', 'Jenkins', 'Git']
      },
      {
        id: 'proj-2',
        name: 'Omnichannel REST API Automation Suite',
        description: 'Developed automated REST API integration test coverage utilizing RestAssured and Jenkins CI/CD pipeline with 99.4% test reliability.',
        technologies: ['RestAssured', 'Java', 'Jenkins', 'SQL']
      }
    ],
    summary: 'Seasoned QA Automation Engineer with 5.5 years of experience architecting scalable automation frameworks using Java, Selenium, Playwright, and RestAssured. Track record of optimizing regression testing cycles and leading CI/CD test automation pipelines in agile FinTech and SaaS ecosystems.',
    experiences: [
      {
        id: 'exp-1',
        title: 'Senior QA Automation Engineer',
        company: 'Infosys Technologies',
        location: 'Bangalore, India',
        startDate: '2022-03',
        endDate: 'Present',
        isCurrent: true,
        highlights: [
          'Engineered end-to-end automation testing suite utilizing Java and Playwright covering 800+ complex UI and API workflows.',
          'Built Jenkins CI/CD test gates preventing 40+ critical defects from entering release branches over 18 months.',
          'Spearheaded SQL verification scripts to validate multi-million record transactional integrity in database tiers.'
        ],
        skillsUsed: ['Java', 'Playwright', 'Selenium', 'Jenkins', 'SQL', 'Git']
      },
      {
        id: 'exp-2',
        title: 'QA Test Automation Engineer',
        company: 'Cognizant',
        location: 'Bangalore, India',
        startDate: '2019-07',
        endDate: '2022-02',
        isCurrent: false,
        highlights: [
          'Designed and maintained Selenium WebDriver automation test scripts using TestNG and Cucumber BDD.',
          'Executed automated API functional verification using Postman and RestAssured.',
          'Collaborated closely with development squads to resolve defects within 24-hour sprint SLA windows.'
        ],
        skillsUsed: ['Java', 'Selenium', 'TestNG', 'Cucumber', 'Postman', 'SQL']
      }
    ],
    isDemo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cand-demo-2',
    name: 'Priya Iyer',
    email: 'priya.iyer.test@jobpilot-demo.internal',
    phone: '+91 91234 56789',
    location: 'Bangalore, India',
    targetRoles: ['Java Backend Developer', 'Senior Backend Engineer', 'Software Development Engineer II'],
    yearsOfExperience: 4.8,
    preferredLocations: ['Bangalore', 'Remote', 'Pune'],
    expectedSalary: '₹26,00,000 INR',
    noticePeriod: '60 Days',
    workPreference: 'Remote',
    primarySkills: ['Java', 'Spring Boot', 'REST API', 'PostgreSQL', 'Kafka'],
    secondarySkills: ['Microservices', 'Docker', 'Redis', 'Hibernate', 'JUnit', 'AWS'],
    technologies: ['Java 17', 'Spring Boot', 'Spring Cloud', 'PostgreSQL', 'Kafka', 'Redis', 'Docker', 'Kubernetes', 'Maven', 'Git'],
    companies: ['Wipro Digital', 'ThoughtWorks'],
    education: [
      {
        id: 'edu-2',
        degree: 'B.E. in Information Technology',
        institution: 'Anna University',
        year: '2020'
      }
    ],
    certifications: ['AWS Certified Solutions Architect – Associate', 'Confluent Certified Developer for Apache Kafka'],
    projects: [
      {
        id: 'proj-3',
        name: 'High-Throughput Payment Processing Microservices',
        description: 'Built distributed transaction processing services handling 8,000 requests/sec with Kafka event streaming and Redis caching.',
        technologies: ['Java', 'Spring Boot', 'Kafka', 'PostgreSQL', 'Redis']
      }
    ],
    summary: 'Backend Software Engineer with 4.8 years of expertise in Java, Spring Boot, distributed microservices, PostgreSQL, and event-driven architectures with Apache Kafka. Proven track record in building fault-tolerant high-throughput REST APIs.',
    experiences: [
      {
        id: 'exp-3',
        title: 'Backend Software Engineer',
        company: 'ThoughtWorks',
        location: 'Bangalore, India',
        startDate: '2022-01',
        endDate: 'Present',
        isCurrent: true,
        highlights: [
          'Engineered core event-driven microservices processing high-volume banking transactions using Java and Apache Kafka.',
          'Optimized PostgreSQL query schemas and indexing, decreasing p99 database latency by 38%.',
          'Integrated distributed Redis cache layers eliminating repetitive third-party API lookups.'
        ],
        skillsUsed: ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'Redis', 'Docker']
      }
    ],
    isDemo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cand-demo-3',
    name: 'Rohan Deshmukh',
    email: 'rohan.deshmukh.test@jobpilot-demo.internal',
    phone: '+91 97654 32109',
    location: 'Mumbai, India',
    targetRoles: ['Data Analyst', 'BI Analyst', 'Analytics Engineer'],
    yearsOfExperience: 3.5,
    preferredLocations: ['Mumbai', 'Bangalore', 'Remote'],
    expectedSalary: '₹15,00,000 INR',
    noticePeriod: '15 Days',
    workPreference: 'Hybrid',
    primarySkills: ['SQL', 'Power BI', 'Python', 'Excel', 'Tableau'],
    secondarySkills: ['Pandas', 'NumPy', 'Data Modeling', 'ETL', 'DAX', 'Snowflake'],
    technologies: ['SQL', 'Power BI', 'Python', 'Tableau', 'Excel', 'Pandas', 'Snowflake', 'PostgreSQL'],
    companies: ['Mu Sigma', 'Swiggy Analytics Partner'],
    education: [
      {
        id: 'edu-3',
        degree: 'B.Sc in Statistics & Data Analytics',
        institution: 'Mumbai University',
        year: '2021'
      }
    ],
    certifications: ['Microsoft Certified: Power BI Data Analyst Associate (PL-300)', 'Tableau Desktop Specialist'],
    projects: [
      {
        id: 'proj-4',
        name: 'Executive Revenue & Churn Intelligence Dashboard',
        description: 'Engineered comprehensive real-time executive dashboard in Power BI backed by complex SQL aggregations on Snowflake.',
        technologies: ['Power BI', 'SQL', 'DAX', 'Python']
      }
    ],
    summary: 'Data Analyst with 3.5 years of experience turning complex business datasets into actionable insights using SQL, Power BI, Python, and Tableau. Proficient in statistical analysis, metric modeling, and automated KPI reporting.',
    experiences: [
      {
        id: 'exp-4',
        title: 'Senior Data Analyst',
        company: 'Mu Sigma',
        location: 'Bangalore / Remote',
        startDate: '2021-08',
        endDate: 'Present',
        isCurrent: true,
        highlights: [
          'Constructed 25+ automated Power BI dashboards consumed daily by C-suite executives for operational decisions.',
          'Wrote advanced SQL queries handling multi-table joins and window functions over 50M+ rows.',
          'Automated weekly data ingestion scripts in Python (Pandas) cutting manual preparation time from 10 hours to 15 minutes.'
        ],
        skillsUsed: ['SQL', 'Power BI', 'Python', 'Tableau', 'Excel']
      }
    ],
    isDemo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cand-demo-4',
    name: 'Sneha Patel',
    email: 'sneha.patel.test@jobpilot-demo.internal',
    phone: '+91 99887 76655',
    location: 'Pune, India',
    targetRoles: ['QA Engineer', 'Automation QA', 'SDET Transition'],
    yearsOfExperience: 3.0,
    preferredLocations: ['Pune', 'Bangalore', 'Hyderabad'],
    expectedSalary: '₹12,00,000 INR',
    noticePeriod: '30 Days',
    workPreference: 'Hybrid',
    primarySkills: ['Manual Testing', 'Selenium', 'Java', 'Postman'],
    secondarySkills: ['Test Planning', 'JIRA', 'Bug Life Cycle', 'SQL Basics', 'TestNG Basics'],
    technologies: ['Selenium', 'Java', 'Postman', 'JIRA', 'Confluence', 'SQL', 'TestNG'],
    companies: ['Capgemini'],
    education: [
      {
        id: 'edu-4',
        degree: 'B.E. in Electronics & Telecommunication',
        institution: 'Pune University',
        year: '2021'
      }
    ],
    certifications: ['ISTQB Certified Foundation Level (CTFL)'],
    projects: [
      {
        id: 'proj-5',
        name: 'E-commerce Checkout Regression Suite',
        description: 'Successfully transitioned from manual test case authoring to automating smoke test suites using Java and Selenium WebDriver.',
        technologies: ['Selenium', 'Java', 'TestNG']
      }
    ],
    summary: 'QA Engineer with 3 years of software testing experience transitioning from Manual QA into Test Automation. Hands-on expertise with Selenium WebDriver, Java, Postman API testing, and robust test case execution.',
    experiences: [
      {
        id: 'exp-5',
        title: 'QA Engineer (Manual & Automation)',
        company: 'Capgemini',
        location: 'Pune, India',
        startDate: '2021-09',
        endDate: 'Present',
        isCurrent: true,
        highlights: [
          'Authored and executed 500+ manual test cases for critical healthcare and insurance web applications.',
          'Automated 120+ regression test scenarios in Java with Selenium WebDriver and TestNG.',
          'Validated backend API endpoints and schema responses using Postman.'
        ],
        skillsUsed: ['Manual Testing', 'Selenium', 'Java', 'Postman', 'JIRA']
      }
    ],
    isDemo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cand-demo-5',
    name: 'Vikram Malhotra',
    email: 'vikram.malhotra.test@jobpilot-demo.internal',
    phone: '+91 98450 12345',
    location: 'Hyderabad, India',
    targetRoles: ['Full Stack Developer', 'Senior Full Stack Engineer', 'MERN Stack Lead'],
    yearsOfExperience: 5.0,
    preferredLocations: ['Hyderabad', 'Bangalore', 'Remote'],
    expectedSalary: '₹28,00,000 INR',
    noticePeriod: '30 Days',
    workPreference: 'Remote',
    primarySkills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS'],
    secondarySkills: ['Express', 'Next.js', 'TailwindCSS', 'Docker', 'GraphQL', 'Redis'],
    technologies: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS', 'Next.js', 'Express', 'Git', 'Docker'],
    companies: ['Persistent Systems', 'Zeta Tech'],
    education: [
      {
        id: 'edu-5',
        degree: 'B.Tech in Information Technology',
        institution: 'JNTU Hyderabad',
        year: '2019'
      }
    ],
    certifications: ['AWS Certified Developer – Associate'],
    projects: [
      {
        id: 'proj-6',
        name: 'Collaborative Real-Time Workspace Platform',
        description: 'Engineered scalable full stack web app utilizing React, TypeScript, Node.js, WebSockets, and MongoDB on AWS ECS.',
        technologies: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'AWS']
      }
    ],
    summary: 'Full Stack Developer with 5.0 years of experience delivering robust web applications using React, Node.js, TypeScript, and AWS. Proven leader in crafting performant user experiences and scalable server-side microservices.',
    experiences: [
      {
        id: 'exp-6',
        title: 'Senior Full Stack Developer',
        company: 'Zeta Tech',
        location: 'Hyderabad, India',
        startDate: '2022-02',
        endDate: 'Present',
        isCurrent: true,
        highlights: [
          'Engineered modern responsive web interfaces with React and TypeScript serving 200k monthly active users.',
          'Architected RESTful APIs and WebSocket microservices in Node.js with MongoDB and Redis caching.',
          'Managed containerized AWS deployments (ECS, S3, CloudFront) driving 99.98% application uptime.'
        ],
        skillsUsed: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS', 'Docker']
      }
    ],
    isDemo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const demoJobs: JobDescription[] = [
  {
    id: 'job-demo-1',
    role: 'Senior QA Automation Engineer',
    company: 'HCL Technologies',
    location: 'Bangalore, India (Hybrid)',
    sourceUrl: 'https://hcltech.com/careers/senior-qa-automation-engineer',
    sourceType: 'sample',
    experienceRequired: '5-7 years',
    salary: '₹20,00,000 - ₹25,00,000 INR',
    careerTrack: 'QA Automation',
    mustHaveSkills: ['Java', 'Selenium', 'Playwright', 'API Testing', 'Jenkins', 'SQL'],
    niceToHaveSkills: ['Docker', 'AWS', 'RestAssured', 'Git'],
    responsibilities: [
      'Architect, develop, and maintain automated regression frameworks for enterprise cloud solutions.',
      'Build robust CI/CD integration gates with Jenkins and automate end-to-end API validations.',
      'Partner closely with cross-functional software developers and Product Owners to drive quality delivery.'
    ],
    qualifications: [
      '5+ years hands-on experience in Java-based test automation frameworks.',
      'Proficiency in Selenium and Playwright with solid SQL database testing capabilities.',
      'Bachelor’s degree in Computer Science, Information Technology or related discipline.'
    ],
    rawText: 'Role: Senior QA Automation Engineer at HCL Technologies...\nKey Skills: Java, Selenium, Playwright, Jenkins, SQL, API Testing...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-2',
    role: 'SDET (Software Development Engineer in Test)',
    company: 'Tata Consultancy Services (TCS)',
    location: 'Bangalore, India (Hybrid)',
    sourceUrl: 'https://tcs.com/careers/sdet-automation',
    sourceType: 'sample',
    experienceRequired: '4-6 years',
    salary: '₹18,00,000 - ₹23,00,000 INR',
    careerTrack: 'QA Automation',
    mustHaveSkills: ['Java', 'Selenium', 'RestAssured', 'TestNG', 'Jenkins'],
    niceToHaveSkills: ['Playwright', 'SQL', 'Docker', 'Kubernetes'],
    responsibilities: [
      'Design test harnesses and automation frameworks from ground up for distributed financial platforms.',
      'Develop automated API regression suites with RestAssured and execute load validation.',
      'Identify bottlenecks and enhance CI/CD test parallelization.'
    ],
    qualifications: [
      'Strong expertise in core Java and object-oriented test design.',
      'Extensive hands-on testing with TestNG, Selenium WebDriver, and REST APIs.'
    ],
    rawText: 'TCS is hiring an experienced SDET in Bangalore...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-3',
    role: 'QA Engineer',
    company: 'Freshworks',
    location: 'Chennai / Bangalore, India',
    sourceUrl: 'https://freshworks.com/careers/qa-engineer',
    sourceType: 'sample',
    experienceRequired: '3-5 years',
    salary: '₹16,00,000 - ₹21,00,000 INR',
    careerTrack: 'QA Automation',
    mustHaveSkills: ['Selenium', 'Java', 'Postman', 'API Testing'],
    niceToHaveSkills: ['Playwright', 'Jenkins', 'SQL', 'JIRA'],
    responsibilities: [
      'Ensure top-tier reliability for customer relationship management platform.',
      'Execute both automated and exploratory testing across modern SaaS frontends and APIs.'
    ],
    qualifications: [
      '3+ years in software quality assurance with proven automation coding skills.'
    ],
    rawText: 'Freshworks QA Engineer opportunity...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-4',
    role: 'Senior Java Backend Developer',
    company: 'Societe Generale',
    location: 'Bangalore, India (Hybrid)',
    sourceUrl: 'https://careers.societegenerale.com/java-backend',
    sourceType: 'sample',
    experienceRequired: '4-6 years',
    salary: '₹24,00,000 - ₹30,00,000 INR',
    careerTrack: 'Java Backend',
    mustHaveSkills: ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'REST API'],
    niceToHaveSkills: ['Redis', 'Docker', 'Kubernetes', 'Microservices'],
    responsibilities: [
      'Design and deploy resilient, high-throughput financial transaction microservices.',
      'Implement asynchronous event streaming pipelines with Apache Kafka.',
      'Optimize database queries and schema indices in PostgreSQL.'
    ],
    qualifications: [
      'Proven expertise in Java 11/17, Spring Boot, and enterprise SQL databases.',
      'Strong understanding of messaging middleware like Kafka.'
    ],
    rawText: 'Societe Generale Senior Java Backend Developer...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-5',
    role: 'Full Stack Developer',
    company: 'Razorpay',
    location: 'Bangalore, India (Onsite / Hybrid)',
    sourceUrl: 'https://razorpay.com/jobs/full-stack-engineer',
    sourceType: 'sample',
    experienceRequired: '4-6 years',
    salary: '₹26,00,000 - ₹34,00,000 INR',
    careerTrack: 'Full Stack',
    mustHaveSkills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS'],
    niceToHaveSkills: ['Docker', 'Redis', 'GraphQL', 'PostgreSQL'],
    responsibilities: [
      'Build end-to-end user journeys for merchant dashboards and payment checkouts.',
      'Collaborate with UI/UX teams to build modular React components.'
    ],
    qualifications: [
      'Hands-on mastery of React, TypeScript, Node.js, and cloud platforms.'
    ],
    rawText: 'Razorpay Full Stack Engineer...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-6',
    role: 'Senior Data Analyst',
    company: 'Flipkart',
    location: 'Bangalore, India',
    sourceUrl: 'https://flipkartcareers.com/data-analyst',
    sourceType: 'sample',
    experienceRequired: '3-5 years',
    salary: '₹18,00,000 - ₹24,00,000 INR',
    careerTrack: 'Data Analytics',
    mustHaveSkills: ['SQL', 'Power BI', 'Python', 'Excel', 'Tableau'],
    niceToHaveSkills: ['Snowflake', 'Pandas', 'Data Warehousing'],
    responsibilities: [
      'Partner with business leaders to extract actionable product analytics insights.',
      'Build scalable dashboards and data models using SQL and Power BI.'
    ],
    qualifications: [
      'Deep expertise in complex SQL aggregations, Power BI, and Python analytics libraries.'
    ],
    rawText: 'Flipkart Senior Data Analyst position...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-7',
    role: 'Manual QA Specialist',
    company: 'Wipro',
    location: 'Pune / Hyderabad, India',
    sourceUrl: 'https://wipro.com/careers/manual-qa',
    sourceType: 'sample',
    experienceRequired: '2-4 years',
    salary: '₹8,00,000 - ₹12,00,000 INR',
    careerTrack: 'QA Manual',
    mustHaveSkills: ['Manual Testing', 'Postman', 'JIRA'],
    niceToHaveSkills: ['SQL Basics', 'Selenium', 'Java'],
    responsibilities: [
      'Design test cases, execute system testing, and report defects across agile sprints.'
    ],
    qualifications: [
      'Thorough knowledge of Software Testing Life Cycle (STLC) and JIRA.'
    ],
    rawText: 'Wipro Manual QA position...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-8',
    role: 'Cloud DevOps Engineer',
    company: 'Infosys',
    location: 'Bangalore, India',
    sourceUrl: 'https://infosys.com/careers/devops-engineer',
    sourceType: 'sample',
    experienceRequired: '4-7 years',
    salary: '₹22,00,000 - ₹28,00,000 INR',
    careerTrack: 'DevOps',
    mustHaveSkills: ['Docker', 'Kubernetes', 'AWS', 'Jenkins', 'Terraform'],
    niceToHaveSkills: ['Linux', 'Python', 'GitLab CI'],
    responsibilities: [
      'Manage cloud infrastructure, CI/CD pipelines, and Kubernetes deployments.'
    ],
    qualifications: [
      'Deep hands-on experience in AWS, Kubernetes, and infrastructure as code.'
    ],
    rawText: 'Infosys Cloud DevOps Engineer...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-9',
    role: 'Lead Java Backend Architect',
    company: 'Oracle',
    location: 'Hyderabad, India',
    sourceUrl: 'https://oracle.com/careers/lead-java-architect',
    sourceType: 'sample',
    experienceRequired: '8-10 years',
    salary: '₹40,00,000 - ₹55,00,000 INR',
    careerTrack: 'Java Backend',
    mustHaveSkills: ['Java', 'Spring Boot', 'Kafka', 'PostgreSQL', 'Microservices', 'Kubernetes'],
    niceToHaveSkills: ['Cloud Infrastructure', 'Distributed Caching', 'Event Sourcing'],
    responsibilities: [
      'Architect next-generation global database cloud microservices.'
    ],
    qualifications: [
      '8+ years in enterprise backend architecture and distributed messaging systems.'
    ],
    rawText: 'Oracle Lead Java Backend Architect...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-10',
    role: 'Product Analytics Lead',
    company: 'PhonePe',
    location: 'Bangalore, India',
    sourceUrl: 'https://phonepe.com/careers/product-analytics-lead',
    sourceType: 'sample',
    experienceRequired: '5-8 years',
    salary: '₹30,00,000 - ₹42,00,000 INR',
    careerTrack: 'Data Analytics',
    mustHaveSkills: ['SQL', 'Python', 'Tableau', 'Power BI', 'A/B Testing'],
    niceToHaveSkills: ['Machine Learning', 'BigQuery', 'Airflow'],
    responsibilities: [
      'Spearhead product metrics, experimentation frameworks, and analytics modeling.'
    ],
    qualifications: [
      'Proven expertise leading product analytics teams and statistical modeling.'
    ],
    rawText: 'PhonePe Product Analytics Lead...',
    createdAt: new Date().toISOString()
  }
];

export async function seedDatabase() {
  console.log('Seeding JobPilot AI database with 5 test candidates and 10 test jobs...');
  await getDb();

  for (const cand of demoCandidates) {
    await CandidateRepository.save(cand);
  }

  for (const job of demoJobs) {
    await JobRepository.save(job);
  }

  // Pre-seed a couple of realistic demo applications for Candidate 1 (Aarav Sharma)
  const demoApps: ApplicationRecord[] = [
    {
      id: 'app-demo-1',
      candidateId: 'cand-demo-1',
      jobId: 'job-demo-1',
      resumeVersionId: 'resume-demo-hcl-1',
      resumeVersionName: 'HCL_QA_v1',
      company: 'HCL Technologies',
      role: 'Senior QA Automation Engineer',
      location: 'Bangalore, India (Hybrid)',
      jobUrl: 'https://hcltech.com/careers/senior-qa-automation-engineer',
      matchScore: 92,
      status: 'Applied',
      applicationDate: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      notes: 'Applied through HCL career portal. Tailored resume focused on Playwright and API testing.',
      customAnswers: {
        'Total years of relevant experience?': '5.5 years',
        'What is your notice period?': '30 Days'
      },
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      id: 'app-demo-2',
      candidateId: 'cand-demo-1',
      jobId: 'job-demo-2',
      resumeVersionId: 'resume-demo-tcs-1',
      resumeVersionName: 'TCS_SDET_v1',
      company: 'Tata Consultancy Services (TCS)',
      role: 'SDET (Software Development Engineer in Test)',
      location: 'Bangalore, India (Hybrid)',
      jobUrl: 'https://tcs.com/careers/sdet-automation',
      matchScore: 88,
      status: 'Interview',
      applicationDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
      notes: 'Technical round 1 scheduled for this Thursday at 3 PM IST.',
      customAnswers: {
        'Total years of relevant experience?': '5.5 years',
        'What is your notice period?': '30 Days'
      },
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString()
    }
  ];

  for (const app of demoApps) {
    await ApplicationRepository.save(app);
  }

  saveDb();
  console.log('Database successfully seeded!');
}

// Run if called directly
if (process.argv[1]?.includes('seed')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
