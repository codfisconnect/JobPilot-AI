import { Router } from 'express';
import { ApplicationController } from './application.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const applicationRouter = Router();

// Strict candidate authentication required on all application endpoints
applicationRouter.use(authenticateJwt);

// Analytics
applicationRouter.get('/stats', ApplicationController.getStats);

// Status and History
applicationRouter.post('/:id/status', ApplicationController.updateStatus);
applicationRouter.get('/:id/history', ApplicationController.getStatusHistory);

// Notes
applicationRouter.get('/:id/notes', ApplicationController.getNotes);
applicationRouter.post('/:id/notes', ApplicationController.addNote);
applicationRouter.delete('/:id/notes/:noteId', ApplicationController.deleteNote);

// Reminders
applicationRouter.get('/:id/reminders', ApplicationController.getReminders);
applicationRouter.post('/:id/reminders', ApplicationController.addReminder);
applicationRouter.delete('/:id/reminders/:reminderId', ApplicationController.deleteReminder);

// Applications CRUD
applicationRouter.get('/', ApplicationController.listApplications);
applicationRouter.get('/:id', ApplicationController.getApplicationById);
applicationRouter.post('/', ApplicationController.createApplication);
applicationRouter.patch('/:id', ApplicationController.updateApplication);
applicationRouter.delete('/:id', ApplicationController.deleteApplication);

// Saved Jobs router
export const savedJobRouter = Router();
savedJobRouter.use(authenticateJwt);
savedJobRouter.get('/', ApplicationController.listSavedJobs);
savedJobRouter.post('/:jobId', ApplicationController.saveJob);
savedJobRouter.delete('/:jobId', ApplicationController.removeSavedJob);
