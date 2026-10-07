import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { authRouter } from './routes/v1/auth.routes.js';
import { healthRouter } from './routes/v1/health.routes.js';
import { candidateRouter } from './routes/v1/candidate.routes.js';
import { resumeRouter } from './routes/v1/resume.routes.js';
import { resumeVersionRouter } from './routes/v1/resumeVersion.routes.js';
import { jobRouter } from './routes/v1/job.routes.js';
import { companyRouter } from './routes/v1/company.routes.js';
import { interviewRouter } from './modules/interviews/interview.routes.js';
import { careerRouter } from './modules/career/career.routes.js';
import { applicationRouter, savedJobRouter } from './modules/applications/application.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { employerRouter } from './modules/employer/employer.routes.js';
import { agentRouter } from './modules/agent/agent.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { apiRouter as prototypeApiRouter } from './routes/api.routes.js';
import { getDb } from './database/db.js';
import { logger } from './utils/logger.js';

export const app = express();

// 1. Structured Request ID & Logging
app.use(requestLogger);

// 2. Security & Cookie Parsing
app.use(cors({
  origin: env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
}));

app.use(cookieParser());
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. V1 Production API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/candidates', candidateRouter);
app.use('/api/v1/resumes', resumeRouter);
app.use('/api/v1/resume-versions', resumeVersionRouter);
app.use('/api/v1/jobs', jobRouter);
app.use('/api/v1/companies', companyRouter);
app.use('/api/v1/applications', applicationRouter);
app.use('/api/v1/saved-jobs', savedJobRouter);
app.use('/api/v1/interview', interviewRouter);
app.use('/api/v1/career', careerRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/employer', employerRouter);
app.use('/api/v1/agent', agentRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1', healthRouter);

// 4. Preserved Prototype API Routes
app.use('/api', prototypeApiRouter);

// 5. Global Error Handling
app.use(errorHandler);

// 6. Server Bootstrap
const PORT = env.PORT;

// Only bind listener when this file is executed directly (not during test runs)
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.TEST_MODE) || process.argv.some(arg => arg.includes('test'));

if (!isTestEnv) {
  getDb()
    .then(async () => {
      try {
        const { seedMasterData } = await import('./database/seedMaster.js');
        await seedMasterData();
      } catch (seedErr) {
        logger.warn('Prototype master data seeding notice:', { error: (seedErr as any)?.message });
      }

      app.listen(PORT, () => {
        logger.info(`Pilot Mama backend listening on port ${PORT} [${env.NODE_ENV}]`);
      });
    })
    .catch(err => {
      logger.error('Failed to initialize prototype database on startup:', err);
      process.exit(1);
    });
}
