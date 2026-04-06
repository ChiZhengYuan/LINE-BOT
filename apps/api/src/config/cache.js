import { createClient } from "redis";
import { env } from "./env.js";

class MemoryCache {
  constructor() {
    this.map = new Map();
  }

  async connect() {}

  async incr(key, ttlSeconds) {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.map.set(key, { value: 1, expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    entry.value += 1;
    this.map.set(key, entry);
    return entry.value;
  }

  async del(key) {
    this.map.delete(key);
  }
}

let client = null;

export async function getCacheClient() {
  if (client) {
    return client;
  }

  if (!env.redisUrl) {
    client = new MemoryCache();
    return client;
  }

  const redis = createClient({ url: env.redisUrl });
  redis.on("error", (error) => {
    console.warn("Redis error:", error.message);
  });

  try {
    await redis.connect();
    client = {
      async connect() {},
      async incr(key, ttlSeconds) {
        const value = await redis.incr(key);
        if (value === 1) {
          await redis.expire(key, ttlSeconds);
        }
        return value;
      },
      async del(key) {
        await redis.del(key);
      }
    };
    return client;
  } catch (error) {
    console.warn("Redis unavailable, falling back to in-memory cache:", error.message);
    client = new MemoryCache();
    return client;
  }
}
