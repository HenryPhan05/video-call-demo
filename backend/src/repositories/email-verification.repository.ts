import { prisma } from "../lib/prisma";

export class EmailVerificationRepository {
  latestForUser(userId: string) {
    return prisma.emailVerificationToken.findFirst({
      where: {
        userId,
        usedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  replaceCode(userId: string, codeHash: string, expiresAt: Date) {
    const now = new Date();
    return prisma.$transaction(async (transaction) => {
      await transaction.emailVerificationToken.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });
      return transaction.emailVerificationToken.create({
        data: {
          userId,
          codeHash,
          expiresAt,
        },
      });
    });
  }

  recordFailedAttempt(id: string, invalidate: boolean) {
    return prisma.emailVerificationToken.update({
      where: {
        id,
      },
      data: {
        attempts: {
          increment: 1,
        },
        usedAt: invalidate ? new Date() : undefined,
      },
    });
  }

  invalidate(id: string) {
    return prisma.emailVerificationToken.update({
      where: {
        id,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  markUserVerified(userId: string, tokenId: string) {
    const now = new Date();
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: {
          id: userId,
        },
        data: {
          emailVerifiedAt: now,
        },
      });
      await transaction.emailVerificationToken.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });
      await transaction.emailVerificationToken.update({
        where: {
          id: tokenId,
        },
        data: {
          usedAt: now,
        },
      });
      return user;
    });
  }
}
