import { prisma } from "../lib/prisma";
export class FriendRepository {
  create(senderId: string, receiverId: string) {
    return prisma.friend.create({
      data: {
        senderId,
        receiverId,
      },
    });
  }
  find(senderId: string, receiverId: string) {
    return prisma.friend.findFirst({
      where: {
        OR: [
          {
            senderId,
            receiverId,
          },
          {
            senderId: receiverId,
            receiverId: senderId,
          },
        ],
      },
    });
  }
  update(id: string, status: "ACCEPTED" | "REJECTED") {
    return prisma.friend.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });
  }
  remove(id: string) {
    return prisma.friend.delete({
      where: {
        id,
      },
    });
  }
  list(userId: string) {
    return prisma.friend.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          {
            senderId: userId,
          },
          {
            receiverId: userId,
          },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }
  pending(userId: string) {
    return prisma.friend.findMany({
      where: {
        receiverId: userId,
        status: "PENDING",
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }
}
