import { z } from "zod";

export const createDirectConversationSchema = z.object({
  userId: z.string().cuid(),
});

export const createGroupConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Group name must contain at least 2 characters.")
    .max(120, "Group name cannot exceed 120 characters."),
  userIds: z.array(z.string().cuid()).min(2).max(49),
});

export const addConversationMembersSchema = z.object({
  userIds: z.array(z.string().cuid()).min(1).max(49),
});

export const conversationReadStateSchema = z.object({
  unread: z.boolean(),
});
