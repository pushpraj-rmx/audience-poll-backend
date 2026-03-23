const { default: mongoose } = require("mongoose");

const DeviceSchema = new mongoose.Schema(
  {
    fingerprintHash: {
      type: String,
      unique: true,
      index: true,
    },
    browser: String,
    os: String,
    deviceType: String,
    firstSeenAt: Date,
    lastSeenAt: Date,
    totalScans: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

DeviceSchema.index({ os: 1 });
DeviceSchema.index({ browser: 1 });

module.exports = mongoose.model("Device", DeviceSchema);
