const Account = require("../models/account");
const AccountType = require("../models/account-type");
const Role = require("../models/role");
const User = require("../models/user");
const { customAlphabet } = require("nanoid");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendInvitationEmail, sendResetPasswordEmail } = require("../utils/email");
const generateToken = require("../utils/generateToken");

/**
 * POST /api/users/user/add
 * Headers: Authorization: Bearer <token>
 * Body: { full_name, email, role_name }
 */
exports.addUser = async (req, res) => {
  console.log("➡️ Controller hit: addUser");

  try {
    const { full_name, email, role_name } = req.body;

    // 1️⃣ Validate input
    if (!full_name || !email) {
      return res.status(400).json({ error: "full_name and email are required" });
    }

    // 2️⃣ Ensure authenticated user (the inviter)
    const inviter = req.user;
    if (!inviter) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 3️⃣ Ensure inviter is enterprise_admin
    if (inviter.role?.name !== "enterprise_admin") {
      return res.status(403).json({ error: "Only enterprise admins can add users" });
    }

    // 4️⃣ Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // 5️⃣ Find or create enterprise_member role
    let memberRole = await Role.findOne({ name: role_name || "enterprise_member" });
    if (!memberRole) {
      memberRole = await Role.create({
        name: "enterprise_member",
        description: "Standard user under enterprise account",
        permissions: ["VIEW_PROJECTS", "EDIT_PROFILE"],
      });
    }

    // 6️⃣ Create user (pending invite)
    const newUser = await User.create({
      name: full_name,
      full_name,
      email,
      account: inviter.account, // link to the same enterprise account
      role: memberRole._id,
      status: "invited",
    });

    // 7️⃣ Generate reset token for invite
    const resetToken = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    newUser.reset_token = resetToken;
    newUser.reset_token_expires_at = Date.now() + 3600000; // 1 hour
    await newUser.save();

    // 8️⃣ Send invitation email
    await sendInvitationEmail(email, resetToken, full_name);

    console.log("📧 Invitation email sent to:", email);

    // 9️⃣ Respond
    return res.status(201).json({
      message: "User added successfully. Invitation email sent.",
      user: {
        id: newUser._id,
        email: newUser.email,
        role: memberRole.name,
        status: newUser.status,
      },
    });
  } catch (error) {
    console.error("🔥 Error adding user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/accounts/login
 * Body: { email, password }
 */
exports.loginUser = async (req, res) => {
  try {
    console.log("➡️ Login controller hit");

    const { email, password } = req.body;
    console.log("📩 Received body:", req.body);

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email }).populate("role").populate("account");
    if (!user) {
      console.warn("⚠️ User not found:", email);
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.warn("⚠️ Invalid password for:", email);
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // ✅ Generate token with only user._id
    const token = generateToken(user);

    console.log("✅ Login successful for:", user.email);
    res.status(200).json({
      message: "Login successful.",
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role?.name,
        account: user.account?.name,
      },
    });
  } catch (err) {
    console.error("🔥 Error logging in user:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getUserById = async (req, res) => {
  console.log("➡️ Controller hit: getUserById");
  try {
    const userId = req.user._id;
    console.log("📦 User ID from token:", userId);

    const user = await User.findById(userId)
      .populate("role", "name description permissions")
      .populate("account", "name account_id")
      .sort({ createdAt: -1 });

    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("🔥 Error getting user by ID:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /api/accounts/user
 * Requires: Bearer token in header
 */
exports.getUser = async (req, res) => {
  console.log("➡️ Controller hit: getUser");
  try {
    // The user is already attached to req.user by the protect middleware
    const user = req.user;

    const userData = await User.findById(user.id)
      .populate({
        path: "account",
        select: "account_id name account_type",
      })
      .populate({
        path: "role",
        select: "name description permissions",
      })
      .select("-password -reset_token -reset_token_expires_at");
    if (!userData) {
      console.log("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ Authenticated user:", user.email);

    // Format response
    res.status(200).json({
      id: userData._id,
      user_id: userData.user_id,
      name: userData.name,
      full_name: userData.full_name,
      email: userData.email,
      role: userData.role
        ? {
            id: userData.role._id,
            name: userData.role.name,
            description: userData.role.description,
            permissions: userData.role.permissions || [],
          }
        : null,
      account: userData.account
        ? {
            id: userData.account._id,
            name: userData.account.name,
            account_id: userData.account.account_id,
          }
        : null,
      status: userData.status,
      created_at: userData.createdAt,
    });
  } catch (error) {
    console.error("🔥 Error fetching user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getUsersByAccount = async (req, res) => {
  console.log("➡️ Controller hit: getUserByAccount");
  try {
    const { account_id } = req.params;
    const user = await User.find({ account: account_id });
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("🔥 Error fetching user by account:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * DELETE /api/accounts/user/:user_id
 * Requires: Bearer token (for authorization)
 */
exports.deleteUser = async (req, res) => {
  console.log("➡️ Controller hit: deleteUser");
  try {
    const { user_id } = req.params;

    // 1️⃣ Validate
    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // 2️⃣ Find the user by custom user_id
    const user = await User.findOne({ user_id });
    if (!user) {
      console.log("❌ User not found:", user_id);
      return res.status(404).json({ error: "User not found" });
    }

    // (Optional) 3️⃣ Add access control
    // For example: only enterprise_admin or creator_admin can delete
    // if (req.user.role.name !== "enterprise_admin" && req.user.role.name !== "creator_admin") {
    //   return res.status(403).json({ error: "Unauthorized: insufficient permissions" });
    // }

    // 4️⃣ Delete user
    await user.deleteOne();

    console.log("✅ User deleted:", user.email);
    return res.status(200).json({
      message: "User deleted successfully.",
      deleted_user_id: user.user_id,
      email: user.email,
    });
  } catch (error) {
    console.error("🔥 Error deleting user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};