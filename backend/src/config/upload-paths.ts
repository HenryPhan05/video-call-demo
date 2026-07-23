import { mkdirSync } from "node:fs";
import path from "node:path";

export const uploadsDirectory = path.resolve(__dirname, "../../uploads");
export const avatarUploadDirectory = path.join(uploadsDirectory, "avatars");
export const attachmentUploadDirectory = path.join(
  uploadsDirectory,
  "attachments",
);

mkdirSync(avatarUploadDirectory, {
  recursive: true,
});
mkdirSync(attachmentUploadDirectory, {
  recursive: true,
});
