const { redis } = require("../config/redis");
const DeviceDetector = require("device-detector-js");
const crypto = require("crypto");
const QrScanLog = require("../models/QrScanLog"); // your Mongoose model


// exports.trackQrScan = async (req, res) => {
//   try {
//     const { contestId, participantId, roundname, deviceInfo } = req.body;

//     if (!contestId || !participantId) {
//       return res.status(400).json({ message: "Missing required fields." });
//     }

//     // -------------------------------
//     // 🧠 Device + Browser Fingerprint
//     // -------------------------------
//     const userAgent = req.headers["user-agent"] || "Unknown UA";
//     const dd = new DeviceDetector();
//     const parsedUA = dd.parse(userAgent);

//     const osName = parsedUA.os?.name || "Unknown";
//     const osVersion = parsedUA.os?.version || "Unknown";
//     const deviceBrand = parsedUA.device?.brand || "Unknown";
//     const deviceModel = parsedUA.device?.model || "Unknown";
//     const browser = parsedUA.client?.name || "Unknown";
//     const browserVersion = parsedUA.client?.version || "Unknown";

//     const ip =
//       req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
//       req.socket.remoteAddress ||
//       "Unknown-IP";

//     const fingerprintSource = JSON.stringify({
//       osName,
//       osVersion,
//       deviceBrand,
//       deviceModel,
//       browser,
//       browserVersion,
//       userAgent,
//       ip,
//       screenWidth: deviceInfo?.screenWidth,
//       screenHeight: deviceInfo?.screenHeight,
//       hardwareConcurrency: deviceInfo?.hardwareConcurrency,
//       deviceMemory: deviceInfo?.deviceMemory,
//       language: deviceInfo?.language,
//       timezone: deviceInfo?.timezone,
//     });

//     const deviceId = crypto
//       .createHash("sha256")
//       .update(`${deviceInfo.clientDeviceId}-${fingerprintSource}`)
//       .digest("hex");

//     const normalizedRound = roundname?.toLowerCase() || "default";

//     // ---------------------------------------------------
//     // ⛔ STRONG Redis Duplicate Protection (SETNX LOCK)
//     // ---------------------------------------------------
//     const redisKey = `qrscan:${contestId}:${participantId}:${normalizedRound}:${deviceId}`;

//     // ❗ SETNX = Atomic: Only first request succeeds
//     const wasSet = await redis.set(redisKey, "1", {
//       NX: true, // Set only if not exists
//       EX: 3600, // 1 hour
//     });

//     if (wasSet === null) {
//       // ❌ Already scanned
//       return res.status(409).json({
//         message: "QR already scanned from this device",
//       });
//     }

//     // ---------------------------------------------------
//     // 🟢 Save to Mongo Only Once (Idempotent Upsert)
//     // ---------------------------------------------------
//     await QrScanLog.updateOne(
//       {
//         contestId,
//         participantId,
//         roundname: normalizedRound,
//         deviceId,
//       },
//       {
//         $setOnInsert: {
//           contestId,
//           participantId,
//           roundname: normalizedRound,
//           deviceId,
//           deviceBrand,
//           deviceModel,
//           browser,
//           browserVersion,
//           osName,
//           osVersion,
//           userAgent,
//           ip,
//           createdAt: new Date(),
//         },
//       },
//       { upsert: true }
//     );

//     const totalScans = await QrScanLog.countDocuments({
//   contestId,
//   participantId,
//   roundname: normalizedRound,
// });

//     const io = req.app.get("io");
//     io.to(contestId.toString()).emit("qr-scan-updated", {
//       contestId,
//       participantId,
//       roundname: normalizedRound,
//       totalScans,
//     });

//     return res.status(200).json({
//       message: "QR scan logged successfully",
//     });

//   } catch (error) {
//     console.error("QR Scan Error:", error);
//     return res.status(500).json({
//       message: "Failed to log QR scan",
//       error: error.message,
//     });
//   }
// };

// exports.trackQrScan = async (req, res) => {
//   try {
//     const { contestId, participantId, roundname } = req.body;

//     if (!contestId || !participantId) {
//       return res.status(400).json({ message: "Missing required fields." });
//     }

//     const userAgent = req.headers["user-agent"] || "Unknown UA";
//     const deviceDetector = new DeviceDetector();
//     const device = deviceDetector.parse(userAgent);
//     console.log(device,"55555555555555555")

//     // --- Extract device info ---
//     let deviceBrand = device.device?.brand || "Unknown";
//     let deviceModel = device.device?.model?.toLowerCase() || "unknown-device";
//     const osName = device.os?.name || "Unknown";
//     const osVersion = device.os?.version || "Unknown";
//     const browser = device.client?.name || "Unknown";
//     const browserVersion = device.client?.version || "Unknown";
//     const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

//     // --- Normalize user-agent to create more unique device ID ---
//     const normalizedUA = userAgent
//       .toLowerCase()
//       .replace(/\s+/g, '')
//       .replace(/[;:]/g, '');

//     // --- Generate STABLE & UNIQUE deviceId ---
//     const fingerprintSource = `${osName}-${osVersion}-${deviceModel}-${browser}-${normalizedUA}`;
//     const deviceId = crypto.createHash("sha256").update(fingerprintSource).digest("hex");

