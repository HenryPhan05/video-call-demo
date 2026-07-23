import { Router } from "express";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";
import { validate } from "../middleware/validate";
import {
  createMessageSchema,
  reactionSchema,
  updateMessageSchema,
} from "../validators/chat.validators";
import {
  conversationReadStateSchema,
  createDirectConversationSchema,
} from "../validators/conversation.validators";
import * as conversations from "../controllers/conversation.controller";
import * as messages from "../controllers/message.controller";
import * as users from "../controllers/user.controller";
import { updateProfileSchema } from "../validators/user.validators";
import { avatarUpload } from "../middleware/upload";

export const chatRouter = Router();
chatRouter.use(requireAuth);
chatRouter.get("/users/me", asyncHandler(users.me));
chatRouter.patch(
  "/users/me",
  validate(updateProfileSchema),
  asyncHandler(users.update),
);
chatRouter.post("/users/me/avatar", avatarUpload, asyncHandler(users.avatar));
chatRouter.get("/users", asyncHandler(users.search));
chatRouter.get("/conversations", asyncHandler(conversations.list));
chatRouter.post(
  "/conversations",
  validate(createDirectConversationSchema),
  asyncHandler(conversations.createDirect),
);
chatRouter.patch(
  "/conversations/:conversationId/read-state",
  validate(conversationReadStateSchema),
  asyncHandler(conversations.setReadState),
);
chatRouter.patch(
  "/conversations/:conversationId/archive",
  asyncHandler(conversations.archive),
);
chatRouter.delete(
  "/conversations/:conversationId",
  asyncHandler(conversations.removeForUser),
);
chatRouter.get(
  "/conversations/:conversationId/messages",
  asyncHandler(messages.list),
);
chatRouter.post(
  "/conversations/:conversationId/messages",
  validate(createMessageSchema),
  asyncHandler(messages.create),
);
chatRouter.post(
  "/conversations/:conversationId/seen",
  asyncHandler(messages.markSeen),
);
chatRouter.patch(
  "/messages/:messageId",
  validate(updateMessageSchema),
  asyncHandler(messages.update),
);
chatRouter.delete("/messages/:messageId", asyncHandler(messages.remove));
chatRouter.post(
  "/messages/:messageId/reactions",
  validate(reactionSchema),
  asyncHandler(messages.react),
);
