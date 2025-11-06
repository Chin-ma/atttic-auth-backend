const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middlewares/auth-middleware");
const { getUserById, getUser, getUsersByAccount, deleteUser, addUser } = require("../controllers/user-controller");

console.log("📦 user-routes.js loaded");

router.post("/add-user", verifyJWT, addUser);
router.get("/user", verifyJWT, getUser);
router.get("/user/:user_id", verifyJWT, getUserById);
router.get("/members", verifyJWT, getUsersByAccount);
router.delete("/delete", verifyJWT, deleteUser);

module.exports = router;