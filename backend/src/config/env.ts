import 'dotenv/config';

function getPort(value: string | undefined): number {
  const port = Number(value ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be an integer between 1 and 65535.');
  return port;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: getPort(process.env.PORT),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'local-development-secret-change-me',
  stunUrl: process.env.STUN_URL ?? 'stun:stun.l.google.com:19302',
  turnUrl: process.env.TURN_URL,
  turnUsername: process.env.TURN_USERNAME,
  turnPassword: process.env.TURN_PASSWORD,
};
