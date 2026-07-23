import { prisma } from "../lib/prisma";

const messageInclude = {
  sender: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
    },
  },
  attachments: true,
  reactions: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  receipts: true,
  replyTo: {
    select: {
      id: true,
      body: true,
      sender: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  conversation: {
    select: {
      participants: {
        select: {
          userId: true,
        },
      },
    },
  },
} as const;

export class MessageRepository {
  list(conversationId: string, after?: Date | null) {
    return prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(after
          ? {
              createdAt: {
                gt: after,
              },
            }
          : {}),
      },
      include: messageInclude,
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  findInConversation(messageId: string, conversationId: string) {
    return prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
        deletedAt: null,
      },
      select: {
        id: true,
        senderId: true,
      },
    });
  }

  findForMember(messageId: string, userId: string) {
    return prisma.message.findFirst({
      where: {
        id: messageId,
        deletedAt: null,
        conversation: {
          participants: {
            some: {
              userId,
            },
          },
        },
      },
      select: {
        id: true,
        senderId: true,
        conversationId: true,
      },
    });
  }

  create(input: {
    conversationId: string;
    senderId: string;
    body?: string;
    replyToId?: string;
    attachmentIds?: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const attachmentIds = [...new Set(input.attachmentIds ?? [])];
      const owned = await tx.attachment.findMany({
        where: {
          id: {
            in: attachmentIds,
          },
          uploaderId: input.senderId,
          messageId: null,
        },
        select: {
          id: true,
          type: true,
        },
      });

      if (owned.length !== attachmentIds.length) {
        throw new Error("One or more attachments are invalid or already sent.");
      }

      if (input.replyToId) {
        const reply = await tx.message.findFirst({
          where: {
            id: input.replyToId,
            conversationId: input.conversationId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });
        if (!reply)
          throw new Error("The message being replied to was not found.");
      }

      const participants = await tx.participant.findMany({
        where: {
          conversationId: input.conversationId,
        },
        select: {
          userId: true,
        },
      });

      const messageType = owned.some(
        (attachment) => attachment.type === "AUDIO",
      )
        ? "AUDIO"
        : owned.some((attachment) => attachment.type === "IMAGE")
          ? "IMAGE"
          : attachmentIds.length
            ? "FILE"
            : "TEXT";
      const created = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          body: input.body?.trim() || null,
          replyToId: input.replyToId,
          type: messageType,
          attachments: {
            connect: owned,
          },
        },
        select: {
          id: true,
        },
      });

      const recipients = participants.filter(
        ({
          userId,
        }) => userId !== input.senderId,
      );
      if (recipients.length) {
        await tx.messageReceipt.createMany({
          data: recipients.map(({
            userId,
          }) => ({
            messageId: created.id,
            userId,
            deliveredAt: new Date(),
          })),
        });
        await tx.participant.updateMany({
          where: {
            conversationId: input.conversationId,
            userId: {
              not: input.senderId,
            },
          },
          data: {
            unreadCount: {
              increment: 1,
            },
            archivedAt: null,
            deletedAt: null,
          },
        });
      }

      await tx.conversation.update({
        where: {
          id: input.conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      return tx.message.findUniqueOrThrow({
        where: {
          id: created.id,
        },
        include: messageInclude,
      });
    });
  }

  update(messageId: string, body: string) {
    return prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        body: body.trim(),
        editedAt: new Date(),
      },
      include: messageInclude,
    });
  }

  softDelete(messageId: string) {
    return prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        body: null,
        deletedAt: new Date(),
      },
      include: messageInclude,
    });
  }

  toggleReaction(messageId: string, userId: string, emoji: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.messageReaction.findFirst({
        where: {
          messageId,
          userId,
          emoji,
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        await tx.messageReaction.delete({
          where: {
            id: existing.id,
          },
        });
      } else {
        await tx.messageReaction.create({
          data: {
            messageId,
            userId,
            emoji,
          },
        });
      }

      return tx.message.findUniqueOrThrow({
        where: {
          id: messageId,
        },
        include: messageInclude,
      });
    });
  }

  async markSeen(conversationId: string, userId: string) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const result = await tx.messageReceipt.updateMany({
        where: {
          userId,
          seenAt: null,
          message: {
            conversationId,
            deletedAt: null,
          },
        },
        data: {
          seenAt: now,
          deliveredAt: now,
        },
      });

      await tx.participant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: {
          unreadCount: 0,
          lastReadAt: now,
        },
      });

      const participants = await tx.participant.findMany({
        where: {
          conversationId,
        },
        select: {
          userId: true,
        },
      });
      return {
        count: result.count,
        seenAt: now,
        participants,
      };
    });
  }
}
