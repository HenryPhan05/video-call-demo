import { prisma } from '../lib/prisma';
export class ConversationRepository {
  listForUser(userId: string) { return prisma.conversation.findMany({ where: { participants: { some: { userId } } }, include: { participants: { include: { user: { select: { id:true,name:true,avatarUrl:true } } } }, messages: { orderBy: { createdAt:'desc' }, take:1 } }, orderBy: { updatedAt:'desc' } }); }
  findMember(id: string, userId: string) { return prisma.conversation.findFirst({ where: { id, participants: { some: { userId } } } }); }
  async participantIds(id: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id, participants: { some: { userId } } },
      select: { participants: { select: { userId: true } } },
    });
    return conversation?.participants.map((participant) => participant.userId) ?? null;
  }
  createDirect(userIds: string[], title?: string) { return prisma.conversation.create({ data: { type:'DIRECT', title, participants: { create: userIds.map((userId) => ({ userId })) } } }); }
  findDirectBetween(firstUserId: string, secondUserId: string) {
    return prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId: firstUserId } } },
          { participants: { some: { userId: secondUserId } } },
        ],
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }
}
