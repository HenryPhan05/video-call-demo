import type { Server, Socket } from 'socket.io';
import { redis } from '../lib/redis';
import { UserRepository } from '../repositories/user.repository';

const users = new UserRepository();
const PRESENCE_TTL = 24 * 60 * 60;

export function registerPresenceSocket(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;
  const socketsKey = `presence:${userId}:sockets`;

  void (async () => {
    await redis.sadd(socketsKey, socket.id);
    await redis.expire(socketsKey, PRESENCE_TTL);
    await redis.set(`socket:${socket.id}:user`, userId, 'EX', PRESENCE_TTL);
    io.emit('presence:update', { userId, status: 'online', lastSeenAt: null });
  })().catch(() => undefined);

  socket.on('disconnect', () => {
    void (async () => {
      await redis.srem(socketsKey, socket.id);
      await redis.del(`socket:${socket.id}:user`);
      const deviceCount = await redis.scard(socketsKey);
      if (deviceCount === 0) {
        const lastSeenAt = new Date();
        await users.updateLastSeen(userId, lastSeenAt);
        io.emit('presence:update', { userId, status: 'offline', lastSeenAt });
      }
    })().catch(() => undefined);
  });
}
