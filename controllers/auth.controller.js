const User = require("../models/User");
const Contest = require("../models/Contest");
const Season = require("../models/seasons")
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Participant = require("../models/Participant");

// exports.signup = async(req,res)=>{
//   try {
//       const { name, email, password, phone, role } = req.body;

//       // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) return res.status(400).json({ message: 'User already exists' });

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Create user
//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword,
//       role,
//       phone
//     });

//     // Create token
//     const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
//       expiresIn: '7d'
//     });

//     // Send token in cookie
//     res.cookie('token', token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'strict',
//       maxAge: 7 * 24 * 60 * 60 * 1000
//     });

//     res.status(201).json({
//       message: 'User registered successfully',
//       user: {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         phone: user.phone,
//       }
//     });
//   } catch (error) {
//     res.status(500).json({message: 'SignUp error', error:error.message})
//   }
// }

// exports./* logi */n = async(req,res)=>{
//     try {
//         const { email, password, role } = req.body;
//         let user;

//         // 1. Check if user exists

//         if(role=="participant"){
//            user = await Participant.findOne({email})
//         if (!user) return res.status(404).json({ message: 'User not found or Checked role' });
//         }else{
//           user = await User.findOne({ email });
//          if (!user) return res.status(404).json({ message: 'User not found or Checked role' });
//         }

//         // 2. Check Role
//         if(role!==user.role){
//           return res.status(401).json({message: `You are not authorized as a ${role}`});
//         }

//           // 3. Compare password
//           const isMatch = await bcrypt.compare(password, user.password);
//           if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

//           // 4. Generate JWT token
//           const token = jwt.sign(
//             { userId: user._id, role: user.role },
//             process.env.JWT_SECRET,
//             { expiresIn: '7d' }
//           );

//           // Send token as cookie
//           res.cookie('token', token, {
//             httpOnly: true,
//             secure: process.env.NODE_ENV === 'production',
//             sameSite: 'strict',
//             maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//           });

//           res.status(200).json({ message: 'Login successful' });
//     } catch (error) {
//         res.status(500).json({ message: 'Login error', error:error.message });
//     }
// };

