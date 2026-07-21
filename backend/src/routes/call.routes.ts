import { Router } from "express";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";
import * as controller from "../controllers/call.controller";

export const callRouter = Router();
callRouter.use(requireAuth);
callRouter.get("/config", asyncHandler(controller.config));
callRouter.get("/history", asyncHandler(controller.history));
