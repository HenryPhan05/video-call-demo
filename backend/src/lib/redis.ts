import Redis from 'ioredis';
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1 });
export async function connectRedis() { if (redis.status === 'wait') await redis.connect(); }
