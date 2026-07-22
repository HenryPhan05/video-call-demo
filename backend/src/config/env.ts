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
  gmailClientId: process.env.GMAIL_CLIENT_ID,
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET,
  gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN,
  gmailSenderEmail: process.env.GMAIL_SENDER_EMAIL,
  gmailSenderName: process.env.GMAIL_SENDER_NAME ?? "Chatting",
  emailVerificationCodeTtlMinutes: getPositiveInteger(
    process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES,
    10,
    "EMAIL_VERIFICATION_CODE_TTL_MINUTES",
  ),
  passwordResetCodeTtlMinutes: getPositiveInteger(
    process.env.PASSWORD_RESET_CODE_TTL_MINUTES,
    10,
    "PASSWORD_RESET_CODE_TTL_MINUTES",
  ),
  stunUrl: process.env.STUN_URL ?? "stun:stun.l.google.com:19302",
  turnUrl: process.env.TURN_URL,
  turnUsername: process.env.TURN_USERNAME,
  turnPassword: process.env.TURN_PASSWORD,
};
