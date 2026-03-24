const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { redis } = require("../config/redis");
const QRCode = require("../models/QrCode");
const Vote = require("../models/Vote");
const VoterInfo = require("../models/VoterInfo");
const Device = require("../models/device.model");
const generateFingerprint = require("../utils/fingerprint");
const UAParser = require("ua-parser-js");
const Participant = require("../models/Participant");
const QrScanLog = require("../models/QrScanLog");
const Contest = require("../models/Contest");
const Season = require("../models/seasons");
const User = require("../models/User");

const STAFF_ROLES = new Set(["judge", "admin", "super_admin", "sponsor"]);

async function resolveRoundNameForSeason(seasonId, roundId) {
  try {
    const season = await Season.findById(seasonId).select("rounds").lean();
    const round = season?.rounds?.find(
      (r) => r?._id?.toString?.() === roundId?.toString?.(),
    );
    return round?.name || null;
  } catch {
    return null;
  }
}

async function resolveRoundIdForSeason(seasonId, roundName) {
  try {
    const season = await Season.findById(seasonId).select("rounds").lean();
    const round = season?.rounds?.find(
      (r) => String(r?.name || "").toLowerCase() === String(roundName || "").toLowerCase(),
    );
    return round?._id || null;
  } catch {
    return null;
  }
}

async function resolveLoggedInVoter(req) {
  try {
    const token = req?.cookies?.token;
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.userId || decoded?.id || decoded?._id;
    if (!userId) return null;

    const user = await User.findById(userId)
      .select("_id role name email phone status")
      .lean();

    if (!user || !STAFF_ROLES.has(user.role) || user.status !== "active") return null;
    return user;
  } catch {
    return null;
  }
}

// Helper to update Redis
// async function updateRedisVote(contestId, participantId, stars) {
//   const redisKey = `contest:${contestId}:votes`;
//   // Increment stars for that participant in Redis
//   await redis.hincrby(redisKey, participantId.toString(), stars);
//   // Refresh TTL so it doesn't expire too soon
//   await redis.expire(redisKey, 60);
// }

// Submit AudienceDetails
exports.submitAudienceInfo = async (req, res) => {
  try {
    const { contestId, participantId, seasonId, name, email, phone } = req.body;

    // Parse device info
    const parser = new UAParser(req.headers["user-agent"]);
    const uaResult = parser.getResult();
    const deviceId = uaResult.device.model || "Unknown";
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Find existing vote in 'scanned' step
    const vote = await QrScanLog.findOne({
      contestId,
      seasonId,
      participantId,
      "source.deviceId": deviceId,
      step: "scanned",
    });

    if (!vote) {
      return res.status(404).json({
        message:
          "No scanned record found for this device or already submitted info.",
      });
    }

    // Update with audience info
    vote.audienceDetails = { name, email, phone };
    vote.source = { deviceId, ip }; // refresh source info just in case
    vote.step = "info_submitted";

    await vote.save();

    res.status(200).json({
      message: "Audience information submitted successfully. Proceed to vote.",
      data: vote,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error submitting audience info",
      error: error.message,
    });
  }
};

// Cast Vote
// exports.castVote = async (req, res) => {
//   try {
//     const { contestId, participantId, voterType, stars, voterDetails, roundName, step = "final" } = req.body;
//     const parser = new UAParser(req.headers["user-agent"]);
//     const uaResult = parser.getResult();
//     const deviceId = uaResult.device.model || "Unknown";
//     const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

//     // Prevent duplicate audience votes
//     if (voterType === "audience") {
//       const existingVote = await Vote.findOne({
//         contestId,
//         participantId,
//         "source.deviceId": deviceId,
//       });
//       if (existingVote) {
//         return res.status(409).json({
//           message: "You have already voted for this participant in this contest from this device.",
//         });
//       }
//     }

//     // Store in MongoDB
//     let vote;
//     if (["judge", "admin", "super_admin", "sponsor"].includes(voterType) && req.user?.userId) {
//       vote = await Vote.findOneAndUpdate(
//         { contestId, participantId, roundName, voterId:req.user.userId },
//         { stars, step,roundName, source: { deviceId, ip }, voterDetails: voterDetails || {} },
//         { new: true, upsert: true }
//       );
//     } else {
//       vote = new Vote({
//         contestId,
//         roundName,
//         participantId,
//         voterType,
//         voterId: req.user?._id || null,
//         stars,
//         step,
//         source: { deviceId, ip },
//         voterDetails: voterDetails || {},
//       });
//       await vote.save();
//     }

//     // Update Redis
//     const redisKey = `contest:${contestId}/${roundName}:votes`;
//     await redis.hIncrBy(redisKey, participantId.toString(), stars);
//     await redis.expire(redisKey, 60 * 60); // 1 hour TTL

//     // Fetch updated leaderboard
//     const redisVotes = await redis.hGetAll(redisKey);
//     const participants = await Participant.find({ contests: contestId }).select("_id name profilePhoto bio").lean();
//     const leaderboard = participants.map((p) => ({
//       participantId: p._id,
//       name: p.name,
//       profilePhoto: p.profilePhoto,
//       bio: p.bio,
//       totalStars: Number(redisVotes[p._id.toString()] || 0),
//     }));
//     leaderboard.sort((a, b) => b.totalStars - a.totalStars);

//     // Broadcast update via Socket.IO
//     const io = req.app.get("io");
//     io.to(`contest_${contestId}`).emit("leaderboardUpdate", leaderboard);

//     res.status(201).json({ message: "Vote recorded successfully", data: vote });
//   } catch (error) {
//     res.status(500).json({ message: "Error casting vote", error: error.message });
//   }
// };

