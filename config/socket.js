const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const app = express();
const server = http.createServer(app);

// Instance tag shown in every log line → makes multi-process logs readable
const INST = `[PID:${process.pid}]`;

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3305",
      "https://f.urmap.space",
      "https://s.urmap.space",
    ],
    credentials: true,
  },
});

/**
 * Socket.IO Redis Adapter
 * - Single instance  : pub/sub same process  → works exactly as before
 * - Multi instance   : all processes share events via Redis pub/sub
 * - If Redis is down : adapter logs error, Socket.IO falls back to single-instance mode
 */
(async () => {
  try {
    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) =>
      console.error(`${INST} ❌ Socket.IO Redis pub error: ${err.message}`),
    );
    subClient.on("error", (err) =>
      console.error(`${INST} ❌ Socket.IO Redis sub error: ${err.message}`),
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log(`${INST} ✅ Socket.IO Redis adapter connected`);
  } catch (err) {
    console.error(
      `${INST} ⚠️  Socket.IO Redis adapter failed — running in single-instance mode: ${err.message}`,
    );
  }
})();

// 🔌 Socket connection handler
io.on("connection", (socket) => {
  console.log(`${INST} 🟢 Socket connected: ${socket.id}`);

  socket.on("join-room", (seasonId) => {
    socket.join(seasonId);
    console.log(`${INST} ✅ ${socket.id} joined room ${seasonId}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`${INST} 🔴 Socket disconnected: ${socket.id} (${reason})`);
  });
});

io.engine.on("connection_error", (err) => {
  console.error(`${INST} ❌ Socket engine error: ${err.req?.url} — ${err.message} (code: ${err.code})`);
});

module.exports = { io, app, server };
