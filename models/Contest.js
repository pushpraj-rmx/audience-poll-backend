const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ContestSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
      index:true
    },
    description: String,
    longDescription:String,
    startDate: Date,
    endDate: Date,

    logo: {
      type: String,
      // required: true,
    },
    banner: {
      type: String,
      // required: true,
    },
    pdf:{
      type:String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy:{
      type:Schema.Types.ObjectId,
      ref:'User',
      default: null,
    },
    // status: {
    //   type: String,
    //   enum: ["upcoming", "active", "completed", "cancelled"],
    //   default: "upcoming",
    // },

    seasons:[{ type: Schema.Types.ObjectId, ref:"Season"}],

    user: [ { type: Schema.Types.ObjectId, ref:"User"} ]

    // 🔥 Categories defined while creating contest
    // categories: [
    //   {
    //     type: String,
    //     required: true,
    //     trim: true, // e.g. Singing, Dancing, Acting
    //   },
    // ],

    // rounds: [
    //   {
    //     name: {
    //       type: String,
    //       enum: ["audition", "semi-final", "final"],
    //     },
    //     startDate: Date,
    //     endDate: Date,
    //     status: {
    //       type: String,
    //       enum: ["upcoming", "active", "completed", "cancelled"],
    //       default: "upcoming",
    //     },
    //     participants: [
    //       {
    //         type: Schema.Types.ObjectId,
    //         ref: "Participant",
    //       },
    //     ],
    //   },
    // ],

    // assignedAdmins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    // assignedJudges: [{ type: Schema.Types.ObjectId, ref: "User" }],
    // assignedSponsors: [{ type: Schema.Types.ObjectId, ref: "User" }],

    // participants: [{ type: Schema.Types.ObjectId, ref: "Participant" }],

    // isVotingEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contest", ContestSchema);
