import { prisma } from "../lib/prisma";

const callInclude = {
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
    },
  },
} as const;

export class CallRepository {
  create(input: {
    conversationId: string;
    callerId: string;
    receiverId: string;
    type: "VOICE" | "VIDEO";
  }) {
    return prisma.call.create({
      data: {
        ...input,
        participants: {
          create: [
            {
              userId: input.callerId,
              joinedAt: new Date(),
            },
            {
              userId: input.receiverId,
            },
          ],
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
        OR: [
          {
            callerId: {
              in: userIds,
            },
          },
          {
            receiverId: {
              in: userIds,
            },
          },
        ],
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

  accept(id: string, receiverId: string) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.callParticipant.update({
        where: {
          callId_userId: {
            callId: id,
            userId: receiverId,
          },
        },
        data: {
          joinedAt: now,
        },
      });
      return tx.call.update({
        where: {
          id,
        },
        data: {
          status: "ACCEPTED",
          startedAt: now,
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
