const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * One saved “reveal” per season (audit). Upsert on save.
 */
const MostTalentedChapterSnapshotSchema = new Schema(
  {
    seasonId: {
      type: Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      unique: true,
      index: true,
    },
    roundId: {
      type: String,
      default: null,
    },
    /** Full compute payload: chapters, warnings, computedAt, seasonId, roundId */
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    revealedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "MostTalentedChapterSnapshot",
  MostTalentedChapterSnapshotSchema,
);
