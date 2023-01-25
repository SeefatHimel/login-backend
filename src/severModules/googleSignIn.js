const { OAuth2Client } = require("google-auth-library");
const keys = require("../data/oauth2.keys.json");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const { SaveToDB } = require("../services/mongoDBService");
const {
  GenerateJwtAccessToken,
  SaveJwtRefreshToken,
} = require("../services/tokenService");
const { GetValidUserData } = require("../services/userData");

let oAuth2Client;

async function GoogleLogin(code, res) {
  const tokensFound = await getGoogleTokens(code, res);
  if (!tokensFound) {
    console.error("Code Expired");
    res.status(401).send({
      message: "Code Expired",
    });
  } else {
    const userData = await getGoogleUserData(
      oAuth2Client?.credentials?.access_token
    );
    console.log("GoogleUserData >> ", userData);
    if (userData) {
      try {
        const savedUserID = await SaveToDB(userData?.name, userData?.email);
        if (!savedUserID) {
          console.log("Failed to add user");
          res.status(400).send({
            message: "Failed to add user",
          });
        }
        const accessToken = await GenerateJwtAccessToken({
          id: savedUserID,
          name: userData?.name,
          email: userData?.email,
        });
        const refreshToken = jwt.sign(
          {
            id: savedUserID,
            name: userData?.name,
            email: userData?.email,
          },
          process.env.REFRESH_TOKEN_SECRET
        );
        console.log({ accessToken: accessToken, refreshToken: refreshToken });
        const savedJwtRefreshToken = SaveJwtRefreshToken(
          userData?.email,
          refreshToken
        );
        userData.id = savedUserID;
        if (savedJwtRefreshToken) {
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
          res.cookie("activeUserID", savedUserID, {
            secure: true,
            sameSite: "strict",
          });
          console.log("...............................");
          res.send({
            accessToken: accessToken,
            refreshToken: refreshToken,
            userData: GetValidUserData(userData),
            message: "Logged in successfully",
          });
          console.log("...............................");
        } else {
          console.log("Failed to save token");
          res.status(400).send({
            message: "Failed to save token",
          });
        }
      } catch (error) {
        console.error(error.message);
        res.status(400).send({
          message: "Logged in Failed",
        });
      }
    } else {
      console.error("Failed to get Google User Data");
      res.status(401).send({
        message: "Failed to get Google User Data",
      });
    }
  }
}

async function getGoogleTokens(code, res) {
  console.log("Code ", code);
  if (code) {
    try {
      const r = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(r.tokens);
      console.info("Tokens acquired.");
      return true;
    } catch (error) {
      return false;
    }
  } else return false;
}

function getLink() {
  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile", // get user info
      "https://www.googleapis.com/auth/userinfo.email", // get user email ID and if its verified or not
    ],
  });
  return authorizeUrl;
}

async function getGoogleUserData(google_access_token) {
  const oauth2Client2 = new google.auth.OAuth2(); // create new auth client
  oauth2Client2.setCredentials({
    access_token: google_access_token,
  });
  const oauth2 = google.oauth2({
    auth: oauth2Client2,
    version: "v2",
  });
  const { data } = await oauth2.userinfo.get();
  return data;
}

async function GetGoogleLoginLink(req, res) {
  console.log(
    "🚀 ~ file: server.js:128 ~ app.get ~ req",
    req.get("origin"),
    req.get("referer")
  );
  const redirect_uri = req.get("referer");
  oAuth2Client = new OAuth2Client(
    keys.web.client_id,
    keys.web.client_secret,
    redirect_uri
  );
  const authorizeUrl = getLink();
  res.send(authorizeUrl);
}

module.exports = { GoogleLogin, GetGoogleLoginLink };
