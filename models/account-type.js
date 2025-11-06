const mongoose = require("mongoose");
const { customAlphabet } = require("nanoid");

const genId = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

const accountTypeSchema = new mongoose.Schema({
  account_type_id: { type: String, default: () => genId() },
  name: { type: String, required: true, enum: ["creator", "enterprise"] },
  description: { type: String },
  is_active: { type: Boolean, default: true },
  max_no_of_users: { type: Number, default: 1 },
}, { timestamps: true });

module.exports = mongoose.model("AccountType", accountTypeSchema);
