const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const QRCodeSchema = new Schema(
  {
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
      index: true,
    },

    seasonId: {
      type: Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    participantId: {
      type: Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    
    metadata: {
      location: String,
      source: String, // stage_screen / poster / table
    },
  },
  { timestamps: true },
);

/**
 * 🔥 Prevent duplicate QR for same participant in same round
 */
QRCodeSchema.index(
  { seasonId: 1, roundId: 1, participantId: 1 },
  { unique: true }
);

module.exports = mongoose.model("QRCode", QRCodeSchema);
