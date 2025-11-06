const mongoose = require("mongoose");
const { customAlphabet } = require("nanoid");

const genId = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

const roleSchema = new mongoose.Schema({
  role_id: { type: String, default: () => genId() },
  name: { type: String, required: true },
  description: { type: String },
  permissions: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model("Role", roleSchema);
