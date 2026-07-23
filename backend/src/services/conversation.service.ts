import { ConversationRepository } from "../repositories/conversation.repository";
import { AppError } from "../utils/app-error";
const conversations = new ConversationRepository();
export class ConversationService {
  async list(userId: string) {
    const items = await conversations.listForUser(userId);
    return items
      .filter((item) => item.participants.length > 1)
      .map((item) => {
        const member = item.participants.find(
          (participant) => participant.userId === userId,
        );
        const other = item.participants.find(
          (participant) => participant.userId !== userId,
        )?.user;
        const latest = item.messages[0] ?? null;
        const last =
          latest &&
          (!member?.clearedAt || latest.createdAt > member.clearedAt)
            ? latest
            : null;
        return {
          ...item,
          title: item.title ?? other?.name ?? "Conversation",
          avatarUrl: other?.avatarUrl ?? null,
          otherUserId: other?.id ?? null,
          lastSeenAt: other?.lastSeenAt ?? null,
          unreadCount: member?.unreadCount ?? 0,
          lastMessage: last
            ? {
              ...last,
              text: last.body ?? "",
            }
            : null,
        };
      });
  }
  async createDirect(userId: string, targetUserId: string) {
    if (userId === targetUserId)
      throw new AppError("You cannot start a conversation with yourself.", 400);
    const existing = await conversations.findDirectBetween(
      userId,
      targetUserId,
    );
    if (existing) {
      await conversations.restoreForUser(existing.id, userId);
      return existing;
    }
    return conversations.createDirect([userId, targetUserId]);
  }
  async assertMember(id: string, userId: string) {
    const c = await conversations.findMember(id, userId);
    if (!c) throw new AppError("Conversation not found.", 404);
    return c;
  }
  async setReadState(id: string, userId: string, unread: boolean) {
    await this.assertMember(id, userId);
    const member = await conversations.setReadState(id, userId, unread);
    return {
      conversationId: id,
      unreadCount: member.unreadCount,
    };
  }
  async archive(id: string, userId: string) {
    await this.assertMember(id, userId);
    await conversations.archiveForUser(id, userId);
    return {
      conversationId: id,
      archived: true,
    };
  }
  async removeForUser(id: string, userId: string) {
    await this.assertMember(id, userId);
    await conversations.deleteForUser(id, userId);
    return {
      conversationId: id,
      deleted: true,
    };
  }
}
