import { z } from "zod";

export const createMessageSchema = z
  .object({
    text: z.string().trim().max(2000).optional(),
    replyToId: z.string().cuid().optional(),
    attachmentIds: z.array(z.string().cuid()).max(10).optional(),
  })
  .refine(
    (value) => Boolean(value.text) || Boolean(value.attachmentIds?.length),
    {
      message: "Message text or an attachment is required.",
    },
  );

export const updateMessageSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
});
