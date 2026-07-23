import type { RequestHandler } from "express";
import { ConversationService } from "../services/conversation.service";
import { ok } from "../utils/api-response";
const service = new ConversationService();
export const list: RequestHandler = async (req, res) =>
  ok(res, await service.list(req.userId!), "Conversations loaded.");
export const createDirect: RequestHandler = async (req, res) =>
  ok(
    res,
    await service.createDirect(req.userId!, req.body.userId),
    "Conversation ready.",
    201,
  );
export const setReadState: RequestHandler = async (req, res) =>
  ok(
    res,
    await service.setReadState(
      String(req.params.conversationId),
      req.userId!,
      req.body.unread,
    ),
    req.body.unread ? "Conversation marked unread." : "Conversation marked read.",
  );
export const archive: RequestHandler = async (req, res) =>
  ok(
    res,
    await service.archive(String(req.params.conversationId), req.userId!),
    "Conversation archived.",
  );
export const removeForUser: RequestHandler = async (req, res) =>
  ok(
    res,
    await service.removeForUser(
      String(req.params.conversationId),
      req.userId!,
    ),
    "Conversation deleted for this user.",
  );
