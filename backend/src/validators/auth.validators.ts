import { z } from "zod";

const firstName = z
  .string()
  .trim()
  .min(2, "First name must contain at least 2 characters.")
  .max(100, "First name cannot exceed 100 characters.");

const lastName = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .min(2, "Last name must contain at least 2 characters.")
    .max(100, "Last name cannot exceed 100 characters.")
    .optional(),
);

const username = z
  .string()
  .trim()
  .min(5, "Username must contain at least 5 characters.")
  .max(30, "Username cannot exceed 30 characters.")
  .regex(
    /^[a-zA-Z0-9._]+$/,
    "Username can only contain letters, numbers, periods, and underscores.",
  )
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(29, "Password must contain fewer than 30 characters.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[0-9]/, "Password must contain at least one number.")
  .regex(
    /[^A-Za-z0-9\s]/,
    "Password must contain at least one special character.",
  );

export const registerSchema = z.object({
  firstName,
  lastName,
  username,
  email: z.string().trim().email("Enter a valid email address."),
  password,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code."),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  password,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password,
});
