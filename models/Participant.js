const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ParticipantSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    profilePhoto: {
      type: String,
    },

    bio: {
      type: String,
    },

    role: {
      type: String,
      default: "participant",
    },

    totalStar: {
      type: Number,
      default: 0,
    },
    // 🔥 Contest registration with selected category
    contests: [
      {
        contest: {
          type: Schema.Types.ObjectId,
          ref: "Season",
          required: true,
        },
        // Optional metadata for group-wise competition
        memberName: {
          type: String,
          default: undefined,
        },
        chapterName: {
          type: String,
          default: undefined,
        },
        category: {
          type: String,
          required: true, // must match contest.categories
        },
        subCategory:{
          type: String,  // must match Contest.subCategories
        },
        // SoloType only applies when subCategory/participationType is "Solo".
        // Keep null/default for backward compatibility with existing rows.
        soloType: {
          type: String,
          enum: ["Junior", "Member", "Teenager", null],
          default: null,
        },
        // Optional grouping identifier for group-wise competition.
        // Format:
        // - Non-solo: `${category}|${subCategory}`
        // - Solo: `${category}|${subCategory}|${soloType}`
        groupKey: {
          type: String,
          default: undefined,
        },
        position: {
          type: String,
          enum: ["participated", "runner up", "third", "second", "first"],
          default: "participated",
        },
        round:[
          {
            roundName : {type: String },
            category: { type: String},
            subCategory: {type: String},
            position: { 
              type: String,
              enum: ["participated","runner_up","third","second","first"],
              default:"participated"
            },
          }
        ],
        status: {
          type: String,
          enum: ["active", "removed"],
          default: "active",
        },
        registeredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Participant', ParticipantSchema);
