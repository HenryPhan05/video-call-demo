import type { RequestHandler } from 'express';
import { ConversationService } from '../services/conversation.service';
import { ok } from '../utils/api-response';
const service=new ConversationService();
export const list:RequestHandler=async(req,res)=>ok(res,await service.list(req.userId!),'Conversations loaded.');
export const createDirect:RequestHandler=async(req,res)=>ok(res,await service.createDirect(req.userId!,req.body.userId),'Conversation ready.',201);
