import { z } from "zod";
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});
export const loginSchema = registerSchema.pick({
  email: true,
  password: true,
});
export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
});
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
});
