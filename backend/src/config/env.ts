import "dotenv/config";

function getPort(value: string | undefined): number {
  const port = Number(value ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("PORT must be an integer between 1 and 65535.");
  return port;
}

function getPositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: getPort(process.env.PORT),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "local-development-secret-change-me",
  emailProvider:
    process.env.EMAIL_PROVIDER ??
    (process.env.RESEND_API_KEY ? "resend" : "smtp"),
  resendApiKey: process.env.RESEND_API_KEY,
  resendFrom:
    process.env.RESEND_FROM ?? "chatting@noreply <onboarding@resend.dev>",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: getPositiveInteger(process.env.SMTP_PORT, 587, "SMTP_PORT"),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER,
  smtpPass:
    process.env.SMTP_HOST === "smtp.gmail.com"
      ? process.env.SMTP_PASS?.replace(/\s+/g, "")
      : process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM ?? "Chatting <no-reply@localhost>",
  emailVerificationCodeTtlMinutes: getPositiveInteger(
    process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES,
    10,
    "EMAIL_VERIFICATION_CODE_TTL_MINUTES",
  ),
  stunUrl: process.env.STUN_URL ?? "stun:stun.l.google.com:19302",
  turnUrl: process.env.TURN_URL,
  turnUsername: process.env.TURN_USERNAME,
  turnPassword: process.env.TURN_PASSWORD,
};
