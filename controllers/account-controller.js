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
 * POST /api/accounts/create
 * 
 * Enterprise Body:
 * {
 *   "account_type": "enterprise",
 *   "account_name": "TechCorp Pvt Ltd"
 * }
 *
 * Creator Body:
 * {
 *   "account_type": "creator",
 *   "full_name": "Chinmay Patil",
 *   "email": "chinmay@example.com",
 *   "nickname": "Chinmay"
 * }
 */
exports.createAccount = async (req, res) => {
  console.log("➡️ Controller hit: createAccount");
  try {
    const { account_type, account_name, full_name, email, nickname } = req.body;
    console.log("📩 Received body:", req.body);

    // 1️⃣ Validate base input
    if (!account_type) {
      return res.status(400).json({ error: "account_type is required" });
    }

    if (!["enterprise", "creator"].includes(account_type)) {
      return res.status(400).json({ error: "Invalid account_type" });
    }

    // 🔹 Case 1: Enterprise account (with Account model)
    if (account_type === "enterprise") {
      if (!account_name) {
        return res.status(400).json({ error: "account_name is required for enterprise" });
      }

      // Check if enterprise type exists
      let type = await AccountType.findOne({ name: "enterprise" });
      if (!type) {
        console.log("⚙️ Creating enterprise account type");
        type = await AccountType.create({
          name: "enterprise",
          description: "Enterprise account type",
          max_no_of_users: 10,
        });
      }

      // Prevent duplicates
      const existing = await Account.findOne({ name: account_name });
      if (existing) {
        return res.status(400).json({ error: "Enterprise account already exists" });
      }

      // Create enterprise account
      const account = await Account.create({
        name: account_name,
        account_type: type._id,
      });

      console.log("✅ Enterprise account created:", account._id);

      return res.status(201).json({
        message: "Enterprise account created successfully.",
        account: {
          id: account._id,
          account_id: account.account_id,
          name: account.name,
          type: "enterprise",
        },
      });
    }

    // 🔹 Case 2: Creator account (standalone user, no Account)
    if (account_type === "creator") {
      if (!full_name || !email) {
        return res.status(400).json({ error: "full_name and email are required for creator" });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }

      randomPassword = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10)();
      hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Get or create 'creator' role
      let creatorRole = await Role.findOne({ name: "creator_admin" });
      if (!creatorRole) {
        console.log("⚙️ Creating creator_admin role");
        creatorRole = await Role.create({
          name: "creator_admin",
          description: "Admin role for individual creators",
          permissions: ["MANAGE_PROJECTS", "VIEW_PROJECTS", "EDIT_PROFILE"],
        });
      }

      // Create the invited user (not yet active)
      const newUser = await User.create({
        name: nickname || full_name,
        full_name,
        email,
        password: randomPassword,
        role: creatorRole._id,
        status: "invited",
      });

      console.log("✅ Creator user invited:", newUser.email);

      // Generate password setup token
      const resetToken = jwt.sign(
        { id: newUser._id },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      newUser.reset_token = resetToken;
      newUser.reset_token_expires_at = Date.now() + 3600000;
      await newUser.save();

      // Send invitation email
      await sendInvitationEmail(email, resetToken, full_name);
      console.log("📧 Password setup email sent to:", email);

      return res.status(201).json({
        message: "Creator invited successfully. Invitation email sent.",
        user: {
          id: newUser._id,
          email: newUser.email,
          status: newUser.status,
          temp_password: randomPassword,
        },
      });
    }
  } catch (error) {
    console.error("🔥 Error creating account:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/accounts/create-superuser
 * Body: { account_id, full_name, email }
 */
exports.createSuperuser = async (req, res) => {
  try {
    console.log("➡️ Controller hit: createSuperuser");

    const { full_name, email, enterprise_name } = req.body;

    if (!full_name || !email || !enterprise_name) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // 1️⃣ Find enterprise account
    const account = await Account.findOne({ name: enterprise_name });
    if (!account) {
      return res.status(404).json({ error: "Enterprise account not found" });
    }

    // 2️⃣ Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "User already exists with this email" });
    }

    // 3️⃣ Generate random password
    const randomPassword = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10)();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // 4️⃣ Get or create enterprise_admin role
    let enterpriseAdminRole = await Role.findOne({ name: "enterprise_admin" });
    if (!enterpriseAdminRole) {
      enterpriseAdminRole = await Role.create({
        name: "enterprise_admin",
        description: "Enterprise Superuser role",
        permissions: ["MANAGE_USERS", "VIEW_USERS", "INVITE_USERS", "MANAGE_ACCOUNT", "VIEW_PROJECTS"]
      });
    }

    // 5️⃣ Create the user
    const superuser = await User.create({
      name: full_name,
      email,
      password: randomPassword,
      account: account._id,
      role: enterpriseAdminRole._id,
      status: "invited"
    });

    const resetToken = jwt.sign(
        { id: superuser._id },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    )

    superuser.reset_token = resetToken;
    superuser.reset_token_expires_at = Date.now() + 3600000;
    await superuser.save();

    await sendInvitationEmail(email, resetToken, full_name);

    console.log("✅ Superuser created:", superuser.email);
    return res.status(201).json({
      message: "Superuser created successfully.",
      success: true,
      superuser_id: superuser._id,
      temp_password: randomPassword,
      email: superuser.email,
    });
  } catch (err) {
    console.error("🔥 Error creating superuser:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/accounts/set-password
 * Body: { token, new_password }
 */
exports.setPassword = async (req, res) => {
  console.log("➡️ Controller hit: setPassword");

  try {
    const { token, new_password } = req.body;
    console.log("📩 Received token:", token);

    if (!token || !new_password) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    // 1️⃣ Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.log("❌ Invalid or expired token");
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // 2️⃣ Find user by token and check expiry
    const user = await User.findOne({
      _id: decoded.id,
      reset_token: token,
      reset_token_expires_at: { $gt: Date.now() },
    });

    if (!user) {
      console.log("❌ No user found for token or token expired");
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // 3️⃣ Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // 4️⃣ Update user record
    user.password = hashedPassword;
    user.status = "active";
    user.reset_token = undefined;
    user.reset_token_expires_at = undefined;

    await user.save();

    console.log("✅ Password updated successfully for user:", user.email);

    res.status(200).json({
      message: "Password updated successfully. You can now log in.",
      email: user.email,
    });
  } catch (error) {
    console.error("🔥 Error in setPassword:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/accounts/forgot-password
 * Body: { email }
 */
exports.forgotPassword = async (req, res) => {
  console.log("➡️ Controller hit: forgotPassword");

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // 1️⃣ Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ No user found with email:", email);
      // Don't reveal that the user doesn't exist (for security)
      return res.status(200).json({ message: "Email does not exist" });
    }

    // 2️⃣ Generate JWT reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 3️⃣ Store token and expiration in DB
    user.reset_token = resetToken;
    user.reset_token_expires_at = Date.now() + 3600000; // 1 hour
    await user.save();

    // 4️⃣ Send reset email
    await sendResetPasswordEmail(user.email, resetToken, user.name);

    console.log(`📧 Password reset email sent to ${user.email}`);
    return res.status(200).json({
      message: "Reset link has been sent to your email.",
    });
  } catch (error) {
    console.error("🔥 Error in forgotPassword:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};