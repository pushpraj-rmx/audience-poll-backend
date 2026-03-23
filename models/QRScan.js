const mongoose = require("mongoose");

const QrScanSchema = new mongoose.Schema(
  {
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      index: true,
    },
    ip: String,
    fingerprintHash: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Important performance indexes
QrScanSchema.index({ seasonId: 1, participantId: 1 });
QrScanSchema.index({ createdAt: -1 });

module.exports = QrScanSchema;
