import path from 'node:path';
import type { RequestHandler } from 'express';
import { AttachmentService } from '../services/attachment.service';
import { ok } from '../utils/api-response';

const service = new AttachmentService();
const attachmentPath = (storedName: string) => path.resolve('uploads/attachments', storedName);

export const upload: RequestHandler = async (req, res) => {
  return ok(res, await service.upload(String(req.params.conversationId), req.userId!, req.file, req.body.duration), 'File uploaded.', 201);
};

export const view: RequestHandler = async (req, res) => {
  const file = await service.download(String(req.params.storedName), req.userId!);
  res.type(file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
  res.sendFile(attachmentPath(file.storedName));
};

export const download: RequestHandler = async (req, res) => {
  const file = await service.download(String(req.params.storedName), req.userId!);
  res.download(attachmentPath(file.storedName), file.originalName);
};
