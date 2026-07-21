import type { RequestHandler } from "express";
import { FriendService } from "../services/friend.service";
import { ok } from "../utils/api-response";
const service = new FriendService();
const emit = (req: any, userId: string, event: string, data: any) =>
  req.app.get("io")?.to(`user:${userId}`).emit(event, data);
export const request: RequestHandler = async (req, res) => {
  const friend = await service.request(req.userId!, req.body.userId);
  emit(req, req.body.userId, "friend:request", friend);
  return ok(res, friend, "Friend request sent.", 201);
};
export const accept: RequestHandler = async (req, res) => {
  const friend = await service.accept(req.userId!, String(req.params.id));
  emit(req, friend.senderId, "friend:accepted", friend);
  return ok(res, friend, "Friend request accepted.");
};
export const reject: RequestHandler = async (req, res) =>
  ok(
    res,
    await service.reject(req.userId!, String(req.params.id)),
    "Friend request rejected.",
  );
export const cancel: RequestHandler = async (req, res) =>
  ok(
    res,
    await service.cancel(req.userId!, String(req.params.userId)),
    "Friend request cancelled.",
  );
export const remove: RequestHandler = async (req, res) =>
  ok(
    res,
    await service.remove(req.userId!, String(req.params.userId)),
    "Friend removed.",
  );
export const list: RequestHandler = async (req, res) =>
  ok(res, await service.list(req.userId!));
export const pending: RequestHandler = async (req, res) =>
  ok(res, await service.pending(req.userId!));
