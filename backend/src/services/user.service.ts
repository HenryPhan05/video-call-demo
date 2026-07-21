import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/app-error';

const users = new UserRepository();

export class UserService {
  async me(id: string) {
    const user = await users.findById(id);
    if (!user) throw new AppError('User not found.', 404);
    const { passwordHash, ...safe } = user;
    return safe;
  }

  search(query: string) {
    return users.search(query);
  }

  update(id: string, input: { name: string; privacy?: object }) {
    return users.updateProfile(id, input);
  }

  avatar(id: string, file?: Express.Multer.File) {
    if (!file) throw new AppError('Choose a JPG, PNG, or WebP image up to 5 MB.', 400);
    return users.updateAvatar(id, {
      avatarUrl: `/uploads/avatars/${file.filename}`,
      avatarMimeType: file.mimetype,
      avatarSize: file.size,
    });
  }

  block(id: string, target: string) {
    if (id === target) throw new AppError('You cannot block yourself.', 400);
    return users.block(id, target);
  }

  unblock(id: string, target: string) {
    return users.unblock(id, target);
  }
}
