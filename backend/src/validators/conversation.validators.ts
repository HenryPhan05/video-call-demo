import { z } from "zod";

export const createDirectConversationSchema = z.object({
  userId: z.string().cuid(),
});

export const conversationReadStateSchema = z.object({
  unread: z.boolean(),
});
