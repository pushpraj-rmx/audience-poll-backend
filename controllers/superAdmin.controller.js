const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Contest = require("../models/Contest");
const jwt = require("jsonwebtoken");

exports.getAllSuperAdmins = async (req, res) => {
  try {
    // Sanitize and parse page number
    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build search filter
    const query = req.query.query;
    let searchFilter = { role: "super_admin" };

    if (query) {
      const regex = new RegExp(query, "i");
      searchFilter = {
        role: "super_admin",
        $or: [
          { name: { $regex: regex } },
          { email: { $regex: regex } },
          { phone: { $regex: regex } },
        ],
      };
    }
    // Fetch filtered, paginated admins
    const superAdmins = await User.find(searchFilter)
      .skip(skip)
      .limit(limit)
      .populate("assignedContests");

    // Count total for pagination
    const total = await User.countDocuments(searchFilter);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      superAdmins,
    });
  } catch (error) {
    console.error("Error in getAllSuperAdmins:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.loginSuperAdmin = async (req, res) => {
  try {
    const { email, password, contestSlug } = req.body;

    /* ==========================
       VALIDATION
    ========================== */
    if (!email || !password || !contestSlug) {
      return res.status(400).json({
        success: false,
        message: "Email, password and contestSlug are required",
      });
    }

    /* ==========================
       FIND USER
    ========================== */
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is not active",
      });
    }

    /* ==========================
       VERIFY PASSWORD
    ========================== */
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    /* ==========================
       ROLE CHECK
    ========================== */
    if (user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin only",
      });
    }

    /* ==========================
       FIND CONTEST
    ========================== */
    const contest = await Contest.findOne({ slug: contestSlug }).select(
      "_id title slug",
    );

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: "Contest not found",
      });
    }

    /* ==========================
       CONTEST ACCESS CHECK
    ========================== */
    const hasAccess = user.assignedContests.some(
      (id) => id.toString() === contest._id.toString(),
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this contest",
      });
    }

    /* ==========================
       SUCCESS RESPONSE
       (JWT can be added here)
    ========================== */

    const token = jwt.sign(
      { userId: user._id, role: user.role, status: user.status },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return res.status(200).json({
      success: true,
      message: "Super admin login successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      contest: {
        _id: contest._id,
        title: contest.title,
        slug: contest.slug,
      },
    });
  } catch (error) {
    console.error("Error in loginSuperAdmin:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
