import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (times) => (times > 2 ? null : Math.min(times * 500, 2000)),
});

redis.on("error", () => {});

export default redis;
