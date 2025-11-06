// app.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const accountRoutes = require("./routes/account-routes");
const userRoutes = require("./routes/user-routes");

const app = express();
app.use(express.json());
app.use(cors());

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });

// --- Routes ---
app.use("/api/accounts", accountRoutes);
app.use("/api/users", userRoutes);

// --- Root Route ---
app.get("/", (req, res) => {
  console.log("✅ Root route hit");
  res.send("Server is running 🚀");
});

module.exports = app;
