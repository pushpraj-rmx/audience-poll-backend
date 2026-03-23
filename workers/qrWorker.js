// const dotenv = require("dotenv");
const { Worker } = require("bullmq");
const UAParser = require("ua-parser-js");
const bullConnection = require("../config/redisBull");
const { connectDB } = require("../config/db");
const Device = require("../models/device.model");
const QrScanLog = require("../models/QrScanLog");
const getQrScanModel = require("../utils/getQrScanModel");

const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 1000; // 1 second

let scanBuffer = [];
let scanLogBuffer = [];
let isFlushing = false;

/**
 * 🔥 Flush Scan Logs in Bulk
 */
const flushScans = async () => {
  if ((scanBuffer.length === 0 && scanLogBuffer.length === 0) || isFlushing) return;

  isFlushing = true;

  const batch = [...scanBuffer];
  scanBuffer = [];

  try {
    const QrScan = getQrScanModel();
    if (batch.length) {
      await QrScan.insertMany(batch, { ordered: false });
      console.log(`✅ Bulk inserted ${batch.length} scans (monthly)`);
    }
  } catch (err) {
    console.error("❌ Bulk insert error:", err);
  }

  const logBatch = [...scanLogBuffer];
  scanLogBuffer = [];

  try {
    if (logBatch.length) {
      await QrScanLog.insertMany(logBatch, { ordered: false });
      console.log(`✅ Bulk inserted ${logBatch.length} scans (QrScanLog)`);
    }
  } catch (err) {
    console.error("❌ QrScanLog bulk insert error:", err);
  } finally {
    isFlushing = false;
  }
};

(async () => {
  await connectDB();

  const worker = new Worker(
    "qrScanQueue",
    async (job) => {
      const {
        contestId,
        seasonId,
        roundId,
        participantId,
        device,
      } = job.data;

      const parser = new UAParser(device.userAgent);
      const ua = parser.getResult();

      /**
       * 1️⃣ Upsert Device (individual — safe)
       */
      const deviceDoc = await Device.findOneAndUpdate(
        { fingerprintHash: device.fingerprint },
        {
          $setOnInsert: {
            browser: ua.browser.name,
            os: ua.os.name,
            deviceType: ua.device.type || "desktop",
            firstSeenAt: new Date(),
          },
          $set: {
            lastSeenAt: new Date(),
          },
          $inc: { totalScans: 1 },
        },
        { upsert: true, new: true }
      );

      /**
       * 2️⃣ Push scan into buffer instead of immediate insert
       */
      scanBuffer.push({
        contestId,
        seasonId,
        roundId,
        participantId,
        deviceId: deviceDoc._id,
        ip: device.ip,
        fingerprintHash: device.fingerprint,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 2b️⃣ Also store audit log in QrScanLog (batched)
      // NOTE: QrScanLog schema has `roundname` (string). We store roundId string for now
      // to avoid DB lookup per scan; enough for audit trails.
      scanLogBuffer.push({
        contestId,
        seasonId,
        participantId,
        roundname: roundId?.toString?.() || String(roundId),
        step: "scanned",
        deviceId: device.fingerprint, // schema expects string unique device hash
        deviceBrand: ua?.device?.vendor,
        deviceModel: ua?.device?.model || ua?.device?.type,
        osName: ua?.os?.name,
        osVersion: ua?.os?.version,
        browser: ua?.browser?.name,
        browserVersion: ua?.browser?.version,
        ip: device.ip,
        userAgent: device.userAgent,
        scannedAt: new Date(),
      });

      /**
       * 3️⃣ If batch size reached → flush
       */
      if (scanBuffer.length >= BATCH_SIZE || scanLogBuffer.length >= BATCH_SIZE) {
        await flushScans();
      }
    },
    {
      connection: bullConnection,
      concurrency: 50, // 🔥 safer than 200
    }
  );

  /**
   * ⏱ Periodic Flush (for low traffic)
   */
  setInterval(() => {
    flushScans();
  }, FLUSH_INTERVAL);

  /**
   * 🛑 Graceful Shutdown
   */
  process.on("SIGINT", async () => {
    console.log("🛑 Flushing remaining scans...");
    await flushScans();
    process.exit();
  });

  console.log("🚀 QR Worker Started (Batched Mode)");
})();