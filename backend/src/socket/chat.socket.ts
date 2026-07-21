import type { Server, Socket } from "socket.io";
import { ConversationRepository } from "../repositories/conversation.repository";

const conversations = new ConversationRepository();

type TypingPayload = {
  conversationId?: string;
};

export function registerChatSocket(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  const publishTyping = async (payload: TypingPayload, isTyping: boolean) => {
    if (!payload?.conversationId) return;
    const participantIds = await conversations.participantIds(
      payload.conversationId,
      userId,
    );
    if (!participantIds) return;

    for (const participantId of participantIds) {
      if (participantId !== userId) {
        io.to(`user:${participantId}`).emit("typing:update", {
          conversationId: payload.conversationId,
          userId,
          isTyping,
        });
      }
    }
  };

  socket.on("typing:start", (payload: TypingPayload) => {
    void publishTyping(payload, true).catch(() => undefined);
  });
  socket.on("typing:stop", (payload: TypingPayload) => {
    void publishTyping(payload, false).catch(() => undefined);
  });
}
