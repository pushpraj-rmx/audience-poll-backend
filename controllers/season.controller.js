const Contest = require("../models/Contest");
const slugify = require("slugify");
const Season = require("../models/seasons");
const User = require("../models/User");
const Participant = require("../models/Participant");
const { getFileUrl } = require('../utils/fileHelper');
const path = require('path');
const fs = require('fs');
const { default: mongoose } = require("mongoose");

// exports.createSeason = async (req, res) => {
//   try {
//     const { userId } = req.user;

//     let {                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 
//       contestId,
//       title,                                                                                                      
//       description,
//       categories,                                                                           
//       subCategories,                                                                                                                                                                                                                                                              
//       rounds,
//       participants,
//       location,
//       status,
//       startDate,
//       endDate,
//       longDescription
//     } = req.body;

//     /* -------------------- Required validation -------------------- */
//     if (!contestId || !title || !description) {
//       return res.status(400).json({
//         success: false,
//         message: "contestId, title, and description are required",
//       });
//     }

//     /* -------------------- JSON parsing (FORM-DATA FIX) -------------------- */
//     if (categories && typeof categories === "string") {
//       categories = JSON.parse(categories);
//     } else if (!categories) {
//       categories = [];
//     }

//     if (subCategories && typeof subCategories === "string") {
//       subCategories = JSON.parse(subCategories);
//     } else if (!subCategories) {
//       subCategories = [];
//     }

//     if (rounds && typeof rounds === "string") {
//       rounds = JSON.parse(rounds);
//     }

//     if (participants && typeof participants === "string") {
//       participants = JSON.parse(participants);
//     }

//     if (location && typeof location === "string") {
//       location = JSON.parse(location);
//     }

//     /* -------------------- Contest check -------------------- */
//     const existingContest = await Contest.findById(contestId).select("title");
//     if (!existingContest) {
//       return res.status(404).json({
//         success: false,
//         message: "Contest not found",
//       });
//     }

//     /* -------------------- Slug -------------------- */
//     let slug = slugify(`${existingContest.title}-${title}`, {
//       lower: true,
//       strict: true,
//     });

//     const slugExists = await Season.findOne({ slug });
//     if (slugExists) {
//       slug = `${slug}-${Date.now()}`;
//     }

//     /* -------------------- File handling (optional) -------------------- */
//     let logo = null;
//     let banner = null;
//     let pdf = null;

//     if (req.files?.logo) {
//       logo = getFileUrl(`contest/logos/${req.files.logo[0].filename}`);
//     }

//     if (req.files?.banner) {
//       banner = getFileUrl(`contest/banners/${req.files.banner[0].filename}`);
//     }

//     if (req.files?.pdf) {
//       pdf = getFileUrl(`contest/pdfs/${req.files.pdf[0].filename}`);
//     }

//     /* -------------------- Create Season -------------------- */
//     const season = await Season.create({
//       contestId,
//       title,
//       slug,
//       description,
//       longDescription,
//       startDate,
//       endDate,
//       categories,
//       subCategories,
//       rounds,
//       participants,
//       location,
//       status,
//       logo,
//       banner,
//       pdf,
//       CreatedBy: userId,
//     });

//     return res.status(201).json({
//       success: true,
//       message: `Season for ${existingContest.title} created successfully`,
//       season,
//     });

//   } catch (error) {
//     console.error("Create Season Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

