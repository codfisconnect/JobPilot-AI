import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { CandidateProfileController } from '../../controllers/v1/candidateProfile.controller.js';

export const candidateRouter = Router();

// All candidate routes strictly require JWT authentication
candidateRouter.use(authenticateJwt);

// Candidate Profile: /api/v1/candidates/me
candidateRouter.get('/me', CandidateProfileController.getProfile);
candidateRouter.patch('/me', CandidateProfileController.updateProfile);

// Preferences: /api/v1/candidates/me/preferences
candidateRouter.get('/me/preferences', CandidateProfileController.getPreferences);
candidateRouter.patch('/me/preferences', CandidateProfileController.updatePreferences);

// Experience: /api/v1/candidates/me/experiences
candidateRouter.get('/me/experiences', CandidateProfileController.getExperiences);
candidateRouter.post('/me/experiences', CandidateProfileController.addExperience);
candidateRouter.patch('/me/experiences/:id', CandidateProfileController.updateExperience);
candidateRouter.delete('/me/experiences/:id', CandidateProfileController.deleteExperience);

// Education: /api/v1/candidates/me/educations
candidateRouter.get('/me/educations', CandidateProfileController.getEducations);
candidateRouter.post('/me/educations', CandidateProfileController.addEducation);
candidateRouter.patch('/me/educations/:id', CandidateProfileController.updateEducation);
candidateRouter.delete('/me/educations/:id', CandidateProfileController.deleteEducation);

// Skills: /api/v1/candidates/me/skills
candidateRouter.get('/me/skills', CandidateProfileController.getSkills);
candidateRouter.post('/me/skills', CandidateProfileController.addSkill);
candidateRouter.delete('/me/skills/:id', CandidateProfileController.deleteSkill);

// Certifications: /api/v1/candidates/me/certifications
candidateRouter.get('/me/certifications', CandidateProfileController.getCertifications);
candidateRouter.post('/me/certifications', CandidateProfileController.addCertification);
candidateRouter.patch('/me/certifications/:id', CandidateProfileController.updateCertification);
candidateRouter.delete('/me/certifications/:id', CandidateProfileController.deleteCertification);

// Projects: /api/v1/candidates/me/projects
candidateRouter.get('/me/projects', CandidateProfileController.getProjects);
candidateRouter.post('/me/projects', CandidateProfileController.addProject);
candidateRouter.patch('/me/projects/:id', CandidateProfileController.updateProject);
candidateRouter.delete('/me/projects/:id', CandidateProfileController.deleteProject);
