import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z
    .union([z.string().trim().min(2).max(100), z.literal("")])
    .transform((value) => (value === "" ? null : value))
    .optional(),
  username: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .regex(/^[a-zA-Z0-9._]+$/)
    .transform((value) => value.toLowerCase())
    .optional(),
  privacy: z
    .object({
      showLastSeen: z.boolean(),
      searchable: z.boolean(),
    })
    .optional(),
});
