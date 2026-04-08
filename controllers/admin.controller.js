const User = require("../models/User");
const mongoose = require("mongoose");
const Vote = require("../models/Vote");
const Season = require("../models/seasons");
const { redis } = require("../config/redis");
const Contest = require("../models/Contest");

const STAFF_ROLES_SWAP = new Set([
  "judge",
  "admin",
  "super_admin",
  "sponsor",
]);

async function resolveVoterIdAfterDetailSwap(vote) {
  if (vote.voterType === "audience") return null;
  const email = String(vote.voterDetails?.email || "")
    .trim()
    .toLowerCase();
  if (!email) return null;
  const u = await User.findOne({
    email,
    status: "active",
    role: { $in: Array.from(STAFF_ROLES_SWAP) },
  })
    .select("_id")
    .lean();
  return u?._id || null;
}

function escapeRegexForEmail(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive exact match on voterDetails.email */
function emailMatchQuery(email) {
  return {
    $regex: new RegExp(`^${escapeRegexForEmail(email)}$`, "i"),
  };
}

/**
 * Swap voterDetails between two loaded Vote documents; saves both.
 */
async function persistSwapVoterDetailsBetweenVotes(a, b) {
  const detA = {
    name: a.voterDetails?.name ?? "",
    email: a.voterDetails?.email ?? "",
    phone: a.voterDetails?.phone ?? "",
  };
  const detB = {
    name: b.voterDetails?.name ?? "",
    email: b.voterDetails?.email ?? "",
    phone: b.voterDetails?.phone ?? "",
  };
  a.voterDetails = {
    name: detB.name,
    email: detB.email,
    phone: detB.phone,
  };
  b.voterDetails = {
    name: detA.name,
    email: detA.email,
    phone: detA.phone,
  };
  a.voterId = await resolveVoterIdAfterDetailSwap(a);
  b.voterId = await resolveVoterIdAfterDetailSwap(b);
  a.markModified("voterDetails");
  b.markModified("voterDetails");
  await Promise.all([a.save(), b.save()]);
}

/** Preset pair for Reports → Audience & judges auto-fix (identity swap only). */
const PRESET_RENU_EMAIL = "renuchabbra62@gmail.com";
const PRESET_ANUBHAV_EMAIL = "rawatanubhav085@gmail.com";

const ensureRenuAnubhavChains = new Map();

/** Serialize preset checks per season+participant+round so concurrent requests cannot double-swap. */
function runSerializedPresetSwap(key, fn) {
  const prev = ensureRenuAnubhavChains.get(key) || Promise.resolve();
  const out = prev.then(() => fn());
  ensureRenuAnubhavChains.set(key, out.catch(() => {}));
  return out;
}

async function performEnsureRenuAnubhavSwap(seasonId, participantId, roundId) {
  const base = {
    seasonId: new mongoose.Types.ObjectId(seasonId),
    participantId: new mongoose.Types.ObjectId(participantId),
    roundId: new mongoose.Types.ObjectId(roundId),
    step: "final",
    isValid: true,
  };

  const [voteRenu, voteAnubhav] = await Promise.all([
    Vote.findOne({
      ...base,
      "voterDetails.email": emailMatchQuery(PRESET_RENU_EMAIL),
    }),
    Vote.findOne({
      ...base,
      "voterDetails.email": emailMatchQuery(PRESET_ANUBHAV_EMAIL),
    }),
  ]);

  if (!voteRenu || !voteAnubhav) {
    return { swapped: false, reason: "preset_pair_not_found" };
  }

  const needsSwap =
    voteRenu.voterType === "audience" &&
    voteAnubhav.voterType !== "audience";

  if (!needsSwap) {
    return { swapped: false, reason: "already_fixed_or_layout_ok" };
  }

  await persistSwapVoterDetailsBetweenVotes(voteRenu, voteAnubhav);

  return { swapped: true, reason: "preset_renu_anubhav_swapped" };
}

exports.getAllAdmins = async (req, res) => {
  try {
    // Sanitize and parse page number
    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build search filter
    const query = req.query.query;
    let searchFilter = { role: "admin" };

    if (query) {
      const regex = new RegExp(query, 'i');
      searchFilter = {
        role: "admin",
        $or: [
          { name: { $regex: regex } },
          { email: { $regex: regex } },
          { phone: { $regex: regex } }
        ]
      };
    }
    // Fetch filtered, paginated admins
    const admins = await User.find(searchFilter)
      .skip(skip)
      .limit(limit)
      .populate("assignedContests");

    // Count total for pagination
    const total = await User.countDocuments(searchFilter);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      admins,
    });
  } catch (error) {
    console.error("Error in getAllAdmins:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAdminsBySeason = async (req, res) => {
  const { seasonId } = req.params;
  const { query, page = 1 } = req.query;

  if (!seasonId) {
    return res.status(400).json({ message: "Season ID is required" });
  }

  const limit = 10;
  const skip = (parseInt(page) - 1) * limit;
  try {
    // Build base filter
    const filter = {
      role: "admin",
      assignedContests: seasonId,
    };

    // If search query is provided, add case-insensitive search on name or email
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(filter);
    const admins = await User.find(filter)
      .skip(skip)
      .limit(limit).lean()
      // .populate("assignedContests");
    if (!admins)
      return res.status(404).json({ message: "Participant not found" });

    return res.status(200).json({
      currentPage: page,
      limit,
      totalAdmins: total,
      totalPages: Math.ceil(total / limit),
      admins,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

exports.alladmin = async (req,res)=>{
  try {   
    const data = await User.find({role:'admin',status:'active'})
    res.send({success:true,data})
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: error.message });
  }
}

// Phase 1 (revote): endpoint skeleton only.
// Phase 2+ will locate + invalidate existing final vote and reconcile aggregates.
exports.adminRevote = async (req, res) => {
  try {
    const { seasonId, roundId, participantId, deviceId, reason } = req.body || {};

    if (!seasonId || !roundId || !participantId || !deviceId || !reason) {
      return res.status(400).json({
        success: false,
        message: "seasonId, roundId, participantId, deviceId, reason are required",
      });
    }

    const isValidId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));
    if (![seasonId, roundId, participantId, deviceId].every(isValidId)) {
      return res.status(400).json({
        success: false,
        message: "seasonId, roundId, participantId, deviceId must be valid ObjectIds",
      });
    }

    // Identify requesting admin from cookie token decode (set by protect middleware)
    const requestedById =
      req.user?.userId || req.user?.id || req.user?._id || null;
    const revokedBy = isValidId(requestedById) ? requestedById : null;

    // Phase 2: invalidate existing audience final vote (DB only).
    const query = {
      seasonId,
      roundId,
      participantId,
      deviceId,
      voterType: "audience",
      step: "final",
    };

    const active = await Vote.findOne({ ...query, isValid: true }).lean();
    if (!active) {
      const alreadyRevoked = await Vote.findOne({ ...query, isValid: false })
        .select("_id isValid revokedAt revokedBy revokeReason")
        .lean();

      if (alreadyRevoked) {
        return res.status(200).json({
          success: true,
          message: "Vote already revoked (idempotent).",
          vote: alreadyRevoked,
        });
      }

      return res.status(404).json({
        success: false,
        message: "No active final vote found for provided identifiers.",
      });
    }

    const updated = await Vote.findByIdAndUpdate(
      active._id,
      {
        $set: {
          isValid: false,
          revokedAt: new Date(),
          revokedBy,
          revokeReason: String(reason).slice(0, 500),
        },
      },
      { new: true },
    ).lean();

    // Phase 3: reconcile Redis totals so old vote doesn't keep affecting live UI.
    try {
      const season = await Season.findById(seasonId).select("rounds").lean();
      const roundNameForKeys =
        season?.rounds?.find((r) => r?._id?.toString?.() === String(roundId))?.name ||
        String(roundId);

      const match = {
        seasonId: new mongoose.Types.ObjectId(seasonId),
        roundId: new mongoose.Types.ObjectId(roundId),
        participantId: new mongoose.Types.ObjectId(participantId),
        step: "final",
        isValid: true,
      };

      const totalsAgg = await Vote.aggregate([
        { $match: match },
        {
          $addFields: {
            voterIdentifier: {
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
            },
          },
        },
        {
          $group: {
            _id: "$voterIdentifier",
            starsSum: { $sum: "$stars" },
          },
        },
        {
          $group: {
            _id: null,
            totalStars: { $sum: "$starsSum" },
            totalVoters: { $sum: 1 },
          },
        },
      ]);

      const totalStars = Number(totalsAgg?.[0]?.totalStars ?? 0);
      const totalVoters = Number(totalsAgg?.[0]?.totalVoters ?? 0);

      const contestIdForKeys = updated?.contestId?.toString?.() || active?.contestId?.toString?.();
      if (contestIdForKeys) {
        const starsKeyByName = `contest:${contestIdForKeys}/${roundNameForKeys}/${seasonId}:votes`;
        const votersKeyByName = `contest:${contestIdForKeys}/${roundNameForKeys}/${seasonId}:voters_count`;
        const votedSetKeyByName = `contest:${contestIdForKeys}/${roundNameForKeys}/${seasonId}:voted`;
        const starsKeyById = `contest:${contestIdForKeys}/${roundId}/${seasonId}:votes`;
        const votersKeyById = `contest:${contestIdForKeys}/${roundId}/${seasonId}:voters_count`;
        const votedSetKeyById = `contest:${contestIdForKeys}/${roundId}/${seasonId}:voted`;

        // Remove this revoked voter's identity from "voted" sets so re-vote can increment counts again.
        const revokeMembers = [
          updated?.voterId ? String(updated.voterId) : null,
          updated?.deviceId ? String(updated.deviceId) : null,
          updated?.voterDetails?.email ? String(updated.voterDetails.email) : null,
          updated?.voterDetails?.phone ? String(updated.voterDetails.phone) : null,
        ].filter(Boolean);

        const pipeline = redis.multi();
        pipeline.hSet(starsKeyByName, participantId.toString(), totalStars);
        pipeline.hSet(votersKeyByName, participantId.toString(), totalVoters);
        pipeline.expire(starsKeyByName, 60 * 60);
        pipeline.expire(votersKeyByName, 60 * 60);
        pipeline.hSet(starsKeyById, participantId.toString(), totalStars);
        pipeline.hSet(votersKeyById, participantId.toString(), totalVoters);
        pipeline.expire(starsKeyById, 60 * 60);
        pipeline.expire(votersKeyById, 60 * 60);
        pipeline.expire(votedSetKeyByName, 60 * 60);
        pipeline.expire(votedSetKeyById, 60 * 60);

        if (revokeMembers.length) {
          pipeline.sRem(votedSetKeyByName, revokeMembers);
          pipeline.sRem(votedSetKeyById, revokeMembers);
        }

        await pipeline.exec();
      }
    } catch (e) {
      // Redis reconcile should never block revote; log and continue.
      console.error("Revote redis reconcile failed:", e);
    }

    return res.status(200).json({
      success: true,
      message: "Vote revoked. Re-vote can now be cast.",
      vote: updated,
    });
  } catch (error) {
    console.error("Error in adminRevote:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Option A (bulk reset): reset audience votes for participant+round so totals go to 0 and voting restarts fresh.
exports.adminResetAudienceVotes = async (req, res) => {
  try {
    const { seasonId, roundId, roundName, participantId, contestId, reason } = req.body || {};

    if (!seasonId || !participantId || !reason || (!roundId && !roundName)) {
      return res.status(400).json({
        success: false,
        message: "seasonId, participantId, reason and (roundId or roundName) are required",
      });
    }

    const isValidId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));
    if (![seasonId, participantId].every(isValidId)) {
      return res.status(400).json({
        success: false,
        message: "seasonId and participantId must be valid ObjectIds",
      });
    }

    // Resolve season → contestId + roundId (robust for admin UI variants)
    const season = await Season.findById(seasonId).select("_id contestId rounds").lean();
    if (!season) {
      return res.status(404).json({ success: false, message: "Season not found" });
    }

    // contestId in this codebase can be inconsistent in season docs in some environments.
    // Prefer explicit contestId, else season.contestId (if valid and not equal to seasonId),
    // else derive via Contest.seasons reference (same fallback used by QR generation).
    let resolvedContestId = isValidId(contestId) ? contestId : null;
    const seasonContestId = season?.contestId?._id || season?.contestId || null;
    if (!resolvedContestId && isValidId(seasonContestId) && String(seasonContestId) !== String(seasonId)) {
      resolvedContestId = seasonContestId;
    }
    if (!resolvedContestId) {
      const contest = await Contest.findOne({ seasons: seasonId }).select("_id").lean();
      resolvedContestId = contest?._id || null;
    }

    const resolvedRoundId = isValidId(roundId)
      ? roundId
      : (season?.rounds || []).find(
          (r) => String(r?.name || "").toLowerCase() === String(roundName || "").toLowerCase(),
        )?._id || null;

    if (!isValidId(resolvedContestId) || !isValidId(resolvedRoundId)) {
      return res.status(400).json({
        success: false,
        message: "Could not resolve contestId/roundId from provided context",
      });
    }

    const requestedById =
      req.user?.userId || req.user?.id || req.user?._id || null;
    const revokedBy = isValidId(requestedById) ? requestedById : null;

    // HARD RESET: invalidate ALL votes for this participant+round so the flow can restart cleanly.
    const base = {
      seasonId,
      roundId: resolvedRoundId,
      participantId,
    };

    // Fetch voter identifiers before invalidation so we can sRem them from voted sets.
    // NOTE: Do NOT filter by contestId here — old votes may have a different contestId stored.
    const activeVotes = await Vote.find({ ...base, isValid: true })
      .select("voterId deviceId voterDetails.email voterDetails.phone")
      .lean();

    const idsToRemove = Array.from(
      new Set(
        (activeVotes || [])
          .flatMap((v) => [
            v?.voterId ? String(v.voterId) : null,
            v?.deviceId ? String(v.deviceId) : null,
            v?.voterDetails?.email ? String(v.voterDetails.email) : null,
            v?.voterDetails?.phone ? String(v.voterDetails.phone) : null,
          ])
          .filter(Boolean),
      ),
    );

    const upd = await Vote.updateMany(
      { ...base, isValid: true },
      {
        $set: {
          isValid: false,
          revokedAt: new Date(),
          revokedBy,
          revokeReason: String(reason).slice(0, 500),
        },
      },
    );

    // Also clear QR scan duplicate locks so the same devices can scan again after reset.
    // Keys are created in qr.controller.js:
    //   scan:${seasonId}:${roundId}:${participantId}:${fingerprint}
    //   count:${seasonId}:${roundId}:${participantId}:scans
    try {
      const scanKeyMatch = `scan:${seasonId}:${resolvedRoundId}:${participantId}:*`;
      const scanCountKey = `count:${seasonId}:${resolvedRoundId}:${participantId}:scans`;

      const keysToDelete = [];
      for await (const key of redis.scanIterator({ MATCH: scanKeyMatch, COUNT: 500 })) {
        keysToDelete.push(key);
        if (keysToDelete.length >= 2000) break; // safety guard
      }

      const pipeline = redis.multi();
      // redis.del expects variadic keys, not an array as a single argument.
      if (keysToDelete.length) pipeline.del(...keysToDelete);
      pipeline.del(scanCountKey);
      await pipeline.exec();
    } catch (e) {
      console.error("Bulk reset scan-lock clear failed:", e);
    }

    // Redis reconcile: recompute totals from DB (should be 0 after reset) and write for this participant.
    try {
      const roundNameForKeys =
        season?.rounds?.find((r) => r?._id?.toString?.() === String(resolvedRoundId))?.name ||
        String(resolvedRoundId);

      const match = {
        seasonId: new mongoose.Types.ObjectId(seasonId),
        roundId: new mongoose.Types.ObjectId(resolvedRoundId),
        participantId: new mongoose.Types.ObjectId(participantId),
        step: "final",
        isValid: true,
      };

      const totalsAgg = await Vote.aggregate([
        { $match: match },
        {
          $addFields: {
            voterIdentifier: {
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
            },
          },
        },
        { $group: { _id: "$voterIdentifier", starsSum: { $sum: "$stars" } } },
        { $group: { _id: null, totalStars: { $sum: "$starsSum" }, totalVoters: { $sum: 1 } } },
      ]);

      const totalStars = Number(totalsAgg?.[0]?.totalStars ?? 0);
      const totalVoters = Number(totalsAgg?.[0]?.totalVoters ?? 0);

      const starsKeyByName = `contest:${resolvedContestId}/${roundNameForKeys}/${seasonId}:votes`;
      const votersKeyByName = `contest:${resolvedContestId}/${roundNameForKeys}/${seasonId}:voters_count`;
      const votedSetKeyByName = `contest:${resolvedContestId}/${roundNameForKeys}/${seasonId}:voted`;
      const starsKeyById = `contest:${resolvedContestId}/${resolvedRoundId}/${seasonId}:votes`;
      const votersKeyById = `contest:${resolvedContestId}/${resolvedRoundId}/${seasonId}:voters_count`;
      const votedSetKeyById = `contest:${resolvedContestId}/${resolvedRoundId}/${seasonId}:voted`;

      const pipeline = redis.multi();
      pipeline.hSet(starsKeyByName, participantId.toString(), totalStars);
      pipeline.hSet(votersKeyByName, participantId.toString(), totalVoters);
      pipeline.hSet(starsKeyById, participantId.toString(), totalStars);
      pipeline.hSet(votersKeyById, participantId.toString(), totalVoters);
      pipeline.expire(starsKeyByName, 60 * 60);
      pipeline.expire(votersKeyByName, 60 * 60);
      pipeline.expire(starsKeyById, 60 * 60);
      pipeline.expire(votersKeyById, 60 * 60);
      pipeline.expire(votedSetKeyByName, 60 * 60);
      pipeline.expire(votedSetKeyById, 60 * 60);

      if (idsToRemove.length) {
        pipeline.sRem(votedSetKeyByName, idsToRemove);
        pipeline.sRem(votedSetKeyById, idsToRemove);
      }

      await pipeline.exec();
    } catch (e) {
      console.error("Bulk reset redis reconcile failed:", e);
    }

    return res.status(200).json({
      success: true,
      message: "Audience votes reset for this participant+round. Fresh voting can start now.",
      invalidated: upd?.modifiedCount ?? 0,
      contestId: resolvedContestId,
      roundId: resolvedRoundId,
    });
  } catch (error) {
    console.error("Error in adminResetAudienceVotes:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Swap voterDetails (name, email, phone) between two final votes for the same
 * season + participant + round. Does not swap stars or voterType.
 * Re-links voterId for staff votes from User by new email.
 */
exports.swapVoteVoterDetails = async (req, res) => {
  try {
    const { voteIdA, voteIdB } = req.body || {};
    if (
      !voteIdA ||
      !voteIdB ||
      !mongoose.Types.ObjectId.isValid(voteIdA) ||
      !mongoose.Types.ObjectId.isValid(voteIdB)
    ) {
      return res.status(400).json({
        success: false,
        message: "voteIdA and voteIdB (valid ObjectIds) are required",
      });
    }
    if (String(voteIdA) === String(voteIdB)) {
      return res.status(400).json({
        success: false,
        message: "Must be two different votes",
      });
    }

    const [a, b] = await Promise.all([
      Vote.findById(voteIdA),
      Vote.findById(voteIdB),
    ]);
    if (!a || !b) {
      return res.status(404).json({
        success: false,
        message: "One or both votes not found",
      });
    }

    if (a.step !== "final" || b.step !== "final") {
      return res.status(400).json({
        success: false,
        message: "Both votes must be final",
      });
    }

    if (
      String(a.seasonId) !== String(b.seasonId) ||
      String(a.participantId) !== String(b.participantId) ||
      String(a.roundId) !== String(b.roundId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Votes must belong to the same season, participant, and round",
      });
    }

    await persistSwapVoterDetailsBetweenVotes(a, b);

    return res.status(200).json({
      success: true,
      message:
        "Voter name, email, and phone swapped. Stars and audience/judge type unchanged.",
      votes: [
        {
          _id: a._id,
          voterType: a.voterType,
          stars: a.stars,
          voterDetails: a.voterDetails,
        },
        {
          _id: b._id,
          voterType: b.voterType,
          stars: b.stars,
          voterDetails: b.voterDetails,
        },
      ],
    });
  } catch (error) {
    console.error("swapVoteVoterDetails:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Idempotent: if Renu’s email is on an audience vote and Anubhav’s on a judge vote
 * for this participant+round, swap only voterDetails (stars/types unchanged).
 * If already corrected or votes missing, returns swapped: false.
 */
exports.ensureRenuAnubhavSwap = async (req, res) => {
  try {
    const { seasonId, participantId, roundId } = req.body || {};
    if (
      !seasonId ||
      !participantId ||
      !roundId ||
      !mongoose.Types.ObjectId.isValid(seasonId) ||
      !mongoose.Types.ObjectId.isValid(participantId) ||
      !mongoose.Types.ObjectId.isValid(roundId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid seasonId, participantId, and roundId are required",
      });
    }

    const key = `${seasonId}:${participantId}:${roundId}`;
    const result = await runSerializedPresetSwap(key, () =>
      performEnsureRenuAnubhavSwap(seasonId, participantId, roundId),
    );

    return res.status(200).json({
      success: true,
      swapped: result.swapped,
      reason: result.reason,
    });
  } catch (error) {
    console.error("ensureRenuAnubhavSwap:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
