import jwt from "jsonwebtoken";
import { env } from "../config/env";
export const tokenCookieName = "chat_access_token";
export const signAccessToken = (userId: string) =>
  jwt.sign(
    {
      sub: userId,
    },
    env.jwtSecret,
    {
      expiresIn: "15m",
    },
  );
export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.jwtSecret) as {
    sub: string;
  };
