import { prisma } from "../lib/prisma";

const conversationInclude = {
  participants: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
          lastSeenAt: true,
        },
      },
    },
  },
  messages: {
    orderBy: {
      createdAt: "desc" as const,
    },
    take: 1,
  },
} as const;

export class ConversationRepository {
  listForUser(userId: string) {
    return prisma.conversation.findMany({
      where: {
        deletedAt: null,
        participants: {
          some: {
            userId,
            archivedAt: null,
            deletedAt: null,
          },
        },
      },
      include: conversationInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });
  }
  findForUser(id: string, userId: string) {
    return prisma.conversation.findFirst({
      where: {
        id,
        deletedAt: null,
        participants: {
          some: {
            userId,
            deletedAt: null,
          },
        },
      },
      include: conversationInclude,
    });
  }
  findMember(id: string, userId: string) {
    return prisma.participant.findFirst({
      where: {
        conversationId: id,
        userId,
        deletedAt: null,
        conversation: {
          deletedAt: null,
        },
      },
    });
  }
  async participantIds(id: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        participants: {
          some: {
            userId,
          },
        },
      },
      select: {
        participants: {
          select: {
            userId: true,
          },
        },
      },
    });
    return (
      conversation?.participants.map((participant) => participant.userId) ??
      null
    );
  }
  async sharedParticipantIds(userId: string, candidateIds: string[]) {
    if (!candidateIds.length) return [];
    const shared = await prisma.conversation.findMany({
      where: {
        deletedAt: null,
        participants: {
          some: {
            userId,
          },
        },
        AND: {
          participants: {
            some: {
              userId: {
                in: candidateIds,
              },
            },
          },
        },
      },
      select: {
        participants: {
          where: {
            userId: {
              in: candidateIds,
            },
          },
          select: {
            userId: true,
          },
        },
      },
    });
    return [
      ...new Set(
        shared.flatMap((conversation) =>
          conversation.participants.map((participant) => participant.userId),
        ),
      ),
    ];
  }
  createDirect(userIds: string[], title?: string) {
    return prisma.conversation.create({
      data: {
        type: "DIRECT",
        title,
        participants: {
          create: userIds.map((userId) => ({
            userId,
          })),
        },
      },
    });
  }
  createGroup(ownerId: string, title: string, memberIds: string[]) {
    return prisma.conversation.create({
      data: {
        type: "GROUP",
        title,
        participants: {
          create: [
            {
              userId: ownerId,
              role: "OWNER",
            },
            ...memberIds.map((userId) => ({
              userId,
              role: "MEMBER" as const,
            })),
          ],
        },
      },
      select: {
        id: true,
      },
    });
  }
  addMembers(conversationId: string, userIds: string[]) {
    return prisma.$transaction(
      userIds.map((userId) =>
        prisma.participant.upsert({
          where: {
            conversationId_userId: {
              conversationId,
              userId,
            },
          },
          create: {
            conversationId,
            userId,
            role: "MEMBER",
          },
          update: {
            archivedAt: null,
            deletedAt: null,
            clearedAt: null,
          },
        }),
      ),
    );
  }
  updateGroupAvatar(conversationId: string, groupAvatarUrl: string) {
    return prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        groupAvatarUrl,
      },
    });
  }
  restoreForUser(conversationId: string, userId: string) {
    return prisma.participant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        archivedAt: null,
        deletedAt: null,
      },
    });
  }
  setReadState(conversationId: string, userId: string, unread: boolean) {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      if (!unread) {
        await tx.messageReceipt.updateMany({
          where: {
            userId,
            seenAt: null,
            message: {
              conversationId,
              deletedAt: null,
            },
          },
          data: {
            deliveredAt: now,
            seenAt: now,
          },
        });
      }
      return tx.participant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: unread
          ? {
              unreadCount: 1,
            }
          : {
              unreadCount: 0,
              lastReadAt: now,
            },
      });
    });
  }
  archiveForUser(conversationId: string, userId: string) {
    return prisma.participant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        archivedAt: new Date(),
      },
    });
  }
  deleteForUser(conversationId: string, userId: string) {
    const now = new Date();
    return prisma.participant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        archivedAt: null,
        deletedAt: now,
        clearedAt: now,
        unreadCount: 0,
      },
    });
  }
  findDirectBetween(firstUserId: string, secondUserId: string) {
    return prisma.conversation.findFirst({
      where: {
        type: "DIRECT",
        AND: [
          {
            participants: {
              some: {
                userId: firstUserId,
              },
            },
          },
          {
            participants: {
              some: {
                userId: secondUserId,
              },
            },
          },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });
  }
}
