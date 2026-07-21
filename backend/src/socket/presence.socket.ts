import type { Server, Socket } from "socket.io";
import { isRedisAvailable, redis } from "../lib/redis";
import { UserRepository } from "../repositories/user.repository";

const users = new UserRepository();
const PRESENCE_TTL = 24 * 60 * 60;

export function registerPresenceSocket(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;
  const socketsKey = `presence:${userId}:sockets`;
  const userRoom = `user:${userId}`;

  io.emit("presence:update", {
    userId,
    status: "online",
    lastSeenAt: null,
  });

  if (isRedisAvailable()) {
    void (async () => {
      await redis.sadd(socketsKey, socket.id);
      await redis.expire(socketsKey, PRESENCE_TTL);
      await redis.set(`socket:${socket.id}:user`, userId, "EX", PRESENCE_TTL);
    })().catch(() => undefined);
  }

  socket.on("disconnect", () => {
    void (async () => {
      let hasActiveSocket: boolean;

      if (isRedisAvailable()) {
        try {
          await redis.srem(socketsKey, socket.id);
          await redis.del(`socket:${socket.id}:user`);
          hasActiveSocket = (await redis.scard(socketsKey)) > 0;
        } catch {
          hasActiveSocket = (await io.in(userRoom).fetchSockets()).length > 0;
        }
      } else {
        hasActiveSocket = (await io.in(userRoom).fetchSockets()).length > 0;
      }

      if (!hasActiveSocket) {
        const lastSeenAt = new Date();
        await users.updateLastSeen(userId, lastSeenAt);
        io.emit("presence:update", {
          userId,
          status: "offline",
          lastSeenAt,
        });
      }
    })().catch(() => undefined);
  });
}
