import { ConversationService } from "./conversation.service";
import { MessageRepository } from "../repositories/message.repository";
import { AppError } from "../utils/app-error";

const conversations = new ConversationService();
const messages = new MessageRepository();

export class MessageService {
  async list(conversationId: string, userId: string) {
    await conversations.assertMember(conversationId, userId);
    return messages.list(conversationId);
  }

  async create(
    conversationId: string,
    userId: string,
    input: {
      text?: string;
      replyToId?: string;
      attachmentIds?: string[];
    },
  ) {
    await conversations.assertMember(conversationId, userId);
    try {
      return await messages.create({
        conversationId,
        senderId: userId,
        body: input.text,
        replyToId: input.replyToId,
        attachmentIds: input.attachmentIds,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("attachments")) {
        throw new AppError(error.message, 400);
      }
      if (error instanceof Error && error.message.includes("replied")) {
        throw new AppError(error.message, 404);
      }
      throw error;
    }
  }

  async update(messageId: string, userId: string, text: string) {
    const message = await messages.findForMember(messageId, userId);
    if (!message) throw new AppError("Message not found.", 404);
    if (message.senderId !== userId)
      throw new AppError("Only the sender can edit this message.", 403);
    return messages.update(messageId, text);
  }

  async remove(messageId: string, userId: string) {
    const message = await messages.findForMember(messageId, userId);
    if (!message) throw new AppError("Message not found.", 404);
    if (message.senderId !== userId)
      throw new AppError("Only the sender can delete this message.", 403);
    return messages.softDelete(messageId);
  }

  async react(messageId: string, userId: string, emoji: string) {
    const message = await messages.findForMember(messageId, userId);
    if (!message) throw new AppError("Message not found.", 404);
    return messages.toggleReaction(messageId, userId, emoji);
  }

  async markSeen(conversationId: string, userId: string) {
    await conversations.assertMember(conversationId, userId);
    return messages.markSeen(conversationId, userId);
  }
}
