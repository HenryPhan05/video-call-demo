import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export class EmailService {
  private readonly resend: Resend | null;
  private readonly transporter: Transporter | null;

  constructor() {
    this.resend =
      env.emailProvider === "resend" && env.resendApiKey
        ? new Resend(env.resendApiKey)
        : null;
    this.transporter =
      env.emailProvider !== "resend" &&
      env.smtpHost &&
      env.smtpUser &&
      env.smtpPass
      ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        auth:
            env.smtpUser && env.smtpPass
              ? {
                user: env.smtpUser,
                pass: env.smtpPass,
              }
              : undefined,
      })
      : null;
  }

  async sendVerificationCode(email: string, code: string) {
    const subject = "Verify your Chatting account";
    const text = `Your Chatting verification code is ${code}. It expires in ${env.emailVerificationCodeTtlMinutes} minutes.`;
    const html = `<p>Your Chatting verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in ${env.emailVerificationCodeTtlMinutes} minutes.</p>`;

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: env.resendFrom,
        to: email,
        subject,
        text,
        html,
      });
      if (error) {
        console.error("Resend rejected the verification email.", error);
        throw new AppError("Unable to send the verification email.", 503);
      }
      return;
    }

    if (!this.transporter) {
      if (env.nodeEnv === "production")
        throw new AppError("Email delivery is not configured.", 503);
      console.info(`[email verification] ${email}: ${code}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: env.emailFrom,
        to: email,
        subject,
        text,
        html,
      });
    } catch (cause) {
      console.error("Unable to send verification email.", cause);
      throw new AppError("Unable to send the verification email.", 503);
    }
  }
}
