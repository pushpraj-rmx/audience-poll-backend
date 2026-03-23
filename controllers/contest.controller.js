const Contest = require("../models/Contest");
const Season = require("../models/seasons");
const Participant = require("../models/Participant");
const User = require("../models/User");
const { getFileUrl } = require('../utils/fileHelper');

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");

// Create Contest
exports.createContest = async (req, res) => {
  try {
    const { userId } = req.user;

    /* -------------------- Parse & validate categories -------------------- */
    // let categories = req.body.categories;
    // if (typeof categories === "string") {
    //   categories = JSON.parse(categories);
    // }

    // if (!Array.isArray(categories) || categories.length === 0) {
    //   return res.status(400).json({
    //     error: "At least one category is required",
    //   });
    // }

    /* -------------------- Parse & validate rounds -------------------- */
    // let rounds = req.body.rounds;
    // if (typeof rounds === "string") {
    //   rounds = JSON.parse(rounds);
    // }

    // if (!Array.isArray(rounds) || rounds.length === 0) {
    //   return res.status(400).json({
    //     error: "At least one round is required to create a contest",
    //   });
    // }

    /* -------------------- Generate optimized unique slug -------------------- */
    let slug;
    if (req.body.title) {
      const baseSlug = slugify(req.body.title, {
        lower: true,
        strict: true,
      });

      // Fetch all similar slugs in ONE query
      const existingSlugs = await Contest.find({
        slug: { $regex: `^${baseSlug}(-\\d+)?$` },
      }).select("slug");

      if (existingSlugs.length === 0) {
        slug = baseSlug;
      } else {
        const numbers = existingSlugs
          .map(s => {
            const match = s.slug.match(/-(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          });

        const nextNumber = Math.max(...numbers) + 1;
        slug = `${baseSlug}-${nextNumber}`;
      }
    }

    /* -------------------- File handling -------------------- */
    // if (!req.files?.logo || !req.files?.banner) {
    //   return res.status(400).json({
    //     error: "Logo and banner are required",
    //   });
    // }
    let logo
    if(req.files?.logo) {
      logo = getFileUrl(`contest/logos/${req.files.logo[0].filename}`);
    }
    let banner
    if(req.files?.banner) {
      banner = getFileUrl(`contest/banners/${req.files.banner[0].filename}`);
    }

    /* -------------------- Create contest -------------------- */
    const contest = await Contest.create({
      ...req.body,
      // categories,
      // rounds,
      slug,
      logo,
      banner,
      createdBy: userId,
    });

    res.status(201).json({
      message: "Contest created successfully",
      contest,
    });
  } catch (error) {
    // Duplicate slug safety
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Contest with this title already exists",
      });
    }

    res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
};

// Get all contests (with pagination)
exports.getAllContests = async (req, res) => {
  try {
    // Pagination setup
    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;

    const limit = 10;
    const skip = (page - 1) * limit;

    // Search filter
    const query = req.query.query;
    const filter = query
      ? { title: { $regex: new RegExp(query, "i") } }
      : {};

    // Count total filtered results
    const total = await Contest.countDocuments(filter);

    // Fetch paginated contests (🔽 reverse order)
    const contests = await Contest.find(filter)
      .sort({ createdAt: -1 }) // ✅ reverse order
      .skip(skip)
      .limit(limit)
      .select("title slug description longDescription logo banner pdf seasons")
      .populate({
        path: "createdBy",
        select: "name role"
      })
      .populate({
        path: "updatedBy",
        select: "name role"
      })
      .populate({
        path:"seasons",
        select:"title rounds.name categories"
      })
    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      contests,
    });
  } catch (error) {
    console.error("Error fetching contests:", error);
    res.status(500).json({ error: error.message });
  }
};


// Get contest by ID
// exports.getContestById = async (req, res) => {
//   console.log(req.params)
//   try {
//     const contest = await Contest.findById(req.params.id)
//       .populate("assignedAdmins assignedJudges assignedSponsors participants createdBy")
//       .lean();

//     if (!contest) return res.status(404).json({ message: "Contest not found" });

//     // Populate participants in each round
//     if (contest.rounds && contest.rounds.length > 0) {
//       const Participant = require("../models/Participant");
//       for (let i = 0; i < contest.rounds.length; i++) {
//         const round = contest.rounds[i];
//         if (round.participants && round.participants.length > 0) {
//           const populatedParticipants = await Participant.find({ _id: { $in: round.participants } });
//           contest.rounds[i].participants = populatedParticipants;
//         }
//       }
//     }

