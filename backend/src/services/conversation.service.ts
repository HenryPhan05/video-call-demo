import { ConversationRepository } from "../repositories/conversation.repository";
import { UserRepository } from "../repositories/user.repository";
import { AppError } from "../utils/app-error";
const conversations = new ConversationRepository();
const users = new UserRepository();

type ConversationRecord = NonNullable<
  Awaited<ReturnType<ConversationRepository["findForUser"]>>
>;

export class ConversationService {
  private present(item: ConversationRecord, userId: string) {
    const member = item.participants.find(
      (participant) => participant.userId === userId,
    );
    const other = item.participants.find(
      (participant) => participant.userId !== userId,
    )?.user;
    const latest = item.messages[0] ?? null;
    const last =
      latest && (!member?.clearedAt || latest.createdAt > member.clearedAt)
        ? latest
        : null;
    const group = item.type === "GROUP";

    return {
      ...item,
      title: group ? item.title ?? "Group chat" : item.title ?? other?.name ?? "Conversation",
      avatarUrl: group ? item.groupAvatarUrl : other?.avatarUrl ?? null,
      otherUserId: group ? null : other?.id ?? null,
      lastSeenAt: group ? null : other?.lastSeenAt ?? null,
      memberCount: item.participants.length,
      memberIds: item.participants.map((participant) => participant.userId),
      members: item.participants.map((participant) => ({
        id: participant.user.id,
        username: participant.user.username,
        name: participant.user.name,
        avatarUrl: participant.user.avatarUrl,
      })),
      currentUserRole: member?.role ?? "MEMBER",
      unreadCount: member?.unreadCount ?? 0,
      lastMessage: last
        ? {
            ...last,
            text: last.body ?? "",
          }
        : null,
    };
  }

  async list(userId: string) {
    const items = await conversations.listForUser(userId);
    return items
      .filter((item) => item.participants.length > 1)
      .map((item) => this.present(item, userId));
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
  async createGroup(userId: string, title: string, requestedIds: string[]) {
    const memberIds = [
      ...new Set(requestedIds.filter((candidate) => candidate !== userId)),
    ];
    if (memberIds.length < 2)
      throw new AppError("Choose at least two other users for a group.", 400);

    const existing = await users.findExistingIds(memberIds);
    if (existing.length !== memberIds.length)
      throw new AppError("One or more selected users no longer exist.", 404);

    const created = await conversations.createGroup(
      userId,
      title.trim(),
      memberIds,
    );
    const group = await conversations.findForUser(created.id, userId);
    if (!group) throw new AppError("Unable to load the new group.", 500);
    return this.present(group, userId);
  }
  async addMembers(
    id: string,
    userId: string,
    requestedIds: string[],
  ) {
    const conversation = await conversations.findForUser(id, userId);
    if (!conversation) throw new AppError("Conversation not found.", 404);
    if (conversation.type !== "GROUP")
      throw new AppError(
        "Add members to a new group instead of exposing a private chat.",
        400,
      );

    const existingIds = new Set(
      conversation.participants.map((participant) => participant.userId),
    );
    const memberIds = [
      ...new Set(
        requestedIds.filter(
          (candidate) => candidate !== userId && !existingIds.has(candidate),
        ),
      ),
    ];
    if (!memberIds.length)
      throw new AppError("Every selected user is already in this group.", 409);

    const existing = await users.findExistingIds(memberIds);
    if (existing.length !== memberIds.length)
      throw new AppError("One or more selected users no longer exist.", 404);

    await conversations.addMembers(id, memberIds);
    const updated = await conversations.findForUser(id, userId);
    if (!updated) throw new AppError("Unable to load the updated group.", 500);
    return this.present(updated, userId);
  }
  async updateGroupAvatar(
    id: string,
    userId: string,
    file?: Express.Multer.File,
  ) {
    await this.assertGroupOwner(id, userId);
    if (!file)
      throw new AppError("Choose a JPG, PNG, or WebP image.", 400);

    await conversations.updateGroupAvatar(
      id,
      `/uploads/avatars/${file.filename}`,
    );
    const updated = await conversations.findForUser(id, userId);
    if (!updated) throw new AppError("Unable to load the updated group.", 500);
    return this.present(updated, userId);
  }
  async assertGroupOwner(id: string, userId: string) {
    const conversation = await conversations.findForUser(id, userId);
    if (!conversation) throw new AppError("Conversation not found.", 404);
    if (conversation.type !== "GROUP")
      throw new AppError("Only groups can have a group avatar.", 400);

    const membership = conversation.participants.find(
      (participant) => participant.userId === userId,
    );
    if (membership?.role !== "OWNER")
      throw new AppError("Only the group owner can change its avatar.", 403);
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
