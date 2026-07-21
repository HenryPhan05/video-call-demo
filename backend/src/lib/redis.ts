import Redis from "ioredis";

let available = false;

export const redis = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    connectTimeout: 2_000,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  },
);

// ioredis emits an `error` event while attempting to reconnect. The server
// reports the startup failure once and deliberately falls back to one node.
redis.on("error", () => undefined);
redis.on("ready", () => {
  available = true;
});
redis.on("end", () => {
  available = false;
});

export async function connectRedis() {
  let timeout: NodeJS.Timeout | undefined;
  try {
    if (redis.status === "wait") {
      const connection = redis.connect();
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Redis connection timed out.")),
          2_500,
        );
      });
      await Promise.race([connection, deadline]);
    }
    available = redis.status === "ready";
  } catch (error) {
    available = false;
    redis.disconnect(false);
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function disconnectRedis() {
  available = false;
  redis.disconnect(false);
}

export function isRedisAvailable() {
  return available && redis.status === "ready";
}
