const jwt = require("jsonwebtoken");
require("dotenv").config();
const UserTokens = require("../models/userTokens");

async function GenerateJwtAccessToken({ id, name, email }) {
  console.log("GenerateJwtAccessToken");
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
async function SaveJwtRefreshToken(email, refresh_token) {
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

async function GetJwtAccessToken(refreshToken, res) {
  console.log("refreshToken > ", refreshToken);
  if (refreshToken == null)
    return res.status(401).send({
      message: "Login Again",
    });
  const refreshTokens = UserTokens.where("refresh_token").equals(refreshToken);
  if (refreshTokens[0])
    return res.status(403).send({
      message: "Token already exists , Log in Again",
    });
  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, user) => {
      if (err)
        return res.status(403).send({
          message: "JWT verification Failed. Login Again",
        });
      const accessToken = await GenerateJwtAccessToken({
        id: user?.id,
        name: user?.name,
        email: user?.email,
      });
      console.log("new accessToken ", accessToken);
      res
        .cookie("accessToken", accessToken, {
          secure: true,
          sameSite: "strict",
        })
        .send({ accessToken: accessToken });
      // res.send({ accessToken: accessToken });
    }
  );
}

async function AuthenticateJwtAccessToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  console.log("authHeader ", authHeader);
  const token = authHeader && authHeader.split(" ")[1];
  console.log(">>>>  JwtAccessToken ", token);

  if (!token) {
    console.log("Token not found!");
    return res.status(404).send({
      message: "Token not found!",
    });
  } else {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
      console.log("AccessToken data ", data);
      console.log("AccessToken err ", err);
      if (err) {
        console.log("AccessToken Expired");
        res.status(401).send({
          message: "AccessToken Expired",
        });
        console.log("AccessToken Expired");
      } else {
        console.log("acs data ", data);
        console.log("data.name ", data.name);
        console.log("req.user before ", req.user);
        req.user = data.name;
        // console.log("req", req);
        console.log("req.user after ", req.user);
        next();
      }
    });
  }
}

module.exports = {
  GenerateJwtAccessToken,
  SaveJwtRefreshToken,
  GetJwtAccessToken,
  AuthenticateJwtAccessToken,
};
