const Participant = require("../models/Participant");
const mongoose = require("mongoose");
const User = require("../models/User");
const Contest = require("../models/Contest");
const Season = require("../models/seasons");
const Vote = require("../models/Vote");
const QrScanLog = require("../models/QrScanLog");
const Seasons = require("../models/seasons");

// exports.total = async (req, res) => {
//   try {
//     const participantId = req.user?.userId;
//     const { contestId } = req.params;

//     // Run all queries in PARALLEL
//     const [
//       users,
//       admins,
//       sponsors,
//       judges,
//       participants,
//       contests,
//       activeContests,
//       activeContestsList,
//       upcomingContestsList,
//       completedContests,
//       upcomingContests,
//       cancelledContest,
//       totalStarsResult,
//     ] = await Promise.all([
//       User.countDocuments(),
//       User.countDocuments({ role: "admin" }),
//       User.countDocuments({ role: "sponsor" }),
//       User.countDocuments({ role: "judge" }),
//       Participant.countDocuments(),
//       Season.countDocuments(),
//       Season.countDocuments({ status: "active" }),
//       Season.find({ status: "active" }),
//       Season.find({ status: "upcoming" }),
//       Season.countDocuments({ status: "completed" }),
//       Season.countDocuments({ status: "upcoming" }),
//       Season.countDocuments({ status: "cancelled" }),

//       // Vote aggregation (if participantId exists)
//       participantId
//         ? Vote.aggregate([
//             {
//               $match: {
//                 participantId: new mongoose.Types.ObjectId(participantId),
//               },
//             },
//             { $group: { _id: null, totalStars: { $sum: "$stars" } } },
//           ])
//         : Promise.resolve([]),
//     ]);

//     const totalStars = totalStarsResult.length
//       ? totalStarsResult[0].totalStars
//       : 0;

//     return res.status(200).json({
//       totalUsers: users,
//       totalAdmins: admins,
//       totalSponsors: sponsors,
//       totalJudges: judges,
//       totalParticipants: participants,
//       totalContests: contests,
//       totalActiveContests: activeContests,
//       activeContestsList,
//       upcomingContestsList,
//       totalCompletedContests: completedContests,
//       totalUpcomingContests: upcomingContests,
//       totalCancelledContest: cancelledContest,
//       totalStars,
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };


// exports.total = async (req, res) => {
//   try {
//     const participantId = req.user?.userId;
//     const { contestId } = req.params;

//     /* -------------------- Validate contestId -------------------- */
//     if (contestId && !mongoose.Types.ObjectId.isValid(contestId)) {
//       return res.status(400).json({ message: "Invalid contestId" });
//     }

//     const seasonFilter = contestId
//       ? { contestId: new mongoose.Types.ObjectId(contestId) }
//       : {};

//     /* -------------------- Parallel Queries -------------------- */
//     const [
//       users,
//       admins,
//       sponsors,
//       judges,
//       participants,

//       totalSeasons,
//       activeSeasons,
//       upcomingSeasons,
//       completedSeasons,
//       cancelledSeasons,

//       activeSeasonsList,
//       upcomingSeasonsList,

//       totalStarsResult,
//     ] = await Promise.all([
//       User.countDocuments(),
//       User.countDocuments({ role: "admin" }),
//       User.countDocuments({ role: "sponsor" }),
//       User.countDocuments({ role: "judge" }),
//       Participant.countDocuments(),

//       // 🟢 Seasons (contest scoped)
//       Season.countDocuments(seasonFilter),
//       Season.countDocuments({ ...seasonFilter, status: "active" }),
//       Season.countDocuments({ ...seasonFilter, status: "upcoming" }),
//       Season.countDocuments({ ...seasonFilter, status: "completed" }),
//       Season.countDocuments({ ...seasonFilter, status: "cancelled" }),

//       // 📄 Season lists
//       Season.find({ ...seasonFilter, status: "active" })
//         .select("title slug startDate endDate status logo banner")
//         .sort({ createdAt: -1 }),

//       Season.find({ ...seasonFilter, status: "upcoming" })
//         .select("title slug startDate endDate status logo banner")
//         .sort({ createdAt: -1 }),

//       // ⭐ Stars aggregation
//       participantId
//         ? Vote.aggregate([
//             {
//               $match: {
//                 participantId: new mongoose.Types.ObjectId(participantId),
//               },
//             },
//             {
//               $group: {
//                 _id: null,
//                 totalStars: { $sum: "$stars" },
//               },
//             },
//           ])
//         : Promise.resolve([]),
//     ]);

//     const totalStars = totalStarsResult.length
//       ? totalStarsResult[0].totalStars
//       : 0;

//     return res.status(200).json({
//       // 👤 Users
//       totalUsers: users,
//       totalAdmins: admins,
//       totalSponsors: sponsors,
//       totalJudges: judges,
//       totalParticipants: participants,

//       // 🏆 Seasons
//       totalSeasons,
//       totalActiveSeasons: activeSeasons,
//       totalUpcomingSeasons: upcomingSeasons,
//       totalCompletedSeasons: completedSeasons,
//       totalCancelledSeasons: cancelledSeasons,

//       activeSeasonsList,
//       upcomingSeasonsList,

//       // ⭐ Votes
//       totalStars,
//     });
//   } catch (error) {
//     console.error("total controller error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

