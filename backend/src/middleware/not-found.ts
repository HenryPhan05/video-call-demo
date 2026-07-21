import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

export const notFound: RequestHandler = (req, _res, next) =>
  next(
    new AppError(`Route ${req.method} ${req.originalUrl} was not found.`, 404),
  );
