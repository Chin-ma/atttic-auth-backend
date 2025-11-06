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
    const { first_name, last_name, email, role_name } = req.body;

    // 1️⃣ Validate input
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: "First name, last name and email are required" });
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
      first_name,
      last_name,
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
    await sendInvitationEmail(email, resetToken, first_name, last_name);

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
      first_name: userData.first_name,
      last_name: userData.last_name,
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

/**
 * GET /api/accounts/users
 * Headers: Authorization: Bearer <token>
 * Description:
 * - Fetch all users under the same enterprise account as the logged-in user
 * - Excludes enterprise_admin users
 */
exports.getUsersByAccount = async (req, res) => {
  console.log("➡️ Controller hit: getUsersByAccount");

  try {
    // 1️⃣ Ensure user is authenticated (middleware populates req.user)
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 2️⃣ Ensure the user is a superuser under an enterprise account
    if (!currentUser.account || currentUser.role?.name !== "enterprise_admin") {
      return res.status(403).json({ error: "Only enterprise admins can view account users" });
    }

    // 3️⃣ Find all users under the same account, excluding superusers
    const users = await User.find({
      account: currentUser.account._id,
    })
      .populate("role", "name description permissions")
      .select("-password -reset_token -reset_token_expires_at")
      .lean();

    // 4️⃣ Filter out other superusers from the result
    const filteredUsers = users.filter(
      (user) => user.role?.name !== "enterprise_admin"
    );

    console.log(`✅ Found ${filteredUsers.length} users under account: ${currentUser.account.name}`);

    res.status(200).json({
      account: {
        id: currentUser.account._id,
        name: currentUser.account.name,
      },
      count: filteredUsers.length,
      users: filteredUsers.map((u) => ({
        id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        role: u.role?.name,
        status: u.status,
        created_at: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("🔥 Error fetching users by account:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * DELETE /api/users/delete
 * Requires: Bearer token (for authorization)
 */
exports.deleteUser = async (req, res) => {
  console.log("➡️ Controller hit: deleteUser");

  try {
    // 1️⃣ Extract authenticated user from middleware
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 2️⃣ Check if user has permission to delete
    // enterprise_admin can delete users in their account
    // creator_admin can delete their own account only
    if (
      currentUser.role?.name === "enterprise_admin"
    ) {
      // Enterprise admin deleting someone else — needs target user in body
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Target user's email is required" });
      }

      // 3️⃣ Find target user under same enterprise account
      const targetUser = await User.findOne({
        email,
        account: currentUser.account._id,
      });

      if (!targetUser) {
        console.log("❌ Target user not found:", email);
        return res.status(404).json({ error: "User not found in your account" });
      }

      // Prevent deleting another admin
      if (targetUser.role?.toString() === currentUser.role?._id.toString()) {
        return res.status(403).json({ error: "Cannot delete another enterprise admin" });
      }

      await targetUser.deleteOne();
      console.log("✅ Enterprise Admin deleted user:", targetUser.email);

      return res.status(200).json({
        message: "User deleted successfully.",
        deleted_user_email: targetUser.email,
      });
    }

    // 4️⃣ Creator or regular user deleting themselves
    if (
      ["creator_admin", "enterprise_member"].includes(currentUser.role?.name)
    ) {
      await User.deleteOne({ _id: currentUser._id });
      console.log("✅ User self-deleted:", currentUser.email);

      return res.status(200).json({
        message: "Your account has been deleted successfully.",
        deleted_email: currentUser.email,
      });
    }

    // 5️⃣ Fallback — no matching role
    return res.status(403).json({
      error: "Unauthorized: insufficient permissions",
    });
  } catch (error) {
    console.error("🔥 Error deleting user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
