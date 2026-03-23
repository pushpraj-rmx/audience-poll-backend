const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const Participant = require("../models/Participant");
const Vote = require("../models/Vote");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// const User = require("../models/User");
const Season = require("../models/seasons");
const { getFileUrl } = require("../utils/fileHelper");

function escapeRegex(input = "") {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Create participant
// exports.createParticipant = async (req, res) => {
//   try {
//     const { email, password, contest_id, category, ...rest } = req.body;
//     console.log(req.body);

//     // 🔍 Check existing participant
//     const existingParticipant = await Participant.findOne({ email });
//     if (existingParticipant) {
//       return res.status(400).json({ message: "Participant already exists" });
//     }

//     // 🔐 Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // 🖼️ Profile image
//     let profileUrl;
//     if (req.file) {
//       profileUrl = getFileUrl(`userPics/${req.file.filename}`);
//     }

//     // 👤 Create participant
//     const participant = new Participant({
//       ...rest,
//       email,
//       password: hashedPassword,
//       profilePhoto: profileUrl,
//     });

//     /**
//      * 🏆 CONTEST JOIN LOGIC
//      */
//     if (contest_id && category) {
//       const contest = await Season.findById(contest_id);

//       if (!contest) {
//         return res.status(404).json({ message: "Season not found" });
//       }

//       // ✅ Validate category
//       if (!contest.categories.includes(category)) {
//         return res.status(400).json({
//           message: "Invalid category for this contest",
//         });
//       }

//       // ✅ Add contest to participant with category
//       participant.contests.push({
//         contest: contest._id,
//         category,
//       });

//       // ✅ Add participant to contest participants
//       if (!contest.participants.includes(participant._id)) {
//         contest.participants.push(participant._id);
//       }

//       // 🎯 Assign to first round (prefer audition)
//       if (contest.rounds && contest.rounds.length > 0) {
//         const firstRound =
//           contest.rounds.find((r) => r.name === "audition") ||
//           contest.rounds[0];

//         if (!firstRound.participants.includes(participant._id)) {
//           firstRound.participants.push(participant._id);
//         }
//       }

//       await contest.save();
//     }

//     // 💾 Save participant
//     await participant.save();

//     return res.status(201).json({
//       message: contest_id
//         ? "Participant created and joined contest successfully"
//         : "Participant created successfully",
//       data: participant,
//     });
//   } catch (error) {
//     console.error("❌ Error creating participant:", error);
//     return res.status(500).json({
//       message: "Error creating participant",
//       error: error.message,
//     });
//   }
// };

// Create Participant (With Season Join)
exports.createParticipant = async (req, res) => {
  try {
    const {
      email,
      password,
      seasonId,
      category,
      subCategory,
      soloType: rawSoloType,
      memberName,
      chapterName,
      ...rest
    } = req.body;

    if (!seasonId || !category) {
      return res.status(400).json({
        message: "seasonId and category are required",
      });
    }

    // 🔍 Find season
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({ message: "Season not found" });
    }

    // ✅ Validate category & subCategory
    if (!season.categories.includes(category)) {
      return res.status(400).json({
        message: "Invalid category for this season",
      });
    }

    if (subCategory && !season.subCategories.includes(subCategory)) {
      return res.status(400).json({
        message: "Invalid subCategory for this season",
      });
    }

    // ✅ Resolve soloType (only valid when subCategory === "Solo")
    const isSolo = String(subCategory ?? "").trim().toLowerCase() === "solo";
    let soloType = null;
    if (isSolo && rawSoloType) {
      const allowed = ["Junior", "Member", "Teenager"];
      const match = allowed.find(
        (x) => x.toLowerCase() === String(rawSoloType).trim().toLowerCase(),
      );
      if (!match) {
        return res.status(400).json({ message: "Invalid soloType. Must be Junior, Member, or Teenager." });
      }
      soloType = match;
    }

    // ✅ Compute groupKey
    const groupKey =
      category && subCategory
        ? isSolo && soloType
          ? `${category}|${subCategory}|${soloType}`
          : `${category}|${subCategory}`
        : null;

    // 🔍 Find participant
    let participant = await Participant.findOne({ email });

    // 🖼️ Profile image
    let profileUrl;
    if (req.file) {
      profileUrl = getFileUrl(`userPics/${req.file.filename}`);
    }

    /**
     * 🆕 Create participant if not exists
     */
    if (!participant) {
      const hashedPassword = await bcrypt.hash(password, 10);

      participant = new Participant({
        ...rest,
        email,
        password: hashedPassword,
        profilePhoto: profileUrl,
      });
    }

    /**
     * ❌ DUPLICATE CHECK
     * Same season + same category + same subCategory + same soloType = NOT ALLOWED
     */
    const alreadyJoinedSameCategory = participant.contests.some(
      (c) =>
        c.contest.toString() === season._id.toString() &&
        c.category === category &&
        (c.subCategory || "") === (subCategory || "") &&
        (c.soloType ?? null) === soloType,
    );

    if (alreadyJoinedSameCategory) {
      return res.status(400).json({
        message:
          "Participant already registered in this season with the same category, subCategory and soloType",
      });
    }

    /**
     * ➕ ADD SEASON ENTRY TO PARTICIPANT
     */
    participant.contests.push({
      contest: season._id,
      category,
      subCategory,
      soloType,
      memberName: memberName || undefined,
      chapterName: chapterName || undefined,
      groupKey: groupKey || undefined,
    });

    /**
     * ➕ ADD PARTICIPANT ENTRY TO SEASON
     */
    season.participants.push({
      participant: participant._id,
      category,
      subCategory,
    });

    /**
     * ➕ AUTO-CREATE / ASSIGN GROUP ROUND
     */
    if (groupKey) {
      const now = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const existingRound = season.rounds.find((r) => r.name === groupKey);
      if (existingRound) {
        if (existingRound.status === "upcoming" || !existingRound.status) {
          existingRound.status = "active";
        }
        if (!existingRound.startDate) existingRound.startDate = now;
        if (!existingRound.endDate) existingRound.endDate = end;
        if (typeof existingRound.isVotingEnable !== "boolean") {
          existingRound.isVotingEnable = true;
        }
        const alreadyIn = existingRound.participants.some(
          (p) => p.toString() === participant._id.toString(),
        );
        if (!alreadyIn) existingRound.participants.push(participant._id);
      } else {
        season.rounds.push({
          name: groupKey,
          category,
          subCategory,
          participants: [participant._id],
          status: "active",
          startDate: now,
          endDate: end,
          isVotingEnable: true,
        });
      }
    }

    // 💾 Save both
    await participant.save();
    await season.save();

    return res.status(201).json({
      success: true,
      message: participant.isNew
        ? "Participant created and added to season successfully"
        : "Participant added to season with new category/subCategory",
      data: participant,
    });
  } catch (error) {
    console.error("❌ Error creating participant:", error);
    return res.status(500).json({
      message: "Error creating participant",
      error: error.message,
    });
  }
};

