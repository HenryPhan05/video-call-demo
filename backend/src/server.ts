import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { app } from "./app";
import { env } from "./config/env";
import { tokenCookieName, verifyAccessToken } from "./utils/token";
import { registerChatSocket } from "./socket/chat.socket";
import { registerCallSocket } from "./socket/call.socket";
import { registerPresenceSocket } from "./socket/presence.socket";
import { connectRedis, disconnectRedis, redis } from "./lib/redis";

async function bootstrap() {
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin,
      credentials: true,
    },
  });
  app.set("io", io);

  try {
    await connectRedis();
    const subscriber = redis.duplicate();
    subscriber.on("error", () => undefined);
    if (subscriber.status === "wait") await subscriber.connect();
    io.adapter(createAdapter(redis, subscriber));
  } catch (error) {
    disconnectRedis();
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `[redis] unavailable (${reason}); continuing with a single Socket.IO node.`,
    );
  }

  io.use((socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie ?? "";
      const token = cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${tokenCookieName}=`))
        ?.slice(tokenCookieName.length + 1);
      socket.data.userId = verifyAccessToken(
        decodeURIComponent(token ?? ""),
      ).sub;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId as string}`);
    registerPresenceSocket(io, socket);
    registerChatSocket(io, socket);
    registerCallSocket(io, socket);
  });

  httpServer.listen(env.port, () =>
    console.info(`API listening at http://localhost:${env.port}`),
  );
}

void bootstrap();
