const jwt = require("jsonwebtoken");
require("dotenv").config();
const UserTokens = require("../models/userTokens");

async function generateJwtAccessToken({ id, name, email }) {
  console.log("generateJwtAccessToken");
  console.log(
    "process.env.ACCESS_TOKEN_SECRET ",
    process.env.ACCESS_TOKEN_SECRET
  );
  return jwt.sign(
    {
      id,
      name,
      email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "60s" }
  );
}
async function saveJwtRefreshToken(email, refresh_token) {
  const oldToken = await UserTokens.where("refresh_token").equals(
    refresh_token
  );
  console.log(oldToken);
  if (oldToken[0]) {
    console.log("Token already Exists");
  } else {
    try {
      newToken = await UserTokens.create({
        email: email,
        refresh_token: refresh_token,
      });
      console.log("Token Added ", newToken);
      return true;
    } catch (e) {
      console.log(e.message);
      return false;
    }
  }
}
module.exports = { generateJwtAccessToken, saveJwtRefreshToken };
