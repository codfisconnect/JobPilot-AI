import type { Request, Response, NextFunction } from 'express';
import { AgentService } from './agent.service.js';
import {
  createAgentSessionSchema,
  sendAgentMessageSchema
} from './agent.schemas.js';
import { UnauthorizedError } from '../../utils/errors.js';

export class AgentController {
  constructor(private service: AgentService = new AgentService()) {}

  private getUserId(req: Request): string {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }
    return userId;
  }

  createSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const parsed = createAgentSessionSchema.parse(req.body || {});
      const session = await this.service.createSession(userId, parsed.title);
      res.status(201).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  };

  listSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const sessions = await this.service.listSessions(userId);
      res.json({ success: true, data: sessions });
    } catch (err) {
      next(err);
    }
  };

  getSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const session = await this.service.getSession(userId, id);
      res.json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const parsed = sendAgentMessageSchema.parse(req.body);
      const result = await this.service.sendMessage(userId, id, parsed);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  approveAction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const result = await this.service.approveAction(userId, id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  rejectAction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const result = await this.service.rejectAction(userId, id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
