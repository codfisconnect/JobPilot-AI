import { getDb, saveDb } from './db.js';
import {
  CandidateRepository,
  JobRepository,
  ApplicationRepository,
  CompanyReviewRepository,
  FollowedCompanyRepository,
  JobAlertRepository,
  SqliteUserRepository
} from '../services/repositories.js';
import { CandidateProfile, JobDescription, ApplicationRecord } from '../types/index.js';
import { hashPassword } from '../utils/password.js';

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
    source: 'External Job Board',
    applicationMode: 'external',
    applicationType: 'EXTERNAL',
    applicationUrl: 'https://hcltech.com/careers/senior-qa-automation-engineer',
    openingsCount: 5,
    department: 'Digital Quality Services',
    roleCategory: 'Automation Testing',
    rating: 3.9,
    reviewsCount: 4200,
    companyLogo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&auto=format&fit=crop&q=80',
    companyWebsite: 'https://hcltech.com',
    companySize: '100,000+ Employees',
    companyHeadquarters: 'Noida, Uttar Pradesh, India',
    companyFounded: '1976',
    companyDescription: 'HCLTech is a global technology company, home to more than 224,000 people across 60 countries, delivering industry-leading capabilities centered around digital, engineering, cloud and AI.',
    benefits: ['Comprehensive Group Health Insurance', 'Provident Fund & Gratuity', 'Transport Allowance', 'Upskilling Certifications'],
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'external',
    applicationUrl: 'https://career.infosys.com/jobdesc?jobReferenceCode=INF-DEVOPS-2026',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
  },
  {
    id: 'job-internal-1',
    role: 'Automation Test Engineer',
    company: 'ABC Technologies',
    location: 'Bangalore, India (Hybrid)',
    sourceUrl: 'https://abctechnologies.io/careers/automation-test-engineer',
    sourceType: 'sample',
    source: 'Employer Portal',
    applicationMode: 'demo',
    applicationType: 'INTERNAL',
    openingsCount: 3,
    department: 'Quality Assurance',
    roleCategory: 'Automation Testing',
    rating: 4.4,
    reviewsCount: 185,
    companyLogo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=128&auto=format&fit=crop&q=80',
    companyWebsite: 'https://abctechnologies.io',
    companySize: '1,000 - 5,000 Employees',
    companyHeadquarters: 'Bangalore, Karnataka, India',
    companyFounded: '2014',
    companyDescription: 'ABC Technologies is an enterprise cloud and digital engineering accelerator delivering mission-critical SaaS platforms, fintech infrastructure, and automated testing ecosystems.',
    benefits: ['Comprehensive Medical Insurance', 'Flexible Hybrid Work Schedule', 'Annual Learning & Certification Stipend', 'Performance Bonus', 'Wellness Program'],
    screeningQuestions: [
      'How many years of hands-on experience do you have with Playwright or Selenium in Java?',
      'What is your official notice period?',
      'Are you open to working in a hybrid arrangement at our Bangalore campus?'
    ],
    experienceRequired: '4-7 years',
    salary: '₹18,00,000 - ₹25,00,000 INR',
    careerTrack: 'QA Automation',
    mustHaveSkills: ['Java', 'Selenium', 'Playwright', 'API Testing', 'Jenkins', 'SQL'],
    niceToHaveSkills: ['Docker', 'AWS', 'TestNG', 'RestAssured', 'Git'],
    responsibilities: [
      'Design, construct, and scale automated regression test frameworks for core enterprise platforms.',
      'Lead API verification suites and integrate continuous automated testing gates in Jenkins CI/CD.',
      'Collaborate directly with product owners and developers to diagnose defect root causes early in sprint lifecycles.'
    ],
    qualifications: [
      '4+ years of dedicated experience writing test automation code in Java.',
      'Solid hands-on expertise in Playwright and Selenium WebDriver.',
      'B.Tech / B.E. in Computer Science, Information Technology, or equivalent practical experience.'
    ],
    rawText: 'ABC Technologies is hiring an Automation Test Engineer for our flagship engineering team in Bangalore...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-internal-2',
    role: 'Lead Full Stack Engineer',
    company: 'Zeta Tech',
    location: 'Hyderabad, India (Remote / Hybrid)',
    sourceUrl: 'https://zetatech.io/careers/lead-full-stack',
    sourceType: 'sample',
    source: 'Employer Portal',
    applicationMode: 'demo',
    applicationType: 'INTERNAL',
    openingsCount: 2,
    department: 'Platform Engineering',
    roleCategory: 'Software Development',
    rating: 4.6,
    reviewsCount: 310,
    companyLogo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=128&auto=format&fit=crop&q=80',
    companyWebsite: 'https://zetatech.io',
    companySize: '500 - 1,000 Employees',
    companyHeadquarters: 'Hyderabad, Telangana, India',
    companyFounded: '2018',
    companyDescription: 'Zeta Tech builds next-generation banking APIs and real-time transaction rails powering millions of daily financial operations globally.',
    benefits: ['100% Remote-first Work Option', 'Stock Options (ESOPs)', 'Health & Dental Coverage', 'Home Office Allowance'],
    screeningQuestions: [
      'Have you led production microservices architectures using React, Node.js, and TypeScript?',
      'What is your expected CTC and earliest joining date?'
    ],
    experienceRequired: '5-8 years',
    salary: '₹28,00,000 - ₹38,00,000 INR',
    careerTrack: 'Full Stack',
    mustHaveSkills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS', 'REST API'],
    niceToHaveSkills: ['GraphQL', 'Docker', 'Redis', 'Kubernetes', 'Next.js'],
    responsibilities: [
      'Architect resilient full stack web applications and microservices serving 500k+ active merchants.',
      'Mentor senior engineers, oversee code reviews, and champion engineering standards.'
    ],
    qualifications: [
      '5+ years in full stack engineering with deep TypeScript, React, and Node.js proficiency.'
    ],
    rawText: 'Zeta Tech is hiring a Lead Full Stack Engineer to spearhead our merchant platform...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-external-1',
    role: 'Test Lead',
    company: 'Exavalu',
    location: 'Kolkata / Remote, India',
    sourceUrl: 'https://exavalu.com/careers/test-lead-automation',
    sourceType: 'external',
    source: 'External Job Website',
    applicationMode: 'external',
    applicationType: 'EXTERNAL',
    applicationUrl: 'https://exavalu.com/careers/test-lead-automation',
    openingsCount: 1,
    department: 'Insurance Technology QA',
    roleCategory: 'Quality Engineering Lead',
    rating: 4.1,
    reviewsCount: 92,
    companyLogo: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=128&auto=format&fit=crop&q=80',
    companyWebsite: 'https://exavalu.com',
    companySize: '1,000 - 5,000 Employees',
    companyHeadquarters: 'Newport Beach, CA / Kolkata, India',
    companyFounded: '2019',
    companyDescription: 'Exavalu is a specialized digital transformation consultancy providing strategy and technology solutions for insurance and financial services.',
    benefits: ['Health Insurance', 'Retirement Plan', 'Flexible Vacation Policy', 'Skill Development Grants'],
    experienceRequired: '7-10 years',
    salary: '₹24,00,000 - ₹32,00,000 INR',
    careerTrack: 'QA Automation',
    mustHaveSkills: ['Selenium', 'Java', 'API Testing', 'Test Strategy', 'Jenkins', 'SQL'],
    niceToHaveSkills: ['Playwright', 'Guidewire', 'Docker', 'Performance Testing'],
    responsibilities: [
      'Formulate comprehensive quality assurance strategies across multi-tier insurance platforms.',
      'Lead and mentor distributed test teams, ensuring automated regression coverage exceeds 85%.'
    ],
    qualifications: [
      '7+ years in QA with proven experience leading test teams and architecting enterprise test frameworks.'
    ],
    rawText: 'Exavalu is seeking an experienced Test Lead to drive automation excellence for Tier-1 insurance clients...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-external-2',
    role: 'Technical Project Manager',
    company: 'Codewalla',
    location: 'Pune / Bangalore, India',
    sourceUrl: 'https://careers.codewalla.com/jobs/technical-project-manager',
    sourceType: 'external',
    source: 'Codewalla',
    applicationMode: 'external',
    applicationType: 'EXTERNAL',
    applicationUrl: 'https://careers.codewalla.com/jobs/technical-project-manager',
    openingsCount: 2,
    department: 'Project & Delivery Management',
    roleCategory: 'Project Management',
    rating: 4.3,
    reviewsCount: 140,
    companyLogo: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=128&auto=format&fit=crop&q=80',
    companyWebsite: 'https://codewalla.com',
    companySize: '200 - 500 Employees',
    companyHeadquarters: 'Pune, Maharashtra, India',
    companyFounded: '2011',
    companyDescription: 'Codewalla is a digital product studio partnering with high-growth startups and global enterprises to engineer modern digital experiences.',
    benefits: ['Hybrid Work Model', 'Health Insurance', 'Team Retreats', 'Annual Training Budget'],
    experienceRequired: '6-9 years',
    salary: '₹22,00,000 - ₹30,00,000 INR',
    careerTrack: 'Project & Delivery Management',
    mustHaveSkills: ['Agile Delivery', 'Scrum', 'Stakeholder Management', 'Sprint Planning', 'JIRA'],
    niceToHaveSkills: ['Technical Background', 'CI/CD Awareness', 'PMP', 'CSM'],
    responsibilities: [
      'Lead end-to-end agile execution for modern web and mobile product teams.',
      'Manage sprint milestones, remove blockers, and align engineering sprints with client business objectives.'
    ],
    qualifications: [
      '6+ years in technical software project and delivery management.'
    ],
    rawText: 'Codewalla is hiring a Technical Project Manager with deep agile execution expertise...',
    createdAt: new Date().toISOString()
  },
  {
    id: 'job-demo-2',
    role: 'SDET (Software Development Engineer in Test)',
    company: 'Tata Consultancy Services (TCS)',
    location: 'Bangalore, India (Hybrid)',
    sourceUrl: 'https://tcs.com/careers/sdet-automation',
    sourceType: 'sample',
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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
    applicationMode: 'external',
    applicationUrl: 'https://career.infosys.com/jobdesc?jobReferenceCode=INF-DEVOPS-2026',
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
    applicationMode: 'demo',
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
    applicationMode: 'demo',
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

  // Pre-seed realistic applications showcasing both Type A (Internal) and Type B (External) workflows
  const demoApps: ApplicationRecord[] = [
    {
      id: 'app-internal-1',
      candidateId: 'cand-demo-1',
      jobId: 'job-internal-1',
      company: 'ABC Technologies',
      role: 'Automation Test Engineer',
      location: 'Bangalore, India (Hybrid)',
      applicationType: 'INTERNAL',
      applicationMode: 'demo',
      matchScore: 94,
      status: 'Shortlisted' as any,
      candidateName: 'Aarav Sharma',
      candidateEmail: 'aarav.sharma.test@jobpilot-demo.internal',
      candidatePhone: '+91 98765 43210',
      candidateLocation: 'Bangalore, India',
      candidateExperience: 5.5,
      candidateDesignation: 'Senior QA Automation Engineer',
      resumeVersionName: 'Aarav_Sharma_QA_v1',
      applicationDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
      appliedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      notes: 'Applied directly inside JobPilot portal. Answered screening questions.',
      screeningAnswers: {
        'How many years of hands-on experience do you have with Playwright or Selenium in Java?': '5.5 years',
        'What is your official notice period?': '30 Days',
        'Are you open to working in a hybrid arrangement at our Bangalore campus?': 'Yes, absolutely'
      },
      statusHistory: [
        { status: 'Submitted', changedAt: new Date(Date.now() - 5 * 86400000).toISOString(), note: 'Application submitted directly on JobPilot' },
        { status: 'Viewed', changedAt: new Date(Date.now() - 4 * 86400000).toISOString(), note: 'Employer viewed application and downloaded resume' },
        { status: 'Under Review', changedAt: new Date(Date.now() - 2 * 86400000).toISOString(), note: 'Candidate profile forwarded to QA Engineering Lead' },
        { status: 'Shortlisted', changedAt: new Date(Date.now() - 1 * 86400000).toISOString(), note: 'Selected for technical interview round' }
      ],
      employerNotes: 'Excellent match on Java & Playwright. Schedule Round 1 interview.',
      interviewDetails: {
        scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        meetingLink: 'https://meet.google.com/abc-tech-interview',
        instructions: 'Please be prepared to demonstrate framework design and solve a live Playwright coding challenge.'
      },
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString()
    },
    {
      id: 'app-external-1',
      candidateId: 'cand-demo-1',
      jobId: 'job-external-1',
      company: 'Exavalu',
      role: 'Test Lead',
      location: 'Kolkata / Remote, India',
      applicationType: 'EXTERNAL',
      applicationMode: 'external',
      applicationUrl: 'https://exavalu.com/careers/test-lead-automation',
      matchScore: 86,
      status: 'Applied' as any,
      candidateName: 'Aarav Sharma',
      candidateEmail: 'aarav.sharma.test@jobpilot-demo.internal',
      candidatePhone: '+91 98765 43210',
      candidateLocation: 'Bangalore, India',
      candidateExperience: 5.5,
      candidateDesignation: 'Senior QA Automation Engineer',
      applicationDate: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      appliedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      notes: 'Redirected to Exavalu career website. Candidate explicitly confirmed application on JobPilot.',
      statusHistory: [
        { status: 'Ready to Apply', changedAt: new Date(Date.now() - 3 * 86400000).toISOString(), note: 'Redirected to Exavalu application URL' },
        { status: 'Applied', changedAt: new Date(Date.now() - 3 * 86400000 + 1800000).toISOString(), note: 'Candidate returned and confirmed completion on external site' }
      ],
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString()
    },
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
      applicationType: 'EXTERNAL',
      applicationMode: 'external',
      matchScore: 92,
      status: 'Applied' as any,
      applicationDate: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
      appliedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      notes: 'Applied through HCL career portal. Tailored resume focused on Playwright and API testing.',
      statusHistory: [
        { status: 'Ready to Apply', changedAt: new Date(Date.now() - 4 * 86400000).toISOString(), note: 'Viewed external opening' },
        { status: 'Applied', changedAt: new Date(Date.now() - 4 * 86400000 + 900000).toISOString(), note: 'Candidate confirmed application' }
      ],
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 86400000).toISOString()
    }
  ];

  for (const app of demoApps) {
    await ApplicationRepository.save(app);
  }

  // Pre-seed genuine company reviews
  const reviews = [
    {
      id: 'rev-abc-1',
      companyName: 'ABC Technologies',
      reviewerName: 'Karthik R.',
      reviewerRole: 'Senior SDET',
      rating: 4.5,
      title: 'Great engineering culture with modern test frameworks',
      reviewText: 'ABC Technologies invests heavily in test automation and CI/CD quality gates. Management trusts engineers to choose the best tools (Playwright, Java, Docker). Work-life balance is very solid.',
      pros: 'Strong focus on quality, collaborative managers, competitive annual bonuses.',
      cons: 'Occasional late evening deployments when releasing major enterprise modules.',
      workCultureRating: 4.6,
      salaryBenefitsRating: 4.4,
      careerGrowthRating: 4.5,
      workLifeBalanceRating: 4.3,
      employmentStatus: 'Current Employee',
      isVerified: true,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
    },
    {
      id: 'rev-hcl-1',
      companyName: 'HCL Technologies',
      reviewerName: 'Pooja M.',
      reviewerRole: 'Lead Quality Consultant',
      rating: 4.0,
      title: 'Stable enterprise projects and good learning environment',
      reviewText: 'HCL gives exposure to very large enterprise client accounts in the US and Europe. Good corporate benefits and health insurance.',
      pros: 'Job security, recognized brand name, extensive internal training portals.',
      cons: 'Project allocation process can take time between client handoffs.',
      workCultureRating: 3.9,
      salaryBenefitsRating: 4.0,
      careerGrowthRating: 3.8,
      workLifeBalanceRating: 4.1,
      employmentStatus: 'Former Employee',
      isVerified: true,
      createdAt: new Date(Date.now() - 45 * 86400000).toISOString()
    },
    {
      id: 'rev-zeta-1',
      companyName: 'Zeta Tech',
      reviewerName: 'Arun K.',
      reviewerRole: 'Full Stack Tech Lead',
      rating: 4.7,
      title: 'Fast-paced fintech with high-scale architecture',
      reviewText: 'Working on high-throughput payment APIs is exciting. Modern tech stack (TypeScript, React, Node.js, AWS) and very transparent leadership.',
      pros: 'Generous stock grants, fully remote flexibility, top-tier engineering colleagues.',
      cons: 'High expectations during quarterly release cycles.',
      workCultureRating: 4.8,
      salaryBenefitsRating: 4.8,
      careerGrowthRating: 4.7,
      workLifeBalanceRating: 4.3,
      employmentStatus: 'Current Employee',
      isVerified: true,
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
    }
  ];

  for (const rev of reviews) {
    await CompanyReviewRepository.save(rev);
  }

  // Pre-seed followed companies
  await FollowedCompanyRepository.follow('cand-demo-1', 'ABC Technologies');
  await FollowedCompanyRepository.follow('cand-demo-1', 'HCL Technologies');

  // Pre-seed job alert
  await JobAlertRepository.save({
    id: 'alert-demo-1',
    candidateId: 'cand-demo-1',
    title: 'QA Automation Engineer (Playwright / Java)',
    keywords: 'Playwright, Java, Selenium, API',
    location: 'Bangalore / Remote',
    experienceMin: 4,
    experienceMax: 8,
    salaryMin: '₹18,00,000 INR',
    frequency: 'Daily',
    isActive: true,
    createdAt: new Date().toISOString()
  });

  // Pre-seed test users in SqliteUserRepository
  const defaultPasswordHash = await hashPassword('Password123!');
  await SqliteUserRepository.save({
    id: 'cand-demo-1',
    email: 'aarav.sharma@example.com',
    passwordHash: defaultPasswordHash,
    fullName: 'Aarav Sharma',
    phone: '+91 98765 43210',
    role: 'CANDIDATE',
    location: 'Bangalore, India',
    experience: 5.5,
    designation: 'Senior QA Automation Engineer',
    emailVerified: 1,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  await SqliteUserRepository.save({
    id: 'emp-demo-1',
    email: 'recruiter@abctech.com',
    passwordHash: defaultPasswordHash,
    fullName: 'Neha Verma',
    phone: '+91 98111 22233',
    role: 'EMPLOYER',
    companyName: 'ABC Technologies',
    companyWebsite: 'https://abctechnologies.io',
    industry: 'Information Technology / Cloud Engineering',
    companySize: '1,000 - 5,000 Employees',
    emailVerified: 1,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  await SqliteUserRepository.save({
    id: 'admin-demo-1',
    email: 'admin@pilotmama.io',
    passwordHash: await hashPassword('AdminSecret123!'),
    fullName: 'Platform Administrator',
    phone: '+91 90000 00001',
    role: 'ADMIN',
    emailVerified: 1,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

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
