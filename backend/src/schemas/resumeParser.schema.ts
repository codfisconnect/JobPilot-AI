import { z } from 'zod';

export const ParsedPersonalInfoSchema = z.object({
  fullName: z.string().default('Candidate'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  location: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  stateProvince: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  headline: z.string().optional().or(z.literal('')),
  summary: z.string().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal('')),
  portfolioUrl: z.string().url().optional().or(z.literal(''))
});

export const ParsedExperienceSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  location: z.string().optional().or(z.literal('')),
  employmentType: z.string().optional().or(z.literal('')),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().or(z.literal('')),
  isCurrent: z.boolean().default(false),
  description: z.string().optional().or(z.literal('')),
  responsibilities: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  displayOrder: z.number().int().default(0)
});

export const ParsedEducationSchema = z.object({
  institution: z.string().min(1, 'Institution is required'),
  degree: z.string().min(1, 'Degree is required'),
  fieldOfStudy: z.string().optional().or(z.literal('')),
  location: z.string().optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  gradeGpa: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal(''))
});

export const ParsedCertificationSchema = z.object({
  name: z.string().min(1, 'Certification name is required'),
  issuingOrganization: z.string().default('Accredited Provider'),
  issueDate: z.string().optional().or(z.literal('')),
  expirationDate: z.string().optional().or(z.literal('')),
  credentialId: z.string().optional().or(z.literal('')),
  credentialUrl: z.string().optional().or(z.literal(''))
});

export const ParsedSkillSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  proficiency: z.string().optional().or(z.literal('')),
  yearsOfExperience: z.number().positive().optional().nullable(),
  source: z.enum(['MANUAL', 'RESUME', 'IMPORTED']).default('RESUME'),
  category: z.enum(['TECHNICAL', 'SOFT', 'TOOL']).default('TECHNICAL')
});

export const ParsedProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional().or(z.literal('')),
  role: z.string().optional().or(z.literal('')),
  technologies: z.array(z.string()).default([]),
  url: z.string().optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  displayOrder: z.number().int().default(0)
});

export const StructuredParsedResumeSchema = z.object({
  personalInfo: ParsedPersonalInfoSchema,
  summary: z.string().default(''),
  skills: z.array(ParsedSkillSchema).default([]),
  experience: z.array(ParsedExperienceSchema).default([]),
  education: z.array(ParsedEducationSchema).default([]),
  certifications: z.array(ParsedCertificationSchema).default([]),
  projects: z.array(ParsedProjectSchema).default([]),
  rawText: z.string().default(''),
  parseConfidence: z.number().min(0).max(100).default(100),
  needsReview: z.boolean().default(false),
  reviewReasons: z.array(z.string()).default([])
});

export type StructuredParsedResume = z.infer<typeof StructuredParsedResumeSchema>;
export type ParsedPersonalInfo = z.infer<typeof ParsedPersonalInfoSchema>;
export type ParsedExperience = z.infer<typeof ParsedExperienceSchema>;
export type ParsedEducation = z.infer<typeof ParsedEducationSchema>;
export type ParsedCertification = z.infer<typeof ParsedCertificationSchema>;
export type ParsedSkill = z.infer<typeof ParsedSkillSchema>;
export type ParsedProject = z.infer<typeof ParsedProjectSchema>;
