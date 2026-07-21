import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const isOperational = error instanceof AppError;
  const statusCode = isOperational ? error.statusCode : 500;
  const message = isOperational ? error.message : "Internal server error.";
  if (!isOperational) console.error(error);
  res.status(statusCode).json({
    success: false,
    message,
    ...(env.nodeEnv === "development" && !isOperational
      ? {
        stack: error.stack,
      }
      : {}),
  });
};
