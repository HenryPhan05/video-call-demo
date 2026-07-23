import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { healthRouter } from "./routes/health.routes";
import { authRouter } from "./routes/auth.routes";
import { chatRouter } from "./routes/chat.routes";
import { friendRouter } from "./routes/friend.routes";
import { attachmentRouter } from "./routes/attachment.routes";
import { callRouter } from "./routes/call.routes";
import { avatarUploadDirectory } from "./config/upload-paths";

export const app = express();
app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  }),
);
app.use(
  express.json({
    limit: "1mb",
  }),
);
app.use(cookieParser());
app.use(
  "/api/v1/auth",
  rateLimit({
    windowMs: 15 * 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", chatRouter);
app.use("/api/v1/friends", friendRouter);
app.use("/api/v1", attachmentRouter);
app.use("/api/v1/calls", callRouter);
app.use(
  "/uploads/avatars",
  express.static(avatarUploadDirectory, {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    setHeaders: (res) => {
      // Avatars are public profile media rendered by the frontend on a
      // different development/production origin. Helmet defaults this header
      // to same-origin, which makes a successfully uploaded image appear
      // broken in <img> elements served from the frontend origin.
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=3600, immutable");
    },
  }),
);
app.use(notFound);
app.use(errorHandler);
