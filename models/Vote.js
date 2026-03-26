// const mongoose = require("mongoose");
// const Schema = mongoose.Schema;

// const VoteSchema = new Schema({
//   contestId: { type: Schema.Types.ObjectId, ref: "Contest" },
//   seasonId:{ type:Schema.Types.ObjectId, ref: "Season"},
//   roundName: { type:String, required: true},
//   participantId: { type: Schema.Types.ObjectId, ref: "Participant" },
//   voterType: {
//     type: String,
//     enum: ["audience", "judge", "admin", "super_admin", "sponsor"],
//     required: true,
//   },
//   voterId: { type: Schema.Types.ObjectId, ref: "User", default: null },
//   stars: { type: Number, min: 1, max: 10 },
//   voterDetails: {
//     name: String,
//     email: String,
//     phone: String
//   },
//   step:{
//     type: String,
//     enum: ['scanned', 'info_submitted', 'final'],
//     default: 'scanned'
//   }
// },{timestamps:true});

// module.exports = mongoose.model('Vote', VoteSchema);

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const VoteSchema = new Schema(
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
      type: Schema.Types.ObjectId,
      ref: "Round",
      required: true,
      index: true,
    },
    participantId: {
      type: Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },
    // 🔐 Anti fraud
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },
    fingerprintHash: {
      type: String,
      required: true,
      index: true,
    },
    ip: {
      type: String,
      index: true,
    },
// 👤 Who voted
    voterType: {
      type: String,
      enum: ["audience", "judge", "admin", "super_admin", "sponsor"],
      required: true,
      index: true,
    },
voterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
// ⭐ Stars (null until final step)
    stars: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
    },

    // 🧍 Audience info
    voterDetails: {
      name: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true },
    },
    // 🔁 Lifecycle
    step: {
      type: String,
      enum: ["scanned", "info_submitted", "final"],
      default: "scanned",
      index: true,
    },

    // ⚠️ Admin invalidation
    isValid: {
      type: Boolean,
      default: true,
      index: true,
    },

    // 🧾 Audit trail for revokes (optional; used by admin re-vote flow)
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokeReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

VoteSchema.index(
  { seasonId: 1, roundId: 1, participantId: 1, deviceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      voterType: "audience",
      step: "final",
      isValid: true,
    },
  }
);

module.exports = mongoose.model("Vote", VoteSchema);
