import { prisma } from "../lib/prisma";
export class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },
    });
  }
  findById(id: string) {
    return prisma.user.findUnique({
      where: {
        id,
      },
    });
  }
  create(input: {
 name: string;
 email: string;
 passwordHash: string
}) {
    return prisma.user.create({
      data: input,
    });
  }
  updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: {
        id,
      },
      data: {
        passwordHash,
      },
    });
  }
  updateProfile(
    id: string,
    data: {
      name: string;
      privacy?: object;
    },
  ) {
    return prisma.user.update({
      where: {
        id,
      },
      data: {
        name: data.name,
        privacy: data.privacy,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  updateAvatar(
    id: string,
    data: {
      avatarUrl: string;
      avatarMimeType: string;
      avatarSize: number;
    },
  ) {
    return prisma.user.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  updateLastSeen(id: string, lastSeenAt: Date) {
    return prisma.user.update({
      where: {
        id,
      },
      data: {
        lastSeenAt,
      },
      select: {
        id: true,
        lastSeenAt: true,
      },
    });
  }
  block(blockerId: string, blockedId: string) {
    return prisma.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
      create: {
        blockerId,
        blockedId,
      },
      update: {},
    });
  }
  unblock(blockerId: string, blockedId: string) {
    return prisma.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });
  }
  search(query: string) {
    return prisma.user.findMany({
      where: {
        name: {
          contains: query,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        lastSeenAt: true,
      },
      take: 20,
    });
  }
}
