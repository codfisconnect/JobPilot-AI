import type { Request, Response, NextFunction } from 'express';
import { CandidateProfileService } from '../../services/candidateProfile.service.js';

export class CandidateProfileController {
  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const profile = await CandidateProfileService.getProfile(userId);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const updated = await CandidateProfileService.updateProfile(userId, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const prefs = await CandidateProfileService.getPreferences(userId);
      res.json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  }

  public static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const updated = await CandidateProfileService.updatePreferences(userId, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  // Experiences
  public static async getExperiences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const experiences = await CandidateProfileService.getExperiences(userId);
      res.json({ success: true, data: experiences });
    } catch (err) {
      next(err);
    }
  }

  public static async addExperience(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const created = await CandidateProfileService.addExperience(userId, req.body);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  public static async updateExperience(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const updated = await CandidateProfileService.updateExperience(userId, id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteExperience(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      await CandidateProfileService.deleteExperience(userId, id);
      res.json({ success: true, message: 'Experience deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // Education
  public static async getEducations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const educations = await CandidateProfileService.getEducations(userId);
      res.json({ success: true, data: educations });
    } catch (err) {
      next(err);
    }
  }

  public static async addEducation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const created = await CandidateProfileService.addEducation(userId, req.body);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  public static async updateEducation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const updated = await CandidateProfileService.updateEducation(userId, id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteEducation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      await CandidateProfileService.deleteEducation(userId, id);
      res.json({ success: true, message: 'Education deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // Certifications
  public static async getCertifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const certs = await CandidateProfileService.getCertifications(userId);
      res.json({ success: true, data: certs });
    } catch (err) {
      next(err);
    }
  }

  public static async addCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const created = await CandidateProfileService.addCertification(userId, req.body);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  public static async updateCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const updated = await CandidateProfileService.updateCertification(userId, id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      await CandidateProfileService.deleteCertification(userId, id);
      res.json({ success: true, message: 'Certification deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // Skills
  public static async getSkills(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const skills = await CandidateProfileService.getSkills(userId);
      res.json({ success: true, data: skills });
    } catch (err) {
      next(err);
    }
  }

  public static async addSkill(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const created = await CandidateProfileService.addSkill(userId, req.body);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteSkill(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      await CandidateProfileService.deleteSkill(userId, id);
      res.json({ success: true, message: 'Skill removed successfully' });
    } catch (err) {
      next(err);
    }
  }

  // Projects
  public static async getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const projects = await CandidateProfileService.getProjects(userId);
      res.json({ success: true, data: projects });
    } catch (err) {
      next(err);
    }
  }

  public static async addProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const created = await CandidateProfileService.addProject(userId, req.body);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  public static async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const updated = await CandidateProfileService.updateProject(userId, id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      await CandidateProfileService.deleteProject(userId, id);
      res.json({ success: true, message: 'Project deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
