import type { RequestHandler } from "express";
import { UserService } from "../services/user.service";
import { ok } from "../utils/api-response";

const service = new UserService();

export const me: RequestHandler = async (req, res) => {
  return ok(
    res,
    {
      user: await service.me(req.userId!),
    },
    "Current user.",
  );
};

export const search: RequestHandler = async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  return ok(res, await service.search(query), "Users loaded.");
};

export const update: RequestHandler = async (req, res) => {
  return ok(
    res,
    {
      user: await service.update(req.userId!, req.body),
    },
    "Profile updated.",
  );
};

export const avatar: RequestHandler = async (req, res) => {
  return ok(
    res,
    {
      user: await service.avatar(req.userId!, req.file),
    },
    "Avatar updated.",
  );
};
