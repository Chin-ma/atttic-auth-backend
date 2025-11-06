const jwt = require("jsonwebtoken");
const User = require("../models/user");

exports.verifyJWT = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        console.log("🔍 authHeader:", authHeader);
        
        if (!authHeader) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findById(decoded.id)
            .populate("role", "name description permissions")
            .populate("account", "name");
        
        if (!req.user) {
            return res.status(401).json({ error: "User not found" });
        }

        next();
    } catch (error) {
        console.error("🔥 Error verifying JWT:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};