exports.loginParticipant = async (req, res) => {
  try {
    const { email, password, seasonSlug } = req.body;

    if (!email || !password || !seasonSlug) {
      return res.status(400).json({
        success: false,
        message: "Email, password and seasonSlug are required",
      });
    }

    /* =========================
       1️⃣ FIND SEASON
    ========================= */
    const season = await Season.findOne({ slug: seasonSlug })
      .select("_id title status contestId participants")
      .lean();

    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    if (season.status !== "active") {
      return res.status(403).json({
        success: false,
        message: `Season is currently ${season.status}`,
      });
    }

    /* =========================
       2️⃣ FIND PARTICIPANT
    ========================= */
    const participant = await Participant.findOne({ email });
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    /* =========================
       3️⃣ CHECK PARTICIPANT REGISTRATION IN SEASON
    ========================= */
    const seasonEntry = participant.contests.find(
      (c) => c.contest.toString() === season._id.toString(),
    );

    if (!seasonEntry) {
      return res.status(403).json({
        success: false,
        message: "You are not registered for this season",
      });
    }

    if (seasonEntry.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your participation has been removed from this season",
      });
    }

    /* =========================
       4️⃣ EXTRA SAFETY CHECK (SEASON SIDE)
    ========================= */
    if (
      Array.isArray(season.participants) &&
      !season.participants.some(
        (p) => p.toString() === participant._id.toString(),
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Participant is not mapped to this season",
      });
    }

    /* =========================
       5️⃣ PASSWORD CHECK
    ========================= */
    const isMatch = await bcrypt.compare(password, participant.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    /* =========================
       6️⃣ GENERATE JWT
    ========================= */
    const token = jwt.sign(
      {
        userId: participant._id,
        role: "participant",
        seasonId: season._id,
        contestId: season.contestId,
        category: seasonEntry.category,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    /* =========================
       7️⃣ SET COOKIE
    ========================= */
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    /* =========================
       8️⃣ RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      message: "Login successful",
      participant: {
        id: participant._id,
        name: participant.name,
        email: participant.email,
        category: seasonEntry.category,
        seasonId: season._id,
        contestId: season.contestId,
        seasonSlug,
      },
    });
  } catch (error) {
    console.error("Participant login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login error",
      error: error.message,
    });
  }
};

// Get loggedInParticipant
exports.getLoggedInParticipant = async (req, res) => {
  try {
    const { email } = req.user;

    const participant = await Participant.findOne({ email })
      .select("-password")
      .populate("contests.contest");
    if (!participant)
      return res.status(404).json({ message: "Participant not found" });
    res.status(200).json({ participant });
  } catch (error) {
    res.status(401).json({ message: "Invalid token", error: error.message });
  }
};

// Get all participants (with pagination)
exports.getAllParticipants = async (req, res) => {
  try {
    // Sanitize and parse page number
    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;
    const limit = 50;
    const skip = (page - 1) * limit;

    const query = req.query.query;
    let searchFilter;
    if (query) {
      const regex = new RegExp(query, "i");
      searchFilter = {
        $or: [
          { name: { $regex: regex } },
          { email: { $regex: regex } },
          { phone: { $regex: regex } },
        ],
      };
    }

    const participants = await Participant.find(searchFilter)
      .skip(skip)
      .limit(limit)
      .populate("contests.contest");

    const total = await Participant.countDocuments(searchFilter);

    res.status(200).json({
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalParticipants: total,
      participants,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get participant by ID
exports.getParticipantById = async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id).populate(
      "contests.contest",
    );
    if (!participant)
      return res.status(404).json({ message: "Participant not found" });

    res.status(200).json(participant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// get Participants By Season (category-wise)
exports.getParticipantBySeason = async (req, res) => {
  try {
    const { seasonId } = req.params;
    const { query, page = 1, category, subCategory, soloType } = req.query;

    if (!seasonId || !mongoose.Types.ObjectId.isValid(seasonId)) {
      return res.status(400).json({ message: "Season ID is required" });
    }

    const limit = 50;
    const skip = (Number(page) - 1) * limit;

    /**
     * 🔍 BASE MATCH (participant level)
     */
    const baseMatch = {
      "contests.contest": new mongoose.Types.ObjectId(seasonId),
    };

    if (query) {
      baseMatch.$or = [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ];
    }

    /**
     * 🔍 CONTEST-LEVEL MATCH (after unwind)
     */
    const contestMatch = {
      "contests.contest": new mongoose.Types.ObjectId(seasonId),
    };

    const normalizedCategory = String(category || "").trim().toLowerCase();
    const normalizedSubCategory = String(subCategory || "").trim().toLowerCase();
    const normalizedSoloType = String(soloType || "").trim().toLowerCase();

    if (normalizedCategory || normalizedSubCategory || normalizedSoloType) {
      contestMatch.$expr = {
        $and: [
          ...(normalizedCategory
            ? [
                {
                  $eq: [
                    {
                      $toLower: {
                        $trim: { input: { $ifNull: ["$contests.category", ""] } },
                      },
                    },
                    normalizedCategory,
                  ],
                },
              ]
            : []),
          ...(normalizedSubCategory
            ? [
                {
                  $eq: [
                    {
                      $toLower: {
                        $trim: { input: { $ifNull: ["$contests.subCategory", ""] } },
                      },
                    },
                    normalizedSubCategory,
                  ],
                },
              ]
            : []),
          ...(normalizedSoloType
            ? [
                {
                  $eq: [
                    {
                      $toLower: {
                        $trim: { input: { $ifNull: ["$contests.soloType", ""] } },
                      },
                    },
                    normalizedSoloType,
                  ],
                },
              ]
            : []),
        ],
      };
    }

    const pipeline = [
      { $match: baseMatch },

      // 🔥 One row per contest entry
      { $unwind: "$contests" },

      // 🔥 Apply conditional category/subCategory filter
      { $match: contestMatch },

      // 🔄 Join season info
      {
        $lookup: {
          from: "seasons",
          localField: "contests.contest",
          foreignField: "_id",
          as: "season",
        },
      },
      { $unwind: "$season" },

      {
        $addFields: {
          seasonParticipant: {
            $first: {
              $filter: {
                input: "$season.participants",
                as: "p",
                cond: {
                  $and: [
                    { $eq: ["$$p.participant", "$_id"] },
                    { $eq: ["$$p.category", "$contests.category"] },
                    {
                      $cond: [
                        { $ifNull: ["$contests.subCategory", false] },
                        { $eq: ["$$p.subCategory", "$contests.subCategory"] },
                        true,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },

      // 📦 Shape response
      // {
      //   $project: {
      //     _id: 1,
      //     name: 1,
      //     email: 1,
      //     phone: 1,
      //     profilePhoto: 1,
      //     totalStar: 1,
      //     category: "$contests.category",
      //     subCategory: "$contests.subCategory",
      //     registeredAt: "$contests.registeredAt",
      //     contest: {
      //       _id: "$season._id",
      //       title: "$season.title",
      //       slug: "$season.slug",
      //       status: "$season.status",
      //     },
      //   },
      // },

      {
        $project: {
          _id: 1, // participant _id
          name: 1,
          email: 1,
          phone: 1,
          profilePhoto: 1,
          totalStar: 1,

          // 🔑 SUB DOC IDS
          participantContestId: "$contests._id",
          seasonParticipantId: "$seasonParticipant._id",

          category: "$contests.category",
          subCategory: "$contests.subCategory",
          memberName: "$contests.memberName",
          chapterName: "$contests.chapterName",
          soloType: "$contests.soloType",
          groupKey: "$contests.groupKey",
          registeredAt: "$contests.registeredAt",

          contest: {
            _id: "$season._id",
            title: "$season.title",
            slug: "$season.slug",
            status: "$season.status",
          },
        },
      },

      { $skip: skip },
      { $limit: limit },
    ];

    /**
     * 🔢 COUNT PIPELINE (must match the same filters)
     */
    const countPipeline = [
      { $match: baseMatch },
      { $unwind: "$contests" },
      { $match: contestMatch },
      { $count: "total" },
    ];

    const [participants, countResult] = await Promise.all([
      Participant.aggregate(pipeline),
      Participant.aggregate(countPipeline),
    ]);

    const totalParticipants = countResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      currentPage: Number(page),
      limit,
      totalParticipants,
      totalPages: Math.ceil(totalParticipants / limit),
      participants,
    });
  } catch (error) {
    console.error("getParticipantBySeason error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// exports.getParticipantBySeason = async (req, res) => {
//   try {
//     const { seasonId } = req.params;
//     const { query, page = 1 } = req.query;

//     if (!seasonId) {
//       return res.status(400).json({ message: "Season ID is required" });
//     }

//     const limit = 50;
//     const skip = (parseInt(page) - 1) * limit;

//     // 🔹 Base match for participants registered in this season
//     const baseMatch = { "contests.contest": new mongoose.Types.ObjectId(seasonId) };

//     // 🔹 Pipeline for fetching participants
//     const pipeline = [
//       { $match: baseMatch },

//       // Unwind contests array to search inside category/subCategory
//       { $unwind: "$contests" },

//       // Only keep contests for this season
//       { $match: { "contests.contest": new mongoose.Types.ObjectId(seasonId) } },

//       // Apply search query if exists
//       ...(query
//         ? [
//             {
//               $match: {
//                 $or: [
//                   { name: { $regex: query, $options: "i" } },
//                   { email: { $regex: query, $options: "i" } },
//                   { "contests.category": { $regex: query, $options: "i" } },
//                   { "contests.subCategory": { $regex: query, $options: "i" } },
//                 ],
//               },
//             },
//           ]
//         : []),

//       // Join season info
//       {
//         $lookup: {
//           from: "seasons",
//           localField: "contests.contest",
//           foreignField: "_id",
//           as: "season",
//         },
//       },
//       { $unwind: "$season" },

//       // Shape the response
//       {
//         $project: {
//           _id: 1,
//           name: 1,
//           email: 1,
//           phone: 1,
//           profilePhoto: 1,
//           totalStar: 1,
//           category: "$contests.category",
//           subCategory: "$contests.subCategory",
//           registeredAt: "$contests.registeredAt",
//           contest: {
//             _id: "$season._id",
//             title: "$season.title",
//             slug: "$season.slug",
//             status: "$season.status",
//           },
//         },
//       },

//       // Pagination
//       { $skip: skip },
//       { $limit: limit },
//     ];

//     // 🔹 Pipeline for counting total filtered participants
//     const countPipeline = [
//       { $match: baseMatch },
//       { $unwind: "$contests" },
//       { $match: { "contests.contest": new mongoose.Types.ObjectId(seasonId) } },
//       ...(query
//         ? [
//             {
//               $match: {
//                 $or: [
//                   { name: { $regex: query, $options: "i" } },
//                   { email: { $regex: query, $options: "i" } },
//                   { "contests.category": { $regex: query, $options: "i" } },
//                   { "contests.subCategory": { $regex: query, $options: "i" } },
//                 ],
//               },
//             },
//           ]
//         : []),
//       { $count: "total" },
//     ];

//     // 🔹 Run both queries in parallel
//     const [participants, countResult] = await Promise.all([
//       Participant.aggregate(pipeline),
//       Participant.aggregate(countPipeline),
//     ]);

//     const totalParticipants = countResult[0]?.total || 0;

//     return res.status(200).json({
//       success: true,
//       currentPage: Number(page),
//       limit,
//       totalParticipants,
//       totalPages: Math.ceil(totalParticipants / limit),
//       participants,
//     });
//   } catch (error) {
//     console.error("getParticipantBySeason error:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// Update participant

exports.updateParticipant = async (req, res) => {
  try {
    const { contestId, status, password, ...rest } = req.body;
    console.log(req.body);

    const updates = { ...rest };

    // 🔐 Hash password if provided
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    // 📸 Profile image
    if (req.file) {
      updates.profilePhoto = getFileUrl(`userPics/${req.file.filename}`);
    }

    let participant;

    // 🔥 If contestId + status → update contest-specific status
    // if (contestId && status) {
    //   participant = await Participant.findOneAndUpdate(
    //     {
    //       _id: req.params.id,
    //       "contests.contest": contestId,
    //     },
    //     {
    //       $set: {
    //         "contests.$.status": status,
    //       },
    //       $setOnInsert: updates,
    //     },
    //     { new: true }
    //   );
    // } else {
    // 🔁 Normal participant update (name, phone, photo, password)
    participant = await Participant.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    // }

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    res.status(200).json(participant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// update Participant with season join
exports.updateParticipantForSeason = async (req, res) => {
  try {
    const {
      participantId,
      seasonId,
      participantContestId,
      seasonParticipantId,
      name,
      email,
      phone,
      profilePhoto,
      category,
      subCategory,
    } = req.body;
    console.log(req.body, "555555555555555555");

    if (
      !participantId ||
      !seasonId ||
      !participantContestId ||
      !seasonParticipantId
    ) {
      return res.status(400).json({
        success: false,
        message: "Required IDs are missing",
      });
    }

    /* =========================
       1️⃣ FETCH PARTICIPANT
    ========================= */
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res
        .status(404)
        .json({ success: false, message: "Participant not found" });
    }

    /* =========================
       2️⃣ FETCH SEASON
    ========================= */
    const season = await Season.findById(seasonId);
    if (!season) {
      return res
        .status(404)
        .json({ success: false, message: "Season not found" });
    }

    /* =========================
       3️⃣ VALIDATE CATEGORY
    ========================= */
    if (category && !season.categories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category for this season",
      });
    }

    if (
      subCategory &&
      Array.isArray(season.subCategories) &&
      season.subCategories.length > 0 &&
      !season.subCategories.includes(subCategory)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid subCategory for this season",
      });
    }

    /* =========================
       4️⃣ UPDATE PARTICIPANT PROFILE
    ========================= */
    if (name) participant.name = name;
    if (phone) participant.phone = phone;
    if (email) participant.email = email;
    if (profilePhoto) participant.profilePhoto = profilePhoto;

    /* =========================
   🚫 PREVENT DUPLICATE CATEGORY + SUBCATEGORY
========================= */
    const duplicateEntry = participant.contests.find((c) => {
      return (
        c._id.toString() !== participantContestId &&
        c.contest.toString() === seasonId &&
        c.category === category &&
        (c.subCategory || null) === (subCategory || null)
      );
    });

    if (duplicateEntry) {
      return res.status(400).json({
        success: false,
        message:
          "Participant is already registered with this category and subCategory in this season",
      });
    }

    /* =========================
       5️⃣ UPDATE PARTICIPANT.CONTESTS (BY _id)
    ========================= */
    const contestEntry = participant.contests.id(participantContestId);
    if (!contestEntry) {
      return res.status(404).json({
        success: false,
        message: "Contest entry not found for participant",
      });
    }

    if (category) contestEntry.category = category;
    if (subCategory !== undefined) contestEntry.subCategory = subCategory;

    /* =========================
       6️⃣ UPDATE SEASON.PARTICIPANTS (BY _id)
    ========================= */
    const seasonParticipant = season.participants.id(seasonParticipantId);
    if (!seasonParticipant) {
      return res.status(404).json({
        success: false,
        message: "Participant entry not found in season",
      });
    }

    if (category) seasonParticipant.category = category;
    if (subCategory !== undefined) seasonParticipant.subCategory = subCategory;

    /* =========================
       7️⃣ SAVE
    ========================= */
    await participant.save();
    await season.save();

    return res.status(200).json({
      success: true,
      message: "Participant updated successfully",
      data: {
        participantContestId,
        seasonParticipantId,
        category,
        subCategory,
      },
    });
  } catch (error) {
    console.error("Update Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete participant
exports.deleteParticipant = async (req, res) => {
  try {
    const participantId = req.params.id;

    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    /* =========================
       1️⃣ Remove participant from all seasons
    ========================= */
    await Season.updateMany(
      {
        $or: [
          { "participants.participant": participantId },
          { "rounds.participants": participantId },
        ],
      },
      {
        $pull: {
          participants: { participant: participantId },
          "rounds.$[].participants": participantId,
        },
      },
    );

    /* =========================
       2️⃣ Delete participant
    ========================= */
    await Participant.findByIdAndDelete(participantId);

    return res.status(200).json({
      message:
        "Participant deleted and removed from all seasons and rounds successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Delete Participants from Season
exports.deleteParticipantFromSeason = async (req, res) => {
  try {
    const {
      participantId,
      seasonId,
      participantContestId,
      seasonParticipantId,
    } = req.body;

    if (
      !participantId ||
      !seasonId ||
      !participantContestId ||
      !seasonParticipantId
    ) {
      return res.status(400).json({
        success: false,
        message: "Required IDs are missing",
      });
    }

    /* =========================
       1️⃣ FETCH PARTICIPANT
    ========================= */
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    /* =========================
       2️⃣ FETCH SEASON
    ========================= */
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    /* =========================
       3️⃣ REMOVE FROM PARTICIPANT.CONTESTS
    ========================= */
    const beforeContestLen = participant.contests.length;

    participant.contests.pull({ _id: participantContestId });

    if (participant.contests.length === beforeContestLen) {
      return res.status(404).json({
        success: false,
        message: "Contest sub-document not found in participant",
      });
    }

    /* =========================
       4️⃣ REMOVE FROM SEASON.PARTICIPANTS
    ========================= */
    const beforeSeasonLen = season.participants.length;

    season.participants.pull({ _id: seasonParticipantId });

    if (season.participants.length === beforeSeasonLen) {
      return res.status(404).json({
        success: false,
        message: "Participant sub-document not found in season",
      });
    }

    /* =========================
       5️⃣ SAVE
    ========================= */
    await participant.save();
    await season.save();

    return res.status(200).json({
      success: true,
      message: "Participant removed from season successfully",
      data: {
        participantContestId,
        seasonParticipantId,
      },
    });
  } catch (error) {
    console.error("Delete Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Assign contests to participant
exports.assignContestToParticipant = async (req, res) => {
  try {
    const { contests } = req.body;
    const participant = await Participant.findByIdAndUpdate(
      req.params.id,
      { contests },
      { new: true },
    ).populate("contests.contest");

    if (!participant)
      return res.status(404).json({ message: "Participant not found" });

    res
      .status(200)
      .json({ message: "Contests assigned successfully", participant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Contest History
exports.contestHistory = async (req, res) => {
  try {
    const participantId = req.user.userId;
    const { contestId, seasonId } = req.params;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    /* -------------------- Validation -------------------- */
    if (
      !contestId ||
      !mongoose.Types.ObjectId.isValid(contestId) ||
      !seasonId ||
      !mongoose.Types.ObjectId.isValid(seasonId)
    ) {
      return res.status(400).json({
        message: "Valid contestId and seasonId are required",
      });
    }

    /* -------------------- Find Participant -------------------- */
    const participant = await Participant.findById(participantId)
      .select("contests")
      .lean();

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    /* -------------------- Extract participant season IDs -------------------- */
    const participantSeasonIds = participant.contests.map((c) => c.contest);

    if (participantSeasonIds.length === 0) {
      return res.status(200).json({
        total: 0,
        page,
        limit,
        totalPages: 0,
        seasons: [],
      });
    }

    /* -------------------- Query conditions -------------------- */
    const query = {
      contestId: contestId, // same contest
      _id: {
        $in: participantSeasonIds, // seasons user participated in
        $ne: seasonId, // exclude current season
      },
    };

    /* -------------------- Fetch paginated seasons -------------------- */
    const [total, seasons] = await Promise.all([
      Season.countDocuments(query),

      Season.find(query)
        .select(
          "title slug startDate endDate status logo banner createdAt description",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      seasons,
    });
  } catch (error) {
    console.error("contestHistory error:", error);
    return res.status(500).json({
      message: "Failed to fetch contest history",
      error: error.message,
    });
  }
};

// Csv Bulk Import Participants
/**
 * Normalize CSV keys (handles " name", "Name", BOM issues, etc.)
 */
const getValue = (row, key) => {
  const foundKey = Object.keys(row).find(
    (k) => k.trim().toLowerCase() === key.toLowerCase(),
  );
  return foundKey ? String(row[foundKey]).trim() : "";
};

exports.bulkImportParticipants = async (req, res) => {
  try {
    const { seasonId } = req.body;

    if (!seasonId) {
      return res.status(400).json({ message: "seasonId is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({ message: "Season not found" });
    }

    /** 1️⃣ Read CSV completely first */
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => rows.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    let importedCount = 0;
    const skippedRows = [];
    // roundKey → { category, subCategory, participantIds[] }
    const roundAssignments = {};
    // roundKey → { category, subCategory }
    const roundMeta = {};

    /** 2️⃣ Process rows safely (async/await works here) */
    for (const row of rows) {
      const name = getValue(row, "name");
      const email = getValue(row, "email").toLowerCase();
      const phone = getValue(row, "phone");
      // Support multiple header naming conventions from CSV.
      // Doc: Category Name (Column D) + Participation Type (Column E)
      const rawCategory = getValue(row, "category") || getValue(row, "category name");
      const rawSubCategory =
        getValue(row, "subcategory") ||
        getValue(row, "participationType") ||
        getValue(row, "participation type");

      // Doc: Member Name (Column A) + Chapter Name (Column C) + Solo Type (Column F)
      const memberName =
        getValue(row, "memberName") || getValue(row, "member name") || "";
      const chapterName =
        getValue(row, "chapterName") || getValue(row, "chapter name") || getValue(row, "chapter") || "";
      const soloTypeRaw =
        getValue(row, "soloType") || getValue(row, "solo type") || getValue(row, "solotype") || "";

      let category = rawCategory;
      let subCategory = rawSubCategory || null;
      const profilePhoto = getValue(row, "profilePhoto") || null;
      const bio = getValue(row, "bio") || null;

      // Normalize category/subCategory to the canonical values stored in season.
      const normalizeFromSeason = (value, options) => {
        const v = String(value ?? "").trim();
        if (!v) return null;
        const match = options.find(
          (x) => String(x ?? "").trim().toLowerCase() === v.toLowerCase(),
        );
        return match ?? null;
      };

      category = normalizeFromSeason(category, season.categories);
      subCategory = subCategory
        ? normalizeFromSeason(subCategory, season.subCategories)
        : null;

      const isSolo = String(subCategory ?? "").trim().toLowerCase() === "solo";

      // ❌ Validation
      if (!name || !email || !phone || !category) {
        skippedRows.push({ row, error: "Required fields missing" });
        continue;
      }

      if (!category) {
        skippedRows.push({ row, error: "Invalid category" });
        continue;
      }

      if (subCategory && !season.subCategories.includes(subCategory)) {
        skippedRows.push({ row, error: "Invalid subCategory" });
        continue;
      }

      /** 🔍 Find or create participant */
      let participant = await Participant.findOne({ email });

      if (!participant) {
        const rawPassword = phone.slice(-6);
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        participant = await Participant.create({
          name,
          email,
          phone,
          password: hashedPassword,
          profilePhoto,
          bio,
        });
      }

      /** 🔁 Prevent duplicate category entry */
      // If it's Solo, include soloType in duplication key; otherwise ignore soloType.
      let soloType = null;
      if (isSolo) {
        const normalizedSoloType = String(soloTypeRaw ?? "").trim().toLowerCase();
        const allowed = ["Junior", "Member", "Teenager"];
        const match =
          allowed.find((x) => x.toLowerCase() === normalizedSoloType) ?? null;
        // For Solo rows, soloType is required to form a valid groupKey.
        if (!match) {
          skippedRows.push({ row, error: "Invalid or missing soloType for Solo" });
          continue;
        }
        soloType = match;
      }

      const expectedSoloType = isSolo ? soloType : null;
      const groupKey =
        category && subCategory
          ? isSolo
            ? `${category}|${subCategory}|${expectedSoloType}`
            : `${category}|${subCategory}`
          : null;

      if (groupKey) {
        roundMeta[groupKey] = { category, subCategory };
      }

      const alreadyRegistered = participant.contests.some(
        (c) =>
          c.contest.toString() === seasonId &&
          c.category === category &&
          c.subCategory === subCategory &&
          (c.soloType ?? null) === expectedSoloType,
      );

      if (alreadyRegistered) {
        skippedRows.push({ row, error: "Duplicate category entry" });
        continue;
      }

      /** ➕ Add contest entry to participant */
      await Participant.updateOne(
        { _id: participant._id },
        {
          $push: {
            contests: {
              contest: seasonId,
              category,
              subCategory,
              memberName: memberName || undefined,
              chapterName: chapterName || undefined,
              soloType: expectedSoloType,
              groupKey: groupKey || undefined,
            },
          },
        },
      );

      /** ➕ Add participant entry to season */
      await Season.updateOne(
        { _id: seasonId },
        {
          $addToSet: {
            participants: {
              participant: participant._id,
              category,
              subCategory,
            },
          },
        },
      );

      importedCount++;

      // Track which round this participant belongs to
      if (groupKey) {
        if (!roundAssignments[groupKey]) {
          roundAssignments[groupKey] = { category, subCategory, participantIds: [] };
        }
        roundAssignments[groupKey].participantIds.push(participant._id);
      }
    }

    /** 3️⃣ Auto-create / assign rounds in one batch */
    const roundKeysTouched = Array.from(
      new Set([...Object.keys(roundAssignments), ...Object.keys(roundMeta)]),
    );

    if (roundKeysTouched.length > 0) {
      const freshSeason = await Season.findById(seasonId);
      const now = new Date();
      // Keep it active for at least ~30 days so UI treats it as ongoing.
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      for (const roundName of roundKeysTouched) {
        const data = roundAssignments[roundName];
        const meta = roundMeta[roundName];
        const existingRound = freshSeason.rounds.find((r) => r.name === roundName);
        if (existingRound) {
          // If this round was created earlier as upcoming (or dates missing), flip it to active.
          if (existingRound.status === "upcoming" || !existingRound.status) {
            existingRound.status = "active";
          }
          if (!existingRound.startDate) existingRound.startDate = now;
          if (!existingRound.endDate) existingRound.endDate = end;
          if (typeof existingRound.isVotingEnable !== "boolean") {
            existingRound.isVotingEnable = true;
          }
          if (data?.participantIds?.length) {
            for (const pid of data.participantIds) {
              const alreadyIn = existingRound.participants.some(
                (p) => p.toString() === pid.toString(),
              );
              if (!alreadyIn) existingRound.participants.push(pid);
            }
          }
        } else {
          // Only create if we have participants captured for this round
          if (data?.participantIds?.length) {
            freshSeason.rounds.push({
              name: roundName,
              category: meta?.category || data.category,
              subCategory: meta?.subCategory || data.subCategory,
              participants: data.participantIds,
              status: "active",
              startDate: now,
              endDate: end,
              isVotingEnable: true,
            });
          }
        }
      }
      await freshSeason.save();
    } else {
    }

    fs.unlinkSync(req.file.path);

    return res.status(201).json({
      success: true,
      message: "CSV import completed successfully",
      totalImported: importedCount,
      skippedRows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};

// Rounds Participant with Stars
exports.getRoundParticipantsWithStars = async (req, res) => {
  try {
    const { seasonId, roundName, roundId, groupKey } = req.query;

    // -----------------------------
    // 1️⃣ Validate input
    // -----------------------------
    if (!seasonId || (!roundName && !roundId)) {
      return res.status(400).json({
        success: false,
        message: "seasonId and roundName/roundId are required",
      });
    }

    // -----------------------------
    // 2️⃣ Fetch season with rounds + participants
    // -----------------------------
    const season = await Season.findById(seasonId)
      .select("contestId rounds")
      .populate({
        path: "rounds.participants",
        select: "name email profilePhoto contests",
        populate: {
          path: "contests.contest", // ⚠️ this is Season ref
          select: "_id",
        },
      });

    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    // -----------------------------
    // 3️⃣ Find EXACT round
    // -----------------------------
    const round = roundId
      ? season.rounds.find((r) => String(r._id) === String(roundId))
      : season.rounds.find((r) => r.name === roundName);

    if (!round) {
      return res.status(404).json({
        success: false,
        message: "Round not found in this season",
      });
    }

    // -----------------------------
    // 4️⃣ If no participants → return empty
    // -----------------------------
    if (!round.participants || round.participants.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        participants: [],
      });
    }

    // -----------------------------
    // 5️⃣ Aggregate vote stars (season + round)
    // -----------------------------
    const participantIds = round.participants.map((p) => p._id);

    const voteStats = await Vote.aggregate([
      {
        $match: {
          seasonId: new mongoose.Types.ObjectId(seasonId),
          roundId: round._id,
          participantId: { $in: participantIds },
          step: "final",
          isValid: true,
        },
      },
      {
        $group: {
          _id: "$participantId",
          totalStars: { $sum: "$stars" },
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
    ]);

    const voteMap = {};
    const avgMap = {};
    voteStats.forEach((v) => {
      voteMap[v._id.toString()] = v.totalStars;
      const avgAudienceStars =
        Number(v.audienceVotes || 0) > 0
          ? Number(v.audiencePoints || 0) / Number(v.audienceVotes || 1)
          : 0;
      const avgJudgeStars =
        Number(v.judgesVotes || 0) > 0
          ? Number(v.judgesPoints || 0) / Number(v.judgesVotes || 1)
          : 0;
      avgMap[v._id.toString()] = {
        avgAudienceStars,
        avgJudgeStars,
        avgStars: avgAudienceStars + avgJudgeStars,
      };
    });

    // -----------------------------
    // 6️⃣ Build response (CATEGORY FIXED)
    // -----------------------------
    const response = round.participants.map((p) => {
      let category = null;
      let participantGroupKey = null;
      let memberName = null;
      let chapterName = null;
      let soloType = null;

      if (Array.isArray(p.contests)) {
        const entry = p.contests.find((c) => {
          if (!c.contest) return false;

          // populated Season ref
          if (c.contest._id) {
            return c.contest._id.toString() === season._id.toString();
          }

          // raw ObjectId
          return c.contest.toString() === season._id.toString();
        });

        category = entry?.category || null;
        participantGroupKey = entry?.groupKey || null;
        memberName = entry?.memberName || null;
        chapterName = entry?.chapterName || null;
        soloType = entry?.soloType || null;
      }

      return {
        _id: p._id,
        name: p.name,
        email: p.email,
        profilePhoto: p.profilePhoto,
        category,
        groupKey: participantGroupKey,
        memberName,
        chapterName,
        soloType,
        totalStars: voteMap[p._id.toString()] || 0,
        avgAudienceStars: avgMap[p._id.toString()]?.avgAudienceStars || 0,
        avgJudgeStars: avgMap[p._id.toString()]?.avgJudgeStars || 0,
        avgStars: avgMap[p._id.toString()]?.avgStars || 0,
      };
    });

    // -----------------------------
    // 6.1️⃣ Optional group filter
    // -----------------------------
    const filteredResponse = groupKey
      ? response.filter((r) => String(r.groupKey || "") === String(groupKey))
      : response;

    // -----------------------------
    // 7️⃣ Sort by stars (leaderboard)
    // -----------------------------
    filteredResponse.sort((a, b) => b.totalStars - a.totalStars);

    // -----------------------------
    // 8️⃣ Final response
    // -----------------------------
    return res.status(200).json({
      success: true,
      count: filteredResponse.length,
      participants: filteredResponse,
    });
  } catch (error) {
    console.error("getRoundParticipantsWithStars error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
