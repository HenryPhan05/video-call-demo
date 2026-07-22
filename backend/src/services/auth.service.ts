import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { AppError } from "../utils/app-error";
import { signAccessToken } from "../utils/token";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository";
import { UserRepository } from "../repositories/user.repository";
import { PasswordResetRepository } from "../repositories/password-reset.repository";
import { EmailVerificationRepository } from "../repositories/email-verification.repository";
import { EmailService } from "./email.service";
import { env } from "../config/env";
const users = new UserRepository();
const refreshTokens = new RefreshTokenRepository();
const resets = new PasswordResetRepository();
const emailVerifications = new EmailVerificationRepository();
const emailService = new EmailService();
const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
const verificationHash = (userId: string, code: string) =>
  crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`${userId}:${code}`)
    .digest("hex");
const passwordResetHash = (userId: string, code: string) =>
  crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`password-reset:${userId}:${code}`)
    .digest("hex");

export class AuthService {
  async register(
    input: {
      firstName: string;
      lastName?: string;
      username: string;
      email: string;
      password: string;
    },
    meta?: any,
  ) {
    const email = input.email.toLowerCase();
    const existingUser = await users.findByEmail(email);
    if (existingUser) {
      if (existingUser.emailVerifiedAt)
        throw new AppError("An account with this email already exists.", 409);
      await this.issueVerificationCode(existingUser.id, existingUser.email, false);
      return {
        verificationRequired: true as const,
        email: existingUser.email,
      };
    }
    if (await users.findByUsername(input.username))
      throw new AppError("This username is already taken.", 409);
    const user = await users.create({
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      email,
      passwordHash: await bcrypt.hash(input.password, 12),
    });
    await this.issueVerificationCode(user.id, user.email, false);
    return {
      verificationRequired: true as const,
      email: user.email,
    };
  }
  async login(
    input: {
      email: string;
      password: string;
    },
    meta?: any,
  ) {
    const user = await users.findByEmail(input.email.toLowerCase());
    if (!user)
      throw new AppError("This email is not registered yet.", 404);
    if (!(await bcrypt.compare(input.password, user.passwordHash)))
      throw new AppError("Email or password is incorrect.", 401);
    if (!user.emailVerifiedAt)
      throw new AppError("Verify your email before signing in.", 403);
    return this.session(user.id, user, meta);
  }

  async verifyEmail(emailInput: string, code: string, meta?: any) {
    const user = await users.findByEmail(emailInput.toLowerCase());
    if (!user) throw new AppError("Verification code is invalid or expired.", 400);
    if (user.emailVerifiedAt)
      throw new AppError("This email is already verified. Please sign in.", 409);

    const token = await emailVerifications.latestForUser(user.id);
    if (!token || token.expiresAt.getTime() <= Date.now()) {
      if (token) await emailVerifications.invalidate(token.id);
      throw new AppError("Verification code is invalid or expired.", 400);
    }
    if (token.attempts >= 5)
      throw new AppError("Too many attempts. Request a new code.", 429);

    const expected = Buffer.from(token.codeHash, "hex");
    const received = Buffer.from(verificationHash(user.id, code), "hex");
    if (!crypto.timingSafeEqual(expected, received)) {
      const finalAttempt = token.attempts + 1 >= 5;
      await emailVerifications.recordFailedAttempt(token.id, finalAttempt);
      throw new AppError(
        finalAttempt
          ? "Too many attempts. Request a new code."
          : "Verification code is invalid or expired.",
        finalAttempt ? 429 : 400,
      );
    }

    const verifiedUser = await emailVerifications.markUserVerified(
      user.id,
      token.id,
    );
    return this.session(verifiedUser.id, verifiedUser, meta);
  }

