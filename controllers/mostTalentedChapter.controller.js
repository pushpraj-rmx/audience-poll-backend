const mongoose = require("mongoose");
const {
  computeMostTalentedChapterScores,
} = require("../services/mostTalentedChapter.service");
const MostTalentedChapterSnapshot = require("../models/MostTalentedChapterSnapshot");

function parseRoundId(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

function validateObjectId(id, label) {
  const s = String(id || "").trim();
  if (!s) return { ok: false, message: `${label} is required` };
  if (!mongoose.Types.ObjectId.isValid(s)) {
    return { ok: false, message: `Invalid ${label}` };
  }
  return { ok: true, value: s };
}

/**
 * GET /api/admin/most-talented-chapter/:seasonId?roundId=<optional>
 * Auth: super_admin, admin
 */
exports.getMostTalentedChapterScores = async (req, res) => {
  try {
    const seasonCheck = validateObjectId(req.params.seasonId, "seasonId");
    if (!seasonCheck.ok) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SEASON_ID",
        message: seasonCheck.message,
      });
    }

    const roundId = parseRoundId(req.query.roundId);
    if (roundId) {
      const rCheck = validateObjectId(roundId, "roundId");
      if (!rCheck.ok) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ROUND_ID",
          message: rCheck.message,
        });
      }
    }

    const data = await computeMostTalentedChapterScores({
      seasonId: seasonCheck.value,
      roundId,
    });
    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    const msg =
      error?.message || "Failed to compute Most Talented Chapter scores";
    let status = 500;
    let code = "COMPUTE_ERROR";
    if (msg.includes("not found")) {
      status = 404;
      code = "SEASON_OR_ROUND_NOT_FOUND";
    } else if (
      msg.includes("Invalid") ||
      msg.includes("does not belong") ||
      msg.includes("missing")
    ) {
      status = 400;
      code = "BAD_REQUEST";
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[mostTalentedChapter] getMostTalentedChapterScores:", error);
    } else {
      console.error("[mostTalentedChapter] getMostTalentedChapterScores:", msg);
    }
    return res.status(status).json({
      success: false,
      code,
      message: msg,
    });
  }
};

/**
 * GET /api/admin/most-talented-chapter/:seasonId/snapshot
 * Last saved audit snapshot (B3).
 */
exports.getMostTalentedChapterSnapshot = async (req, res) => {
  try {
    const seasonCheck = validateObjectId(req.params.seasonId, "seasonId");
    if (!seasonCheck.ok) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SEASON_ID",
        message: seasonCheck.message,
      });
    }

    const doc = await MostTalentedChapterSnapshot.findOne({
      seasonId: new mongoose.Types.ObjectId(seasonCheck.value),
    }).lean();

    if (!doc) {
      // 200 (not 404) so page load / devtools don’t show a failed request when no snapshot exists yet
      return res.status(200).json({
        success: true,
        hasSnapshot: false,
        message: "No snapshot saved for this season yet",
      });
    }

    const payload = doc.payload || {};
    return res.status(200).json({
      success: true,
      hasSnapshot: true,
      fromSnapshot: true,
      snapshotSavedAt: doc.updatedAt || doc.createdAt,
      revealedBy: doc.revealedBy || null,
      ...payload,
    });
  } catch (error) {
    console.error("[mostTalentedChapter] getMostTalentedChapterSnapshot:", error);
    return res.status(500).json({
      success: false,
      code: "SNAPSHOT_READ_ERROR",
      message: error?.message || "Failed to read snapshot",
    });
  }
};

/**
 * POST /api/admin/most-talented-chapter/:seasonId/snapshot
 * Body: { roundId?: string } — compute + upsert audit row (B3).
 */
exports.saveMostTalentedChapterSnapshot = async (req, res) => {
  try {
    const seasonCheck = validateObjectId(req.params.seasonId, "seasonId");
    if (!seasonCheck.ok) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SEASON_ID",
        message: seasonCheck.message,
      });
    }

    const roundId = parseRoundId(req.body?.roundId);
    if (roundId) {
      const rCheck = validateObjectId(roundId, "roundId");
      if (!rCheck.ok) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ROUND_ID",
          message: rCheck.message,
        });
      }
    }

    const data = await computeMostTalentedChapterScores({
      seasonId: seasonCheck.value,
      roundId,
    });

    const revealedByRaw = req.user?.userId || req.user?.id;
    const revealedBy =
      revealedByRaw && mongoose.Types.ObjectId.isValid(String(revealedByRaw))
        ? new mongoose.Types.ObjectId(String(revealedByRaw))
        : null;

    await MostTalentedChapterSnapshot.findOneAndUpdate(
      { seasonId: new mongoose.Types.ObjectId(seasonCheck.value) },
      {
        seasonId: new mongoose.Types.ObjectId(seasonCheck.value),
        roundId: data.roundId || null,
        payload: data,
        ...(revealedBy ? { revealedBy } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return res.status(200).json({
      success: true,
      snapshotSaved: true,
      snapshotSavedAt: new Date().toISOString(),
      ...data,
    });
  } catch (error) {
    const msg =
      error?.message || "Failed to save Most Talented Chapter snapshot";
    let status = 500;
    if (msg.includes("not found")) status = 404;
    else if (msg.includes("Invalid") || msg.includes("does not belong") || msg.includes("missing"))
      status = 400;
    console.error("[mostTalentedChapter] saveMostTalentedChapterSnapshot:", error);
    return res.status(status).json({
      success: false,
      code: "SNAPSHOT_SAVE_ERROR",
      message: msg,
    });
  }
};
