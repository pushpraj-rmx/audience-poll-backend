const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { getFileUrl } = require("../utils/fileHelper");
const Contest = require("../models/Contest");
const Season = require("../models/seasons");

const ROLE_FIELD_MAP = {
  admin: "admins",
  judge: "judges",
  sponsor: "sponsors",
};

// GET ALL USERS
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default page 1
    const limit = 10; // Show 10 users per page
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    const users = await User.find()
      .skip(skip)
      .limit(limit);
    //   .populate("assignedContests");

    res.status(200).json({
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total,
      users,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET SINGLE USER
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "assignedContests"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE USER
exports.createUser = async (req, res) => {
  try {
    const { email, password, seasonId, role, ...rest } = req.body;

    /* =========================
       1️⃣ FIND USER
    ========================= */
    let user = await User.findOne({ email });

    /* =========================
       2️⃣ FETCH SEASON (IF ANY)
    ========================= */
    let season = null;
    if (seasonId) {
      season = await Season.findById(seasonId);
      if (!season) {
        return res.status(404).json({
          success: false,
          message: "Season not found",
        });
      }
    }

    /* =========================
       3️⃣ IF USER EXISTS
    ========================= */
    if (user) {
      // ❌ No seasonId → real duplicate
      if (!seasonId) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      /* Assign season to user */
      await User.findByIdAndUpdate(
        user._id,
        {
          $addToSet: { assignedContests: seasonId },
        },
        { new: true }
      );

      /* Assign user to season by role */
      const roleMap = {
        admin: "admins",
        judge: "judges",
        sponsor: "sponsors",
      };

      const seasonField = roleMap[role];
      if (seasonField) {
        await Season.findByIdAndUpdate(seasonId, {
          $addToSet: { [seasonField]: user._id },
        });
      }

      return res.status(200).json({
        success: true,
        message: "Existing user assigned to season successfully",
      });
    }

    /* =========================
       4️⃣ CREATE NEW USER
    ========================= */
    const hashedPassword = await bcrypt.hash(password, 10);

    let profileUrl;
    if (req.file) {
      profileUrl = getFileUrl(`userPics/${req.file.filename}`);
    }

    user = await User.create({
      ...rest,
      email,
      password: hashedPassword,
      role,
      profile: profileUrl,
      assignedContests: seasonId ? [seasonId] : [],
    });

    /* =========================
       5️⃣ ASSIGN NEW USER TO SEASON
    ========================= */
    if (seasonId) {
      const roleMap = {
        admin: "admins",
        judge: "judges",
        sponsor: "sponsors",
      };

      const seasonField = roleMap[role];
      if (seasonField) {
        await Season.findByIdAndUpdate(seasonId, {
          $addToSet: { [seasonField]: user._id },
        });
      }
    }

    /* =========================
       6️⃣ RESPONSE
    ========================= */
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: "User created and assigned successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error("createUser error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// UPDATE USER
// exports.updateUser = async (req, res) => {
//   try {
//     console.log(req.body,"555555555")
//     const updates = req.body;  
    
//     // Hash password if updating
//     if (updates.password) {
//       console.log("object")
//       updates.password = await bcrypt.hash(updates.password, 10);
//     }

//     // Get profile URL if file was uploaded
//     if (req.file) {
//       updates.profile = getFileUrl(`userPics/${req.file.filename}`);
//     }

//     const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, {
//       new: true,
//     });
//     if (!updatedUser)
//       return res.status(404).json({ success: false, message: "User not found" });

//     res.status(201).json({ success: true, updatedUser });
//   } catch (err) {
//     console.log(err);
    
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = { ...req.body };

    // 1️⃣ Fetch existing user
    const existingUser = await User.findById(userId).select("role");
    if (!existingUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const oldRole = existingUser.role;
    const newRole = updates.role;

    // 2️⃣ Hash password if updating
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    // 3️⃣ Profile upload
    if (req.file) {
      updates.profile = getFileUrl(`userPics/${req.file.filename}`);
    }

    // 4️⃣ Update user
    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
    });

    // 5️⃣ Sync role with Season
    if (newRole && newRole !== oldRole) {
      const oldField = ROLE_FIELD_MAP[oldRole];
      const newField = ROLE_FIELD_MAP[newRole];

      const bulkOps = [];

      if (oldField) {
        bulkOps.push({
          updateMany: {
            filter: { [oldField]: userId },
            update: { $pull: { [oldField]: userId } },
          },
        });
      }

      if (newField) {
        bulkOps.push({
          updateMany: {
            filter: {},
            update: { $addToSet: { [newField]: userId } },
          },
        });
      }

      if (bulkOps.length) {
        await Season.bulkWrite(bulkOps);
      }
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE USER
exports.deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser)
      return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ASSIGN CONTEST
exports.assignContest = async (req, res) => {
  try {
    const { contestId } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { assignedContests: contestId } },
      { new: true }
    );
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
