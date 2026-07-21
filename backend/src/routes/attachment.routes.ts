import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth';
import { attachmentUpload } from '../middleware/upload';
import { asyncHandler } from '../utils/async-handler';
import * as controller from '../controllers/attachment.controller';

export const attachmentRouter = Router();
attachmentRouter.use(requireAuth);
attachmentRouter.post('/conversations/:conversationId/attachments', attachmentUpload, asyncHandler(controller.upload));
attachmentRouter.get('/attachments/:storedName', asyncHandler(controller.view));
attachmentRouter.get('/attachments/:storedName/download', asyncHandler(controller.download));
