const mongoose = require("mongoose");
const { customAlphabet } = require("nanoid");

const genId = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

const accountSchema = new mongoose.Schema({
  account_id: { type: String, default: () => genId() },
  account_type: { type: mongoose.Schema.Types.ObjectId, ref: "AccountType" },
  name: { type: String, required: true },
  description: { type: String },
  is_active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Account", accountSchema);
