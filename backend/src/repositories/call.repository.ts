import { prisma } from "../lib/prisma";

const callInclude = {
  conversation: {
    select: {
      id: true,
      type: true,
      title: true,
      groupAvatarUrl: true,
    },
  },
  caller: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
    },
  },
  receiver: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
    },
  },
  participants: {
    select: {
      userId: true,
      joinedAt: true,
      leftAt: true,
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  },
} as const;

export class CallRepository {
  create(input: {
    conversationId: string;
    callerId: string;
    receiverId: string;
    participantIds: string[];
    type: "VOICE" | "VIDEO";
  }) {
    return prisma.call.create({
      data: {
        conversationId: input.conversationId,
        callerId: input.callerId,
        receiverId: input.receiverId,
        type: input.type,
        participants: {
          create: input.participantIds.map((userId) => ({
            userId,
            joinedAt: userId === input.callerId ? new Date() : undefined,
          })),
        },
      },
      include: callInclude,
    });
  }

  findForUser(id: string, userId: string) {
    return prisma.call.findFirst({
      where: {
        id,
        participants: {
          some: {
            userId,
            leftAt: null,
          },
        },
      },
      include: callInclude,
    });
  }

  findActiveForUsers(userIds: string[]) {
    return prisma.call.findFirst({
      where: {
        status: {
          in: ["RINGING", "ACCEPTED"],
        },
        participants: {
          some: {
            userId: {
              in: userIds,
            },
            leftAt: null,
          },
        },
      },
      include: callInclude,
    });
  }

  activeForUser(userId: string) {
    return prisma.call.findFirst({
      where: {
        status: {
          in: ["RINGING", "ACCEPTED"],
        },
        participants: {
          some: {
            userId,
          },
        },
      },
      include: callInclude,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  accept(id: string, userId: string) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.callParticipant.update({
        where: {
          callId_userId: {
            callId: id,
            userId,
          },
        },
        data: {
          joinedAt: now,
          leftAt: null,
        },
      });
      const current = await tx.call.findUniqueOrThrow({
        where: {
          id,
        },
      });
      return tx.call.update({
        where: {
          id,
        },
        data: {
          status: "ACCEPTED",
          startedAt: current.startedAt ?? now,
        },
        include: callInclude,
      });
    });
  }

  leave(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.callParticipant.update({
        where: {
          callId_userId: {
            callId: id,
            userId,
          },
        },
        data: {
          leftAt: new Date(),
        },
      });
      return tx.call.findUniqueOrThrow({
        where: {
          id,
        },
        include: callInclude,
      });
    });
  }

  finish(id: string, status: "REJECTED" | "CANCELLED" | "ENDED" | "MISSED") {
    return prisma.$transaction(async (tx) => {
      const current = await tx.call.findUniqueOrThrow({
        where: {
          id,
        },
      });
      const endedAt = new Date();
      const duration = current.startedAt
        ? Math.max(
          0,
          Math.floor(
            (endedAt.getTime() - current.startedAt.getTime()) / 1000,
          ),
        )
        : 0;
      await tx.callParticipant.updateMany({
        where: {
          callId: id,
          leftAt: null,
        },
        data: {
          leftAt: endedAt,
        },
      });
      return tx.call.update({
        where: {
          id,
        },
        data: {
          status,
          endedAt,
          duration,
        },
        include: callInclude,
      });
    });
  }

  history(userId: string) {
    return prisma.call.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      include: callInclude,
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });
  }
}
