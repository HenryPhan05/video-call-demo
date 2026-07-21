import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { AppError } from "../utils/app-error";
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowed = new Set([
  ...imageTypes,
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "audio/mpeg",
  "audio/webm",
  "audio/wav",
  "audio/ogg",
]);
export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: "uploads/avatars",
    filename: (_req, file, cb) =>
      cb(
        null,
        `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
      ),
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => cb(null, imageTypes.has(file.mimetype)),
}).single("avatar");
export const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: "uploads/attachments",
    filename: (_req, file, cb) =>
      cb(
        null,
        `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
      ),
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => cb(null, allowed.has(file.mimetype)),
}).single("file");
