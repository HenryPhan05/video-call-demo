import { prisma } from "../lib/prisma";

const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  findByUsername(username: string) {
    return prisma.user.findUnique({
      where: {
        username,
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

  findPresenceByIds(ids: string[]) {
    return prisma.user.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        lastSeenAt: true,
      },
    });
  }

  findExistingIds(ids: string[]) {
    return prisma.user.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
      },
    });
  }

  create(input: {
    firstName: string;
    lastName?: string;
    username: string;
    email: string;
    passwordHash: string;
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
      firstName?: string;
      lastName?: string | null;
      username?: string;
      privacy?: object;
    },
  ) {
    return prisma.user.update({
      where: {
        id,
      },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        privacy: data.privacy,
      },
      select: publicUserSelect,
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
      select: publicUserSelect,
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

  findPublicByUsername(username: string) {
    return prisma.user.findUnique({
      where: {
        username,
      },
      select: publicUserSelect,
    });
  }
}
