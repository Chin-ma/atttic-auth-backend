const mongoose = require("mongoose");
const { customAlphabet } = require("nanoid");

const genId = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

const projectSchema = new mongoose.Schema({
    project_id: { type: String, required: true, default: () => genId() },
    is_private: { type: Boolean, default: false },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Project", projectSchema);