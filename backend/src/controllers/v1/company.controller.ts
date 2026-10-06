import { Request, Response, NextFunction } from 'express';
import { JobQueryService } from '../../services/jobQuery.service.js';

export class CompanyControllerV1 {
  /**
   * GET /api/v1/companies - List canonical companies
   */
  public static async listCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const companies = await JobQueryService.getCompanies(limit);
      res.status(200).json({
        success: true,
        data: companies
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/companies/:id - Get company with source history
   */
  public static async getCompanyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const company = await JobQueryService.getCompanyById(id);
      res.status(200).json({
        success: true,
        data: company
      });
    } catch (err) {
      next(err);
    }
  }
}
