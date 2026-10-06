import { Router } from 'express';
import { CompanyControllerV1 } from '../../controllers/v1/company.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const companyRouter = Router();

companyRouter.get('/', authenticateJwt, CompanyControllerV1.listCompanies);
companyRouter.get('/:id', authenticateJwt, CompanyControllerV1.getCompanyById);
