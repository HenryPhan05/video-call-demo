import type { RequestHandler } from "express";
import { AuthService } from "../services/auth.service";
import { ok } from "../utils/api-response";
import { tokenCookieName } from "../utils/token";
import { AppError } from "../utils/app-error";
const service = new AuthService();
const opts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
const meta = (req: any) => ({
  ip: req.ip,
  device: req.get("user-agent"),
});
const set = (res: any, s: any, status = 200) => {
  res
    .cookie(tokenCookieName, s.accessToken, {
      ...opts,
      maxAge: 900000,
    })
    .cookie("refresh_token", s.refreshToken, {
      ...opts,
      maxAge: 604800000,
    });
  return ok(
    res,
    {
      user: s.user,
    },
    "Authenticated.",
    status,
  );
};
export const register: RequestHandler = async (req, res) =>
  ok(
    res,
    await service.register(req.body, meta(req)),
    "Account created. Enter the code sent to your email.",
    201,
  );
export const verifyEmail: RequestHandler = async (req, res) =>
  set(res, await service.verifyEmail(req.body.email, req.body.code, meta(req)));
export const resendVerification: RequestHandler = async (req, res) => {
  await service.resendVerification(req.body.email);
  return ok(
    res,
    null,
    "If the account is awaiting verification, a new code has been sent.",
  );
};
export const login: RequestHandler = async (req, res) =>
  set(res, await service.login(req.body, meta(req)));
export const refresh: RequestHandler = async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken)
    throw new AppError("Refresh session is missing.", 401);
  return set(res, await service.refresh(refreshToken, meta(req)));
};
export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(tokenCookieName, opts).clearCookie("refresh_token", opts);
  return ok(res, null, "Signed out.");
};
export const logoutAll: RequestHandler = async (req, res) => {
  await service.logoutAll(req.userId!);
  res.clearCookie(tokenCookieName, opts).clearCookie("refresh_token", opts);
  return ok(res, null, "Signed out on all devices.");
};
export const changePassword: RequestHandler = async (req, res) => {
  await service.changePassword(
    req.userId!,
    req.body.currentPassword,
    req.body.password,
  );
  return ok(res, null, "Password changed. Please sign in again.");
};
export const forgotPassword: RequestHandler = async (req, res) => {
  await service.forgotPassword(req.body.email);
  return ok(
    res,
    null,
    "A six-digit password reset code has been sent.",
  );
};
export const resetPassword: RequestHandler = async (req, res) => {
  await service.resetPassword(
    req.body.email,
    req.body.code,
    req.body.password,
  );
  return ok(res, null, "Password reset. Please sign in.");
};
