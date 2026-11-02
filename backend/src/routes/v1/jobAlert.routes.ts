import { Router } from 'express';
import { JobAlertController } from '../../controllers/v1/jobAlert.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const jobAlertRouter = Router();

// Public unsubscribe link (token verified)
jobAlertRouter.get('/unsubscribe', JobAlertController.unsubscribe);

// Authenticated candidate notification preferences
jobAlertRouter.get('/preferences', authenticateJwt, JobAlertController.getPreferences);
jobAlertRouter.put('/preferences', authenticateJwt, JobAlertController.updatePreferences);

// Outbox batch process
jobAlertRouter.post('/process', JobAlertController.processQueue);
