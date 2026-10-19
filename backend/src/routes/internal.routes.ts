import { Router } from 'express';
import { requireSchedulerSecret } from '../middleware/schedulerAuth.middleware.js';
import { InternalJobSourcesController } from '../controllers/v1/internalJobSources.controller.js';

export const internalRouter = Router();

// Protect all internal routes with strong scheduler secret verification
internalRouter.use(requireSchedulerSecret);

// Automated synchronization entrypoint for all enabled job sources
internalRouter.post('/job-sources/sync-all', InternalJobSourcesController.syncAll);
