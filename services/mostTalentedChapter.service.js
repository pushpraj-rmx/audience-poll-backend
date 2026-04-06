/**
 * Most Talented Chapter — read-only aggregate (Participant + Vote).
 *
 * First×3 and Group rank (15/10/5) both use the same live leaderboard rule:
 * per `groupKey`, sort by avgStars (audience+judge, same formula as point table),
 * tie-break earlier `registeredAt`. No reliance on stored `contests.position`.
 *
 * - P_headcount: unique participants per chapter (active season entries).
 * - P_first_in_category: ×3 per #1 per groupKey (leaderboard).
 * - P_group_participation: +5 if any active entry has subCategory Group.
 * - P_group_placement: max 15/10/5 from top-3 per groupKey (leaderboard).
 * - P_audience_average: mean audience avg per participant (optional round).
 */

const mongoose = require("mongoose");
const Participant = require("../models/Participant");
const Vote = require("../models/Vote");
const Season = require("../models/seasons");

const POINTS_PER_FIRST = 3;
const GROUP_PARTICIPATION_BONUS = 5;
/** Index 0 = 1st place, 1 = 2nd, 2 = 3rd per groupKey */
const PODIUM_PLACEMENT_POINTS = [15, 10, 5];

function normalizeChapterName(raw) {
  const s = raw != null ? String(raw).trim() : "";
  return s.length ? s : "(Unassigned)";
}

function isGroupSubCategory(subCategory) {
  return String(subCategory || "")
    .trim()
    .toLowerCase() === "group";
}

/** Same pattern as participant registration / groupKey in DB. */
function buildGroupKey(c) {
  if (c.groupKey != null && String(c.groupKey).trim()) {
    return String(c.groupKey).trim();
  }
  const cat = String(c.category || "").trim();
  const sub = String(c.subCategory || "").trim();
  const st = c.soloType;
  if (String(sub).toLowerCase() === "solo" && st) {
    return `${cat}|${sub}|${st}`;
  }
  return `${cat}|${sub}`;
}

/**
 * Per-participant avgStars for one round — aligned with point-table row formula.
 * @returns {Map<string, number>}
 */
