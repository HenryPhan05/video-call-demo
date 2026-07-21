import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";
import { tokenCookieName, verifyAccessToken } from "../utils/token";
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
export const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    const token = req.cookies?.[tokenCookieName];
    if (!token) throw new AppError("Please sign in to continue.", 401);
    req.userId = verifyAccessToken(token).sub;
    next();
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : new AppError("Session invalid or expired.", 401),
    );
  }
};
