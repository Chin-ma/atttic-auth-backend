const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middlewares/auth-middleware");
const { createAccount, setPassword, forgotPassword, createSuperuser, loginUser, verifyResetToken } = require("../controllers/account-controller");

console.log("📦 account-routes.js loaded");

// router.post("/create-enterprise", createEnterpriseAccount);
router.post("/create-account", createAccount);
router.post("/create-superuser", createSuperuser);
router.post("/login", loginUser);
router.post("/set-password", setPassword);
router.post("/forgot-password", forgotPassword);

router.post("/verify-reset-token", verifyResetToken);

module.exports = router;
