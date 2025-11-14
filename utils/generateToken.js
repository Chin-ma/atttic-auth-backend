const jwt = require("jsonwebtoken");

const generateToken = (user, project) => {
  return jwt.sign(
    {
      id: user._id,
      project: project._id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

module.exports = generateToken;