async function aggregateAvgStarsByParticipantForRound(seasonId, roundId) {
  const seasonObjectId = new mongoose.Types.ObjectId(seasonId);
  const roundObjectId = new mongoose.Types.ObjectId(roundId);

  const pipeline = [
    {
      $match: {
        seasonId: seasonObjectId,
        roundId: roundObjectId,
        participantId: { $ne: null },
        step: "final",
        isValid: true,
      },
    },
    {
      $group: {
        _id: {
          participantId: "$participantId",
          roundId: "$roundId",
          seasonId: "$seasonId",
        },
        audiencePoints: {
          $sum: {
            $cond: [{ $eq: ["$voterType", "audience"] }, "$stars", 0],
          },
        },
        audienceVotes: {
          $sum: {
            $cond: [{ $eq: ["$voterType", "audience"] }, 1, 0],
          },
        },
        judgesPoints: {
          $sum: {
            $cond: [{ $ne: ["$voterType", "audience"] }, "$stars", 0],
          },
        },
        judgesVotes: {
          $sum: {
            $cond: [{ $ne: ["$voterType", "audience"] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        participantId: "$_id.participantId",
        avgAudienceStars: {
          $cond: [
            { $gt: ["$audienceVotes", 0] },
            { $divide: ["$audiencePoints", "$audienceVotes"] },
            0,
          ],
        },
        avgJudgeStars: {
          $cond: [
            { $gt: ["$judgesVotes", 0] },
            { $divide: ["$judgesPoints", "$judgesVotes"] },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        avgStars: { $add: ["$avgAudienceStars", "$avgJudgeStars"] },
      },
    },
  ];

  const rows = await Vote.aggregate(pipeline);
  const map = new Map();
  for (const r of rows) {
    map.set(String(r.participantId), Number(r.avgStars) || 0);
  }
  return map;
}

/**
 * All rounds merged — same avgStars formula, one score per participant.
 * @returns {Map<string, number>}
 */
async function aggregateAvgStarsByParticipantAllRounds(seasonId) {
  const seasonObjectId = new mongoose.Types.ObjectId(seasonId);

  const pipeline = [
    {
      $match: {
        seasonId: seasonObjectId,
        participantId: { $ne: null },
        step: "final",
        isValid: true,
      },
    },
    {
      $group: {
        _id: "$participantId",
        audiencePoints: {
          $sum: {
            $cond: [{ $eq: ["$voterType", "audience"] }, "$stars", 0],
          },
        },
        audienceVotes: {
          $sum: {
            $cond: [{ $eq: ["$voterType", "audience"] }, 1, 0],
          },
        },
        judgesPoints: {
          $sum: {
            $cond: [{ $ne: ["$voterType", "audience"] }, "$stars", 0],
          },
        },
        judgesVotes: {
          $sum: {
            $cond: [{ $ne: ["$voterType", "audience"] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        participantId: "$_id",
        avgAudienceStars: {
          $cond: [
            { $gt: ["$audienceVotes", 0] },
            { $divide: ["$audiencePoints", "$audienceVotes"] },
            0,
          ],
        },
        avgJudgeStars: {
          $cond: [
            { $gt: ["$judgesVotes", 0] },
            { $divide: ["$judgesPoints", "$judgesVotes"] },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        avgStars: { $add: ["$avgAudienceStars", "$avgJudgeStars"] },
      },
    },
  ];

  const rows = await Vote.aggregate(pipeline);
  const map = new Map();
  for (const r of rows) {
    map.set(String(r.participantId), Number(r.avgStars) || 0);
  }
  return map;
}

/**
 * Audience avg (unique voters) per participant — one round.
 * @returns {Map<string, number>}
 */
async function aggregateAudienceAvgByParticipantIds(
  participantObjectIds,
  seasonId,
  roundId,
) {
  if (!participantObjectIds.length || !roundId) return new Map();

  const seasonObjectId = new mongoose.Types.ObjectId(seasonId);
  const roundObjectId = new mongoose.Types.ObjectId(roundId);

  const baseMatch = {
    seasonId: seasonObjectId,
    roundId: roundObjectId,
    participantId: { $in: participantObjectIds },
    step: "final",
    isValid: true,
    voterType: "audience",
  };

  const pipeline = [
    { $match: baseMatch },
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
        _id: {
          participantId: "$participantId",
          voterIdentifier: "$voterIdentifier",
        },
        starsSum: { $sum: "$stars" },
      },
    },
    {
      $group: {
        _id: "$_id.participantId",
        totalStars: { $sum: "$starsSum" },
        totalVoters: { $sum: 1 },
      },
    },
  ];

  const rows = await Vote.aggregate(pipeline);
  const map = new Map();
  for (const r of rows) {
    const pid = String(r._id);
    const tv = Number(r.totalVoters || 0);
    const ts = Number(r.totalStars || 0);
    map.set(pid, tv > 0 ? ts / tv : 0);
  }
  return map;
}

/**
 * Audience avg across all rounds (unique voter dedup in pipeline).
 * @returns {Map<string, number>}
 */
async function aggregateAudienceAvgByParticipantIdsAllRounds(
  participantObjectIds,
  seasonId,
) {
  if (!participantObjectIds.length) return new Map();

  const seasonObjectId = new mongoose.Types.ObjectId(seasonId);
  const baseMatch = {
    seasonId: seasonObjectId,
    participantId: { $in: participantObjectIds },
    step: "final",
    isValid: true,
    voterType: "audience",
  };

  const pipeline = [
    { $match: baseMatch },
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
        _id: {
          participantId: "$participantId",
          voterIdentifier: "$voterIdentifier",
        },
        starsSum: { $sum: "$stars" },
      },
    },
    {
      $group: {
        _id: "$_id.participantId",
        totalStars: { $sum: "$starsSum" },
        totalVoters: { $sum: 1 },
      },
    },
  ];

  const rows = await Vote.aggregate(pipeline);
  const map = new Map();
  for (const r of rows) {
    const pid = String(r._id);
    const tv = Number(r.totalVoters || 0);
    const ts = Number(r.totalStars || 0);
    map.set(pid, tv > 0 ? ts / tv : 0);
  }
  return map;
}

/**
 * @returns {Map<string, number>} chapterName -> count of groupKeys where this chapter is #1
 */
function computeFirstWinsByChapterFromLeaderboard(
  competitorsByGroupKey,
  avgStarsByParticipant,
) {
  const wins = new Map();

  for (const [, entries] of competitorsByGroupKey) {
    if (!entries.length) continue;
    const sorted = [...entries].sort((a, b) => {
      const as = avgStarsByParticipant.get(a.participantId) ?? 0;
      const bs = avgStarsByParticipant.get(b.participantId) ?? 0;
      if (bs !== as) return bs - as;
      return a.registeredAtMs - b.registeredAtMs;
    });
    const w = sorted[0];
    const ch = w.chapterName;
    wins.set(ch, (wins.get(ch) || 0) + 1);
  }
  return wins;
}

/**
 * Top 3 per groupKey → 15/10/5 to that row’s chapter; chapter max across keys.
 * @returns {Map<string, number>} chapterName -> best placement points
 */
function computeGroupPlacementByChapterFromLeaderboard(
  competitorsByGroupKey,
  avgStarsByParticipant,
) {
  const best = new Map();

  for (const [, entries] of competitorsByGroupKey) {
    if (!entries.length) continue;
    const sorted = [...entries].sort((a, b) => {
      const as = avgStarsByParticipant.get(a.participantId) ?? 0;
      const bs = avgStarsByParticipant.get(b.participantId) ?? 0;
      if (bs !== as) return bs - as;
      return a.registeredAtMs - b.registeredAtMs;
    });
    const topN = Math.min(3, sorted.length);
    for (let i = 0; i < topN; i++) {
      const pts = PODIUM_PLACEMENT_POINTS[i];
      const ch = sorted[i].chapterName;
      best.set(ch, Math.max(best.get(ch) ?? 0, pts));
    }
  }
  return best;
}

async function computeMostTalentedChapterScores({ seasonId, roundId = null }) {
  if (!seasonId || !mongoose.Types.ObjectId.isValid(seasonId)) {
    throw new Error("Invalid or missing seasonId");
  }

  const seasonObjectId = new mongoose.Types.ObjectId(seasonId);
  const season = await Season.findById(seasonObjectId).select("rounds").lean();
  if (!season) {
    throw new Error("Season not found");
  }

  const warnings = [];
  if (!roundId) {
    warnings.push(
      "All rounds: First×3, group rank, and audience use votes merged across the whole season (no single round).",
    );
  } else {
    if (!mongoose.Types.ObjectId.isValid(roundId)) {
      throw new Error("Invalid roundId");
    }
    const roundOk = (season.rounds || []).some(
      (r) => String(r?._id) === String(roundId),
    );
    if (!roundOk) {
      throw new Error("roundId does not belong to this season");
    }
    warnings.push(
      "Single round: First×3, group rank, and audience use only this round’s votes.",
    );
  }

  /** @type {Map<string, { participantIds: Set<string>, hasGroupParticipation: boolean }>} */
  const byChapter = new Map();

  const competitorsByGroupKey = new Map();
  const seenParticipantGroupKey = new Set();

  const participants = await Participant.find({
    contests: { $elemMatch: { contest: seasonObjectId } },
  })
    .select("_id contests")
    .lean();

  for (const p of participants) {
    const pid = String(p._id);
    const contests = p.contests || [];
    for (const c of contests) {
      if (String(c.contest) !== String(seasonObjectId)) continue;
      if (c.status !== "active") continue;

      const chapter = normalizeChapterName(c.chapterName);
      if (!byChapter.has(chapter)) {
        byChapter.set(chapter, {
          participantIds: new Set(),
          hasGroupParticipation: false,
        });
      }
      const agg = byChapter.get(chapter);
      agg.participantIds.add(pid);

      const gk = buildGroupKey(c);
      if (gk) {
        const pairKey = `${pid}|${gk}`;
        if (!seenParticipantGroupKey.has(pairKey)) {
          seenParticipantGroupKey.add(pairKey);
          if (!competitorsByGroupKey.has(gk)) {
            competitorsByGroupKey.set(gk, []);
          }
          const regMs = c.registeredAt
            ? new Date(c.registeredAt).getTime()
            : 0;
          competitorsByGroupKey.get(gk).push({
            participantId: pid,
            chapterName: normalizeChapterName(c.chapterName),
            registeredAtMs: regMs,
          });
        }
      }

      if (isGroupSubCategory(c.subCategory)) {
        agg.hasGroupParticipation = true;
      }
    }
  }

  let firstWinsByChapter = new Map();
  let groupPlacementByChapter = new Map();
  if (competitorsByGroupKey.size > 0) {
    const avgStarsByParticipant = roundId
      ? await aggregateAvgStarsByParticipantForRound(seasonId, roundId)
      : await aggregateAvgStarsByParticipantAllRounds(seasonId);
    firstWinsByChapter = computeFirstWinsByChapterFromLeaderboard(
      competitorsByGroupKey,
      avgStarsByParticipant,
    );
    groupPlacementByChapter = computeGroupPlacementByChapterFromLeaderboard(
      competitorsByGroupKey,
      avgStarsByParticipant,
    );
  }

  const allParticipantObjectIds = [];
  const seen = new Set();
  for (const [, agg] of byChapter) {
    for (const id of agg.participantIds) {
      if (!seen.has(id)) {
        seen.add(id);
        allParticipantObjectIds.push(new mongoose.Types.ObjectId(id));
      }
    }
  }

  const audienceMap = roundId
    ? await aggregateAudienceAvgByParticipantIds(
        allParticipantObjectIds,
        seasonId,
        roundId,
      )
    : await aggregateAudienceAvgByParticipantIdsAllRounds(
        allParticipantObjectIds,
        seasonId,
      );

  const chapters = [];

  for (const [chapterName, agg] of byChapter) {
    const pHeadcount = agg.participantIds.size;
    const firstPlaceEntryCount = firstWinsByChapter.get(chapterName) || 0;
    const pFirstInCategory = firstPlaceEntryCount * POINTS_PER_FIRST;
    const pGroupParticipation = agg.hasGroupParticipation
      ? GROUP_PARTICIPATION_BONUS
      : 0;
    const pGroupPlacement = groupPlacementByChapter.get(chapterName) || 0;

    let sumAudience = 0;
    let nAudience = 0;
    for (const pid of agg.participantIds) {
      sumAudience += audienceMap.get(pid) ?? 0;
      nAudience += 1;
    }
    const pAudienceAverage = nAudience > 0 ? sumAudience / nAudience : 0;

    const grandTotal =
      pHeadcount +
      pFirstInCategory +
      pGroupParticipation +
      pGroupPlacement +
      pAudienceAverage;

    chapters.push({
      chapterName,
      pHeadcount,
      firstPlaceEntryCount,
      pFirstInCategory,
      pGroupParticipation,
      pGroupPlacement,
      pAudienceAverage: Number(pAudienceAverage.toFixed(4)),
      grandTotal: Number(grandTotal.toFixed(4)),
      participantCountForAudience: nAudience,
    });
  }

  chapters.sort((a, b) => {
    if (b.grandTotal !== a.grandTotal) return b.grandTotal - a.grandTotal;
    return String(a.chapterName).localeCompare(String(b.chapterName));
  });

  return {
    seasonId: String(seasonObjectId),
    roundId: roundId ? String(roundId) : null,
    aggregationMode: roundId ? "single_round" : "all_rounds",
    computedAt: new Date().toISOString(),
    warnings,
    chapters,
  };
}

module.exports = {
  computeMostTalentedChapterScores,
};