//     // --- Fallback brand inference ---
//     if (deviceBrand === "Unknown" && deviceModel !== "unknown-device") {
//       if (deviceModel.startsWith("sm-")) deviceBrand = "Samsung";
//       else if (deviceModel.startsWith("moto")) deviceBrand = "Motorola";
//       else if (deviceModel.startsWith("redmi") || deviceModel.startsWith("mi")) deviceBrand = "Xiaomi";
//       else if (deviceModel.startsWith("vivo")) deviceBrand = "Vivo";
//       else if (deviceModel.startsWith("infinix")) deviceBrand = "Infinix";
//       else if (deviceModel.startsWith("tecno")) deviceBrand = "Tecno";
//       else if (deviceModel.startsWith("rmx")) deviceBrand = "Realme";
//       else if (deviceModel.startsWith("oneplus")) deviceBrand = "OnePlus";
//     }

//     // --- Normalize round name ---
//     const normalizedRound = roundname?.toLowerCase() || "default";

//     // --- Check for existing scan from the same device ---
//     const existingScan = await QrScanLog.findOne({
//       participantId,
//       contestId,
//       roundname: normalizedRound,
//       deviceId,
//     });

//     if (existingScan) {
//       return res.status(409).json({
//         message: "QR already scanned from this device for the same participant and round.",
//       });
//     }

//     // --- Create new scan log ---
//     const log = new QrScanLog({
//       participantId,
//       contestId,
//       roundname: normalizedRound,
//       step: "scanned",
//       deviceId,
//       deviceBrand,
//       browser,
//       ip,
//     });

//     await log.save();

//     return res.status(200).json({
//       message: "QR scan logged successfully",
//       data: {
//         ...log.toObject(),
//         deviceModel,
//         osName,
//         osVersion,
//         browserVersion,
//         userAgent,
//       },
//     });
//   } catch (error) {
//     console.error("QR Scan Log Error:", error);
//     res.status(500).json({
//       message: "Failed to log QR scan",
//       error: error.message,
//     });
//   }
// };


exports.trackQrScan = async (req, res) => {
  try {
    const { contestId, participantId, roundname, deviceInfo } = req.body;

    if (!contestId || !participantId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const normalizedRound = roundname?.toLowerCase() || "default";

    // -------------------------------
    // 🔐 DEVICE FINGERPRINT (AS IS)
    // -------------------------------
    const userAgent = req.headers["user-agent"] || "Unknown UA";
    const dd = new DeviceDetector();
    const parsedUA = dd.parse(userAgent);

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "Unknown-IP";

    const fingerprintSource = JSON.stringify({
      userAgent,
      ip,
      screenWidth: deviceInfo?.screenWidth,
      screenHeight: deviceInfo?.screenHeight,
      deviceMemory: deviceInfo?.deviceMemory,
      timezone: deviceInfo?.timezone,
    });

    const deviceId = crypto
      .createHash("sha256")
      .update(`${deviceInfo.clientDeviceId}-${fingerprintSource}`)
      .digest("hex");

    // ---------------------------------------
    // ⛔ DUPLICATE PREVENTION (ALREADY GOOD)
    // ---------------------------------------
    const lockKey = `qrscan:lock:${contestId}:${participantId}:${normalizedRound}:${deviceId}`;

    const wasSet = await redis.set(lockKey, "1", {
      NX: true,
      EX: 3600,
    });

    if (wasSet === null) {
      return res.status(409).json({
        message: "QR already scanned from this device",
      });
    }

    // ---------------------------------------
    // 🟢 SAVE TO MONGO (IDEMPOTENT)
    // ---------------------------------------
    await QrScanLog.updateOne(
      {
        contestId,
        participantId,
        roundname: normalizedRound,
        deviceId,
      },
      {
        $setOnInsert: {
          contestId,
          participantId,
          roundname: normalizedRound,
          deviceId,
          userAgent,
          ip,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    // ---------------------------------------
    // 🚀 CACHE-ASIDE COUNT LOGIC (KEY PART)
    // ---------------------------------------
    const countKey = `qrscan:count:${contestId}:${participantId}:${normalizedRound}`;

    let totalScans = await redis.get(countKey);

    if (totalScans) {
      // ✅ FAST PATH (REDIS)
      totalScans = parseInt(totalScans, 10);
      await redis.incr(countKey);
      totalScans += 1;
    } else {
      // ❌ CACHE MISS → DB
      totalScans = await QrScanLog.countDocuments({
        contestId,
        participantId,
        roundname: normalizedRound,
      });

      // 💾 Store in Redis
      await redis.set(countKey, totalScans, {
        EX: 3600, // 1 hour cache
      });
    }

    // ---------------------------------------
    // 📡 REAL-TIME SOCKET EMIT
    // ---------------------------------------
    const io = req.app.get("io");

    io.to(contestId.toString()).emit("qr-scan-updated", {
      contestId,
      participantId,
      roundname: normalizedRound,
      totalScans,
    });

    return res.status(200).json({
      message: "QR scan logged successfully",
      totalScans,
      source: "redis/db", // optional debug
    });

  } catch (error) {
    console.error("QR Scan Error:", error);
    return res.status(500).json({
      message: "Failed to log QR scan",
      error: error.message,
    });
  }
};


