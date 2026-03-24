const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/db');
const path = require('path');
const { io, app, server } = require('./config/socket');
const { connectRedis } = require('./config/redis');

//env configuration
dotenv.config();

// If behind nginx / proxy, trust X-Forwarded-* headers (also helps fingerprint uniqueness)
app.set("trust proxy", 1);

// Instance tag for structured logs (visible in PM2 multi-instance logs)
const INST = `[PID:${process.pid}]`;

//Routes
const authRouter = require("./routes/auth.routes");
const userRouter = require("./routes/user.routes");
const contestRouter = require("./routes/contest.routes");
const seasonRouter = require("./routes/season.routes");
const participantRouter = require("./routes/participant.routes");
const qrScanRouter = require('./routes/qrScan.routes');
const voteRouter = require('./routes/vote.routes');
const superAdminRouter = require('./routes/superAdmin.routes');
const adminRouter = require('./routes/admin.routes');
const sponsorRouter = require('./routes/sponsor.routes');
const judgeRouter = require('./routes/judge.routes');
const analyticsRouter = require('./routes/analytics.routes');
const voterInfoRouter = require('./routes/voterInfo.routes');
const qrRouter = require('./routes/qr.routes');

const PORT = process.env.PORT || 5000;

// Middlewares
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3305",
  "http://localhost:5173",
  "http://f.urmap.space",
  "https://f.urmap.space",
  "http://s.urmap.space",
  "https://s.urmap.space",
  "https://audiencevotes.com",
  "https://backend.audiencevotes.com"
]);

app.use(
  cors({
    origin(origin, callback) {
      // allow non-browser tools (no Origin header)
      if (!origin) return callback(null, true);

      // allow any localhost port for dev
      if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);

      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.options("*", cors());
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan('dev'));
app.use(express.json());
// app.set("trust proxy", true);
app.use(cookieParser());

// Serve static files from uploads directory with CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));


// Database + Redis Initialization
(async () => {
  try {
    await connectDB();
    await connectRedis(); // ✅ Connect Redis only once here

    console.log(`${INST} ✅ All core services connected`);

    // Store io globally so controllers can use it
    app.set("io", io);

    // Default Route
    app.get("/", (req, res) => {
      res.send("Hello Audience from Backend");
    });

    // Health check — used by Caddy (and monitoring) to verify instance is alive
    app.get("/api/health", (req, res) => {
      res.json({ ok: true, pid: process.pid, ts: Date.now() });
    });

    // Routes
    app.use('/api/auth', authRouter);
    app.use('/api/users', userRouter);
    app.use('/api/superAdmin', superAdminRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/sponsor', sponsorRouter);
    app.use('/api/judge', judgeRouter);
    app.use('/api/contests', contestRouter);
    app.use('/api/seasons', seasonRouter);
    app.use('/api/participants', participantRouter);
    app.use('/api/qr-scan', qrScanRouter);
    app.use('/api/qr', qrRouter);
    app.use('/api/votes', voteRouter);
    app.use('/api/voterInfo', voterInfoRouter);
    app.use('/api/analytics', analyticsRouter);

    // Start Server
    server.listen(PORT, () => {
      console.log(`${INST} 🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error(`[PID:${process.pid}] ❌ Failed to start server:`, err);
    process.exit(1);
  }
})();
