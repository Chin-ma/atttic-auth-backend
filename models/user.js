const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { customAlphabet } = require("nanoid");

const genId = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, unique: true },
  password: { type: String, default: "" },
  user_id: { type: String, default: () => genId() },
  account: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
  full_name: { type: String },
  display_name: { type: String },
  last_login: { type: Date },
  status: { type: String, enum: ["active", "inactive", "pending", "invited"], default: "pending" },
  reset_token: { type: String },
  reset_token_expires_at: { type: Date },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
