/**
 * PM2 Ecosystem Config
 *
 * Single instance (simple):
 *   pm2 start ecosystem.config.js
 *
 * Check status:
 *   pm2 status
 *   pm2 logs audience-api
 *   pm2 logs audience-worker
 *   pm2 save   ← reboot ke baad auto-start ke liye
 *
 * NOTE: Worker sirf instances:1 rakho — multiple workers = same queue job double process
 */

module.exports = {
  apps: [
    // ─── API Server (4 instances = 4 cores use) ───────────────────────────────
    {
      name: "audience-api",
      script: "server.js",
      instances: 4,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        // PORT is intentionally NOT set here.
        // Caddy config below uses 5501–5504.
        // PM2 cluster mode auto-assigns ports when PORT env is set per instance.
        // If you want explicit ports, set PORT in each instance override (see below).
      },
      // Per-instance port override (uncomment if Caddy needs explicit ports):
      // instance_var: "INSTANCE_ID",
      // env_0: { PORT: 5501 },
      // env_1: { PORT: 5502 },
      // env_2: { PORT: 5503 },
      // env_3: { PORT: 5504 },
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_memory_restart: "512M",
      watch: false,
      autorestart: true,
      restart_delay: 1000,
    },

    // ─── QR Scan Worker (sirf 1 instance) ────────────────────────────────────
    {
      name: "audience-worker",
      script: "workers/qrWorker.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_memory_restart: "256M",
      watch: false,
      autorestart: true,
      restart_delay: 2000,
    },
  ],
};