// exports.castVote = async (req, res) => {
//   try {
//     const { contestId, participantId, voterType, stars, voterDetails, voterId, roundName, step = "final" } = req.body;

//     // 🧩 Validate required fields
//     if (!contestId || !participantId || !stars) {
//       return res.status(400).json({
//         message: "Missing required fields for voting.",
//       });
//     }

//     // 🧭 Device + IP tracking
//     const parser = new UAParser(req.headers["user-agent"]);
//     const uaResult = parser.getResult();
//     const deviceId = uaResult.device.model || "Unknown";
//     const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

//     // 🔐 Build unique voter identifier
//     const uniqueVoterIdentifier =
//       voterId?.toString() ||
//       deviceId ||
//       voterDetails?.email ||
//       voterDetails?.phone ||
//       `${ip}-${Date.now()}`;

//     // 🚫 Prevent duplicate vote (for all voter types)
//     let existingVoteQuery = { contestId, participantId, roundName };

//     if (
//       ["judge", "admin", "super_admin", "sponsor"].includes(voterType) &&
//       voterId
//     ) {
//       existingVoteQuery.voterId = voterId;
//     } else {
//       existingVoteQuery["source.deviceId"] = deviceId;
//     }

//     const existingVote = await Vote.findOne(existingVoteQuery);
//     if (existingVote) {
//       return res.status(409).json({
//         message: "You have already voted for this participant in this round.",
//       });
//     }

//     // 💾 Save new vote
//     const vote = new Vote({
//       contestId,
//       roundName,
//       participantId,
//       voterType,
//       voterId: voterId || null,
//       stars,
//       step,
//       source: { deviceId, ip },
//       voterDetails: voterDetails || {},
//     });

//     await vote.save();

//     // 🧮 Redis Keys
//     const starsKey = `contest:${contestId}/${roundName}:votes`;
//     const votersKey = `contest:${contestId}/${roundName}:voters_count`;
//     const votedSetKey = `contest:${contestId}/${roundName}:voted`;

//     // ⚡ Update total stars
//     await redis.hIncrBy(starsKey, participantId.toString(), stars);
//     await redis.expire(starsKey, 60 * 60);

//     // ⚡ Update total voters only if this unique voter hasn't been counted yet
//    const added = await redis.sAdd(votedSetKey, uniqueVoterIdentifier);
// if (added === 1) {
//   const pipeline = redis.multi();
//   pipeline.hIncrBy(votersKey, participantId.toString(), 1);
//   pipeline.expire(votersKey, 3600);
//   pipeline.expire(votedSetKey, 3600);
//   await pipeline.exec();
// }

//     await redis.expire(votersKey, 60 * 60);
//     await redis.expire(votedSetKey, 60 * 60);

//     // 📡 Notify frontend via socket
//     const io = req.app.get("io");
//     io.to(contestId).emit("vote-updated", {
//       message: "Vote recorded successfully",
//       contestId,
//       participantId,
//       roundName,
//     });

//     // ✅ Success response
//     return res.status(201).json({
//       message: "Vote recorded successfully",
//       data: vote,
//     });
//   } catch (error) {
//     console.error("❌ Error casting vote:", error);
//     return res
//       .status(500)
//       .json({ message: "Error casting vote", error: error.message });
//   }
// };