exports.superAdminLogin = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // 1️⃣ Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    // 2️⃣ Check if super admin exists
    const admin = await User.findOne({ email });
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Super Admin not found" });
    }

    // 3️⃣ Check role (optional)
    if (role && admin.role !== role) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized role" });
    }

    // 4️⃣ Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid password" });
    }

    // 5️⃣ Generate JWT token
    const token = jwt.sign(
      { userId: admin._id, role: admin.role, status: admin.status },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 6️⃣ Send response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// exports.login = async (req, res) => {

//   try {
//     const { email, password, role, contestId } = req.body;

//     let user;

//     // 1. Check if user exists
//     if (role == "participant") {
//       user = await Participant.findOne({ email })
//       if (!user) return res.status(404).json({ message: 'User not found or Checked role' });
//       else {
//         const verify = user.assignedContests.find(id => id.toString() === contestId);
//         if (!verify) return res.status(404).json({ message: 'You are not a part of this Contest' });
//       }
//     } else {
//       user = await User.findOne({ email });
//       if (!user) return res.status(404).json({ message: 'User not found or Checked role' });
//       else {
//         console.log(user,"useruser")
//         const verify = user.assignedContests.find(id => id.toString() === contestId);
//         if (!verify) return res.status(404).json({ message: 'You are not a part of this Contest' });
//       }
//     }

//     // 2. Check Role
//     if (role !== user.role) {
//       return res.status(401).json({ message: `You are not authorized as a ${role}` });
//     }

//     // 3. Status check
//     if (role === "participant") {
//       if (user.status !== "active") {
//         const msgMap = {
//           pending: "Your account is pending approval.",
//           inactive: "Your account is inactive.",
//           removed: "Your account has been removed."
//         };
//         const msg = msgMap[user.status] || "Your account is not active.";
//         return res.status(403).json({ message: msg, status: user.status });
//       }
//     } else {
//       if (user.status !== "active") {
//         const msgMap = {
//           inactive: "Your account is inactive.",
//           blocked: "Your account is blocked."
//         };
//         const msg = msgMap[user.status] || "Your account is not active.";
//         return res.status(403).json({ message: msg, status: user.status });
//       }
//     }

//     // 4. Compare password
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

//     // 5. Generate JWT token
//     const token = jwt.sign(
//       { userId: user._id, role: user.role, status: user.status },
//       process.env.JWT_SECRET,
//       { expiresIn: '7d' }
//     );

//     // Send token as cookie
//     res.cookie('token', token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'none',
//       maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//     });

//     res.status(200).json({ message: 'Login successful' });
//   } catch (error) {
//     res.status(500).json({ message: 'Login error', error: error.message });
//   }
// };

// Get Logged in User

exports.login = async (req, res) => {
  try {
    const { email, password, role, seasonSlug } = req.body;
    console.log(req.body)

    if (!email || !password || !role || !seasonSlug) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* ----------------------------------
       1️⃣ Resolve contest from slug
    ---------------------------------- */
    const season = await Season.findOne({ slug: seasonSlug }).select("_id");
    if (!season) {
      return res.status(404).json({ message: "Season not found" });
    }

    const seasonId = season._id.toString();
    /* ----------------------------------
       2️⃣ Fetch user based on role
    ---------------------------------- */
    // const Model = role === "participant" ? Participant : User;

    const user = await User.findOne({ email }).select(
      "password role status assignedContests",
    );

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found or role mismatch" });
    }

    /* ----------------------------------
       3️⃣ Role validation
    ---------------------------------- */
    if (user.role !== role) {
      return res
        .status(401)
        .json({ message: `You are not authorized as ${role}` });
    }

    /* ----------------------------------
       4️⃣ Contest assignment validation
    ---------------------------------- */
    const isAssigned = user.assignedContests.some(
      (id) => id.toString() === seasonId,
    );

    if (!isAssigned) {
      return res
        .status(403)
        .json({ message: "You are not part of this contest" });
    }

    /* ----------------------------------
       5️⃣ Status validation
    ---------------------------------- */
    const statusMessages = {
      participant: {
        pending: "Your account is pending approval.",
        inactive: "Your account is inactive.",
        removed: "Your account has been removed.",
      },
      user: {
        inactive: "Your account is inactive.",
        blocked: "Your account is blocked.",
      },
    };

    if (user.status !== "active") {
      const msg =
        statusMessages[role]?.[user.status] || "Your account is not active.";
      return res.status(403).json({ message: msg, status: user.status });
    }

    /* ----------------------------------
       6️⃣ Password check
    ---------------------------------- */
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    /* ----------------------------------
       7️⃣ Generate JWT
    ---------------------------------- */
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        seasonId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    /* ----------------------------------
       8️⃣ Set cookie
    ---------------------------------- */
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      role: user.role,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

// exports.getLoggedInUser = async (req, res) => {
//   try {
//     const { userId, role } = req.user;
//     let user;
//     if (role === "participant") {
//       user = await Participant.findById(userId)
//         .select("-password")
//         .populate({
//           path: "contests.contest",
//           populate: {
//             path: "rounds.participants", // 👈 deep populate the participants inside rounds
//             model: "Participant",
//             select: "_id name email profilePhoto", // fields you want
//           },
//         });
//     } else {
//       user = await User.findById(userId)
//         .select("-password")
//         .populate({
//           path: "assignedContests",
//           populate: {
//             path: "rounds.participants",
//             model: "Participant",
//             select: "_id name email",
//           },
//         });
//     }

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.status(200).json({ success: true, user });
//   } catch (err) {
//     res.status(401).json({ message: "Invalid token", error: err.message });
//   }
// };

// Logout

exports.getLoggedInUser = async (req, res) => {
  try {
    const { userId, role } = req.user;
    let user;

    if (role === "participant") {
      user = await Participant.findById(userId)
        .select("-password")
        .populate({
          path: "contests.contest",
          populate: {
            path: "seasons",
            populate: {
              path: "rounds.participants",
              model: "Participant",
              select: "_id name email profilePhoto",
            },
          },
        });
    } else {
      user = await User.findById(userId)
        .select("-password")
        // .populate({
        //   path: "assignedContests",
        //   populate: {
        //     path: "seasons",
        //     populate: [
        //       {
        //         path: "rounds.participants",
        //         model: "Participant",
        //         select: "_id name email profilePhoto",
        //       },
        //       {
        //         path: "admins judges sponsors",
        //         model: "User",
        //         select: "_id name email",
        //       },
        //     ],
        //   },
        // });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(401).json({ message: "Invalid token", error: err.message });
  }
};

exports.getLoggedInParticipant = async (req, res) => {
  try {
    const { userId, role } = req.user;

    // extra safety (even though protect already checks role)
    if (role !== "participant") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const participant = await Participant.findById(userId)
      .select("-password")
      .populate({
        path: "contests.contest", // Season
        populate: [
          {
            path: "rounds.participants",
            model: "Participant",
            select: "_id name email profilePhoto",
          },
          {
            path: "admins judges sponsors",
            model: "User",
            select: "_id name email",
          },
        ],
      });

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    return res.status(200).json({
      success: true,
      participant,
    });
  } catch (error) {
    console.error("Get Logged In Participant Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch logged-in participant",
      error: error.message,
    });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res.status(200).json({ message: "Logged out successfully" });
};

exports.resetPassword = async (req, res) => {
  const { password } = req.body;
  const { userId } = req.user;

  try {
    const hashed = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(userId, { password: hashed });

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Reset password error", error: error.message });
  }
};

// Simulated email function
// const jwt = require("jsonwebtoken");
// const nodemailer = require("nodemailer");
// const User = require("../models/User");

exports.sendResetEmail = async (req, res) => {
  try {
    const { email } = req.body;

    // 1️⃣ Validate input
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    // 2️⃣ Find user
    const user = await User.findOne({ email, role: "super_admin" });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 3️⃣ Generate JWT token (valid for 5 minutes)
    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "5m" },
    );

    // 4️⃣ Reset link
    const resetLink = `${process.env.DOMAIN}/reset-password/${token}`;

    // 5️⃣ Configure transporter (Hostinger)
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Optional: Verify connection before sending
    await transporter.verify();

    // 6️⃣ Send the email
    await transporter.sendMail({
      from: `"Support Team" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Password Reset Request</h2>
          <p>Hello <strong>${user.name || "User"}</strong>,</p>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <p><a href="${resetLink}" style="color: #1a73e8;">Reset Password</a></p>
          <p>This link will expire in <b>5 minutes</b>.</p>
          <p>If you didn’t request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    // 7️⃣ Respond
    return res.status(200).json({
      success: true,
      message: "Reset password link sent to your email!",
    });
  } catch (error) {
    console.error("❌ sendResetEmail error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send reset email. Please try again later.",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ message: "User not found with this email" });

    // Create reset token valid for 15 minutes
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_RESET_SECRET,
      {
        expiresIn: "15m",
      },
    );

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    await sendResetEmail(email, resetLink); // Replace with real email function

    res.status(200).json({ message: "Reset link sent to your email" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error sending reset link", error: err.message });
  }
};
