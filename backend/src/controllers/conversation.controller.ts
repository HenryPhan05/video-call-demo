import type { RequestHandler } from "express";
import { ConversationService } from "../services/conversation.service";
import { ok } from "../utils/api-response";
const service = new ConversationService();

const broadcast = (
  req: Parameters<RequestHandler>[0],
  event: string,
  conversation: {
    id: string;
    memberIds: string[];
  },
) => {
  const io = req.app.get("io");
  for (const memberId of conversation.memberIds)
    io?.to(`user:${memberId}`).emit(event, {
      conversationId: conversation.id,
    });
};

export const list: RequestHandler = async (req, res) =>
  ok(res, await service.list(req.userId!), "Conversations loaded.");
export const createDirect: RequestHandler = async (req, res) =>
  ok(
    res,
    await service.createDirect(req.userId!, req.body.userId),
    "Conversation ready.",
    201,
  );
export const createGroup: RequestHandler = async (req, res) => {
  const conversation = await service.createGroup(
    req.userId!,
    req.body.title,
    req.body.userIds,
  );
  broadcast(req, "conversation:new", conversation);
  return ok(res, conversation, "Group created.", 201);
};
export const addMembers: RequestHandler = async (req, res) => {
  const conversation = await service.addMembers(
    String(req.params.conversationId),
    req.userId!,
    req.body.userIds,
  );
  broadcast(req, "conversation:update", conversation);
  return ok(res, conversation, "Members added.");
};
export const requireGroupOwner: RequestHandler = async (req, _res, next) => {
  await service.assertGroupOwner(
    String(req.params.conversationId),
    req.userId!,
  );
  next();
};
export const updateGroupAvatar: RequestHandler = async (req, res) => {
  const conversation = await service.updateGroupAvatar(
    String(req.params.conversationId),
    req.userId!,
    req.file,
  );
  broadcast(req, "conversation:update", conversation);
  return ok(res, conversation, "Group avatar updated.");
};
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