exports.createSeason = async (req, res) => {
  try {
    const { userId } = req.user;
    console.log(req.user)

    let {
      contestId,
      title,
      description,
      categories,
      subCategories,
      rounds,
      participants,
      location,
      status,
      startDate,
      endDate,
      longDescription,
    } = req.body;

    /* -------------------- Required validation -------------------- */
    if (!contestId || !title || !description) {
      return res.status(400).json({
        success: false,
        message: "contestId, title, and description are required",
      });
    }

    /* -------------------- JSON parsing (FORM-DATA FIX) -------------------- */
    if (categories && typeof categories === "string") {
      categories = JSON.parse(categories);
    } else if (!categories) categories = [];

    if (subCategories && typeof subCategories === "string") {
      subCategories = JSON.parse(subCategories);
    } else if (!subCategories) subCategories = [];

    if (rounds && typeof rounds === "string") {
      rounds = JSON.parse(rounds);
    }

    if (participants && typeof participants === "string") {
      participants = JSON.parse(participants);
    }

    if (location && typeof location === "string") {
      location = JSON.parse(location);
    }

    /* -------------------- Contest check -------------------- */
    const contest = await Contest.findById(contestId).select("title seasons");

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: "Contest not found",
      });
    }

    /* -------------------- Slug -------------------- */
    let slug = slugify(`${contest.title}-${title}`, {
      lower: true,
      strict: true,
    });

    const slugExists = await Season.findOne({ slug });
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }

    /* -------------------- File handling -------------------- */
    let logo = null;
    let banner = null;
    let pdf = null;

    if (req.files?.logo) {
      logo = getFileUrl(`contest/logos/${req.files.logo[0].filename}`);
    }

    if (req.files?.banner) {
      banner = getFileUrl(`contest/banners/${req.files.banner[0].filename}`);
    }

    if (req.files?.pdf) {
      pdf = getFileUrl(`contest/pdfs/${req.files.pdf[0].filename}`);
    }

    /* -------------------- Create Season -------------------- */
    const season = await Season.create({
      contestId,
      title,
      slug,
      description,
      longDescription,
      startDate,
      endDate,
      categories,
      subCategories,
      rounds,
      participants,
      location,
      status,
      logo,
      banner,
      pdf,
      CreatedBy: userId,
    });

    /* -------------------- 🔥 Assign season to contest -------------------- */
    await Contest.findByIdAndUpdate(
      contestId,
      {
        $addToSet: { seasons: season._id }, // prevents duplicates
      },
      { new: true }
    );

    return res.status(201).json({
      success: true,
      message: `Season created and assigned to ${contest.title}`,
      season,
    });
  } catch (error) {
    console.error("Create Season Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// create Rounds in Seasons
exports.addRoundToSeason = async (req, res) => {
  try {
    const { seasonId, name, startDate, endDate, status, isVotingEnable, category, subCategory, } = req.body;
    console.log(req.body,"33333333333333")

    // 1️⃣ Basic validation
    if (!seasonId || !name) {
      return res.status(400).json({
        success: false,
        message: "Season ID and round name are required",
      });
    }

    // 2️⃣ Check if season exists
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    // 3️⃣ Check for duplicate round
    const roundExists = await Season.findOne({
      _id: seasonId,
      rounds: {
        $elemMatch: {
          name: name.trim(),
          category: category || null,
          subCategory: subCategory || null,
        },
      },
    });

    if (roundExists) {
      return res.status(409).json({
        success: false,
        message:
          "Round already exists for this season with same name, category and sub-category",
      });
    }

    // 4️⃣ Create round object
    const newRound = {
      name: name.trim(),
      startDate,
      endDate,
      status,
      isVotingEnable,
      category,
      subCategory,
    };

    // 5️⃣ Push round
    season.rounds.push(newRound);
    await season.save();

    return res.status(201).json({
      success: true,
      message: "Round added successfully",
      data: season.rounds,
    });
  } catch (error) {
    console.error("Add Round Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


exports.getSeasonsByContestId = async (req, res) => {
    try {
        const { contestId } = req.params;

        const seasons = await Season.find({ contestId })
            .populate("contestId")
            .populate("admins judges sponsors participants")
            .populate("rounds.participants");

        res.status(200).json({
            success: true,
            count: seasons.length,
            data: seasons,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getBasicDetails = async (req, res) => {
  try {
    const { slug } = req.params;

    const season = await Season.findOne(
      { slug },
      {
        title: 1,
        logo: 1,
        banner: 1,
        description: 1,
        longDescription: 1,
        status: 1,
        categories: 1,
        subCategories: 1, // ✅ added
        rounds: 1,
        startDate: 1,
        endDate: 1,
        pdf: 1,
      }
    ).lean();

    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Contest not found",
      });
    }

    // 🔥 Remove _id from rounds & sort by startDate
    if (season.rounds?.length) {
      season.rounds = season.rounds
        .map(({ _id, ...round }) => round)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    }

    // 🧹 Optional: remove empty subCategories
    if (!season.subCategories || season.subCategories.length === 0) {
      delete season.subCategories;
    }

    return res.status(200).json({
      success: true,
      data: season,
    });
  } catch (error) {
    console.error("getBasicDetails error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getSeasonBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const season = await Season.findOne({ slug })
      .select({
  title: 1,
  slug: 1,
  description: 1,
  longDescription: 1,
  logo: 1,
  banner: 1,
  pdf: 1,
  status: 1,
  categories: 1,
  subCategories: 1,
  startDate: 1,
  endDate: 1,

  CreatedBy: 1,
  admins: 1,
  judges: 1,
  sponsors: 1,
  participants: 1,

  "rounds._id": 1,
  "rounds.name": 1,
  "rounds.startDate": 1,
  "rounds.endDate": 1,
  "rounds.status": 1,
  "rounds.isVotingEnable": 1,
  "rounds.category": 1,
  "rounds.subCategory": 1,
  "rounds.participants": 1,
})
      .populate({
        path: "CreatedBy",
        select: "name email role",
      })
      .populate({
        path: "admins",
        select: "name email phone createdAt status",
      })
      .populate({
        path: "judges",
        select: "name email phone createdAt status",
      })
      .populate({
        path: "sponsors",
        select: "name email phone createdAt status",
      })
      .populate({
        path: "rounds.participants",
        select: "name email",
      })
      .populate({
        path: "participants",
        select:"name email"
      })
      .populate({
        path: "contestId",
        select: "title slug"
      })
      .lean(); // 🚀 VERY IMPORTANT
    if (!season) {
      return res.status(404).json({ message: "season not found" });
    }

    res.status(200).json({
      success: true,
      season,
    });
  } catch (error) {
    console.error("getSeasonBySlug error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.getSeasonById = async (req, res) => {
  try {
    const { seasonId } = req.params;

    const season = await Season.findById(seasonId)
      .select(
        // "title slug description longDescription logo banner pdf status categories startDate endDate rounds createdBy admins judges sponsors participants"
        `
        title slug contestId description longDescription logo banner pdf status categories subCategories startDate endDate CreatedBy admins judges sponsors participants rounds._id rounds.name rounds.startDate rounds.endDate rounds.status rounds.isVotingEnable rounds.participants ` )
      .populate({
        path: "CreatedBy",
        select: "name email role",
      })
      .populate({
        path: "admins",
        select: "name email phone createdAt status",
      })
      .populate({
        path: "judges",
        select: "name email phone createdAt status",
      })
      .populate({
        path: "sponsors",
        select: "name email phone createdAt status",
      })
      .populate({
        path: "rounds.participants",
        select: "name email",
      })
      .populate({
        path: "participants",
        select:"name email"
      })
      .populate({
        path: "contestId",
        select: "title slug"
      })
      .lean(); // 🚀 VERY IMPORTANT
    if (!season) {
      return res.status(404).json({ message: "season not found" });
    }

    res.status(200).json({
      success: true,
      season,
    });
  } catch (error) {
    console.error("getSeasonBySlug error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// update Season
exports.updateSeason = async (req, res) => {
  try {
    const { seasonId } = req.params;
    const { userId } = req.user;

    let {
      contestId,
      title,
      description,
      longDescription,
      startDate,
      endDate,
      status,
      categories,
      subCategories,
      rounds,
      location
    } = req.body;

    /* -------------------- Find Season -------------------- */
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    /* -------------------- JSON parsing (FORM-DATA FIX) -------------------- */
    if (categories && typeof categories === "string") {
      categories = JSON.parse(categories);
    }

    if (subCategories && typeof subCategories === "string") {
      subCategories = JSON.parse(subCategories);
    }

    if (rounds && typeof rounds === "string") {
      rounds = JSON.parse(rounds);
    }

    if (location && typeof location === "string") {
      location = JSON.parse(location);
    }

    /* -------------------- Slug update (if title changes) -------------------- */
    if (title && title !== season.title) {
      let contest = null;

      if (contestId) {
        contest = await Contest.findById(contestId).select("title");
      } else {
        contest = await Contest.findById(season.contestId).select("title");
      }

      let newSlug = slugify(`${contest.title}-${title}`, {
        lower: true,
        strict: true,
      });

      const slugExists = await Season.findOne({
        slug: newSlug,
        _id: { $ne: seasonId },
      });

      if (slugExists) {
        newSlug = `${newSlug}-${Date.now()}`;
      }

      season.slug = newSlug;
      season.title = title;
    }

    /* -------------------- File handling (optional) -------------------- */
    if (req.files?.logo) {
      season.logo = getFileUrl(`contest/logos/${req.files.logo[0].filename}`);
    }

    if (req.files?.banner) {
      season.banner = getFileUrl(`contest/banners/${req.files.banner[0].filename}`);
    }

    if (req.files?.pdf) {
      season.pdf = getFileUrl(`contest/pdfs/${req.files.pdf[0].filename}`);
    }

    /* -------------------- Update fields (safe merge) -------------------- */
    if (contestId) season.contestId = contestId;
    if (description) season.description = description;
    if (longDescription) season.longDescription = longDescription;
    if (startDate) season.startDate = startDate;
    if (endDate) season.endDate = endDate;
    if (status) season.status = status;
    if (categories) season.categories = categories;
    if (subCategories) season.subCategories = subCategories;
    if (rounds) season.rounds = rounds;
    if (location) season.location = location;

    season.updatedBy = userId;

    /* -------------------- Save -------------------- */
    await season.save();

    return res.status(200).json({
      success: true,
      message: "Season updated successfully",
      season,
    });

  } catch (error) {
    console.error("Update Season Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// update Rounds in season
exports.updateRoundById = async (req, res) => {
  try {
    const { seasonId, roundId } = req.params;
    const { name, startDate, endDate, status, isVotingEnable, category, subCategory, } = req.body; 

    if (!seasonId || !roundId) {
      return res.status(400).json({
        success: false,
        message: "Season ID and Round ID are required",
      });
    }

    // 1️⃣ Check for duplicate round (exclude current round)
    const duplicateRound = await Season.findOne({
      _id: seasonId,
      rounds: {
        $elemMatch: {
          _id: { $ne: roundId },
          name: name?.trim(),
          category: category || null,
          subCategory: subCategory || null,
        },
      },
    });

    if (duplicateRound) {
      return res.status(409).json({
        success: false,
        message:
          "Another round already exists with same name, category and sub-category",
      });
    }

    // 2️⃣ Update round using positional operator
    const updatedSeason = await Season.findOneAndUpdate(
      {
        _id: seasonId,
        "rounds._id": roundId,
      },
      {
        $set: {
          "rounds.$.name": name?.trim(),
          "rounds.$.startDate": startDate,
          "rounds.$.endDate": endDate,
          "rounds.$.status": status,
          "rounds.$.isVotingEnable": isVotingEnable,
          "rounds.$.category": category,
          "rounds.$.subCategory": subCategory,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedSeason) {
      return res.status(404).json({
        success: false,
        message: "Season or Round not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Round updated successfully",
      data: updatedSeason.rounds,
    });
  } catch (error) {
    console.error("Update Round Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




// exports.deleteSeason = async (req, res) => {
//   try {
//     const { seasonId } = req.params;

//     /* -------------------- Find Season -------------------- */
//     const season = await Season.findById(seasonId);
//     if (!season) {
//       return res.status(404).json({
//         success: false,
//         message: "Season not found",
//       });
//     }

//     /* -------------------- Delete Files (optional but recommended) -------------------- */
//     const deleteFileIfExists = (fileUrl) => {
//       if (!fileUrl) return;

//       // assuming getFileUrl creates public URLs like /uploads/...
//       const filePath = path.join(
//         __dirname,
//         "..",
//         fileUrl.replace(process.env.BASE_URL || "", "")
//       );

//       if (fs.existsSync(filePath)) {
//         fs.unlinkSync(filePath);
//       }
//     };

//     deleteFileIfExists(season.logo);
//     deleteFileIfExists(season.banner);
//     deleteFileIfExists(season.pdf);

//     /* -------------------- Delete Season -------------------- */
//     await Season.findByIdAndDelete(seasonId);

//     return res.status(200).json({
//       success: true,
//       message: "Season deleted successfully",
//     });

//   } catch (error) {
//     console.error("Delete Season Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// Toggle voting (enable/disable) for season


exports.deleteSeason = async (req, res) => {
  try {
    const { seasonId } = req.params;

    /* -------------------- Find Season -------------------- */
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    /* -------------------- Delete Files -------------------- */
    const deleteFileIfExists = (fileUrl) => {
      if (!fileUrl) return;

      const filePath = path.join(
        __dirname,
        "..",
        fileUrl.replace(process.env.BASE_URL || "", "")
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    };

    deleteFileIfExists(season.logo);
    deleteFileIfExists(season.banner);
    deleteFileIfExists(season.pdf);

    /* -------------------- Remove Season from Contest(s) -------------------- */
    await Contest.updateMany(
      { seasons: seasonId },
      { $pull: { seasons: seasonId } }
    );

    /* -------------------- Delete Season -------------------- */
    await Season.findByIdAndDelete(seasonId);

    return res.status(200).json({
      success: true,
      message: "Season deleted and removed from contest successfully",
    });

  } catch (error) {
    console.error("Delete Season Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.toggleVoting = async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    /* -------------------- Find Season -------------------- */
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({ 
        success: false,
        message: "Season not found" 
      });
    }

    /* -------------------- Toggle voting -------------------- */
    season.isVotingEnabled = !season.isVotingEnabled;
    
    // Also toggle all rounds in the season
    if (season.rounds && season.rounds.length > 0) {
      season.rounds.forEach(round => {
        round.isVotingEnable = season.isVotingEnabled;
      });
    }
    
    await season.save();

    return res.status(200).json({
      success: true,
      message: `Voting ${season.isVotingEnabled ? "enabled" : "disabled"} successfully`,
      season,
    });
  } catch (error) {
    console.error("Toggle Voting Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Assign user (admin/judge/sponsor) to season
// exports.assignUserToSeason = async (req, res) => {
//   const { userId, seasonId, role } = req.body;
  
//   if (!userId || !seasonId || !role) {
//     return res.status(400).json({ 
//       success: false,
//       message: "Missing required fields: userId, seasonId, role" 
//     });
//   }
  
//   try {
//     /* -------------------- Find Season -------------------- */
//     const season = await Season.findById(seasonId);
//     if (!season) {
//       return res.status(404).json({ 
//         success: false,
//         message: "Season not found" 
//       });
//     }

//     /* -------------------- Find User -------------------- */
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ 
//         success: false,
//         message: "User not found" 
//       });
//     }

//     /* -------------------- Add user to season based on role -------------------- */
//     let update = {};
//     if (role === "admin") {
//       update = { $addToSet: { admins: userId } };
//     } else if (role === "judge") {
//       update = { $addToSet: { judges: userId } };
//     } else if (role === "sponsor") {
//       update = { $addToSet: { sponsors: userId } };
//     } else {
//       return res.status(400).json({ 
//         success: false,
//         message: "Invalid role. Must be admin, judge, or sponsor" 
//       });
//     }

//     await Season.findByIdAndUpdate(seasonId, update);

//     return res.status(200).json({ 
//       success: true,
//       message: `User assigned as ${role} to season successfully` 
//     });
//   } catch (error) {
//     console.error("Assign User To Season Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

exports.assignUserToSeason = async (req, res) => {
  const { userId, seasonId, role } = req.body;
  console.log("Assign User To Season Request Body:", req.body);

  if (!userId || !seasonId || !role) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: userId, seasonId, role",
    });
  }

  try {
    /* -------------------- Validate ObjectIds -------------------- */
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(seasonId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId or seasonId",
      });
    }

    /* -------------------- Find Season -------------------- */
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    /* -------------------- Find User -------------------- */
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* -------------------- Role Validation -------------------- */
    if (!["admin", "judge", "sponsor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be admin, judge, or sponsor",
      });
    }

    /* -------------------- Assign User to Season -------------------- */
    const seasonUpdate = {
      admin: { $addToSet: { admins: userId } },
      judge: { $addToSet: { judges: userId } },
      sponsor: { $addToSet: { sponsors: userId } },
    };

    await Season.findByIdAndUpdate(seasonId, seasonUpdate[role]);

    /* -------------------- STORE seasonId IN USER -------------------- */
    await User.findByIdAndUpdate(userId, {
      $addToSet: { assignedContests: seasonId }, // ✅ seasonId stored here
    });

    return res.status(200).json({
      success: true,
      message: `User assigned as ${role} to season successfully`,
    });
  } catch (error) {
    console.error("Assign User To Season Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Unassign user (admin/judge/sponsor) from season
// exports.unassignUserFromSeason = async (req, res) => {
//   const { userId, seasonId, role } = req.body;
  
//   if (!userId || !seasonId || !role) {
//     return res.status(400).json({ 
//       success: false,
//       message: "Missing required fields: userId, seasonId, role" 
//     });
//   }
  
//   try {
//     /* -------------------- Find Season -------------------- */
//     const season = await Season.findById(seasonId);
//     if (!season) {
//       return res.status(404).json({ 
//         success: false,
//         message: "Season not found" 
//       });
//     }

//     /* -------------------- Remove user from season based on role -------------------- */
//     let update = {};
//     if (role === "admin") {
//       update = { $pull: { admins: userId } };
//     } else if (role === "judge") {
//       update = { $pull: { judges: userId } };
//     } else if (role === "sponsor") {
//       update = { $pull: { sponsors: userId } };
//     } else {
//       return res.status(400).json({ 
//         success: false,
//         message: "Invalid role. Must be admin, judge, or sponsor" 
//       });
//     }

//     await Season.findByIdAndUpdate(seasonId, update);

//     return res.status(200).json({ 
//       success: true,
//       message: `User removed from ${role} role in season successfully` 
//     });
//   } catch (error) {
//     console.error("Unassign User From Season Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

exports.unassignUserFromSeason = async (req, res) => {
  const { userId, seasonId, role } = req.body;

  /* -------------------- Basic validation -------------------- */
  if (!userId || !seasonId || !role) {
    return res.status(400).json({
      success: false,
      message: "userId, seasonId and role are required",
    });
  }

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(seasonId)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid userId or seasonId",
    });
  }

  try {
    /* -------------------- Find Season -------------------- */
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    /* -------------------- Role-based removal -------------------- */
    let seasonUpdate = {};
    let roleArray;

    switch (role) {
      case "admin":
        roleArray = "admins";
        break;
      case "judge":
        roleArray = "judges";
        break;
      case "sponsor":
        roleArray = "sponsors";
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid role. Allowed: admin, judge, sponsor",
        });
    }

    /* -------------------- Check if user is assigned -------------------- */
    if (!season[roleArray].includes(userId)) {
      return res.status(400).json({
        success: false,
        message: `User is not assigned as ${role} in this season`,
      });
    }

    /* -------------------- Update Season -------------------- */
    seasonUpdate = { $pull: { [roleArray]: userId } };

    await Season.findByIdAndUpdate(seasonId, seasonUpdate);

    /* -------------------- Update User -------------------- */
    await User.findByIdAndUpdate(userId, {
      $pull: { assignedContests: seasonId },
    });

    return res.status(200).json({
      success: true,
      message: `User unassigned from ${role} role successfully`,
    });
  } catch (error) {
    console.error("Unassign User From Season Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Assign participant to season
// exports.assignParticipantToSeason = async (req, res) => {
//   try {
//     const { participantId, seasonId, category, subCategory } = req.body;
//     console.log("Assign Participant To Season Request Body:", req.body);

//     if (!participantId || !seasonId || !category) {
//       return res.status(400).json({ 
//         success: false,
//         message: "Missing required fields: participantId, seasonId, category" 
//       });
//     }

//     /* -------------------- Find Season -------------------- */
//     const season = await Season.findById(seasonId);
//     if (!season) {
//       return res.status(404).json({ 
//         success: false,
//         message: "Season not found" 
//       });
//     }

//     /* -------------------- Validate category -------------------- */
//     if (!season.categories.includes(category)) {
//       return res.status(400).json({ 
//         success: false,
//         message: "Invalid category selected for this season" 
//       });
//     }

//     /* -------------------- Validate subCategory (if provided) -------------------- */
//     if (subCategory && season.subCategories && season.subCategories.length > 0) {
//       if (!season.subCategories.includes(subCategory)) {
//         return res.status(400).json({ 
//           success: false,
//           message: "Invalid sub-category selected for this season" 
//         });
//       }
//     }

//     /* -------------------- Find Participant -------------------- */
//     const participant = await Participant.findById(participantId);
//     if (!participant) {
//       return res.status(404).json({ 
//         success: false,
//         message: "Participant not found" 
//       });
//     }

//     /* -------------------- Prevent duplicate registration -------------------- */
//     const alreadyRegistered = season.participants.some(
//       (p) => p.toString() === participantId
//     );

//     if (alreadyRegistered) {
//       return res.status(400).json({
//         success: false,
//         message: "Participant already registered in this season",
//       });
//     }

//     /* -------------------- Check if participant already registered in contest -------------------- */
//     const contestId = season.contestId;
//     const alreadyInContest = participant.contests.some(
//       (c) => c.contest.toString() === contestId.toString()
//     );

//     /* -------------------- Add participant to season -------------------- */
//     season.participants.addToSet(participantId);

//     /* -------------------- Assign to first round (audition preferred) -------------------- */
//     if (season.rounds?.length > 0) {
//       const firstRound =
//         season.rounds.find((r) => r.name === "audition") ||
//         season.rounds[0];

//       firstRound.participants.addToSet(participantId);
//     }

//     await season.save();

//     /* -------------------- Add contest to participant's contests array -------------------- */
//     if (!alreadyInContest) {
//       participant.contests.push({
//         contest: seasonId,
//         category: category,
//         registeredAt: new Date(),
//       });
//       await participant.save();
//       console.log(`✅ Contest ${contestId} added to participant ${participantId} contests array`);
//     } else {
//       console.log(`ℹ️ Participant ${participantId} already registered in contest ${contestId}`);
//     }

//     console.log(`✅ Participant ${participantId} assigned to season ${seasonId} with category: ${category}${subCategory ? ` and sub-category: ${subCategory}` : ''}`);

//     return res.status(200).json({
//       success: true,
//       message: "Participant assigned to season successfully",
//       season,
//     });
//   } catch (error) {
//     console.error("Assign Participant To Season Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


exports.assignParticipantToSeason = async (req, res) => {
  try {
    const { participantId, seasonId, category, subCategory } = req.body;

    if (!participantId || !seasonId || !category) {
      return res.status(400).json({
        success: false,
        message: "participantId, seasonId and category are required",
      });
    }

    /* =========================
       1️⃣ FIND SEASON
    ========================= */
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    /* =========================
       2️⃣ VALIDATE CATEGORY
    ========================= */
    if (!season.categories.includes(category)) {
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
        message: "Invalid sub-category for this season",
      });
    }

    /* =========================
       3️⃣ FIND PARTICIPANT
    ========================= */
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    /* =========================
       4️⃣ PREVENT DUPLICATE (SEASON-BASED)
    ========================= */
    const alreadyRegisteredInSeason = participant.contests.some(
      (c) => c.contest.toString() === seasonId.toString()
    );

    if (alreadyRegisteredInSeason) {
      return res.status(400).json({
        success: false,
        message: "Participant already registered in this season",
      });
    }

    /* =========================
       5️⃣ ADD PARTICIPANT TO SEASON
    ========================= */
    season.participants.addToSet(participant._id);

    /* Assign to first round (audition preferred) */
    // if (Array.isArray(season.rounds) && season.rounds.length > 0) {
    //   const firstRound =
    //     season.rounds.find((r) => r.name === "audition") ||
    //     season.rounds[0];

    //   if (firstRound) {
    //     firstRound.participants.addToSet(participant._id);
    //   }
    // }

    await season.save();

    /* =========================
       6️⃣ ADD SEASON TO PARTICIPANT.CONTESTS
    ========================= */
    participant.contests.push({
      contest: season._id,   // 🔥 SEASON ID (as per model)
      category,
      subCategory,
      status: "active",
      registeredAt: new Date(),
    });

    await participant.save();

    /* =========================
       7️⃣ RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      message: "Participant assigned to season successfully",
      data: {
        participantId: participant._id,
        seasonId: season._id,
        category,
        subCategory: subCategory || null,
      },
    });
  } catch (error) {
    console.error("Assign Participant To Season Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Unassign participant from season
// exports.unassignParticipantFromSeason = async (req, res) => {
//   try {
//     const { participantId, seasonId } = req.body;

//     if (!participantId || !seasonId) {
//       return res.status(400).json({ 
//         success: false,
//         message: "Missing required fields: participantId, seasonId" 
//       });
//     }

//     /* -------------------- Find Season -------------------- */
//     const season = await Season.findById(seasonId);
//     if (!season) {
//       return res.status(404).json({ 
//         success: false,
//         message: "Season not found" 
//       });
//     }

//     /* -------------------- Find Participant -------------------- */
//     const participant = await Participant.findById(participantId);
//     if (!participant) {
//       return res.status(404).json({ 
//         success: false,
//         message: "Participant not found" 
//       });
//     }

//     /* -------------------- Get contestId from season -------------------- */
//     const contestId = season.contestId;

//     /* -------------------- Remove participant from season participants -------------------- */
//     season.participants = season.participants.filter(
//       (p) => p.toString() !== participantId
//     );

//     /* -------------------- Remove participant from all rounds -------------------- */
//     season.rounds.forEach((round) => {
//       round.participants = round.participants.filter(
//         (p) => p.toString() !== participantId
//       );
//     });

//     await season.save();

//     /* -------------------- Remove contest from participant's contests array -------------------- */
//     const contestIndex = participant.contests.findIndex(
//       (c) => c.contest.toString() === contestId.toString()
//     );

//     if (contestIndex !== -1) {
//       participant.contests.splice(contestIndex, 1);
//       await participant.save();
//       console.log(`✅ Contest ${contestId} removed from participant ${participantId} contests array`);
//     } else {
//       console.log(`ℹ️ Contest ${contestId} not found in participant ${participantId} contests array`);
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Participant unassigned from season successfully",
//     });
//   } catch (error) {
//     console.error("Unassign Participant From Season Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

exports.unassignParticipantFromSeason = async (req, res) => {
  try {
    const { participantId, seasonId } = req.body;
    console.log(req.body);

    /* -------------------- Validation -------------------- */
    if (!participantId || !seasonId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: participantId, seasonId",
      });
    }

    /* -------------------- Find Season -------------------- */
    const season = await Season.findById(seasonId);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
      });
    }

    /* -------------------- Find Participant -------------------- */
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    /* -------------------- Remove participant from season -------------------- */
    season.participants = season.participants.filter(
      (p) => p.toString() !== participantId.toString()
    );

    season.rounds.forEach((round) => {
      round.participants = round.participants.filter(
        (p) => p.toString() !== participantId.toString()
      );
    });

    await season.save();

    /* -------------------- HARD REMOVE contest object from participant -------------------- */
    const originalLength = participant.contests.length;

    participant.contests = participant.contests.filter(
      (c) => c.contest.toString() !== seasonId.toString()
    );

    if (participant.contests.length === originalLength) {
      return res.status(400).json({
        success: false,
        message: "Participant is not assigned to this season",
      });
    }

    await participant.save();

    console.log(
      `✅ Participant ${participantId} fully removed from season ${seasonId}`
    );

    return res.status(200).json({
      success: true,
      message: "Participant unassigned from season successfully",
    });

  } catch (error) {
    console.error("Unassign Participant From Season Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addParticipantsToRound = async (req, res) => {
  try {
    const { seasonId, roundId, participantIds } = req.body;

    if (!seasonId || !roundId || !participantIds?.length) {
      return res.status(400).json({
        success: false,
        message: "seasonId, roundId and participantIds are required",
      });
    }

    const updatedSeason = await Season.findOneAndUpdate(
      {
        _id: seasonId,
        "rounds._id": roundId,
      },
      {
        $addToSet: {
          "rounds.$.participants": { $each: participantIds },
        },
      },
      { new: true }
    );

    if (!updatedSeason) {
      return res.status(404).json({
        success: false,
        message: "Season or Round not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Participants added successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({success: false, message: "Server error" });
  }
};


 