exports.total = async (req, res) => {
  try {
    const participantId = req.user?.userId;
    const { contestId } = req.params;

    /* -------------------- Validation -------------------- */
    if (!contestId || !mongoose.Types.ObjectId.isValid(contestId)) {
      return res.status(400).json({ message: "Valid contestId is required" });
    }

    const contestObjectId = new mongoose.Types.ObjectId(contestId);

    /* -------------------- Parallel Queries -------------------- */
    const [
      users,
      admins,
      sponsors,
      judges,
      participants,

      // 🏆 Season totals (contest scoped)
      totalSeasons,
      activeSeasons,
      upcomingSeasons,
      completedSeasons,
      cancelledSeasons,

      // 📄 Season lists
      activeSeasonsList,
      upcomingSeasonsList,

      // 🧍‍♂️ Participant season participation count
      participantSeasonCount,

      // ⭐ Stars
      totalStarsResult,
    ] = await Promise.all([
      // 👤 Users
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "sponsor" }),
      User.countDocuments({ role: "judge" }),
      Participant.countDocuments(),

      // 🏆 Seasons (by contest + status)
      Season.countDocuments({ contestId: contestObjectId }),
      Season.countDocuments({ contestId: contestObjectId, status: "active" }),
      Season.countDocuments({ contestId: contestObjectId, status: "upcoming" }),
      Season.countDocuments({ contestId: contestObjectId, status: "completed" }),
      Season.countDocuments({ contestId: contestObjectId, status: "cancelled" }),

      // 📄 Lists
      Season.find({ contestId: contestObjectId, status: "active" })
        .select("title slug startDate endDate status logo banner")
        .sort({ createdAt: -1 }),

      Season.find({ contestId: contestObjectId, status: "upcoming" })
        .select("title slug startDate endDate status logo banner")
        .sort({ createdAt: -1 }),

      // 🧍‍♂️ Seasons where participant is present
      participantId
        ? Season.countDocuments({
            contestId: contestObjectId,
            participants: new mongoose.Types.ObjectId(participantId),
          })
        : Promise.resolve(0),

      // ⭐ Vote stars
      participantId
        ? Vote.aggregate([
            {
              $match: {
                participantId: new mongoose.Types.ObjectId(participantId),
              },
            },
            {
              $group: {
                _id: null,
                totalStars: { $sum: "$stars" },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const totalStars = totalStarsResult.length
      ? totalStarsResult[0].totalStars
      : 0;

    /* -------------------- Response -------------------- */
    return res.status(200).json({
      // 👤 Users
      totalUsers: users,
      totalAdmins: admins,
      totalSponsors: sponsors,
      totalJudges: judges,
      totalParticipants: participants,

      // 🏆 Seasons (contest scoped)
      totalSeasons,
      totalActiveSeasons: activeSeasons,
      totalUpcomingSeasons: upcomingSeasons,
      totalCompletedSeasons: completedSeasons,
      totalCancelledSeasons: cancelledSeasons,

      activeSeasonsList,
      upcomingSeasonsList,

      // 🧍‍♂️ Participant
      participantSeasonCount,

      // ⭐ Votes
      totalStars,
    });
  } catch (error) {
    console.error("total controller error:", error);
    return res.status(500).json({ error: error.message });
  }
};


exports.totalsForSuperAdmin = async (req,res )=>{
  try {
    const [ totalUsers, totalParticipants, totalContests, activeSeasonsList, upcomingSeasonList, activeSeasonCount, upcomingSeasonCount, completedSeasonCount, cancelledSeasonCount ] = await Promise.all([
      User.countDocuments(),
      Participant.countDocuments(),
      Season.countDocuments(),
      Season.find({ status: "active" })
        .select("_id title slug startDate endDate status contestId")
        .populate("contestId", "title slug"),
      Season.find({ status: "upcoming" })
        .select("_id title slug startDate endDate status contestId")
        .populate("contestId", "title slug"),
      Season.countDocuments({status: "active"}),
      Season.countDocuments({status: "upcoming"}),
      Season.countDocuments({status: "completed"}),
      Season.countDocuments({status: "cancelled"}),
    ])

    res.status(200).json({
      totalUsers,
      totalParticipants,
      totalContests,
      activeSeasonsList,
      upcomingSeasonList,
      activeSeasonCount,
      upcomingSeasonCount,
      completedSeasonCount,
      cancelledSeasonCount
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({error:error.message})
  }
}


exports.getRegistrationsByContest = async (req, res) => {
  try {
    // Fetch all contests with participant count
    const contests = await Contest.find({}, "title participants").lean();

    const labels = contests.map((c) => c.title);
    const data = contests.map((c) => c.participants.length);

    res.status(200).json({ labels, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// exports.getVotesPerContestForParticipant = async (req, res) => {
//   try {
//     if (!req.user.userId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Participant ID required" });
//     }

//     // Convert participantId string to ObjectId
//     const participantId = new mongoose.Types.ObjectId(req.user.userId);

//     // 1️⃣ Find contests that the participant is part of
//     const contests = await Contest.find({ participants: participantId }).select(
//       "_id title",
//     );

//     if (!contests.length) {
//       return res.status(200).json({ success: true, data: [] });
//     }

//     // 2️⃣ Extract contest IDs (should already be ObjectId)
//     const contestIds = contests.map((c) => c._id);

//     // 3️⃣ Optional: Check if votes exist for this participant
//     const testVotes = await Vote.find({ participantId: participantId });

//     // 4️⃣ Aggregate total stars per contest for this participant
//     const votes = await Vote.aggregate([
//       {
//         $match: {
//           contestId: { $in: contestIds },
//           participantId: participantId,
//         },
//       },
//       {
//         $group: {
//           _id: "$contestId",
//           totalStars: { $sum: "$stars" },
//         },
//       },
//       {
//         $lookup: {
//           from: "contests",
//           localField: "_id",
//           foreignField: "_id",
//           as: "contest",
//         },
//       },
//       { $unwind: "$contest" },
//       {
//         $project: {
//           _id: 0,
//           contestId: "$contest._id",
//           contestTitle: "$contest.title",
//           totalStars: 1,
//         },
//       },
//     ]);

//     return res.status(200).json({ success: true, data: votes });
//   } catch (error) {
//     console.error("Error fetching votes per contest for participant:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };


exports.getVotesPerSeasonForParticipant = async (req, res) => {
  try {
    const { seasonId } = req.params;

    if (!seasonId || !mongoose.Types.ObjectId.isValid(seasonId)) {
      return res.status(400).json({
        success: false,
        message: "Valid contestId is required",
      });
    }

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const seasonObjectId = new mongoose.Types.ObjectId(seasonId);
    const participantObjectId = new mongoose.Types.ObjectId(req.user.userId);

    /* ===========================
       AGGREGATION
    =========================== */
    const pipeline = [
      {
        $match: {
          seasonId: seasonObjectId,
          participantId: participantObjectId,
        },
      },

      /* ===========================
         GROUP BY SEASON
      =========================== */
      {
        $group: {
          _id: "$seasonId",
          totalVotes: { $sum: 1 },
          totalStars: { $sum: "$stars" },
        },
      },

      /* ===========================
         JOIN SEASON
      =========================== */
      {
        $lookup: {
          from: "seasons",
          localField: "_id",
          foreignField: "_id",
          as: "season",
        },
      },
      { $unwind: "$season" },

      /* ===========================
         FINAL SHAPE (BAR GRAPH READY)
      =========================== */
      {
        $project: {
          _id: 0,
          seasonId: "$season._id",
          seasonTitle: "$season.title",
          totalVotes: 1,
          totalStars: 1,
        },
      },

      /* ===========================
         SORT BY SEASON START DATE
      =========================== */
      { $sort: { "season.startDate": 1 } },
    ];

    const data = await Vote.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      seasonId,
      participantId: req.user.userId,
      data,
    });
  } catch (error) {
    console.error("Error in getVotesPerSeasonForParticipant:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch votes per season",
      error: error.message,
    });
  }
};

exports.getStarsPerRoundForParticipant = async (req, res) => {
  try {
    const participantId = req.user.userId;
    const { seasonId, roundName } = req.params; // Expect contestId from query string

    if (!seasonId) {
      return res
        .status(400)
        .json({ success: false, message: "seasonId is required" });
    }

    // Aggregate total stars grouped by roundName for the selected contest
    const data = await Vote.aggregate([
      {
        $match: {
          participantId: new mongoose.Types.ObjectId(participantId),
          seasonId: new mongoose.Types.ObjectId(seasonId),
        },
      },
      {
        $group: {
          _id: "$roundName",
          totalStars: { $sum: "$stars" },
        },
      },
    ]);

    // Format for frontend
    const result = data.map((item) => ({
      roundName: item._id,
      totalStars: item.totalStars,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// exports.getVotingAnalytics = async (req, res) => {
//   try {
//     const { contestId, roundName, participantId } = req.query;

//     if (!contestId) {
//       return res.status(400).json({ message: "contestId is required" });
//     }

//     // Base match condition
//     const match = { contestId: new mongoose.Types.ObjectId(contestId) };
//     if (roundName) match.roundName = roundName;
//     if (participantId) match.participantId = new mongoose.Types.ObjectId(participantId);

//     let groupStage = {};
//     let lookupStage = {};
//     let labelField = "";

//     // CASE 1: Contest only -> total stars per participant
//     if (contestId && !roundName && !participantId) {
//       groupStage = { _id: "$participantId", totalStars: { $sum: "$stars" } };
//       lookupStage = {
//         from: "participants",
//         localField: "_id",
//         foreignField: "_id",
//         as: "participant",
//       };
//       labelField = "participant.name";
//     }

//     // CASE 2: Contest + Round -> total stars for participants in that round
//     else if (contestId && roundName && !participantId) {
//       groupStage = { _id: "$participantId", totalStars: { $sum: "$stars" } };
//       lookupStage = {
//         from: "participants",
//         localField: "_id",
//         foreignField: "_id",
//         as: "participant",
//       };
//       labelField = "participant.name";
//     }

//     // CASE 3: Contest + Round + Participant -> total stars per round
//     else if (contestId && participantId) {
//       groupStage = { _id: "$roundName", totalStars: { $sum: "$stars" } };
//       labelField = "_id"; // roundName is the label
//     }

//     const pipeline = [
//       { $match: match },
//       { $group: groupStage },
//     ];

//     if (lookupStage.from) pipeline.push({ $lookup: lookupStage });

//     // Simplify result structure
//     const results = await Vote.aggregate(pipeline);

//     // Format response for charts
//     const formatted = results.map((r) => ({
//       label:
//         labelField === "_id"
//           ? r._id
//           : r.participant?.[0]?.name || "Unknown",
//       totalStars: r.totalStars,
//     }));

//     return res.status(200).json({
//       success: true,
//       contestId,
//       roundName: roundName || null,
//       participantId: participantId || null,
//       data: formatted,
//     });
//   } catch (err) {
//     console.error("Error in getVotingAnalytics:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch analytics",
//       error: err.message,
//     });
//   }
// };

// Get total stars by contest

// exports.getVotingAnalytics = async (req, res) => {
//   try {
//     console.log("getVotingAnalytics called");
//     const { seasonId, roundName, participantId, category } = req.query;
//     console.log("Analytics Query Params:", req.query);

//     if (!seasonId) {
//       return res.status(400).json({ message: "seasonId is required" });
//     }

//     // 🔹 Base match for votes
//     const match = {
//       seasonId: new mongoose.Types.ObjectId(seasonId),
//     };

//     if (roundName) match.roundName = roundName;
//     if (participantId)
//       match.participantId = new mongoose.Types.ObjectId(participantId);

//     let groupStage = {};
//     let lookupParticipantStage = null;
//     let labelResolver = null;

//     /**
//      * CASE 1: Contest only
//      * → Total stars per participant
//      */
//     if (seasonId && !roundName && !participantId) {
//       groupStage = {
//         _id: "$participantId",
//         totalStars: { $sum: "$stars" },
//       };

//       lookupParticipantStage = {
//         from: "participants",
//         localField: "_id",
//         foreignField: "_id",
//         as: "participant",
//       };

//       labelResolver = (r) => r.participant?.[0]?.name || "Unknown";
//     } else if (seasonId && roundName && !participantId) {

//     /**
//      * CASE 2: Season + Round
//      * → Total stars per participant in that round
//      */
//       groupStage = {
//         _id: "$participantId",
//         totalStars: { $sum: "$stars" },
//       };

//       lookupParticipantStage = {
//         from: "participants",
//         localField: "_id",
//         foreignField: "_id",
//         as: "participant",
//       };

//       labelResolver = (r) => r.participant?.[0]?.name || "Unknown";
//     } else if (seasonId && participantId) {

//     /**
//      * CASE 3: Contest + Participant
//      * → Total stars per round
//      */
//       groupStage = {
//         _id: "$roundName",
//         totalStars: { $sum: "$stars" },
//       };

//       labelResolver = (r) => r._id; // roundName
//     }

//     const pipeline = [
//       { $match: match },

//       // 🔥 Join contest to filter by category
//       {
//         $lookup: {
//           from: "contests",
//           localField: "contestId",
//           foreignField: "_id",
//           as: "contest",
//         },
//       },
//       { $unwind: "$contest" },
//     ];

//     // 🔹 Apply category filter (if provided)
//     if (category) {
//       pipeline.push({
//         $match: {
//           "contest.categories": category,
//         },
//       });
//     }

//     // 🔹 Group analytics
//     pipeline.push({ $group: groupStage });

//     // 🔹 Participant lookup if required
//     if (lookupParticipantStage) {
//       pipeline.push({ $lookup: lookupParticipantStage });
//     }

//     const results = await Vote.aggregate(pipeline);

//     // 🔹 Final response formatting
//     const formatted = results.map((r) => ({
//       label: labelResolver(r),
//       totalStars: r.totalStars,
//     }));

//     return res.status(200).json({
//       success: true,
//       contestId,
//       roundName: roundName || null,
//       participantId: participantId || null,
//       category: category || null,
//       data: formatted,
//     });
//   } catch (err) {
//     console.error("Error in getVotingAnalytics:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch analytics",
//       error: err.message,
//     });
//   }
// };

exports.getVotingAnalytics = async (req, res) => {
  try {
    const { seasonId, roundName, participantId, category } = req.query;

    if (!seasonId) {
      return res.status(400).json({
        success: false,
        message: "seasonId is required",
      });
    }

    /* -------------------- Base Match -------------------- */
    const matchStage = {
      seasonId: new mongoose.Types.ObjectId(seasonId),
    };

    if (roundName) matchStage.roundName = roundName;
    if (participantId) {
      matchStage.participantId = new mongoose.Types.ObjectId(participantId);
    }

    /* -------------------- Aggregation Logic -------------------- */
    let groupStage = {};
    let lookupStages = [];
    let labelResolver = null;

    /**
     * CASE 1 & 2
     * Season OR Season + Round
     * → Stars per participant
     */
    if (!participantId) {
      groupStage = {
        _id: "$participantId",
        totalStars: { $sum: "$stars" },
      };

      lookupStages.push(
        {
          $lookup: {
            from: "participants",
            localField: "_id",
            foreignField: "_id",
            as: "participant",
          },
        },
        { $unwind: "$participant" }
      );

      /* 🔹 Category filter (from participant.contests) */
      if (category) {
        lookupStages.push({
          $match: {
            "participant.contests": {
              $elemMatch: {
                contest: new mongoose.Types.ObjectId(seasonId),
                category,
                status: "active",
              },
            },
          },
        });
      }

      labelResolver = (r) => r.participant.name;
    }

    /**
     * CASE 3
     * Season + Participant
     * → Stars per round
     */
    if (participantId) {
      groupStage = {
        _id: "$roundName",
        totalStars: { $sum: "$stars" },
      };

      labelResolver = (r) => r._id;
    }

    /* -------------------- Pipeline -------------------- */
    const pipeline = [
      { $match: matchStage },
      { $group: groupStage },
      ...lookupStages,
      { $sort: { totalStars: -1 } },
    ];

    const results = await Vote.aggregate(pipeline);

    /* -------------------- Response Format -------------------- */
    const data = results.map((r) => ({
      label: labelResolver(r),
      totalStars: r.totalStars,
    }));

    return res.status(200).json({
      success: true,
      seasonId,
      roundName: roundName || null,
      participantId: participantId || null,
      category: category || null,
      data,
    });
  } catch (error) {
    console.error("Voting Analytics Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch voting analytics",
      error: error.message,
    });
  }
};

exports.getTotalStarsByContest = async (req, res) => {
  try {
    const totalStarsByContest = await Vote.aggregate([
      {
        $group: {
          _id: "$contestId",
          totalStars: { $sum: "$stars" },
          totalVotes: { $sum: 1 },
          averageStars: { $avg: "$stars" },
        },
      },
      {
        $lookup: {
          from: "contests",
          localField: "_id",
          foreignField: "_id",
          as: "contest",
        },
      },
      {
        $unwind: "$contest",
      },
      {
        $project: {
          _id: 0,
          contestId: "$_id",
          contestTitle: "$contest.title",
          totalStars: 1,
          totalVotes: 1,
          averageStars: { $round: ["$averageStars", 2] },
        },
      },
      {
        $sort: { totalStars: -1 },
      },
    ]);

    // Format data as labels and data arrays for chart/display
    const labels = totalStarsByContest.map((item) => item.contestTitle);
    const data = totalStarsByContest.map((item) => item.totalStars);

    res.status(200).json({
      success: true,
      message: "Total stars by contest fetched successfully",
      labels: labels,
      data: data,
      details: totalStarsByContest,
    });
  } catch (err) {
    console.error("Error in getTotalStarsByContest:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch total stars by contest",
      error: err.message,
    });
  }
};

// Get total unique voters by contest with optional roundName and participantId filtering
// exports.getTotalVoterByContest = async (req, res) => {
//   try {
//     const { contestId, roundName, participantId } = req.query;

//     if (!contestId) {
//       return res.status(400).json({ success: false, message: "contestId is required" });
//     }

//     // Base match condition
//     const match = { contestId: new mongoose.Types.ObjectId(contestId) };
//     if (roundName) match.roundName = roundName;
//     if (participantId) match.participantId = new mongoose.Types.ObjectId(participantId);

//     let groupStage = {};
//     let lookupStage = {};
//     let labelField = "";

//     // CASE 1: Contest only -> total unique voters per participant
//     if (contestId && !roundName && !participantId) {
//       groupStage = {
//         _id: "$participantId",
//         totalVoters: { $addToSet: "$voterId" },
//         totalVotes: { $sum: 1 }
//       };
//       lookupStage = {
//         from: "participants",
//         localField: "_id",
//         foreignField: "_id",
//         as: "participant",
//       };
//       labelField = "participant.name";
//     }

//     // CASE 2: Contest + Round -> total unique voters for participants in that round
//     else if (contestId && roundName && !participantId) {
//       groupStage = {
//         _id: "$participantId",
//         totalVoters: { $addToSet: "$voterId" },
//         totalVotes: { $sum: 1 }
//       };
//       lookupStage = {
//         from: "participants",
//         localField: "_id",
//         foreignField: "_id",
//         as: "participant",
//       };
//       labelField = "participant.name";
//     }

//     // CASE 3: Contest + Participant -> total unique voters per round for that participant
//     else if (contestId && participantId && !roundName) {
//       groupStage = {
//         _id: "$roundName",
//         totalVoters: { $addToSet: "$voterId" },
//         totalVotes: { $sum: 1 }
//       };
//       labelField = "_id"; // roundName is the label
//     }

//     // CASE 4: Contest + Round + Participant -> total unique voters for that specific combination
//     else if (contestId && roundName && participantId) {
//       groupStage = {
//         _id: "$participantId",
//         totalVoters: { $addToSet: "$voterId" },
//         totalVotes: { $sum: 1 }
//       };
//       lookupStage = {
//         from: "participants",
//         localField: "_id",
//         foreignField: "_id",
//         as: "participant",
//       };
//       labelField = "participant.name";
//     }

//     const pipeline = [
//       { $match: match },
//       { $group: groupStage },
//     ];

//     if (lookupStage.from) pipeline.push({ $lookup: lookupStage });

//     // Add project stage to calculate total voters count
//     pipeline.push({
//       $project: {
//         _id: 1,
//         totalVotersCount: { $size: "$totalVoters" },
//         totalVotes: 1,
//         participant: 1
//       }
//     });

//     const results = await Vote.aggregate(pipeline);

//     // Format response for charts
//     const formatted = results.map((r) => ({
//       label:
//         labelField === "_id"
//           ? r._id
//           : r.participant?.[0]?.name || "Unknown",
//       totalVotersCount: r.totalVotersCount,
//       totalVotes: r.totalVotes,
//     }));

//     return res.status(200).json({
//       success: true,
//       contestId,
//       roundName: roundName || null,
//       participantId: participantId || null,
//       data: formatted,
//     });
//   } catch (err) {
//     console.error("Error in getTotalVoterByContest:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch voters analytics",
//       error: err.message,
//     });
//   }
// };


exports.getTotalVoterByContest = async (req, res) => {
  try {
    const { contestId, roundName, participantId } = req.query;

    if (!contestId) {
      return res.status(400).json({
        success: false,
        message: "contestId is required",
      });
    }

    const match = {
      contestId: new mongoose.Types.ObjectId(contestId),
      participantId: { $ne: null }, // 🔥 IMPORTANT
    };

    if (roundName) match.roundName = roundName;
    if (participantId)
      match.participantId = new mongoose.Types.ObjectId(participantId);

    let groupStage = {};
    let lookupParticipant = false;
    let labelFrom = "participant"; // participant | round

    // CASE 1 & 2: contest OR contest + round → participants
    if (!participantId) {
      groupStage = {
        _id: "$participantId",
        uniqueVoters: { $addToSet: "$voterKey" },
        totalVotes: { $sum: 1 },
      };
      lookupParticipant = true;
    }

    // CASE 3: contest + participant → round wise
    else if (participantId && !roundName) {
      groupStage = {
        _id: "$roundName",
        uniqueVoters: { $addToSet: "$voterKey" },
        totalVotes: { $sum: 1 },
      };
      labelFrom = "round";
    }

    // CASE 4: contest + round + participant
    else {
      groupStage = {
        _id: "$participantId",
        uniqueVoters: { $addToSet: "$voterKey" },
        totalVotes: { $sum: 1 },
      };
      lookupParticipant = true;
    }

    const pipeline = [
      { $match: match },

      // ✅ Correct unique voter identity
      {
        $addFields: {
          voterKey: {
            $cond: [
              { $ifNull: ["$voterId", false] },
              { $toString: "$voterId" },
              {
                $cond: [
                  { $ifNull: ["$voterDetails.email", false] },
                  "$voterDetails.email",
                  { $toString: "$_id" },
                ],
              },
            ],
          },
        },
      },

      { $group: groupStage },
    ];

    // ✅ Participant lookup when needed
    if (lookupParticipant) {
      pipeline.push(
        {
          $lookup: {
            from: "participants",
            localField: "_id",
            foreignField: "_id",
            as: "participant",
          },
        },
        { $unwind: "$participant" },
      );
    }

    pipeline.push({
      $project: {
        label: labelFrom === "round" ? "$_id" : "$participant.name",
        totalVotersCount: { $size: "$uniqueVoters" },
        totalVotes: 1,
      },
    });

    const results = await Vote.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      contestId,
      roundName: roundName || null,
      participantId: participantId || null,
      data: results,
    });
  } catch (err) {
    console.error("Error in getTotalVoterByContest:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch voters analytics",
      error: err.message,
    });
  }
};

exports.getScanAnalytics = async (req, res) => {
  try {
    const { contestId, roundname, participantId } = req.query;

    if (!contestId) {
      return res.status(400).json({ message: "contestId is required" });
    }

    // Base match condition
    const match = { contestId: new mongoose.Types.ObjectId(contestId) };
    if (roundname) match.roundname = roundname;
    if (participantId)
      match.participantId = new mongoose.Types.ObjectId(participantId);

    let groupStage = {};
    let lookupStage = {};
    let labelField = "";

    // CASE 1: Contest only -> total scans per participant
    if (contestId && !roundname && !participantId) {
      groupStage = { _id: "$participantId", totalScans: { $sum: 1 } };
      lookupStage = {
        from: "participants",
        localField: "_id",
        foreignField: "_id",
        as: "participant",
      };
      labelField = "participant.name";
    }

    // CASE 2: Contest + Round -> total scans per participant for that round
    else if (contestId && roundname && !participantId) {
      groupStage = { _id: "$participantId", totalScans: { $sum: 1 } };
      lookupStage = {
        from: "participants",
        localField: "_id",
        foreignField: "_id",
        as: "participant",
      };
      labelField = "participant.name";
    }

    // CASE 3: Contest + Participant -> total scans per round
    else if (contestId && participantId) {
      groupStage = { _id: "$roundname", totalScans: { $sum: 1 } };
      labelField = "_id"; // roundname becomes the label
    }

    const pipeline = [{ $match: match }, { $group: groupStage }];

    if (lookupStage.from) pipeline.push({ $lookup: lookupStage });

    const results = await QrScanLog.aggregate(pipeline);

    // Format response for charts
    const formatted = results.map((r) => ({
      label:
        labelField === "_id" ? r._id : r.participant?.[0]?.name || "Unknown",
      totalScans: r.totalScans,
    }));

    return res.status(200).json({
      success: true,
      contestId,
      roundname: roundname || null,
      participantId: participantId || null,
      data: formatted,
    });
  } catch (err) {
    console.error("Error in getScanAnalytics:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch scan analytics",
      error: err.message,
    });
  }
};

// UserAnalytics
// exports.getUserContestAnalytics = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ message: "Invalid userId" });
//     }

//     // 1️⃣ First, get user's assignedContests from User model
//     const user = await User.findById(userId).select("assignedContests role");
//     const userAssignedContestIds = user?.assignedContests || [];

//     // 2️⃣ Find contests where user is involved (including participant)
//     // Check both: User's assignedContests array AND Contest's assigned arrays
//     const contestQuery = {
//       $or: [
//         { createdBy: userId },
//         { assignedAdmins: userId },
//         { assignedJudges: userId },
//         { assignedSponsors: userId },
//         { participants: userId },
//         { "rounds.participants": userId },
//       ],
//     };

//     // If user has assignedContests, also include those
//     if (userAssignedContestIds.length > 0) {
//       contestQuery.$or.push({ _id: { $in: userAssignedContestIds } });
//     }

//     const contests = await Contest.find(contestQuery).select(
//       "title status rounds participants assignedAdmins assignedJudges assignedSponsors createdBy"
//     );

//     if (!contests.length) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//         message: "User is not assigned to any contest",
//       });
//     }

//     const contestIds = contests.map(c => c._id);

//     // 2️⃣ Votes grouped by contest & round
//     const votesAgg = await Vote.aggregate([
//       {
//         $match: {
//           contestId: { $in: contestIds },
//           step: "final",
//         },
//       },
//       {
//         $group: {
//           _id: {
//             contestId: "$contestId",
//             roundName: "$roundName",
//           },
//           totalVotes: { $sum: 1 },
//         },
//       },
//     ]);

//     // 3️⃣ Normalize votes
//     const votesMap = {};
//     votesAgg.forEach(v => {
//       const cId = v._id.contestId.toString();
//       if (!votesMap[cId]) votesMap[cId] = {};
//       votesMap[cId][v._id.roundName] = v.totalVotes;
//     });

//     // 4️⃣ Prepare response
//     const response = contests.map(contest => {
//       let userRole = "unknown";

//       // Safely check arrays with optional chaining and default to empty array
//       const assignedAdmins = contest.assignedAdmins || [];
//       const assignedJudges = contest.assignedJudges || [];
//       const assignedSponsors = contest.assignedSponsors || [];
//       const participants = contest.participants || [];
//       const rounds = contest.rounds || [];

//       if (contest.createdBy && contest.createdBy.toString() === userId) {
//         userRole = "creator";
//       } else if (assignedAdmins.some(id => (id?._id || id)?.toString() === userId)) {
//         userRole = "admin";
//       } else if (assignedJudges.some(id => (id?._id || id)?.toString() === userId)) {
//         userRole = "judge";
//       } else if (assignedSponsors.some(id => (id?._id || id)?.toString() === userId)) {
//         userRole = "sponsor";
//       } else if (
//         participants.some(id => (id?._id || id)?.toString() === userId) ||
//         rounds.some(r =>
//           (r.participants || []).some(p => (p?._id || p)?.toString() === userId)
//         )
//       ) {
//         userRole = "participant";
//       }

//       return {
//         contestId: contest._id,
//         title: contest.title,
//         status: contest.status,
//         userRole,

//         usersCount: {
//           admins: assignedAdmins.length,
//           judges: assignedJudges.length,
//           sponsors: assignedSponsors.length,
//           participants: participants.length,
//         },

//         participantsByRound: rounds.reduce((acc, round) => {
//           if (round && round.name) {
//             acc[round.name] = (round.participants || []).length;
//           }
//           return acc;
//         }, {}),

//         votesByRound: votesMap[contest._id.toString()] || {},
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       totalContests: response.length,
//       data: response,
//     });

//   } catch (error) {
//     console.error("User Contest Analytics Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

exports.getSuperAdminContestAnalytics = async (req, res) => {
  // try {
  //   const { userId } = req.params;
  //   console.log(userId);
  //   // console.log(req.params)
  //   if (!mongoose.Types.ObjectId.isValid(userId)) {
  //     return res.status(400).json({ message: "Invalid userId" });
  //   }
  //   const contests = await Contest.find({
  //     user: userId,
  //   })
  //     .select("title description slug startDate endDate seasons")
  //     .populate({
  //       path: "seasons",
  //       select: "title",
  //     });

  //   if (!contests.length) {
  //     return res.status(200).json({
  //       success: true,
  //       totalContests: 0,
  //       data: [],
  //       message: "User is not present in any contest",
  //     });
  //   }

  //   return res.status(200).json({
  //     success: true,
  //     totalContests: contests.length,
  //     data: contests,
  //   });
  // } catch (error) {
  //   console.error("User Contest Analytics Error:", error);
  //   res.status(500).json({
  //     success: false,
  //     message: "Server error",
  //   });
  // }

  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const seasons = await Seasons.find({
      $or: [
        { admins: userId },
        { judges: userId },
        { sponsors: userId },
        { participants: userId },
      ],
    })
      .select("title slug status admins judges sponsors participants contestId")
      .populate({
        path: "contestId",
        select: "title slug",
      });

    return res.status(200).json({
      success: true,
      totalContests: seasons.length,
      data: seasons,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getUserAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const seasons = await Seasons.find({
      $or: [
        { admins: userId },
        { judges: userId },
        { sponsors: userId },
        { participants: userId },
      ],
    })
      .select("title slug status admins judges sponsors participants contestId")
      .populate({
        path: "contestId",
        select: "title slug",
      });

    return res.status(200).json({
      success: true,
      totalContests: seasons.length,
      data: seasons,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// exports.getParticipantContestsWithVotes = async (req, res) => {
//   try {
//     const { participantId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(participantId)) {
//       return res.status(400).json({ message: "Invalid participant id" });
//     }

//     // 1️⃣ Fetch participant with contest info
//     const participant = await Participant.findById(participantId)
//       .populate("contests.contest", "title status")
//       .lean();

//       console.log(participant,"55555")

//     if (!participant) {
//       return res.status(404).json({ message: "Participant not found" });
//     }

//     const contestsData = [];

//     // 2️⃣ Loop through contests participant is registered in
//     for (const entry of participant.contests) {
//       const contest = entry.contest;
//       if (!contest) continue;

//       // 3️⃣ Aggregate total stars & total voters for this contest
//       const voteStats = await Vote.aggregate([
//         {
//           $match: {
//             contestId: contest._id,
//             participantId: new mongoose.Types.ObjectId(participantId),
//           },
//         },
//         {
//           $group: {
//             _id: null,
//             totalStars: { $sum: "$stars" },
//             totalVoters: { $sum: 1 },
//           },
//         },
//       ]);

//       contestsData.push({
//         contestId: contest._id,
//         title: contest.title,
//         status: contest.status,
//         category: entry.category,
//         totalStars: voteStats[0]?.totalStars || 0,
//         totalVoters: voteStats[0]?.totalVoters || 0,
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       participantId,
//       contests: contestsData,
//     });
//   } catch (error) {
//     console.error("Error fetching participant contest stats:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

exports.getParticipantSeasonsWithVotes = async (req, res) => {
  try {
    const { participantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid participant id",
      });
    }

    const participantObjectId = new mongoose.Types.ObjectId(participantId);

    /* ===========================
       AGGREGATE SEASONS
    =========================== */
    const seasons = await Season.aggregate([
      {
        $match: {
          $or: [
            { participants: participantObjectId },
            { "rounds.participants": participantObjectId },
          ],
        },
      },

      /* ===========================
         CONTEST INFO
      =========================== */
      {
        $lookup: {
          from: "contests",
          localField: "contestId",
          foreignField: "_id",
          as: "contest",
        },
      },
      { $unwind: "$contest" },

      /* ===========================
         VOTES LOOKUP
      =========================== */
      {
        $lookup: {
          from: "votes",
          let: { seasonId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$seasonId", "$$seasonId"] },
                    { $eq: ["$participantId", participantObjectId] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: "$roundName",
                totalStars: { $sum: "$stars" },
                totalVotes: { $sum: 1 },
              },
            },
          ],
          as: "roundStats",
        },
      },

      /* ===========================
         TOTAL STATS
      =========================== */
      {
        $addFields: {
          totalStars: { $sum: "$roundStats.totalStars" },
          totalVotes: { $sum: "$roundStats.totalVotes" },
        },
      },

      /* ===========================
         SHAPE RESPONSE
      =========================== */
      {
        $project: {
          title: 1,
          slug: 1,
          status: 1,
          startDate: 1,
          endDate: 1,
          contest: {
            _id: 1,
            title: 1,
            slug: 1,
            status: 1,
          },
          rounds: {
            name: 1,
            status: 1,
            isVotingEnable: 1,
          },
          totalStars: 1,
          totalVotes: 1,
          roundStats: 1,
        },
      },

      { $sort: { startDate: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      participantId,
      totalSeasons: seasons.length,
      seasons,
    });
  } catch (error) {
    console.error("Participant Season Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// exports.getPointTableByContest = async (req, res) => {
//   try {
//     const { contestId, roundName, category } = req.query;

//     if (!contestId) {
//       return res.status(400).json({
//         success: false,
//         message: "contestId is required",
//       });
//     }

//     const contestObjectId = new mongoose.Types.ObjectId(contestId);

//     // 1️⃣ Match votes
//     const voteMatch = {
//       contestId: contestObjectId,
//       participantId: { $ne: null },
//     };

//     if (roundName) {
//       voteMatch.roundName = roundName;
//     }

//     const pipeline = [
//       { $match: voteMatch },

//       // 2️⃣ Group points (round-wise if roundName not sent)
//       {
//         $group: {
//           _id: {
//             participantId: "$participantId",
//             roundName: "$roundName",
//           },
//           totalPoints: { $sum: "$stars" },
//         },
//       },

//       // 3️⃣ Join participant
//       {
//         $lookup: {
//           from: "participants",
//           localField: "_id.participantId",
//           foreignField: "_id",
//           as: "participant",
//         },
//       },
//       { $unwind: "$participant" },

//       // 4️⃣ Extract category for this contest
//       {
//         $addFields: {
//           contestCategory: {
//             $first: {
//               $filter: {
//                 input: "$participant.contests",
//                 as: "c",
//                 cond: { $eq: ["$$c.contest", contestObjectId] },
//               },
//             },
//           },
//         },
//       },

//       // 5️⃣ Optional category filter
//       ...(category
//         ? [
//             {
//               $match: {
//                 "contestCategory.category": category,
//               },
//             },
//           ]
//         : []),

//       // 6️⃣ Final projection
//       {
//         $project: {
//           participantId: "$participant._id",
//           name: "$participant.name",
//           category: "$contestCategory.category",
//           roundName: "$_id.roundName",
//           totalPoints: 1,
//         },
//       },

//       // 7️⃣ Sort by highest points
//       { $sort: { totalPoints: -1 } },
//     ];

//     const data = await Vote.aggregate(pipeline);

//     return res.status(200).json({
//       success: true,
//       contestId,
//       roundName: roundName || null,
//       category: category || null,
//       data,
//     });
//   } catch (error) {
//     console.error("Error in getPointTableByContest:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch point table",
//       error: error.message,
//     });
//   }
// };

// exports.getPointTableBySeason = async (req, res) => {
//   try {
//     const { seasonId, roundName, category } = req.query;

//     if (!seasonId || !mongoose.Types.ObjectId.isValid(seasonId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Valid seasonId is required",
//       });
//     }

//     const seasonObjectId = new mongoose.Types.ObjectId(seasonId);

//     /* ===========================
//        FETCH SEASON (for contestId)
//     =========================== */
//     const season = await Season.findById(seasonObjectId)
//       .select("contestId title")
//       .lean();

//     if (!season) {
//       return res.status(404).json({
//         success: false,
//         message: "Season not found",
//       });
//     }

//     const contestObjectId = season.contestId;

//     /* ===========================
//        MATCH VOTES
//     =========================== */
//     const voteMatch = {
//       seasonId: seasonObjectId,
//       participantId: { $ne: null },
//     };

//     if (roundName) {
//       voteMatch.roundName = roundName;
//     }

//     /* ===========================
//        AGGREGATION PIPELINE
//     =========================== */
//     const pipeline = [
//       { $match: voteMatch },

//       /* ===========================
//          GROUP POINTS
//       =========================== */
//       {
//         $group: {
//           _id: {
//             participantId: "$participantId",
//             roundName: "$roundName",
//           },
//           totalPoints: { $sum: "$stars" },
//           totalVotes: { $sum: 1 },
//         },
//       },

//       /* ===========================
//          JOIN PARTICIPANT
//       =========================== */
//       {
//         $lookup: {
//           from: "participants",
//           localField: "_id.participantId",
//           foreignField: "_id",
//           as: "participant",
//         },
//       },
//       { $unwind: "$participant" },

//       /* ===========================
//          EXTRACT CATEGORY (FROM CONTEST REGISTRATION)
//       =========================== */
//       {
//         $addFields: {
//           contestCategory: {
//             $first: {
//               $filter: {
//                 input: "$participant.contests",
//                 as: "c",
//                 cond: { $eq: ["$$c.contest", contestObjectId] },
//               },
//             },
//           },
//         },
//       },

//       /* ===========================
//          OPTIONAL CATEGORY FILTER
//       =========================== */
//       ...(category
//         ? [
//             {
//               $match: {
//                 "contestCategory.category": category,
//               },
//             },
//           ]
//         : []),

//       /* ===========================
//          FINAL SHAPE
//       =========================== */
//       {
//         $project: {
//           _id: 0,
//           participantId: "$participant._id",
//           name: "$participant.name",
//           category: "$contestCategory.category",
//           roundName: "$_id.roundName", // ✅ explicit
//           totalPoints: 1,
//           totalVotes: 1,
//         },
//       },

//       /* ===========================
//          SORT (LEADERBOARD)
//       =========================== */
//       { $sort: { totalPoints: -1 } },
//     ];

//     const data = await Vote.aggregate(pipeline);

//     return res.status(200).json({
//       success: true,
//       seasonId,
//       seasonTitle: season.title,
//       roundName: roundName || null,
//       category: category || null,
//       data,
//     });
//   } catch (error) {
//     console.error("Error in getPointTableBySeason:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch season point table",
//       error: error.message,
//     });
//   }
// };

exports.getPointTableBySeason = async (req, res) => {
  try {
    const { seasonId, roundName, category } = req.query;

    if (!seasonId || !mongoose.Types.ObjectId.isValid(seasonId)) {
      return res.status(400).json({
        success: false,
        message: "Valid seasonId is required",
      });
    }

    const seasonObjectId = new mongoose.Types.ObjectId(seasonId);
    const seasonIdString = seasonObjectId.toString();

    // Vote schema stores `roundId` (not `roundName`)
    let roundIdFilter = null;
    if (roundName) {
      const season = await Season.findById(seasonObjectId)
        .select("rounds._id rounds.name")
        .lean();

      const resolvedRound = season?.rounds?.find(
        (r) => String(r?.name || "").toLowerCase() === String(roundName).toLowerCase(),
      );
      roundIdFilter = resolvedRound?._id || null;
    }

    const voteMatch = {
      seasonId: seasonObjectId,
      participantId: { $ne: null },
      step: "final",
      isValid: true,
      ...(roundIdFilter ? { roundId: roundIdFilter } : {}),
    };

    const pipeline = [
      { $match: voteMatch },

      /* ============================
         GROUP STARS
      ============================ */
      {
        $group: {
          _id: {
            participantId: "$participantId",
            roundId: "$roundId",
            seasonId: "$seasonId",
          },
          totalPoints: { $sum: "$stars" },
          totalVotes: { $sum: 1 },
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

      /* ============================
         JOIN PARTICIPANT
      ============================ */
      {
        $lookup: {
          from: "participants",
          localField: "_id.participantId",
          foreignField: "_id",
          as: "participant",
        },
      },
      { $unwind: "$participant" },

      /* ============================
         JOIN SEASON (to resolve roundName from roundId)
      ============================ */
      {
        $lookup: {
          from: "seasons",
          localField: "_id.seasonId",
          foreignField: "_id",
          as: "seasonDoc",
        },
      },
      { $unwind: "$seasonDoc" },

      /* ============================
         🔥 FIXED CATEGORY MATCH
      ============================ */
      {
        $addFields: {
          seasonRegistration: {
            $first: {
              $filter: {
                input: "$participant.contests",
                as: "c",
                cond: {
                  $and: [
                    {
                      $eq: [
                        { $toString: "$$c.contest" },
                        seasonIdString,
                      ],
                    },
                    {
                      $or: [
                        { $eq: ["$$c.status", "active"] },
                        { $eq: ["$$c.status", null] },
                      ],
                    },
                  ],
                },
              },
            },
          },
          roundDoc: {
            $first: {
              $filter: {
                input: "$seasonDoc.rounds",
                as: "r",
                cond: { $eq: ["$$r._id", "$_id.roundId"] },
              },
            },
          },
        },
      },

      /* ============================
         OPTIONAL CATEGORY FILTER
      ============================ */
      ...(category
        ? [{ $match: { "seasonRegistration.category": category } }]
        : []),

      /* ============================
         FINAL RESPONSE
      ============================ */
      {
        $project: {
          _id: 0,
          participantId: "$participant._id",
          name: "$participant.name",
          category: "$seasonRegistration.category",
          roundId: "$_id.roundId",
          roundName: {
            $ifNull: [
              "$roundDoc.name",
              { $toString: "$_id.roundId" },
            ],
          },
          subCategory: "$seasonRegistration.subCategory",
          soloType: "$seasonRegistration.soloType",
          memberName: "$seasonRegistration.memberName",
          chapterName: "$seasonRegistration.chapterName",
          totalPoints: 1,
          totalVotes: 1,
          audienceVotes: 1,
          judgesVotes: 1,
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
      { $sort: { avgStars: -1, totalVotes: -1, totalPoints: -1 } },
    ];

    const data = await Vote.aggregate(pipeline);

    const scanAgg = await QrScanLog.aggregate([
      { $match: { seasonId: seasonObjectId } },
      {
        $group: {
          _id: {
            participantId: "$participantId",
            roundname: "$roundname",
          },
          totalScans: { $sum: 1 },
          qrSubmits: {
            $sum: {
              $cond: [
                { $in: ["$step", ["info_submitted", "voted"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const scanByKey = new Map();
    for (const row of scanAgg) {
      const pid = row._id?.participantId?.toString?.();
      const rk = row._id?.roundname;
      if (!pid || rk === undefined || rk === null) continue;
      const key = `${pid}|${String(rk)}`;
      scanByKey.set(key, {
        totalScans: row.totalScans || 0,
        qrSubmits: row.qrSubmits || 0,
      });
    }

    const submitMatch = {
      seasonId: seasonObjectId,
      step: "info_submitted",
      isValid: true,
      participantId: { $ne: null },
      ...(roundIdFilter ? { roundId: roundIdFilter } : {}),
    };
    const pendingSubmitAgg = await Vote.aggregate([
      { $match: submitMatch },
      {
        $group: {
          _id: {
            participantId: "$participantId",
            roundId: "$roundId",
          },
          pendingSubmits: { $sum: 1 },
        },
      },
    ]);
    const pendingByKey = new Map();
    for (const row of pendingSubmitAgg) {
      const pid = row._id?.participantId?.toString?.();
      const rid = row._id?.roundId?.toString?.();
      if (!pid || !rid) continue;
      pendingByKey.set(`${pid}|${rid}`, row.pendingSubmits || 0);
    }

    const resolveScanStats = (participantId, roundId, roundNameStr) => {
      const pid = participantId?.toString?.();
      const rid = roundId?.toString?.();
      const rname = String(roundNameStr || "").toLowerCase();
      const keys = [`${pid}|${rid}`, `${pid}|${rname}`].filter(
        (k) => !k.includes("undefined"),
      );
      for (const k of keys) {
        if (scanByKey.has(k)) return scanByKey.get(k);
      }
      return { totalScans: 0, qrSubmits: 0 };
    };

    const merged = data.map((row) => {
      const pid = row.participantId;
      const rid = row.roundId;
      const stats = resolveScanStats(pid, rid, row.roundName);
      const pending =
        pendingByKey.get(`${pid?.toString?.()}|${rid?.toString?.()}`) || 0;
      const finalVotes = Number(row.totalVotes || 0);
      // Submits = completed final votes + still at info_submitted; QR log funnel when tracked
      const totalSubmits = Math.max(
        pending + finalVotes,
        Number(stats.qrSubmits || 0),
      );
      return {
        ...row,
        totalScans: stats.totalScans,
        totalSubmits,
      };
    });

    return res.status(200).json({
      success: true,
      seasonId,
      roundName: roundName || null,
      category: category || null,
      data: merged,
    });
  } catch (error) {
    console.error("Error in getPointTableBySeason:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch point table",
      error: error.message,
    });
  }
};

/**
 * Admin drill-down: scans audit + vote breakdown (audience / judges with emails) for one participant+round.
 * Query: seasonId, participantId, roundId (all required)
 */
exports.getParticipantRoundAudit = async (req, res) => {
  try {
    const { seasonId, participantId, roundId } = req.query;

    if (
      !seasonId ||
      !participantId ||
      !roundId ||
      !mongoose.Types.ObjectId.isValid(seasonId) ||
      !mongoose.Types.ObjectId.isValid(participantId) ||
      !mongoose.Types.ObjectId.isValid(roundId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid seasonId, participantId, and roundId are required",
      });
    }

    const seasonObjectId = new mongoose.Types.ObjectId(seasonId);
    const participantObjectId = new mongoose.Types.ObjectId(participantId);
    const roundObjectId = new mongoose.Types.ObjectId(roundId);

    const [participant, season] = await Promise.all([
      Participant.findById(participantObjectId)
        .select("name email phone profilePhoto contests")
        .lean(),
      Season.findById(seasonObjectId).select("rounds title").lean(),
    ]);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    const roundDoc = season?.rounds?.find(
      (r) => String(r?._id) === String(roundId),
    );
    const roundName = roundDoc?.name || "";
    const roundIdStr = String(roundObjectId);
    const roundNameLower = String(roundName || "").toLowerCase();

    const scanRoundOr = [{ roundname: roundIdStr }];
    if (roundNameLower) scanRoundOr.push({ roundname: roundNameLower });
    if (roundName && roundName !== roundNameLower) {
      scanRoundOr.push({ roundname: roundName });
    }

    const scans = await QrScanLog.find({
      seasonId: seasonObjectId,
      participantId: participantObjectId,
      $or: scanRoundOr,
    })
      .sort({ scannedAt: -1, createdAt: -1 })
      .lean();

    const voteBase = {
      seasonId: seasonObjectId,
      participantId: participantObjectId,
      roundId: roundObjectId,
      isValid: true,
    };

    const roleLabel = (vt) => {
      const m = {
        audience: "Audience",
        judge: "Judge",
        sponsor: "Sponsor",
        admin: "Admin",
        super_admin: "Super admin",
      };
      return m[vt] || vt || "—";
    };

    const [finalVotes, pendingInfoVotesRaw] = await Promise.all([
      Vote.find({ ...voteBase, step: "final" })
        .populate("voterId", "name email phone role")
        .sort({ createdAt: -1 })
        .lean(),
      Vote.find({ ...voteBase, step: "info_submitted" })
        .populate("voterId", "name email phone role")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const pendingVotes = pendingInfoVotesRaw.map((v) => ({
      _id: v._id,
      name:
        (v.voterDetails && v.voterDetails.name) ||
        (v.voterId && v.voterId.name) ||
        "—",
      email:
        (v.voterDetails && v.voterDetails.email) ||
        (v.voterId && v.voterId.email) ||
        "—",
      phone:
        (v.voterDetails && v.voterDetails.phone) ||
        (v.voterId && v.voterId.phone) ||
        "—",
      voterType: v.voterType,
      role: roleLabel(v.voterType),
      createdAt: v.createdAt,
    }));

    const audienceVotes = [];
    const judgeVotes = [];

    for (const v of finalVotes) {
      const isAudience = v.voterType === "audience";
      const name =
        (v.voterDetails && v.voterDetails.name) ||
        (v.voterId && v.voterId.name) ||
        "—";
      const email =
        (v.voterDetails && v.voterDetails.email) ||
        (v.voterId && v.voterId.email) ||
        "—";
      const phone =
        (v.voterDetails && v.voterDetails.phone) ||
        (v.voterId && v.voterId.phone) ||
        "—";

      const row = {
        _id: v._id,
        voterType: v.voterType,
        stars: v.stars ?? null,
        name,
        email,
        phone,
        createdAt: v.createdAt,
      };

      if (isAudience) audienceVotes.push(row);
      else judgeVotes.push(row);
    }

    const audiencePoints = audienceVotes.reduce(
      (s, r) => s + (Number(r.stars) || 0),
      0,
    );
    const judgePoints = judgeVotes.reduce(
      (s, r) => s + (Number(r.stars) || 0),
      0,
    );
    const audienceCount = audienceVotes.length;
    const judgeCount = judgeVotes.length;

    const qrSubmits = scans.reduce(
      (n, s) =>
        n + (["info_submitted", "voted"].includes(s.step) ? 1 : 0),
      0,
    );
    const totalSubmits = Math.max(
      pendingVotes.length + finalVotes.length,
      qrSubmits,
    );

    return res.status(200).json({
      success: true,
      seasonId,
      participantId,
      roundId,
      roundName: roundName || null,
      participant: {
        _id: participant._id,
        name: participant.name,
        email: participant.email,
        phone: participant.phone,
        profilePhoto: participant.profilePhoto || null,
      },
      pendingVotes,
      totals: {
        totalScans: scans.length,
        totalSubmits,
        pendingInfoSubmits: pendingVotes.length,
        totalVoters: finalVotes.length,
        totalPoints: audiencePoints + judgePoints,
        audience: {
          count: audienceCount,
          totalPoints: audiencePoints,
          avgScore: audienceCount > 0 ? audiencePoints / audienceCount : 0,
        },
        judges: {
          count: judgeCount,
          totalPoints: judgePoints,
          avgScore: judgeCount > 0 ? judgePoints / judgeCount : 0,
        },
      },
      scans: scans.map((s) => ({
        _id: s._id,
        step: s.step,
        deviceId: s.deviceId || null,
        ip: s.ip || null,
        browser: s.browser || null,
        browserVersion: s.browserVersion || null,
        osName: s.osName || null,
        userAgent: s.userAgent
          ? String(s.userAgent).slice(0, 200)
          : null,
        scannedAt: s.scannedAt || s.createdAt,
        createdAt: s.createdAt,
      })),
      audienceVotes,
      judgeVotes,
    });
  } catch (error) {
    console.error("Error in getParticipantRoundAudit:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch participant round audit",
      error: error.message,
    });
  }
};

exports.getContestSeasonStats = async (req, res) => {
  try {
    const data = await Season.aggregate([
      {
        // group seasons by contestId
        $group: {
          _id: "$contestId",
          seasonCount: { $sum: 1 },
        },
      },
      {
        // join contest collection
        $lookup: {
          from: "contests", // collection name (plural + lowercase)
          localField: "_id",
          foreignField: "_id",
          as: "contest",
        },
      },
      {
        $unwind: "$contest",
      },
      {
        // final shape for bar graph
        $project: {
          _id: 0,
          contestId: "$contest._id",
          contestName: "$contest.title",
          seasonCount: 1,
        },
      },
      {
        $sort: { seasonCount: -1 }, // optional
      },
    ]);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Contest season stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contest season stats",
    });
  }
};



exports.getParticipantVoteAnalytics = async (req, res) => {
  try {
    const participantId = req.user.userId;
    const { contestId, seasonId } = req.query;
    console.log(req.query)

    if (!contestId && !seasonId) {
      return res.status(400).json({
        success: false,
        message: "contestId or seasonId is required",
      });
    }

    /**
     * ===============================
     * CASE 1: CONTEST → SEASON GRAPH
     * ===============================
     */
    if (contestId) {
      const data = await Vote.aggregate([
        {
          $match: {
            contestId: new mongoose.Types.ObjectId(contestId),
            participantId: new mongoose.Types.ObjectId(participantId),
          },
        },
        {
          $group: {
            _id: "$seasonId",
            totalStars: { $sum: "$stars" },
          },
        },
        {
          $lookup: {
            from: "seasons",
            localField: "_id",
            foreignField: "_id",
            as: "season",
          },
        },
        { $unwind: "$season" },
        {
          $project: {
            _id: 0,
            seasonId: "$_id",
            seasonName: "$season.title",
            totalStars: 1,
          },
        },
        { $sort: { seasonName: 1 } },
      ]);

      return res.status(200).json({
        success: true,
        type: "SEASON_WISE",
        data,
      });
    }

    /**
     * ===============================
     * CASE 2: SEASON → ROUND GRAPH
     * ===============================
     */
    if (seasonId) {
      const data = await Vote.aggregate([
        {
          $match: {
            seasonId: new mongoose.Types.ObjectId(seasonId),
            participantId: new mongoose.Types.ObjectId(participantId),
          },
        },
        {
          $group: {
            _id: "$roundName",
            totalStars: { $sum: "$stars" },
          },
        },
        {
          $project: {
            _id: 0,
            roundName: "$_id",
            totalStars: 1,
          },
        },
        { $sort: { roundName: 1 } },
      ]);

      return res.status(200).json({
        success: true,
        type: "ROUND_WISE",
        data,
      });
    }
  } catch (error) {
    console.error("Participant analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
    });
  }
};

/**
 * Group-wise leaderboard for GroupingAndWinners feature.
 * Score formula:
 *   AvgAudienceScore = AudienceTotalStars / AudienceUniqueVoters
 *   AvgJudgesScore   = JudgesTotalStars / JudgesUniqueVoters
 *   FinalScore       = AvgAudienceScore + AvgJudgesScore
 *
 * Judges bucket definition:
 *   voterType !== "audience"
 *
 * Query params:
 *   seasonId, roundId, groupKey
 */
exports.groupLeaderboard = async (req, res) => {
  try {
    const { seasonId, roundId, groupKey } = req.query;

    if (!seasonId || !roundId || !groupKey) {
      return res.status(400).json({
        success: false,
        message: "seasonId, roundId and groupKey are required.",
      });
    }
    if (
      !mongoose.Types.ObjectId.isValid(seasonId) ||
      !mongoose.Types.ObjectId.isValid(roundId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid seasonId or roundId.",
      });
    }

    const seasonObjectId = new mongoose.Types.ObjectId(seasonId);
    const roundObjectId = new mongoose.Types.ObjectId(roundId);
    const groupKeyStr = String(groupKey).trim();

    // 1) Find exact round participants in this season
    const season = await Season.findById(seasonObjectId)
      .select("contestId rounds._id rounds.name rounds.participants")
      .lean();

    const round = season?.rounds?.find(
      (r) => String(r?._id) === String(roundObjectId),
    );

    if (!round) {
      return res.status(400).json({
        success: false,
        message: "Invalid roundId for this season.",
      });
    }

    const roundParticipantIds = (round.participants || []).map((id) =>
      mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
    );

    if (!roundParticipantIds.length) {
      return res.status(200).json({
        success: true,
        seasonId,
        roundId,
        groupKey: groupKeyStr,
        leaderboard: [],
      });
    }

    // 2) Fetch participants who belong to the requested groupKey
    const groupedParticipants = await Participant.find({
      _id: { $in: roundParticipantIds },
      "contests.contest": seasonObjectId,
      "contests.groupKey": groupKeyStr,
    })
      .select("_id name profilePhoto contests")
      .lean();

    const groupedParticipantIds = groupedParticipants.map((p) => p._id);
    if (!groupedParticipantIds.length) {
      return res.status(200).json({
        success: true,
        seasonId,
        roundId,
        groupKey: groupKeyStr,
        leaderboard: [],
      });
    }

    const baseVoteMatch = {
      seasonId: seasonObjectId,
      roundId: roundObjectId,
      participantId: { $in: groupedParticipantIds },
      step: "final",
      isValid: true,
    };

    const buildAgg = (voterTypeFilter) => [
      { $match: { ...baseVoteMatch, ...voterTypeFilter } },
      // Build a stable "unique voter identifier"
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
      // 1) Deduplicate voters
      {
        $group: {
          _id: { participantId: "$participantId", voterIdentifier: "$voterIdentifier" },
          starsSum: { $sum: "$stars" },
        },
      },
      // 2) Aggregate per participant
      {
        $group: {
          _id: "$_id.participantId",
          totalStars: { $sum: "$starsSum" },
          totalVoters: { $sum: 1 },
        },
      },
    ];

    const [audienceAgg, judgeAgg] = await Promise.all([
      Vote.aggregate(buildAgg({ voterType: "audience" })),
      Vote.aggregate(buildAgg({ voterType: { $ne: "audience" } })),
    ]);

    const audienceMap = {};
    const judgeMap = {};
    for (const a of audienceAgg) audienceMap[String(a._id)] = a;
    for (const j of judgeAgg) judgeMap[String(j._id)] = j;

    const leaderboard = groupedParticipants.map((p) => {
      const pid = String(p._id);
      const aud = audienceMap[pid] || { totalStars: 0, totalVoters: 0 };
      const jdg = judgeMap[pid] || { totalStars: 0, totalVoters: 0 };

      const avgAudienceScore =
        aud.totalVoters > 0 ? aud.totalStars / aud.totalVoters : 0;
      const avgJudgesScore =
        jdg.totalVoters > 0 ? jdg.totalStars / jdg.totalVoters : 0;
      const finalScore = avgAudienceScore + avgJudgesScore;

      return {
        participantId: pid,
        name: p.name,
        avgAudienceScore,
        judgeAvgScore: avgJudgesScore,
        finalScore,
      };
    });

    leaderboard.sort((a, b) => b.finalScore - a.finalScore);

    // 3) Assign positions (ties rule: simple 1..n by sort order)
    let position = 1;
    for (const item of leaderboard) {
      item.position = position++;
    }

    // Optional: keep to top 3 only if you want later
    // const top3 = leaderboard.slice(0, 3);

    return res.status(200).json({
      success: true,
      seasonId,
      roundId,
      groupKey: groupKeyStr,
      leaderboard,
    });
  } catch (error) {
    console.error("groupLeaderboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch group leaderboard",
      error: error.message,
    });
  }
};

/**
 * Compute and persist group winners (1st/2nd/3rd) into Participant.contests[].position.
 *
 * Tie-breaker:
 * - Sort by finalScore desc
 * - If tie: earlier contests[].registeredAt (within the matching season+groupKey) wins
 *
 * Body params:
 *   seasonId, roundId, groupKey
 *
 * Result:
 *   Updates only top 3 participants. Others remain unchanged.
 */
async function computeGroupWinnersForKey({ seasonId, roundId, groupKey }) {
  if (!seasonId || !roundId || !groupKey) {
    throw new Error("seasonId, roundId and groupKey are required.");
  }
  if (
    !mongoose.Types.ObjectId.isValid(seasonId) ||
    !mongoose.Types.ObjectId.isValid(roundId)
  ) {
    throw new Error("Invalid seasonId or roundId.");
  }

  const seasonObjectId = new mongoose.Types.ObjectId(seasonId);
  const roundObjectId = new mongoose.Types.ObjectId(roundId);
  const groupKeyStr = String(groupKey).trim();

  if (
    !groupKeyStr ||
    ["null", "undefined", "na", "NA"].includes(groupKeyStr.toLowerCase())
  ) {
    throw new Error("Valid groupKey is required.");
  }

  // 1) Find exact round inside season
  const season = await Season.findById(seasonObjectId)
    .select("contestId rounds._id rounds.participants")
    .lean();

  const round = season?.rounds?.find(
    (r) => String(r?._id) === String(roundObjectId),
  );

  if (!round) return { winners: [] };

  const roundParticipantIds = (round.participants || [])
    .map((id) =>
      mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
    )
    .filter(Boolean);

  if (!roundParticipantIds.length) return { winners: [] };

  // 2) Load participants of this group (within this season)
  const groupedParticipants = await Participant.find({
    _id: { $in: roundParticipantIds },
    "contests.contest": seasonObjectId,
    "contests.groupKey": groupKeyStr,
  })
    .select("_id name contests")
    .lean();

  if (!groupedParticipants.length) return { winners: [] };

  const groupedParticipantIds = groupedParticipants.map((p) => p._id);

  // 3) Aggregate vote totals with unique voter identifiers
  const baseVoteMatch = {
    seasonId: seasonObjectId,
    roundId: roundObjectId,
    participantId: { $in: groupedParticipantIds },
    step: "final",
    isValid: true,
  };

  const buildAgg = (voterTypeFilter) => [
    { $match: { ...baseVoteMatch, ...voterTypeFilter } },
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
        _id: { participantId: "$participantId", voterIdentifier: "$voterIdentifier" },
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

  const [audienceAgg, judgeAgg] = await Promise.all([
    Vote.aggregate(buildAgg({ voterType: "audience" })),
    Vote.aggregate(buildAgg({ voterType: { $ne: "audience" } })),
  ]);

  const audienceMap = {};
  const judgeMap = {};
  for (const a of audienceAgg) audienceMap[String(a._id)] = a;
  for (const j of judgeAgg) judgeMap[String(j._id)] = j;

  // 4) Build final leaderboard (include tie-breaker via registeredAt)
  const leaderboard = groupedParticipants.map((p) => {
    const pid = String(p._id);
    const entry =
      (p.contests || []).find(
        (c) =>
          String(c?.contest) === String(seasonObjectId) &&
          String(c?.groupKey) === groupKeyStr,
      ) || {};

    const registeredAt = entry?.registeredAt
      ? new Date(entry.registeredAt).getTime()
      : Number.MAX_SAFE_INTEGER;

    const aud = audienceMap[pid] || { totalStars: 0, totalVoters: 0 };
    const jdg = judgeMap[pid] || { totalStars: 0, totalVoters: 0 };

    const avgAudienceScore =
      Number(aud.totalVoters) > 0
        ? Number(aud.totalStars) / Number(aud.totalVoters)
        : 0;
    const avgJudgesScore =
      Number(jdg.totalVoters) > 0
        ? Number(jdg.totalStars) / Number(jdg.totalVoters)
        : 0;

    const finalScore = avgAudienceScore + avgJudgesScore;

    return {
      participantId: pid,
      name: p.name,
      registeredAt,
      finalScore,
    };
  });

  leaderboard.sort((a, b) => {
    const df = Number(b.finalScore) - Number(a.finalScore);
    if (df !== 0) return df;
    return Number(a.registeredAt) - Number(b.registeredAt);
  });

  const top3 = leaderboard.slice(0, 3);

  // 5) Persist positions (only top3)
  const posByIdx = ["first", "second", "third"];
  const winners = [];

  for (let i = 0; i < top3.length; i++) {
    const w = top3[i];
    const position = posByIdx[i];

    await Participant.updateOne(
      { _id: new mongoose.Types.ObjectId(w.participantId) },
      {
        $set: { "contests.$[elem].position": position },
      },
      {
        arrayFilters: [
          { "elem.contest": seasonObjectId, "elem.groupKey": groupKeyStr },
        ],
      },
    );

    winners.push({
      participantId: w.participantId,
      name: w.name,
      position,
      finalScore: w.finalScore,
    });
  }

  return { winners };
}

exports.computeGroupWinnersForKey = computeGroupWinnersForKey;

exports.computeGroupWinners = async (req, res) => {
  try {
    const { seasonId, roundId, groupKey } = req.body || {};
    const result = await computeGroupWinnersForKey({
      seasonId,
      roundId,
      groupKey,
    });
    return res.status(200).json({
      success: true,
      seasonId,
      roundId,
      groupKey: String(groupKey).trim(),
      winners: result.winners || [],
    });
  } catch (error) {
    console.error("computeGroupWinners error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to compute group winners",
      error: error.message,
    });
  }
};