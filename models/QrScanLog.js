const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const QrScanLogSchema = new Schema(
{
    contestId: { type: Schema.Types.ObjectId, ref: "Contest", required: true },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season", required: true },
    participantId: { type: Schema.Types.ObjectId, ref: "Participant", required: true },
    roundname: { type: String },

    step: {
      type: String,
      enum: ["scanned", "info_submitted", "voted"],
      default: "scanned",
    },

    // Device and browser details
    deviceId: { type: String, index: true }, // unique hash per device
    deviceBrand: { type: String },
    deviceModel: { type: String },
    osName: { type: String },
    osVersion: { type: String },
    browser: { type: String },
    browserVersion: { type: String },
    ip: { type: String },
    userAgent: { type: String },

    // Optional — track scan location if needed
    location: {
      country: String,
      region: String,
      city: String,
    },

    scannedAt: { type: Date, default: Date.now },
  }
,{timestamps:true})

module.exports = mongoose.model('QrScanLog', QrScanLogSchema);