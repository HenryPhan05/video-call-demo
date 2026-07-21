import type { Request, RequestHandler } from 'express';
import { MessageService } from '../services/message.service';
import { ok } from '../utils/api-response';

const service = new MessageService();

function broadcast(req: Request, event: string, message: { conversation: { participants: { userId: string }[] } }) {
  const io = req.app.get('io');
  for (const participant of message.conversation.participants) {
    io?.to(`user:${participant.userId}`).emit(event, message);
  }
}

export const list: RequestHandler = async (req, res) => {
  return ok(res, await service.list(String(req.params.conversationId), req.userId!), 'Messages loaded.');
};

export const create: RequestHandler = async (req, res) => {
  const message = await service.create(String(req.params.conversationId), req.userId!, req.body);
  broadcast(req, 'message:new', message);
  return ok(res, message, 'Message sent.', 201);
};

export const update: RequestHandler = async (req, res) => {
  const message = await service.update(String(req.params.messageId), req.userId!, req.body.text);
  broadcast(req, 'message:update', message);
  return ok(res, message, 'Message updated.');
};

export const remove: RequestHandler = async (req, res) => {
  const message = await service.remove(String(req.params.messageId), req.userId!);
  broadcast(req, 'message:delete', message);
  return ok(res, { id: message.id, conversationId: message.conversationId }, 'Message deleted.');
};

export const react: RequestHandler = async (req, res) => {
  const message = await service.react(String(req.params.messageId), req.userId!, req.body.emoji);
  broadcast(req, 'message:update', message);
  return ok(res, message, 'Reaction updated.');
};

export const markSeen: RequestHandler = async (req, res) => {
  const conversationId = String(req.params.conversationId);
  const result = await service.markSeen(conversationId, req.userId!);
  const io = req.app.get('io');
  for (const participant of result.participants) {
    io?.to(`user:${participant.userId}`).emit('message:seen', {
      conversationId,
      userId: req.userId,
      seenAt: result.seenAt,
    });
  }
  return ok(res, { count: result.count, seenAt: result.seenAt }, 'Messages marked as seen.');
};
