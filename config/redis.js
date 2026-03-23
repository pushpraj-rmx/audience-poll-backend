const { createClient } = require("redis");
const dotenv = require("dotenv");

dotenv.config();

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error("Redis retry attempts exhausted");
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redis.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

redis.on("ready", () => {
  console.log("🚀 Redis is ready");
});

async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}

process.on("SIGINT", async () => {
  if (redis.isOpen) {
    await redis.quit();
    console.log("🔴 Redis connection closed");
  }
  process.exit(0);
});

module.exports = { redis, connectRedis };