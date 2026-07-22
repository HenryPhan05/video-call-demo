import { prisma } from "../lib/prisma";
export class PasswordResetRepository {
  replaceCode(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });
      return tx.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
    });
  }

  latestForUser(userId: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        userId,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  recordFailedAttempt(id: string, invalidate: boolean) {
    return prisma.passwordResetToken.update({
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
    return prisma.passwordResetToken.update({
      where: {
        id,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  consumeAndUpdatePassword(
    id: string,
    userId: string,
    passwordHash: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id,
          userId,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          usedAt: new Date(),
        },
      });
      if (consumed.count !== 1) return false;
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          passwordHash,
        },
      });
      return true;
    });
  }
}