  async resendVerification(emailInput: string) {
    const user = await users.findByEmail(emailInput.toLowerCase());
    if (!user || user.emailVerifiedAt) return;
    await this.issueVerificationCode(user.id, user.email, true);
  }
  async refresh(raw: string, meta?: any) {
    const record = await refreshTokens.findActive(hash(raw));
    if (!record) throw new AppError("Refresh token reuse detected.", 401);
    await refreshTokens.revoke(record.id);
    const user = await users.findById(record.userId);
    if (!user) throw new AppError("User no longer exists.", 401);
    return this.session(user.id, user, meta);
  }
  async logoutAll(userId: string) {
    await refreshTokens.revokeAll(userId);
  }
  async changePassword(
    userId: string,
    currentPassword: string,
    password: string,
  ) {
    const user = await users.findById(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash)))
      throw new AppError("Current password is incorrect.", 400);
    await users.updatePassword(userId, await bcrypt.hash(password, 12));
    await refreshTokens.revokeAll(userId);
  }
  async forgotPassword(email: string) {
    const user = await users.findByEmail(email.toLowerCase());
    if (!user)
      throw new AppError("This email is not registered.", 404);
    const latest = await resets.latestForUser(user.id);
    if (latest && Date.now() - latest.createdAt.getTime() < 60_000)
      throw new AppError(
        "Please wait 60 seconds before requesting another reset code.",
        429,
      );

    const code = crypto.randomInt(100_000, 1_000_000).toString();
    const reset = await resets.replaceCode(
      user.id,
      passwordResetHash(user.id, code),
      new Date(Date.now() + env.passwordResetCodeTtlMinutes * 60_000),
    );
    try {
      await emailService.sendPasswordResetCode(user.email, code);
    } catch (cause) {
      await resets.invalidate(reset.id).catch((error) => {
        console.error("Unable to invalidate an undelivered reset code.", error);
      });
      throw cause;
    }
  }

  async resetPassword(email: string, code: string, password: string) {
    const user = await users.findByEmail(email.toLowerCase());
    if (!user)
      throw new AppError("Reset code is invalid or expired.", 400);
    const record = await resets.latestForUser(user.id);
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      if (record) await resets.invalidate(record.id);
      throw new AppError("Reset code is invalid or expired.", 400);
    }
    if (record.attempts >= 5)
      throw new AppError("Too many attempts. Request a new reset code.", 429);

    const expected = Buffer.from(record.tokenHash, "hex");
    const received = Buffer.from(passwordResetHash(user.id, code), "hex");
    if (!crypto.timingSafeEqual(expected, received)) {
      const finalAttempt = record.attempts + 1 >= 5;
      await resets.recordFailedAttempt(record.id, finalAttempt);
      throw new AppError(
        finalAttempt
          ? "Too many attempts. Request a new reset code."
          : "Reset code is invalid or expired.",
        finalAttempt ? 429 : 400,
      );
    }

    const consumed = await resets.consumeAndUpdatePassword(
      record.id,
      user.id,
      await bcrypt.hash(password, 12),
    );
    if (!consumed)
      throw new AppError("Reset code is invalid or expired.", 400);
    await refreshTokens.revokeAll(user.id);
  }
  async session(userId: string, user: any, meta?: any) {
    const refreshToken = crypto.randomBytes(48).toString("base64url");
    await refreshTokens.create(
      userId,
      hash(refreshToken),
      new Date(Date.now() + 7 * 86400000),
      meta?.device,
      meta?.ip,
    );
    return {
      accessToken: signAccessToken(userId),
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    };
  }

  private async issueVerificationCode(
    userId: string,
    email: string,
    enforceCooldown: boolean,
  ) {
    if (enforceCooldown) {
      const latest = await emailVerifications.latestForUser(userId);
      if (latest && Date.now() - latest.createdAt.getTime() < 60_000)
        throw new AppError(
          "Too many requests, please wait to try again.",
          429,
        );
    }

    const code = crypto.randomInt(100_000, 1_000_000).toString();
    const expiresAt = new Date(
      Date.now() + env.emailVerificationCodeTtlMinutes * 60_000,
    );
    const verification = await emailVerifications.replaceCode(
      userId,
      verificationHash(userId, code),
      expiresAt,
    );
    try {
      await emailService.sendVerificationCode(email, code);
    } catch (cause) {
      await emailVerifications.invalidate(verification.id).catch((error) => {
        console.error("Unable to invalidate an undelivered verification code.", error);
      });
      throw cause;
    }
  }
}
