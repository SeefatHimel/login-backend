const User = require("../models/user");

const {
  GenerateJwtAccessToken,
  SaveJwtRefreshToken,
} = require("../services/tokenService");
const { GetDataFromDBbyEmail } = require("../services/mongoDBService");
const jwt = require("jsonwebtoken");
const { GetValidUserData } = require("../services/userData");
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
    await User.findOne({ email: req.body.email }, async function (err, user) {
      if (err) console.error(err);
      if (!user) {
        console.log("User not found.");
        return res.status(400).send({
          message: "User not found.",
        });
      } else {
        console.log("user > ", user);
        if (user.validPassword(req.body.password)) {
          const accessToken = await GenerateJwtAccessToken({
            id: user?.id,
            name: user?.name,
            email: user?.email,
          });
          const refreshToken = jwt.sign(
            {
              id: user?.id,
              name: user?.name,
              email: user?.email,
            },
            process.env.REFRESH_TOKEN_SECRET
          );
          console.log({ accessToken: accessToken, refreshToken: refreshToken });
          const savedJwtRefreshToken = await SaveJwtRefreshToken(
            user?.email,
            refreshToken
          );
          const userArray = await GetDataFromDBbyEmail(req.body.email);
          const userData = GetValidUserData(userArray[0]);
          console.log("userData > ", userData);
          if (savedJwtRefreshToken && userData) {
            res.cookie("accessToken", accessToken, {
              secure: true,
              sameSite: "strict",
            });
            res.cookie("refreshToken", refreshToken, {
              secure: true,
              sameSite: "strict",
            });
            res.cookie("user", userData.name, {
              secure: true,
              sameSite: "strict",
            });
            res.cookie("activeUserID", user?.id, {
              secure: true,
              sameSite: "strict",
            });
            console.log("...............................");
            res.send({
              accessToken: accessToken,
              refreshToken: refreshToken,
              userData: userData,
              message: "Logged in successfully",
            });
            console.log("...............................");
          } else {
            console.log("signIn - Failed to save token");
            res.status(400).send({
              message: "Failed to save token",
            });
          }
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

// type userType = {
//   id: string;
//   email: string;
//   verified_email: boolean;
//   name: string;
//   picture: string;
//   locale: string;
// };
module.exports = { signIn };
