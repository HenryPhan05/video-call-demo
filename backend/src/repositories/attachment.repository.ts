import { prisma } from "../lib/prisma";
export class AttachmentRepository {
  create(input: {
    uploaderId: string;
    originalName: string;
    storedName: string;
    mimeType: string;
    size: number;
    url: string;
    type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "ARCHIVE";
    duration?: number;
  }) {
    return prisma.attachment.create({
      data: input,
    });
  }
  findByStoredName(storedName: string) {
    return prisma.attachment.findUnique({
      where: {
        storedName,
      },
      include: {
        message: true,
      },
    });
  }
  link(messageId: string, id: string) {
    return prisma.attachment.update({
      where: {
        id,
      },
      data: {
        messageId,
      },
    });
  }
}