//     res.status(200).json(contest);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

exports.getContestById = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id)
      .populate("assignedAdmins assignedJudges assignedSponsors participants createdBy")
      .populate({
        path: "rounds.participants",
        select: "name email",
      });

    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }

    res.status(200).json(contest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get contest by slug
// exports.getContestBySlug = async (req, res) => {
//   try {
//     const { slug } = req.params;

//     const contest = await Contest.findOne({ slug })
//       .populate("assignedAdmins assignedJudges assignedSponsors participants createdBy")
//       .populate({
//         path: "rounds.participants",
//         select: "name email",
//       }).lean();

//     if (!contest) {
//       return res.status(404).json({ message: "Contest not found" });
//     }

//     res.status(200).json(contest);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

exports.getContestBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const contest = await Contest.findOne({ slug })
      .select(
        "title slug description longDescription startDate endDate logo banner pdf createdBy updatedBy status"
      )
      .populate({
        path: "createdBy",
        select: "name email role",
      })
      .populate({
        path: "updatedBy",
        select:"name email role",
      })
      // .populate({
      //   path: "assignedAdmins",
      //   select: "name email phone createdAt status",
      // })
      // .populate({
      //   path: "assignedJudges",
      //   select: "name email phone createdAt status",
      // })
      // .populate({
      //   path: "assignedSponsors",
      //   select: "name email phone createdAt status",
      // })
      // .populate({
      //   path: "rounds.participants",
      //   select: "name email",
      // })
      // .populate({
      //   path: "participants",
      // })
      .lean(); // 🚀 VERY IMPORTANT
    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }

    res.status(200).json({
      success: true,
      contest,
    });
  } catch (error) {
    console.error("getContestBySlug error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Basic Details for home page

exports.getBasicDetails = async (req, res) => {
  try {
    const { slug } = req.params;

    const contest = await Contest.findOne(
      { slug },
      {
        title: 1,
        logo: 1,
        banner: 1,
        description: 1,
        longDescription: 1,
        status: 1,
        categories: 1,
        rounds: 1,
        startDate: 1,
        endDate: 1,
        pdf: 1,
      }
    ).lean(); // plain object

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: "Contest not found",
      });
    }

    // 🔥 Remove _id from rounds & sort
    if (contest.rounds?.length) {
      contest.rounds = contest.rounds
        .map(({ _id, ...round }) => round) // remove _id
        .sort(
          (a, b) => new Date(a.startDate) - new Date(b.startDate)
        );
    }

    return res.status(200).json({
      success: true,
      data: contest,
    });
  } catch (error) {
    console.error("getBasicDetails error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update contest
// exports.updateContest = async (req, res) => {
//   try {
//     let updates = { ...req.body };
    
//     // never allow createdBy override
//     if ("createdBy" in updates) {
//       delete updates.createdBy;
//     }

//     // parse rounds if it came as string
//     if (updates.rounds && typeof updates.rounds === "string") {
//       try {
//         updates.rounds = JSON.parse(updates.rounds);
//       } catch (err) {
//         updates.rounds = [];
//       }
//     }

//     if (req.files?.logo) {
//       const logoResult = getFileUrl(`contest/logos/${req.files.logo[0].filename}`);
//       updates.logo = logoResult;
//     }

//     if (req.files?.banner) {
//       const bannerResult = getFileUrl(`contest/banners/${req.files.banner[0].filename}`);
//       updates.banner = bannerResult;
//     }

//     // ✅ actually update in DB
//     const contest = await Contest.findByIdAndUpdate(req.params.id, updates, {
//       new: true, // return updated doc
//       runValidators: true,
//     });

//     if (!contest) {
//       return res.status(404).json({ message: "Contest not found" });
//     }

//     res.status(200).json(contest);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

exports.updateContest = async (req, res) => {
  try {
    const { userId } = req.user;
    let updates = { ...req.body };
    delete updates.createdBy;

    if (updates.categories && typeof updates.categories === "string") {
      updates.categories = JSON.parse(updates.categories);
    }

    if (updates.rounds && typeof updates.rounds === "string") {
      updates.rounds = JSON.parse(updates.rounds);
    }

    // Regenerate slug if title changes
    if (updates.title) {
      let baseSlug = slugify(updates.title);
      let slug = baseSlug;
      let count = 1;

      while (
        await Contest.exists({
          slug,
          _id: { $ne: req.params.id },
        })
      ) {
        slug = `${baseSlug}-${count++}`;
      }

      updates.slug = slug;
    }

    if (req.files?.logo) {
      updates.logo = getFileUrl(`contest/logos/${req.files.logo[0].filename}`);
    }

    if (req.files?.banner) {
      updates.banner = getFileUrl(`contest/banners/${req.files.banner[0].filename}`);
    }

    updates.updatedBy = userId;

    const contest = await Contest.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }

    res.status(200).json(contest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Delete contest
exports.deleteContest = async (req, res) => {
  try {
    const contest = await Contest.findByIdAndDelete(req.params.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    res.status(200).json({ message: "Contest deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Search Contests
exports.searchContests = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: "Query parameter is required" });
    const regex = new RegExp(query, 'i');
    const contests = await Contest.find({ name: { $regex: regex } }).populate("assignedAdmins assignedJudges assignedSponsors participants createdBy");
    res.status(200).json(contests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Toggle voting (enable/disable)
exports.toggleVoting = async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    contest.isVotingEnabled = !contest.isVotingEnabled;
    await contest.save();

    res.status(200).json({
      message: `Voting ${contest.isVotingEnabled ? "enabled" : "disabled"
        } successfully`,
      contest,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getContestByAdmin = async (req, res) => {
  try {
    const { userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const contestsByAdmin = await Contest.find({ assignedAdmins: userId }).skip(skip).limit(limit).populate("assignedAdmins assignedJudges assignedSponsors participants createdBy");
    const total = await Contest.countDocuments({ assignedAdmins: userId });

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      contestsByAdmin,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Assign user to contest
exports.assignUserToContest = async (req, res) => {
  const { userId, contestId, role } = req.body;
  console.log(role,"2222222222")
  if (!userId || !contestId || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  try {
    // Add contest to user's assignedContests if not already present
    await User.findByIdAndUpdate(userId, {
      $addToSet: { assignedContests: contestId },
    });

    // Add user to contest's assigned role array
    let update = {};
    if(role === "super_admin") update = { $addToSet: { user: userId } };
    else return res.status(400).json({ message: "Invalid role" });

    await Contest.findByIdAndUpdate(contestId, update);

    res.status(200).json({ message: "User assigned to contest successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// unAssign user from contest
exports.unassignUserFromContest = async (req, res) => {
  const { userId, contestId, role } = req.body;
  if (!userId || !contestId || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  try {
    // Remove contest from user's assignedContests
    await User.findByIdAndUpdate(userId, {
      $pull: { assignedContests: contestId },
    });

    // Remove user from contest's assigned role array
    let update = {};
    if(role === "super_admin") update = { $pull: {user: userId}}
    else return res.status(400).json({ message: "Invalid role" });

    await Contest.findByIdAndUpdate(contestId, update);

    res.status(200).json({ message: "User unassigned from contest successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Assign participant to contest
// exports.assignParticipantToContest = async (req, res) => {
//   try {
//     const { userId, contestId } = req.body;

//     // 🧩 Validate input
//     if (!userId || !contestId) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     // 🔍 Fetch contest
//     const contest = await Contest.findById(contestId);
//     if (!contest) {
//       return res.status(404).json({ message: "Contest not found" });
//     }

//     // 🔍 Fetch participant
//     const participant = await Participant.findById(userId);
//     if (!participant) {
//       return res.status(404).json({ message: "Participant not found" });
//     }

//     // 🚫 Prevent duplicate assignment in contest or participant record
//     await Participant.findByIdAndUpdate(userId, {
//       $addToSet: { assignedContests: contestId },
//     });

//     await Contest.findByIdAndUpdate(contestId, {
//       $addToSet: { participants: userId },
//     });

//     // 🎯 Find the first round (prefer "audition" if exists)
//     let firstRound =
//       contest.rounds.find((r) => r.name === "audition") || contest.rounds[0];

//     if (!firstRound) {
//       return res.status(400).json({
//         message: "This contest has no rounds to assign the participant to.",
//       });
//     }

//     // 🚫 Check if participant already exists in the round
//     const isAlreadyInRound = firstRound.participants.some(
//       (p) => p.toString() === userId
//     );
//     if (!isAlreadyInRound) {
//       firstRound.participants.push(userId);
//     }

//     // 💾 Save the contest with updated round data
//     await contest.save();

//     return res.status(200).json({
//       message: "Participant assigned to contest and first round successfully",
//     });
//   } catch (error) {
//     console.error("❌ Error assigning participant:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

// exports.assignParticipantToContest = async (req, res) => {
//   try {
//     const { participantId, contestId, category } = req.body;

//     if (!participantId || !contestId || !category) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     const contest = await Contest.findById(contestId);
//     if (!contest) {
//       return res.status(404).json({ message: "Contest not found" });
//     }

//     // ✅ validate category
//     if (!contest.categories.includes(category)) {
//       return res.status(400).json({ message: "Invalid category selected" });
//     }

//     const participant = await Participant.findById(participantId);
//     if (!participant) {
//       return res.status(404).json({ message: "Participant not found" });
//     }

//     // 🚫 Prevent duplicate registration
//     const alreadyRegistered = participant.contests.some(
//       (c) => c.contest.toString() === contestId
//     );
//     if (alreadyRegistered) {
//       return res.status(400).json({ message: "Already registered in this contest" });
//     }

//     // ➕ Add contest + category to participant
//     participant.contests.push({
//       contest: contestId,
//       category,
//     });
//     await participant.save();

//     // ➕ Add participant to contest
//     contest.participants.addToSet(participantId);

//     // ➕ Assign to first round (audition preferred)
//     const firstRound =
//       contest.rounds.find((r) => r.name === "audition") || contest.rounds[0];

//     if (firstRound) {
//       firstRound.participants.addToSet(participantId);
//     }

//     await contest.save();

//     res.status(200).json({
//       message: "Participant registered successfully",
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: error.message });
//   }
// };

exports.assignParticipantToContest = async (req, res) => {
  try {
    const { participantId, contestId, category } = req.body;
    console.log(req.body)

    if (!participantId || !contestId || !category) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 🔍 Fetch contest
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }

    // ✅ Validate category
    if (!contest.categories.includes(category)) {
      return res.status(400).json({ message: "Invalid category selected" });
    }

    // 🔍 Fetch participant
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    // 🚫 Prevent duplicate registration
    const alreadyRegistered = participant.contests.some(
      (c) => c.contest.toString() === contestId
    );

    if (alreadyRegistered) {
      return res
        .status(400)
        .json({ message: "Participant already registered in this contest" });
    }

    // ➕ Add contest + category to participant
    participant.contests.push({
      contest: contestId,
      category,
    });

    await participant.save();

    // ➕ Add participant to contest
    contest.participants.addToSet(participantId);

    // ➕ Assign to first round (audition preferred)
    if (contest.rounds?.length > 0) {
      const firstRound =
        contest.rounds.find((r) => r.name === "audition") ||
        contest.rounds[0];

      firstRound.participants.addToSet(participantId);
    }

    await contest.save();

    return res.status(200).json({
      message: "Participant registered successfully",
    });
  } catch (error) {
    console.error("❌ assignParticipantToContest error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Unassign participant from contest
// exports.unAssignParticipantFromContest = async (req, res) => {
//   try {
//     const { userId, contestId } = req.body;

//     // 🧩 Validate input
//     if (!userId || !contestId) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     // 🔍 Fetch contest
//     const contest = await Contest.findById(contestId);
//     if (!contest) {
//       return res.status(404).json({ message: "Contest not found" });
//     }

//     // 🔍 Fetch participant
//     const participant = await Participant.findById(userId);
//     if (!participant) {
//       return res.status(404).json({ message: "Participant not found" });
//     }

//     // 🧹 Remove participant from all rounds within the contest
//     if (contest.rounds && contest.rounds.length > 0) {
//       contest.rounds.forEach((round) => {
//         round.participants = round.participants.filter(
//           (p) => p.toString() !== userId.toString()
//         );
//       });
//     }

//     // 🧾 Remove participant from main contest participants list
//     contest.participants = contest.participants.filter(
//       (p) => p.toString() !== userId.toString()
//     );

//     // 💾 Save contest
//     await contest.save();

//     // 🔄 Remove contest reference from participant’s assignedContests
//     await Participant.findByIdAndUpdate(userId, {
//       $pull: { assignedContests: contestId },
//     });

//     // ✅ Send success response
//     return res.status(200).json({
//       message:
//         "Participant unassigned from contest and removed from all rounds successfully",
//     });
//   } catch (error) {
//     console.error("❌ Error unassigning participant:", error);
//     return res.status(500).json({
//       message: "Error unassigning participant",
//       error: error.message,
//     });
//   }
// };
// exports.unAssignParticipantFromContest = async (req, res) => {
//   try {
//     const { participantId, contestId } = req.body;

//     const contest = await Contest.findById(contestId);
//     if (!contest) {
//       return res.status(404).json({ message: "Contest not found" });
//     }

//     // remove from contest participants
//     contest.participants = contest.participants.filter(
//       (p) => p.toString() !== participantId
//     );

//     // remove from rounds
//     contest.rounds.forEach((round) => {
//       round.participants = round.participants.filter(
//         (p) => p.toString() !== participantId
//       );
//     });

//     await contest.save();

//     // remove contest from participant
//     await Participant.findByIdAndUpdate(participantId, {
//       $pull: { contests: { contest: contestId } },
//     });

//     res.status(200).json({
//       message: "Participant unassigned successfully",
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

exports.unAssignParticipantFromContest = async (req, res) => {
  try {
    const { participantId, contestId } = req.body;
    console.log(req.body)

    if (!participantId || !contestId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }

    // 🧹 Remove participant from contest participants
    contest.participants = contest.participants.filter(
      (p) => p.toString() !== participantId
    );

    // 🧹 Remove participant from all rounds
    contest.rounds.forEach((round) => {
      round.participants = round.participants.filter(
        (p) => p.toString() !== participantId
      );
    });

    await contest.save();

    // 🧹 Remove contest entry from participant.contests
    await Participant.findByIdAndUpdate(participantId, {
      $pull: { contests: { contest: contestId } },
    });

    return res.status(200).json({
      message: "Participant unassigned successfully",
    });
  } catch (error) {
    console.error("❌ unAssignParticipantFromContest error:", error);
    return res.status(500).json({ error: error.message });
  }
}; 


exports.votingEnabled = async (req, res) => {
  try {
    // Sanitize page number
    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build search filter
    const query = req.query.query || "";
    const filter = {
      isVotingEnabled: true,
    };

    if (query) {
      filter.title = { $regex: new RegExp(query, 'i') };
    }

    // Count filtered contests
    const total = await Contest.countDocuments(filter);

    // Fetch paginated contests
    const contests = await Contest.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("assignedAdmins assignedJudges assignedSponsors participants createdBy");

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      contests,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getContentest = async (req, res) => {
  try {
    const data = await Contest.find({
      status: { $in: ["upcoming", "active"] },
    });
    res.send({ success: true, data });
  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, message: "Server error" });
  }
};



exports.assignToNextRound = async (req, res) => {
  try {
    const { seasonId, roundName, participantIds } = req.body;

    if (!seasonId || !roundName || !participantIds?.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload",
      });
    }

    const contest = await Season.findById(seasonId);

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: "Contest not found",
      });
    }

    // 🔥 Find current round index dynamically
    const currentRoundIndex = contest.rounds.findIndex(
      (r) => r.name === roundName
    );

    if (currentRoundIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Current round not found",
      });
    }

    // 🔥 Check if next round exists
    if (currentRoundIndex === contest.rounds.length - 1) {
      return res.status(400).json({
        success: false,
        message: "This is the last round. No next round available.",
      });
    }

    const nextRound = contest.rounds[currentRoundIndex + 1];

    if (!nextRound) {
      return res.status(400).json({
        success: false,
        message: "Next round not found",
      });
    }

    // 🔥 Add participants to next round (NO removal from current)
    let addedCount = 0;

    participantIds.forEach((id) => {
      if (!nextRound.participants.some(p => p.toString() === id)) {
        nextRound.participants.push(id);
        addedCount++;
      }
    });

    await contest.save();

    /**
     * Phase 9: Auto-compute group winners
     * When admin clicks "Assign to Next Round", treat current round as completed
     * and persist top 1/2/3 for each groupKey.
     */
    try {
      const { computeGroupWinnersForKey } = require("./analytics.controller");
      const currentRound = contest.rounds[currentRoundIndex];
      const currentRoundId = currentRound?._id;

      if (currentRoundId) {
        // Get distinct non-null groupKeys from participants already present in current round
        const currentParticipantIds = currentRound.participants || [];
        const groupKeys = await Participant.distinct("contests.groupKey", {
          _id: { $in: currentParticipantIds },
          "contests.contest": seasonId,
          "contests.groupKey": { $ne: null },
        });

        for (const gk of groupKeys || []) {
          if (!gk) continue;
          // Persist winners (top 3)
          await computeGroupWinnersForKey({
            seasonId,
            roundId: currentRoundId,
            groupKey: gk,
          });
        }
      }
    } catch (e) {
      // Do not block main flow; log only.
      console.error("Auto computeGroupWinners failed:", e);
    }

    return res.status(200).json({
      success: true,
      message: `Participants assigned to next round: ${nextRound.name}`,
      nextRound: nextRound.name,
      addedCount,
    });
  } catch (error) {
    console.error("Assign next round error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};