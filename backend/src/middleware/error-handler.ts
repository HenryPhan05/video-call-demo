import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const isOperational = error instanceof AppError;
  const isValidation = error instanceof ZodError;
  const isUniqueConflict =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002";
  const statusCode = isOperational
    ? error.statusCode
    : isValidation
      ? 400
      : isUniqueConflict
        ? 409
        : 500;
  const message = isOperational
    ? error.message
    : isValidation
      ? error.issues[0]?.message ?? "Request validation failed."
      : isUniqueConflict
        ? "That email or username is already registered."
      : "Internal server error.";

  if (!isOperational && !isValidation && !isUniqueConflict) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.nodeEnv === "development" &&
    !isOperational &&
    !isValidation &&
    !isUniqueConflict
      ? {
          stack: error.stack,
        }
      : {}),
  });
};