exports.castVote = async (req, res) => {
  try {
    const {
      contestId,
      seasonId,
      participantId,
      voterType,
      stars,
      voterDetails,
      voterId,
      roundName,
      step = "final",
    } = req.body;

    // 🧩 Validate required fields
    if (!contestId || !seasonId || !participantId || !stars || !roundName) {
      return res.status(400).json({
        message: "Missing required fields for voting.",
      });
    }

    // const contest = await Contest.findById(contestId);
    // if(contest?.isVotingEnabled === false)
    //   return res.status(403).json({ message: "Voting is closed"})

    const roundId = await resolveRoundIdForSeason(seasonId, roundName);
    if (!roundId) {
      return res.status(400).json({
        message: "Invalid roundName for this season.",
      });
    }

    // Resolve trusted voter from auth cookie (if present)
    const loggedInVoter = await resolveLoggedInVoter(req);
    const effectiveVoterType =
      loggedInVoter?.role && STAFF_ROLES.has(loggedInVoter.role)
        ? loggedInVoter.role
        : (STAFF_ROLES.has(voterType) ? voterType : "audience");
    const effectiveVoterId = loggedInVoter?._id || voterId || null;

    // 🧭 Device + IP tracking + fingerprint
    const parser = new UAParser(req.headers["user-agent"]);
    const uaResult = parser.getResult();
    const fingerprint = generateFingerprint(req);
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      req.ip ||
      "Unknown-IP";

    const deviceDoc = await Device.findOneAndUpdate(
      { fingerprintHash: fingerprint },
      {
        $setOnInsert: {
          browser: uaResult?.browser?.name,
          os: uaResult?.os?.name,
          deviceType: uaResult?.device?.type || "desktop",
          firstSeenAt: new Date(),
        },
        $set: {
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    // 🔐 Build consistent unique voter identifier
    const uniqueVoterIdentifier =
      effectiveVoterId?.toString?.() ||
      voterDetails?.email ||
      voterDetails?.phone ||
      deviceDoc?._id?.toString?.() ||
      `${ip}-${Date.now()}`;

    // 💾 Save/Upsert vote
    let vote;
    if (effectiveVoterId && STAFF_ROLES.has(effectiveVoterType)) {
      // Staff can update their own rating for same participant+round
      vote = await Vote.findOneAndUpdate(
        {
          contestId,
          seasonId,
          participantId,
          roundId,
          voterType: effectiveVoterType,
          voterId: effectiveVoterId,
          isValid: true,
        },
        {
          $set: {
            stars,
            step,
            voterType: effectiveVoterType,
            voterId: effectiveVoterId,
            fingerprintHash: fingerprint,
            deviceId: deviceDoc._id,
            ip,
            voterDetails:
              voterDetails || {
                name: loggedInVoter?.name,
                email: loggedInVoter?.email,
                phone: loggedInVoter?.phone,
              },
          },
          $setOnInsert: {
            contestId,
            seasonId,
            participantId,
            roundId,
          },
        },
        { upsert: true, new: true },
      );
    } else {
      // Audience path (duplicate blocked by unique index)
      vote = new Vote({
        contestId,
        seasonId,
        roundId,
        participantId,
        voterType: "audience",
        voterId: null,
        stars,
        step,
        fingerprintHash: fingerprint,
        deviceId: deviceDoc._id,
        ip,
        voterDetails: voterDetails || {},
      });

      await vote.save();
    }

    // 🧮 Redis keys
    const starsKey = `contest:${contestId}/${roundName}/${seasonId}:votes`;
    const votersKey = `contest:${contestId}/${roundName}/${seasonId}:voters_count`;
    const votedSetKey = `contest:${contestId}/${roundName}/${seasonId}:voted`;

    // ⚡ Update total stars
    await redis.hIncrBy(starsKey, participantId.toString(), stars);
    await redis.expire(starsKey, 3600);

    // ⚡ Count unique voter only once
    const added = await redis.sAdd(votedSetKey, uniqueVoterIdentifier);
    if (added === 1) {
      const pipeline = redis.multi();
      pipeline.hIncrBy(votersKey, participantId.toString(), 1);
      pipeline.expire(votersKey, 3600);
      pipeline.expire(votedSetKey, 3600);
      await pipeline.exec();
    }

    await redis.expire(votersKey, 3600);
    await redis.expire(votedSetKey, 3600);

    // 📡 Notify frontend via socket
    const io = req.app.get("io");
    if (io) {
      io.to(contestId).emit("vote-updated", {
        message: "Vote recorded successfully",
        contestId,
        seasonId,
        participantId,
        roundName,
        stars,
        voterName:
          voter?.voterDetails?.name ||
          loggedInVoter?.name ||
          "Audience",
      });
    }

    // ✅ Success response
    return res.status(201).json({
      message: "Vote recorded successfully",
      data: vote,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "You have already voted for this participant in this round.",
      });
    }
    console.error("❌ Error casting vote:", error);
    return res
      .status(500)
      .json({ message: "Error casting vote", error: error.message });
  }
};

// Live Leaderboard
exports.getLiveVotes = async (req, res) => {
  try {
    const { contestId, seasonId } = req.params;
    const { roundName } = req.body;

    if (!contestId || !roundName) {
      return res
        .status(400)
        .json({ message: "contestId and roundName are required." });
    }

    const redisKey = `contest:${contestId}/${roundName}/${seasonId}:votes`;
    const participantKey = `contest:${contestId}/${seasonId}:participants`;
    let voteData = {};

    // Parallel: get participants + cached votes
    const [participantsJSON, redisVotes] = await Promise.all([
      redis.get(participantKey),
      redis.hGetAll(redisKey),
    ]);

    let participants = participantsJSON ? JSON.parse(participantsJSON) : null;

    if (!participants) {
      participants = await Participant.find({ "contests.contest": seasonId })
        .select("_id name profilePhoto bio")
        .lean();
      redis.set(participantKey, JSON.stringify(participants), { EX: 300 });
    }

    if (redisVotes && Object.keys(redisVotes).length > 0) {
      for (const [pid, stars] of Object.entries(redisVotes))
        voteData[pid] = Number(stars);
    } else {
      const dbVotes = await Vote.aggregate([
        {
          $match: {
            seasonId: new mongoose.Types.ObjectId(seasonId),
            roundName,
            step: "final",
          },
        },
        { $group: { _id: "$participantId", totalStars: { $sum: "$stars" } } },
      ]);

      const hashObj = {};
      dbVotes.forEach(
        (v) => (hashObj[v._id.toString()] = v.totalStars.toString()),
      );
      voteData = Object.fromEntries(
        Object.entries(hashObj).map(([k, v]) => [k, Number(v)]),
      );

      if (dbVotes.length > 0) {
        await redis.hSet(redisKey, hashObj);
        await redis.expire(redisKey, 60);
      }
    }

    const leaderboard = participants
      .map((p) => ({
        participantId: p._id,
        name: p.name,
        profilePhoto: p.profilePhoto,
        bio: p.bio,
        totalStars: voteData[p._id.toString()] || 0,
      }))
      .sort((a, b) => b.totalStars - a.totalStars);

    res.status(200).json({ contestId, roundName, leaderboard });
  } catch (error) {
    console.error("❌ Error fetching live votes:", error);
    res
      .status(500)
      .json({ message: "Error fetching live votes", error: error.message });
  }
};

// Get total stars and number of distinct voters for a specific contest, participant and round
exports.getTotalStars = async (req, res) => {
  try {
    const contestId =
      req.params.contestId || req.query.contestId || req.body.contestId;
    const seasonId =
      req.params.seasonId || req.query.seasonId || req.body.seasonId;
    const participantId =
      req.params.participantId ||
      req.query.participantId ||
      req.body.participantId;
    const roundIdentifier =
      req.params.roundName || req.query.roundName || req.body.roundName;

    if (!contestId || !participantId || !roundIdentifier || !seasonId) {
      return res
        .status(400)
        .json({
          message: "contestId, participantId and roundName are required.",
        });
    }

    // Allow both roundName and roundId-like strings as the "roundName" param.
    // Prefer season round name when the identifier looks like an ObjectId.
    let roundNameForKeys = roundIdentifier;
    let roundIdForDb = null;
    if (/^[a-fA-F0-9]{24}$/.test(roundIdentifier)) {
      roundIdForDb = roundIdentifier;
      try {
        const season = await Season.findById(seasonId).select("rounds").lean();
        const round = season?.rounds?.find(
          (r) => r?._id?.toString() === roundIdentifier,
        );
        if (round?.name) roundNameForKeys = round.name;
      } catch (e) {
        // ignore
      }
    }

    // Try both key styles to be backward compatible (roundName and roundId string)
    const starsKeyByName = `contest:${contestId}/${roundNameForKeys}/${seasonId}:votes`;
    const votersKeyByName = `contest:${contestId}/${roundNameForKeys}/${seasonId}:voters_count`;
    const starsKeyById = `contest:${contestId}/${roundIdentifier}/${seasonId}:votes`;
    const votersKeyById = `contest:${contestId}/${roundIdentifier}/${seasonId}:voters_count`;

    // Try to read both from Redis
    const [cachedStars, cachedVoters, cachedStarsAlt, cachedVotersAlt] =
      await Promise.all([
        redis.hGet(starsKeyByName, participantId.toString()),
        redis.hGet(votersKeyByName, participantId.toString()),
        redis.hGet(starsKeyById, participantId.toString()),
        redis.hGet(votersKeyById, participantId.toString()),
      ]);

    const finalCachedStars = cachedStars ?? cachedStarsAlt;
    const finalCachedVoters = cachedVoters ?? cachedVotersAlt;

    // If found in cache, return instantly
    if (finalCachedStars !== null && finalCachedVoters !== null) {
      return res.status(200).json({
        contestId,
        participantId,
        roundName: roundNameForKeys,
        totalStars: Number(finalCachedStars),
        totalVoters: Number(finalCachedVoters),
      });
    }

    // Fallback: compute from DB if missing
    let totalStars = finalCachedStars ? Number(finalCachedStars) : 0;
    let totalVoters = finalCachedVoters ? Number(finalCachedVoters) : 0;

    // Aggregate stars if needed
    if (!finalCachedStars) {
      const match = {
        seasonId: new mongoose.Types.ObjectId(seasonId),
        participantId: new mongoose.Types.ObjectId(participantId),
        step: "final",
      };
      // Audience votes use roundId; staff flow uses roundName.
      if (roundIdForDb) {
        match.roundId = new mongoose.Types.ObjectId(roundIdForDb);
      } else {
        match.roundName = roundIdentifier;
      }

      const starsAgg = await Vote.aggregate([
        { $match: match },
        { $group: { _id: null, totalStars: { $sum: "$stars" } } },
      ]);
      totalStars = starsAgg.length > 0 ? starsAgg[0].totalStars : 0;
      // write to both key formats
      await Promise.all([
        redis.hSet(starsKeyByName, participantId.toString(), totalStars),
        redis.expire(starsKeyByName, 60 * 60),
        redis.hSet(starsKeyById, participantId.toString(), totalStars),
        redis.expire(starsKeyById, 60 * 60),
      ]);
    }

    // Aggregate voters if needed
    if (!finalCachedVoters) {
      const match = {
        seasonId: new mongoose.Types.ObjectId(seasonId),
        participantId: new mongoose.Types.ObjectId(participantId),
        step: "final",
      };
      if (roundIdForDb) {
        match.roundId = new mongoose.Types.ObjectId(roundIdForDb);
      } else {
        match.roundName = roundIdentifier;
      }

      const votersAgg = await Vote.aggregate([
        { $match: match },
        {
          $addFields: {
            voterIdentifier: {
              $ifNull: [
                { $toString: "$voterId" },
                {
                  $ifNull: [
                    "$source.deviceId",
                    {
                      $ifNull: [
                        "$voterDetails.email",
                        {
                          $ifNull: ["$voterDetails.phone", "$_id"],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        { $group: { _id: "$voterIdentifier" } },
        { $count: "uniqueVoters" },
      ]);
      totalVoters = votersAgg.length > 0 ? votersAgg[0].uniqueVoters : 0;
      await Promise.all([
        redis.hSet(votersKeyByName, participantId.toString(), totalVoters),
        redis.expire(votersKeyByName, 60 * 60),
        redis.hSet(votersKeyById, participantId.toString(), totalVoters),
        redis.expire(votersKeyById, 60 * 60),
      ]);
    }

    return res.status(200).json({
      contestId,
      participantId,
      roundName: roundNameForKeys,
      totalStars,
      totalVoters,
    });
  } catch (error) {
    console.error("❌ Error fetching total stars/voters:", error);
    return res
      .status(500)
      .json({
        message: "Error fetching total stars/voters",
        error: error.message,
      });
  }
};

/**
 * Audience vs Judges bucket totals for VoteProfile.
 *
 * Endpoint:
 *   GET /api/votes/bucket-totals/:contestId/:participantId/:roundId/:seasonId
 *
 * Judges bucket definition:
 *   voterType !== "audience"
 *
 * Response:
 * {
 *   audience: { totalPoints, totalVoters, avgScore },
 *   judges:   { totalPoints, totalVoters, avgScore },
 *   final:    { finalScore }
 * }
 *
 * Note:
 * - contestId can be "NA" (frontend fallback). We ignore contestId filter when invalid.
 */
exports.getBucketTotals = async (req, res) => {
  try {
    const { contestId, participantId, roundId, seasonId } = req.params;

    const isInvalidId = (v) => {
      const s = String(v ?? "").trim();
      if (!s) return true;
      const lower = s.toLowerCase();
      if (lower === "na" || lower === "undefined" || lower === "null") return true;
      return !mongoose.Types.ObjectId.isValid(s);
    };

    if (
      isInvalidId(participantId) ||
      isInvalidId(roundId) ||
      isInvalidId(seasonId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid participantId, roundId and seasonId are required.",
      });
    }

    const participantObjectId = new mongoose.Types.ObjectId(participantId);
    const roundObjectId = new mongoose.Types.ObjectId(roundId);
    const seasonObjectId = new mongoose.Types.ObjectId(seasonId);

    const contestObjectId =
      !isInvalidId(contestId) && mongoose.Types.ObjectId.isValid(contestId)
        ? new mongoose.Types.ObjectId(contestId)
        : null;

    const baseMatch = {
      seasonId: seasonObjectId,
      roundId: roundObjectId,
      participantId: participantObjectId,
      step: "final",
      isValid: true,
    };
    if (contestObjectId) baseMatch.contestId = contestObjectId;

    const buildUniqueVoterIdentifier = {
      $ifNull: [
        { $toString: "$voterId" },
        {
          $ifNull: [
            { $toString: "$deviceId" },
            {
              $ifNull: [
                "$voterDetails.email",
                { $ifNull: ["$voterDetails.phone", { $toString: "$_id" }] },
              ],
            },
          ],
        },
      ],
    };

    const runAgg = async (voterTypeFilter) => {
      const agg = await Vote.aggregate([
        { $match: { ...baseMatch, ...voterTypeFilter } },
        {
          $addFields: {
            voterIdentifier: buildUniqueVoterIdentifier,
          },
        },
        {
          $group: {
            _id: { voterIdentifier: "$voterIdentifier" },
            starsSum: { $sum: "$stars" },
          },
        },
        {
          $group: {
            _id: null,
            totalPoints: { $sum: "$starsSum" },
            totalVoters: { $sum: 1 },
          },
        },
      ]);

      if (!agg?.length) {
        return { totalPoints: 0, totalVoters: 0, avgScore: 0 };
      }

      const totalPoints = Number(agg[0].totalPoints ?? 0);
      const totalVoters = Number(agg[0].totalVoters ?? 0);
      const avgScore = totalVoters > 0 ? totalPoints / totalVoters : 0;

      return { totalPoints, totalVoters, avgScore };
    };

    const audience = await runAgg({ voterType: "audience" });
    const judges = await runAgg({ voterType: { $ne: "audience" } });

    const finalScore = Number(audience.avgScore + judges.avgScore);

    return res.status(200).json({
      success: true,
      participantId,
      roundId,
      seasonId,
      audience,
      judges,
      final: { finalScore },
    });
  } catch (error) {
    console.error("getBucketTotals error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bucket totals",
      error: error.message,
    });
  }
};

// exports.voterInfo = async (req, res) => {
//   try {
//     const {
//       contestName,
//       roundName,
//       voterType,
//       page = 1,
//       limit = 10,
//     } = req.query;

//     if (!contestName) {
//       return res.status(400).json({ message: "contestName is required" });
//     }

//     // 1️⃣ Find contest (case-insensitive)
//     const contest = await Contest.findOne({
//       title: { $regex: `^${contestName.trim()}$`, $options: "i" },
//     });

//     if (!contest) {
//       return res.status(404).json({ message: "Contest not found" });
//     }

//     // 2️⃣ Build filter dynamically
//     const filter = {
//       contestId: contest._id,
//     };

//     if (roundName) {
//       filter.roundName = roundName;
//     }

//     if (voterType) {
//       filter.voterType = voterType;
//     }

//     // 3️⃣ Pagination logic
//     const skip = (Number(page) - 1) * Number(limit);

//     // 4️⃣ Fetch votes
//     const [voter, total] = await Promise.all([
//       Vote.find(filter)
//         .populate("participantId", "name")
//         .populate("contestId", "title")
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(Number(limit)),

//       Vote.countDocuments(filter),
//     ]);

//     res.status(200).json({
//       voter,
//       pagination: {
//         total,
//         page: Number(page),
//         limit: Number(limit),
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     return res.status(500).json({ message: error.message });
//   }
// };

// exports.voterInfo = async (req, res) => {
//   try {
//     const {
//       contestName,
//       roundName,
//       voterType,
//       // page = 1,
//       // limit = 10,
//     } = req.query;

//     const filter = {};

//     /* ======================
//        CONTEST FILTER
//     ====================== */
//     if (contestName?.trim()) {
//       const contest = await Contest.findOne({
//         title: { $regex: contestName.trim(), $options: "i" }, // partial match
//       });

//       if (!contest) {
//         return res.status(200).json({
//           voter: [],
//           // pagination: {
//           //   total: 0,
//           //   page: 1,
//           //   limit: 0,
//           //   totalPages: 0,
//           // },
//         });
//       }

//       filter.contestId = contest._id;
//     }

//     if (roundName) filter.roundName = roundName;
//     if (voterType) filter.voterType = voterType;

//     // const skip = (Number(page) - 1) * Number(limit);

//     const voter = await Vote.find(filter)
//       .populate("participantId", "name")
//       .populate("contestId", "title")
//       .populate("seasonId", "title")
//       .sort({ createdAt: -1 })
//       // .skip(skip)
//       // .limit(Number(limit))
//       ;

//     // const total = await Vote.countDocuments(filter);

//     res.status(200).json({
//       voter,
//       // pagination: {
//       //   total,
//       //   page: Number(page),
//       //   limit: Number(limit),
//       //   totalPages: Math.ceil(total / limit),
//       // },
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.voterInfo = async (req, res) => {
  try {
    const { contestName, seasonId, roundName, voterType } = req.query;

    const filter = {};
    let seasons = [];
    let contestId = null;

    /* ======================
       CONTEST FILTER (FAST)
    ====================== */
    if (contestName?.trim()) {
      const contest = await Contest.findOne(
        { title: new RegExp(`^${contestName.trim()}`, "i") }, // faster than contains
        { seasons: 1 }, // projection
      )
        .populate("seasons", "title slug status rounds.name")
        .lean();

      if (!contest) {
        return res.status(200).json({
          success: true,
          votes: [],
          seasons: [],
        });
      }

      contestId = contest._id;
      filter.contestId = contestId;
      seasons = contest.seasons || [];
    }

    /* ======================
       FILTERS
    ====================== */
    if (seasonId && mongoose.Types.ObjectId.isValid(seasonId)) {
      filter.seasonId = seasonId;
    }

    if (roundName) filter.roundName = roundName;
    if (voterType) filter.voterType = voterType;

    /* ======================
       FETCH VOTES (LEAN & MINIMAL)
    ====================== */
    const votes = await Vote.find(filter)
      .select(
        "participantId contestId seasonId roundName voterType stars voterDetails createdAt",
      )
      .populate("participantId", "name")
      .populate("contestId", "title") // 🔥 no seasons here
      .populate("seasonId", "title")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      totalVotes: votes.length,
      seasons,
      votes,
    });
  } catch (error) {
    console.error("Voter Info Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.submitVoterInfo = async (req, res) => {
  try {
    const { token, name, email, phone } = req.body;
    console.log(req.body);

    if (!token || !name || !email) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    // 1️⃣ Verify token
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

    // 2️⃣ Get QR
    const redisQrKey = `qr:${qrId}`;
    let qrData = await redis.get(redisQrKey);

    if (!qrData) {
      const qr = await QRCode.findById(qrId).lean();

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

    // Resolve roundName for VoterInfo (schema requires roundName)
    const resolvedRoundName =
      (await resolveRoundNameForSeason(qrData.seasonId, qrData.roundId)) ||
      qrData.roundId?.toString?.() ||
      "unknown-round";
    const normalizedRoundName = String(resolvedRoundName).toLowerCase();

    // 3️⃣ Identify device (fingerprint-based)
    const fingerprint = generateFingerprint(req);
    console.log("[submitVoterInfo] computed fingerprint tail:", fingerprint.slice(-6));
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    const deviceDoc = await Device.findOneAndUpdate(
      { fingerprintHash: fingerprint },
      {
        $setOnInsert: {
          browser: ua?.browser?.name,
          os: ua?.os?.name,
          deviceType: ua?.device?.type || "desktop",
          firstSeenAt: new Date(),
        },
        $set: {
          lastSeenAt: new Date(),
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      },
      { upsert: true, new: true },
    );
    console.log("[submitVoterInfo] deviceDoc exists id:", deviceDoc?._id?.toString?.());

    // 4️⃣ Upsert Vote SAFELY
    const vote = await Vote.findOneAndUpdate(
      {
        seasonId: qrData.seasonId,
        roundId: qrData.roundId, // ✅ FIXED
        participantId: qrData.participantId,
        deviceId: deviceDoc._id,
        step: { $ne: "final" }, // ✅ Prevent overwrite of final vote
      },
      {
        $set: {
          contestId: qrData.contestId,
          voterType: "audience",
          voterDetails: { name, email, phone },
          fingerprintHash: fingerprint,
          deviceId: deviceDoc._id,
          ip: req.ip, // ✅ store
          step: "info_submitted",
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
    console.log("[submitVoterInfo] vote upserted id/step/email tail:", {
      voteId: vote?._id?.toString?.(),
      step: vote?.step,
      emailTail: vote?.voterDetails?.email ? String(vote.voterDetails.email).slice(-3) : "",
      contestId: qrData?.contestId?.toString?.(),
      seasonId: qrData?.seasonId?.toString?.(),
    });

    // 5️⃣ Also upsert VoterInfo for "info submitted" audit trail
    await VoterInfo.updateOne(
      {
        contestId: qrData.contestId,
        participantId: qrData.participantId,
        roundName: normalizedRoundName,
        "voterDetails.email": String(email).toLowerCase(),
      },
      {
        $set: {
          contestId: qrData.contestId,
          participantId: qrData.participantId,
          roundName: normalizedRoundName,
          voterType: "audience",
          voterDetails: { name, email, phone },
          step: "info_submitted",
        },
      },
      { upsert: true },
    );

    return res.json({
      success: true,
      message: "Information submitted successfully",
      voteId: vote._id,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Already submitted from this device",
      });
    }

    console.error("Submit Info Error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// If audience already submitted voter details once from this device,
// reuse them when they scan a new participant QR (avoid re-entering email/phone).
exports.getExistingVoterDetails = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    // 1) Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.QR_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const { qrId } = decoded;

    // 2) Get QR payload (redis -> DB fallback)
    const redisQrKey = `qr:${qrId}`;
    // Debug: token-based fetch (remove later if needed)
    console.log("[getExistingVoterDetails] token ok, qrId:", qrId);
    let qrData = await redis.get(redisQrKey);

    if (!qrData) {
      const qr = await QRCode.findById(qrId).lean();
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

    // 3) Identify device (fingerprint-based)
    const fingerprint = generateFingerprint(req);
    console.log(
      "[getExistingVoterDetails] fingerprint tail:",
      fingerprint.slice(-6)
    );
    const deviceDoc = await Device.findOne({ fingerprintHash: fingerprint })
      .select("_id")
      .lean();

    console.log(
      "[getExistingVoterDetails] deviceDoc exists:",
      Boolean(deviceDoc),
      deviceDoc?._id?.toString?.()
    );

    if (!deviceDoc) {
      return res.status(200).json({ success: true, exists: false });
    }

    // 4) Find latest "info_submitted" or "final" vote for this device in same contest/season
    const vote = await Vote.findOne({
      contestId: qrData.contestId,
      seasonId: qrData.seasonId,
      deviceId: deviceDoc._id,
      step: { $in: ["info_submitted", "final"] },
    })
      .sort({ createdAt: -1 })
      .select("voterDetails")
      .lean();

    const hasAnyVoterDetail =
      Boolean(vote?.voterDetails) &&
      (Boolean(vote.voterDetails.name) ||
        Boolean(vote.voterDetails.email) ||
        Boolean(vote.voterDetails.phone));

    if (!hasAnyVoterDetail) {
      console.log("[getExistingVoterDetails] no/empty voterDetails found (main query)", {
        contestId: String(qrData?.contestId || ""),
        seasonId: String(qrData?.seasonId || ""),
        hasVote: Boolean(vote),
        hasName: Boolean(vote?.voterDetails?.name),
        hasEmail: Boolean(vote?.voterDetails?.email),
        hasPhone: Boolean(vote?.voterDetails?.phone),
      });
      // Fallback: if contest/season mismatch or QR payload differs,
      // still reuse latest audience info submitted from this device.
      const fallbackVote = await Vote.findOne({
        deviceId: deviceDoc._id,
        step: { $in: ["info_submitted", "final"] },
      })
        .sort({ createdAt: -1 })
        .select("voterDetails")
        .lean();

      const hasAnyFallbackDetail =
        Boolean(fallbackVote?.voterDetails) &&
        (Boolean(fallbackVote.voterDetails.name) ||
          Boolean(fallbackVote.voterDetails.email) ||
          Boolean(fallbackVote.voterDetails.phone));

      if (!hasAnyFallbackDetail) {
        return res.status(200).json({ success: true, exists: false });
      }

      const { name, email, phone } = fallbackVote.voterDetails;
      const safeEmailTail = email ? String(email).slice(-3) : "";
      console.log(
        "[getExistingVoterDetails] fallback found details. email tail:",
        safeEmailTail
      );

      return res.status(200).json({
        success: true,
        exists: true,
        voterDetails: {
          name: name || "",
          email: email || "",
          phone: phone || "",
        },
      });
    }

    const { name, email, phone } = vote.voterDetails;
    // Avoid printing full email/phone in logs
    const safeEmailTail = email ? String(email).slice(-3) : "";
    console.log(
      "[getExistingVoterDetails] found existing details. email tail:",
      safeEmailTail
    );
    return res.status(200).json({
      success: true,
      exists: true,
      voterDetails: {
        name: name || "",
        email: email || "",
        phone: phone || "",
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error fetching existing voter details",
      error: err?.message,
    });
  }
};

exports.submitFinalVote = async (req, res) => {
  try {
    const { token, stars } = req.body;

    if (!token || !stars) {
      return res.status(400).json({
        success: false,
        message: "Token and stars are required",
      });
    }

    if (stars < 1 || stars > 10) {
      return res.status(400).json({
        success: false,
        message: "Stars must be between 1 and 10",
      });
    }

    /**
     * 1️⃣ Verify QR Token
     */
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

    /**
     * 2️⃣ Get QR from Redis or DB
     */
    const redisQrKey = `qr:${qrId}`;
    let qrData = await redis.get(redisQrKey);

    if (!qrData) {
      const qr = await QRCode.findById(qrId).lean();

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

    /**
     * 3️⃣ Identify device (fingerprint-based)
     */
    const fingerprint = generateFingerprint(req);
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();

    const deviceDoc = await Device.findOneAndUpdate(
      { fingerprintHash: fingerprint },
      {
        $setOnInsert: {
          browser: ua?.browser?.name,
          os: ua?.os?.name,
          deviceType: ua?.device?.type || "desktop",
          firstSeenAt: new Date(),
        },
        $set: {
          lastSeenAt: new Date(),
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      },
      { upsert: true, new: true },
    );

    const loggedInVoter = await resolveLoggedInVoter(req);

    // Default fallback: logged-in role (if staff), else audience.
    let resolvedVoterType =
      loggedInVoter?.role && STAFF_ROLES.has(loggedInVoter.role)
        ? loggedInVoter.role
        : "audience";
    let resolvedVoterId = loggedInVoter?._id || null;

    /**
     * 4️⃣ Finalize Vote
     */
    const voteQuery = {
      seasonId: qrData.seasonId,
      roundId: qrData.roundId,
      participantId: qrData.participantId,
      deviceId: deviceDoc._id,
      voterType: "audience", // submit-info stage always writes audience; final step can change it
      step: "info_submitted",
      isValid: true,
    };

    // Read vote first so we can attribute role from typed voterDetails.email/phone.
    const voteInfo = await Vote.findOne(voteQuery).lean();
    if (!voteInfo) {
      return res.status(400).json({
        success: false,
        message: "Invalid voting flow or already finalized",
      });
    }

    const typedEmail = String(voteInfo?.voterDetails?.email ?? "")
      .trim()
      .toLowerCase();
    const typedPhone = String(voteInfo?.voterDetails?.phone ?? "").trim();

    // If typed email/phone belongs to a staff user, use that staff role.
    if (typedEmail) {
      const typedUser = await User.findOne({
        email: typedEmail,
        status: "active",
      })
        .select("_id role")
        .lean();

      if (typedUser?.role && STAFF_ROLES.has(typedUser.role)) {
        resolvedVoterType = typedUser.role;
        resolvedVoterId = typedUser._id;
      }
    } else if (typedPhone) {
      const typedUser = await User.findOne({
        phone: typedPhone,
        status: "active",
      })
        .select("_id role")
        .lean();

      if (typedUser?.role && STAFF_ROLES.has(typedUser.role)) {
        resolvedVoterType = typedUser.role;
        resolvedVoterId = typedUser._id;
      }
    }

    const vote = await Vote.findOneAndUpdate(
      voteQuery,
      {
        $set: {
          stars,
          fingerprintHash: fingerprint,
          voterType: resolvedVoterType,
          voterId: resolvedVoterId,
          step: "final",
        },
      },
      { new: true },
    );

    if (!vote) {
      return res.status(400).json({
        success: false,
        message: "Invalid voting flow or already finalized",
      });
    }

    /**
     * Resolve roundName (Redis keys + UI use roundName)
     */
    const resolvedRoundName =
      (await resolveRoundNameForSeason(qrData.seasonId, qrData.roundId)) || null;
    const roundNameForKeys =
      resolvedRoundName || qrData.roundId?.toString() || "unknown-round";
    const roundIdForKeys = qrData.roundId?.toString() || "unknown-round";
    const normalizedRoundName = String(roundNameForKeys).toLowerCase();

    // Upsert VoterInfo as "final" (so you have parallel record in VoterInfo table)
    await VoterInfo.updateOne(
      {
        contestId: qrData.contestId,
        participantId: qrData.participantId,
        roundName: normalizedRoundName,
        "voterDetails.email": vote?.voterDetails?.email,
      },
      {
        $set: {
          contestId: qrData.contestId,
          participantId: qrData.participantId,
          roundName: normalizedRoundName,
          voterType: resolvedVoterType,
          voterId: resolvedVoterId,
          voterDetails: vote?.voterDetails || {},
          step: "final",
        },
      },
      { upsert: true },
    );

    /**
     * 5️⃣ Update Redis aggregates (stars + unique voters)
     * VoteProfile / analytics reads from these keys via getTotalStars().
     */
    const starsKeyByName = `contest:${qrData.contestId}/${roundNameForKeys}/${qrData.seasonId}:votes`;
    const votersKeyByName = `contest:${qrData.contestId}/${roundNameForKeys}/${qrData.seasonId}:voters_count`;
    const votedSetKeyByName = `contest:${qrData.contestId}/${roundNameForKeys}/${qrData.seasonId}:voted`;

    // also write using roundId string (backward compatibility with URLs passing roundId)
    const starsKeyById = `contest:${qrData.contestId}/${roundIdForKeys}/${qrData.seasonId}:votes`;
    const votersKeyById = `contest:${qrData.contestId}/${roundIdForKeys}/${qrData.seasonId}:voters_count`;
    const votedSetKeyById = `contest:${qrData.contestId}/${roundIdForKeys}/${qrData.seasonId}:voted`;

    const uniqueVoterIdentifier =
      vote?.voterDetails?.email ||
      vote?.voterDetails?.phone ||
      `${vote?.ip || req.ip || "unknown-ip"}:${vote._id.toString()}`;

    await Promise.all([
      redis.hIncrBy(starsKeyByName, qrData.participantId.toString(), Number(stars)),
      redis.expire(starsKeyByName, 3600),
      redis.hIncrBy(starsKeyById, qrData.participantId.toString(), Number(stars)),
      redis.expire(starsKeyById, 3600),
    ]);

    const [addedByName, addedById] = await Promise.all([
      redis.sAdd(votedSetKeyByName, uniqueVoterIdentifier),
      redis.sAdd(votedSetKeyById, uniqueVoterIdentifier),
    ]);

    const pipeline = redis.multi();
    if (addedByName === 1) pipeline.hIncrBy(votersKeyByName, qrData.participantId.toString(), 1);
    if (addedById === 1) pipeline.hIncrBy(votersKeyById, qrData.participantId.toString(), 1);
    pipeline.expire(votersKeyByName, 3600);
    pipeline.expire(votersKeyById, 3600);
    pipeline.expire(votedSetKeyByName, 3600);
    pipeline.expire(votedSetKeyById, 3600);
    await pipeline.exec();

    /**
     * 6️⃣ Emit socket updates
     * VoteProfile joins seasonId room; analytics pages often join contestId room.
     */
    const io = req.app.get("io");
    if (io) {
      const payload = {
        message: "Vote submitted successfully",
        contestId: qrData.contestId,
        seasonId: qrData.seasonId,
        participantId: qrData.participantId,
        roundName: roundNameForKeys,
        stars: Number(vote?.stars || stars || 0),
        voterName: vote?.voterDetails?.name || "Audience",
      };
      io.to(qrData.seasonId.toString()).emit("vote-updated", payload);
      io.to(qrData.contestId.toString()).emit("vote-updated", payload);
    }

    return res.json({
      success: true,
      message: "Vote submitted successfully",
      stars: vote.stars,
    });
  } catch (err) {
    console.log(err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already voted for this participant in this round.",
      });
    }

    console.error("Final Vote Error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
