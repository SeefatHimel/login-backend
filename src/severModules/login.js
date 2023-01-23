const User = require("../models/user");

const {
  generateJwtAccessToken,
  saveJwtRefreshToken,
} = require("../services/tokenService");
const jwt = require("jsonwebtoken");
require("dotenv").config();

async function signIn(req, res) {
  console.log("email : ", req.body.email, " Pass : ", req.body.password);
  if (!req.body.email) {
    console.log("Request email was empty.");
    return res.status(400).send({
      message: "Request email was empty.",
    });
  }
  try {
    await User.findOne({ email: req.body.email }, function (err, user) {
      if (err) console.error(err);
      if (!user) {
        console.log("User not found.");
        return res.status(400).send({
          message: "User not found.",
        });
      } else {
        console.log("user > ", user);
        if (user.validPassword(req.body.password)) {
          const accessToken = generateJwtAccessToken({
            name: user?.name,
            email: user?.email,
          });
          const refreshToken = jwt.sign(
            {
              name: user?.name,
              email: user?.email,
            },
            process.env.REFRESH_TOKEN_SECRET
          );
          console.log({ accessToken: accessToken, refreshToken: refreshToken });
          saveJwtRefreshToken(user?.email, refreshToken);
          res.cookie("accessToken", accessToken, {
            secure: true,
            sameSite: "strict",
          });
          res.cookie("refreshToken", refreshToken, {
            secure: true,
            sameSite: "strict",
          });
          // res.send();

          return res.status(201).send({
            message: "User Logged In",
            accessToken: accessToken,
            refreshToken: refreshToken,
            userData: user,
          });
        } else {
          return res.status(400).send({
            message: "Wrong Password",
          });
        }
      }
    }).clone();
  } catch (error) {
    console.log("Sign in Error : ", error);
    return res.status(400).send({
      message: "User not found.",
    });
  }
}

module.exports = { signIn };
