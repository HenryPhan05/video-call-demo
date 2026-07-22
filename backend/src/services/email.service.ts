import crypto from "node:crypto";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

const tokenEndpoint = "https://oauth2.googleapis.com/token";
const gmailSendEndpoint =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const encodeHeader = (value: string) =>
  `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;

function createMessage(to: string, subject: string, text: string, html: string) {
  if (/\r|\n/.test(to)) throw new AppError("Invalid email recipient.", 400);
  const boundary = `chatting-${crypto.randomUUID()}`;
  const fromName = encodeHeader(env.gmailSenderName);
  const message = [
    `From: ${fromName} <${env.gmailSenderEmail}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf8").toString("base64"),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

export class EmailService {
  async sendVerificationCode(email: string, code: string) {
    const subject = "Verify your Chatting account";
    const text = `Your Chatting verification code is ${code}. It expires in ${env.emailVerificationCodeTtlMinutes} minutes.`;
    const html = `<p>Your Chatting verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in ${env.emailVerificationCodeTtlMinutes} minutes.</p>`;

    if (
      !env.gmailClientId ||
      !env.gmailClientSecret ||
      !env.gmailRefreshToken ||
      !env.gmailSenderEmail
    ) {
      throw new AppError(
        "Gmail API is not configured. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_SENDER_EMAIL to backend/.env.",
        503,
      );
    }

    const accessToken = await this.accessToken();
    let response: Response;
    try {
      response = await fetch(gmailSendEndpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          raw: createMessage(email, subject, text, html),
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (cause) {
      console.error("Unable to reach the Gmail API.", cause);
      throw new AppError(
        "The Gmail email service is temporarily unavailable. Please try again.",
        503,
      );
    }

    if (response.ok) return;

    const error = (await response.json().catch(() => null)) as {
      error?: {
        code?: number;
        message?: string;
        status?: string;
      };
    } | null;
    console.error("Gmail rejected the verification email.", {
      status: response.status,
      code: error?.error?.status,
      message: error?.error?.message,
    });

    if (response.status === 401)
      throw new AppError(
        "Gmail authorization failed. Generate a new GMAIL_REFRESH_TOKEN.",
        503,
      );
    if (response.status === 403)
      throw new AppError(
        "Gmail refused permission to send. Enable the Gmail API and authorize the gmail.send scope.",
        503,
      );
    if (response.status === 429)
      throw new AppError(
        "The Gmail sending limit has been reached. Please try again later.",
        429,
      );
    throw new AppError(
      "Unable to send the verification email through Gmail. Please try again.",
      503,
    );
  }

  private async accessToken() {
    let response: Response;
    try {
      response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: env.gmailClientId!,
          client_secret: env.gmailClientSecret!,
          refresh_token: env.gmailRefreshToken!,
          grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (cause) {
      console.error("Unable to reach Google OAuth.", cause);
      throw new AppError(
        "Google authorization is temporarily unavailable. Please try again.",
        503,
      );
    }

    const result = (await response.json().catch(() => null)) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    } | null;
    if (response.ok && result?.access_token) return result.access_token;

    console.error("Google OAuth rejected the refresh token.", {
      status: response.status,
      error: result?.error,
      description: result?.error_description,
    });
    if (result?.error === "invalid_grant")
      throw new AppError(
        "Gmail authorization expired or was revoked. Generate a new GMAIL_REFRESH_TOKEN.",
        503,
      );
    throw new AppError(
      "Gmail OAuth credentials are invalid. Check the client ID, client secret, and refresh token.",
      503,
    );
  }
}
