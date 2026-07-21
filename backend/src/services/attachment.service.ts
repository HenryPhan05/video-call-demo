import { AttachmentRepository } from '../repositories/attachment.repository';
import { ConversationService } from './conversation.service';
import { AppError } from '../utils/app-error';

const attachments = new AttachmentRepository();
const conversations = new ConversationService();

function attachmentType(mimeType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'ARCHIVE' {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType.includes('zip')) return 'ARCHIVE';
  return 'DOCUMENT';
}

export class AttachmentService {
  async upload(conversationId: string, userId: string, file?: Express.Multer.File, durationValue?: unknown) {
    await conversations.assertMember(conversationId, userId);
    if (!file) throw new AppError('A supported file is required.', 400);
    const type = attachmentType(file.mimetype);
    const parsedDuration = Number(durationValue);
    const duration = type === 'AUDIO' && Number.isFinite(parsedDuration) && parsedDuration > 0
      ? Math.min(Math.round(parsedDuration), 86_400)
      : undefined;
    return attachments.create({
      uploaderId: userId,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      type,
      duration,
      url: `/api/v1/attachments/${file.filename}`,
    });
  }

  async download(storedName: string, userId: string) {
    const file = await attachments.findByStoredName(storedName);
    if (!file?.message) throw new AppError('Attachment not found.', 404);
    await conversations.assertMember(file.message.conversationId, userId);
    return file;
  }
}
