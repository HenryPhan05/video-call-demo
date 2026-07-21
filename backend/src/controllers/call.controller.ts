import type { RequestHandler } from 'express';
import { CallService } from '../services/call.service';
import { ok } from '../utils/api-response';

const service = new CallService();

export const config: RequestHandler = async (_req, res) => ok(res, service.config(), 'WebRTC configuration.');
export const history: RequestHandler = async (req, res) => ok(res, await service.history(req.userId!), 'Call history loaded.');
