import IORedis from "ioredis";

export function createRedisConnection(redisUrl: string) {
  return new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}
