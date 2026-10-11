import { Router } from 'express';
import { CompanyControllerV1 } from '../../controllers/v1/company.controller.js';
import { optionalAuthenticateJwt } from '../../middleware/auth.middleware.js';

export const companyRouter = Router();

companyRouter.get('/', optionalAuthenticateJwt, CompanyControllerV1.listCompanies);
companyRouter.get('/:id', optionalAuthenticateJwt, CompanyControllerV1.getCompanyById);
