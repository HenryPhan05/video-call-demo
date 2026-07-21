import { z } from "zod";
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  privacy: z
    .object({
      showLastSeen: z.boolean(),
      searchable: z.boolean(),
    })
    .optional(),
});
