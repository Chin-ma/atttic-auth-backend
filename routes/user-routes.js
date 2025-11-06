const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middlewares/auth-middleware");
const { getUserById, getUser, getUsersByAccount, deleteUser, loginUser, addUser } = require("../controllers/user-controller");

console.log("📦 user-routes.js loaded");

router.post("/add-user", verifyJWT, addUser);
router.post("/login", loginUser);
router.get("/user", verifyJWT, getUser);
router.get("/user/:user_id", verifyJWT, getUserById);
router.get("/:account_id", getUsersByAccount);
router.delete("/user/:user_id", verifyJWT, deleteUser);

module.exports = router;