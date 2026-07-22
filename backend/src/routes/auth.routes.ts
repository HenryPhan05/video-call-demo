import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as c from "../controllers/auth.controller";
import { requireAuth } from "../middleware/require-auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "../validators/auth.validators";
export const authRouter = Router();
const registerLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please wait to try again.",
  },
});
const verificationLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts. Try again later.",
  },
});
const resendLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many code requests. Try again later.",
  },
});
const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset code requests. Try again later.",
  },
});
const passwordResetAttemptLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset attempts. Try again later.",
  },
});
authRouter.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  asyncHandler(c.register),
);
authRouter.post("/login", validate(loginSchema), asyncHandler(c.login));
authRouter.post(
  "/verify-email",
  verificationLimiter,
  validate(verifyEmailSchema),
  asyncHandler(c.verifyEmail),
);
authRouter.post(
  "/resend-verification",
  resendLimiter,
  validate(resendVerificationSchema),
  asyncHandler(c.resendVerification),
);
authRouter.post("/refresh", asyncHandler(c.refresh));
authRouter.post("/logout", c.logout);
authRouter.post("/logout-all", requireAuth, asyncHandler(c.logoutAll));
authRouter.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(c.changePassword),
);
authRouter.post(
  "/forgot-password",
  passwordResetRequestLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(c.forgotPassword),
);
authRouter.post(
  "/reset-password",
  passwordResetAttemptLimiter,
  validate(resetPasswordSchema),
  asyncHandler(c.resetPassword),
);
