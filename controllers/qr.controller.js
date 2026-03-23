const jwt = require("jsonwebtoken");
const { redis } = require("../config/redis");
const qrScanQueue = require("../queues/qrScan.queue");
const scanScript = require("../redisScripts/scanAtomic");
const mongoose = require("mongoose");

const QRCodeSchema = require("../models/QrCode");
const Contest = require("../models/Contest");
const Season = require("../models/seasons");
const QRCode = require("qrcode");

const generateFingerprint = require("../utils/fingerprint");

// ===============================
// GENERATE QR
// ===============================
exports.generateQr = async (req, res) => {
  try {
    const { contestId, seasonId, roundId, participantId } = req.body;
    const isInvalidId = (v) => {
      const s = String(v ?? "").trim();
      if (!s) return true;
      const lower = s.toLowerCase();
      if (lower === "undefined" || lower === "null" || lower === "na") return true;
      return !mongoose.Types.ObjectId.isValid(s);
    };

    // Fallback: season.contestId null/absent ho to contestId derive karo
    let resolvedContestId = contestId;
    if (isInvalidId(resolvedContestId)) {
      if (seasonId && mongoose.Types.ObjectId.isValid(String(seasonId))) {
        const contest = await Contest.findOne({ seasons: seasonId })
          .select("_id")
          .lean();
        resolvedContestId = contest?._id || null;
      }
    }

    if (
      isInvalidId(resolvedContestId) ||
      isInvalidId(seasonId) ||
      isInvalidId(roundId) ||
      isInvalidId(participantId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "contestId, seasonId, roundId and participantId are required for QR generation.",
      });
    }

    // Use resolved contestId for downstream QR/DB record
    const finalContestId = resolvedContestId;
    /**
     * 1️⃣ Validate round exists inside season
     */
    const season = await Season.findOne({
      _id: seasonId,
      "rounds._id": roundId,
    }).select("_id");

    if (!season) {
      return res.status(400).json({
        success: false,
        message: "Invalid season or round",
      });
    }

    /**
     * 2️⃣ Check if QR already exists
     */
    let qrRecord = await QRCodeSchema.findOne({
      seasonId,
      roundId,
      participantId,
    });

    // If not exists → create
    if (!qrRecord) {
      qrRecord = await QRCodeSchema.create({
        contestId: finalContestId,
        seasonId,
        roundId,
        participantId,
        createdBy: req.user?._id,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h expiry
      });
    }

    /**
     * 3️⃣ Generate fresh signed token
     * (Even for existing QR — token can be regenerated safely)
     */
    const token = jwt.sign({ qrId: qrRecord._id }, process.env.QR_SECRET, {
      expiresIn: "2h",
    });

    const voteUrl = `${process.env.FRONTEND}/vote/${token}`;

    /**
     * 4️⃣ Generate QR Image
     */
    const qrImage = await QRCode.toDataURL(voteUrl);

    return res.status(200).json({
      success: true,
      qrId: qrRecord._id,
      voteUrl,
      qrImage,
      expiresAt: qrRecord.expiresAt,
    });
  } catch (error) {
    console.error("Generate QR Error:", error);

    // 🔥 Duplicate fallback protection (race condition safe)
    if (error.code === 11000) {
      const existingQR = await QRCodeSchema.findOne({
        seasonId: req.body.seasonId,
        roundId: req.body.roundId,
        participantId: req.body.participantId,
      });

      const token = jwt.sign({ qrId: existingQR._id }, process.env.QR_SECRET, {
        expiresIn: "2h",
      });

      const voteUrl = `${process.env.FRONTEND}/vote/${token}`;
      const qrImage = await QRCode.toDataURL(voteUrl);

      return res.status(200).json({
        success: true,
        qrId: existingQR._id,
        voteUrl,
        qrImage,
        expiresAt: existingQR.expiresAt,
      });
    }

    return res.status(500).json({
      success: false,
      message: "QR generation failed",
    });
  }
};

// ===============================
// SCAN QR
// ===============================
exports.scanQr = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token required",
      });
    }

    // 1️⃣ Verify JWT safely
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.QR_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const { qrId } = decoded;

    // 2️⃣ Fetch QR (Redis First)
    const redisQrKey = `qr:${qrId}`;
    let qrData = await redis.get(redisQrKey);

    if (!qrData) {
      const qr = await QRCodeSchema.findById(qrId).lean();

      if (!qr || !qr.isActive || qr.expiresAt < new Date()) {
        return res.status(403).json({
          success: false,
          message: "QR invalid or expired",
        });
      }

      await redis.set(redisQrKey, JSON.stringify(qr), "EX", 7200);
      qrData = qr;
    } else {
      qrData = JSON.parse(qrData);
    }

    // 3️⃣ Fingerprint
    const fingerprint = generateFingerprint(req);

    const duplicateKey = `scan:${qrData.seasonId}:${qrData.roundId}:${qrData.participantId}:${fingerprint}`;
    const countKey = `count:${qrData.seasonId}:${qrData.roundId}:${qrData.participantId}:scans`;

    // 4️⃣ Atomic Redis call
    const result = await redis.eval(scanScript, {
      keys: [duplicateKey, countKey],
      arguments: [(60 * 60 * 6).toString()],
    });

    const isFirstScan = result[0];
    const scanCount = result[1];

    if (!isFirstScan) {
      return res.status(400).json({
        success: false,
        message: "Already scanned",
      });
    }

    // 5️⃣ Push to queue (fire-and-forget)
    qrScanQueue
      .add(
        "syncScan",
        {
          contestId: qrData.contestId,
          seasonId: qrData.seasonId,
          roundId: qrData.roundId,
          participantId: qrData.participantId,
          device: {
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            fingerprint,
          },
        },
        {
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
        },
      )
      .catch((err) => {
        console.error("Queue Push Error:", err);
      });

    // 6️⃣ Emit socket (non-blocking)
    const io = req.app.get("io");
    if (io) {
      io.to(qrData.seasonId.toString()).emit("QR_SCAN_UPDATED", {
        participantId: qrData.participantId,
        scanCount,
      });
    }

    return res.json({
      success: true,
      scanCount,
      message: "QR scanned successfully",
    });
  } catch (err) {
    console.error("Scan QR Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
