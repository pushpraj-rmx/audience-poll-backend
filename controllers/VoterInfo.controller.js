const { redis } = require("../config/redis");
const VoterInfo = require("../models/VoterInfo");

exports.submitVoterDetails = async (req, res) => {
  try {
    const {
      contestId,
      participantId,
      roundName,
      voterType,
      voterDetails,
      deviceId, // pass from frontend or derive
    } = req.body;

    if (!contestId || !participantId || !roundName) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    const normalizedRound = roundName.toLowerCase();

    // ----------------------------------
    // 🔐 DUPLICATE PROTECTION (REDIS)
    // ----------------------------------
    const lockKey = `voter:lock:${contestId}:${participantId}:${normalizedRound}:${deviceId || voterDetails?.email}`;

    const wasSet = await redis.set(lockKey, "1", {
      NX: true,
      EX: 3600, // 1 hour
    });

    if (wasSet === null) {
      return res.status(409).json({
        message: "Details already submitted from this device",
      });
    }

    // ----------------------------------
    // 🟢 SAVE / UPSERT VOTER INFO
    // ----------------------------------
    await VoterInfo.updateOne(
      {
        contestId,
        participantId,
        roundName: normalizedRound,
        "voterDetails.email": voterDetails?.email,
      },
      {
        $setOnInsert: {
          contestId,
          participantId,
          roundName: normalizedRound,
          voterType,
          voterDetails,
          step: "final",
        },
      },
      { upsert: true }
    );

    // ----------------------------------
    // 🚀 REDIS COUNT (CACHE-ASIDE)
    // ----------------------------------
    const countKey = `voter:count:${contestId}:${participantId}:${normalizedRound}`;

    let totalVoters = await redis.get(countKey);

    if (totalVoters) {
      totalVoters = parseInt(totalVoters, 10);
      await redis.incr(countKey);
      totalVoters += 1;
    } else {
      totalVoters = await VoterInfo.countDocuments({
        contestId,
        participantId,
        roundName: normalizedRound,
        step: "final",
      });

      await redis.set(countKey, totalVoters, {
        EX: 3600,
      });
    }

    // ----------------------------------
    // 📡 REAL-TIME SOCKET EMIT
    // ----------------------------------
    const io = req.app.get("io");

    io.to(contestId.toString()).emit("voter-info-updated", {
      contestId,
      participantId,
      roundName: normalizedRound,
      totalVoters,
    });

    return res.status(200).json({
      message: "Voter details submitted successfully",
      totalVoters,
      source: "redis/db",
    });

  } catch (error) {
    console.error("Voter submit error:", error);
    return res.status(500).json({
      message: "Failed to submit voter details",
      error: error.message,
    });
  }
};