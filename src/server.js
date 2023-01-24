const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");
const mongoose = require("mongoose");
const { signIn } = require("./severModules/login");
const {
  generateJwtAccessToken,
  saveJwtRefreshToken,
} = require("./services/tokenService");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const User = require("./models/user");
const UserTokens = require("./models/userTokens");
const keys = require("./data/oauth2.keys.json");
const {
  saveToDB,
  saveUserToDB,
  getDataFromDBbyEmail,
} = require("./services/mongoDBService");
const { getValidUserData } = require("./services/userData");

const app = express();

mongoose.connect(
  "mongodb+srv://himel:himel@cluster0.6uvuj.mongodb.net/test2",
  (err, result) => {
    if (err) {
      console.error(err);
    } else {
      console.log("connected");
    }
  }
);

const corsOptions = {
  origin: true, //included origin as true

  credentials: true, //included credentials as true
};

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {
  res.send({ hello: "hello" });
});
const oAuth2Client = new OAuth2Client(
  keys.web.client_id,
  keys.web.client_secret,
  keys.web.redirect_uris[1]
);

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
app.post("/token", async (req, res) => {
  const refreshToken = req.body.token;
  console.log("123", refreshToken);
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
      const accessToken = await generateJwtAccessToken({
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
});
app.get("/getLink", (req, res) => {
  const authorizeUrl = getLink();
  res.send(authorizeUrl);
});

app.get("/login", async (req, res) => {
  const code = req.query.code ? req.query.code : req.body.code;
  console.log("Code ", code);

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
        const savedUserID = await saveToDB(userData?.name, userData?.email);
        if (!savedUserID) {
          console.log("Failed to add user");
          res.status(400).send({
            message: "Failed to add user",
          });
        }
        const accessToken = await generateJwtAccessToken({
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
        const savedJwtRefreshToken = saveJwtRefreshToken(
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
            userData: getValidUserData(userData),
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
});

function authenticateJwtAccessToken(req, res, next) {
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

async function getLoggedInUser(token) {
  let tmp;
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
    console.log("User > ", data);
    tmp = data;
  });
  return tmp;
}

app.get("/getData", authenticateJwtAccessToken, async (req, res) => {
  // console.log(req);
  const authToken = req.headers["authorization"].split(" ")[1];
  console.log("/getData", authToken);
  const loggedInUser = await getLoggedInUser(authToken);
  console.log("/getData > user > ", loggedInUser);
  if (!loggedInUser) {
    console.log("User Not Found");
    res.status(401).send({
      message: "User Not Found",
    });
  }

  console.log("in data");
  const data = await getDataFromDBbyEmail(loggedInUser.email);
  // console.log("data>>> ", data);
  // console.log(">>>>>>>", data?.name, data?.email);
  if (data === -1) {
    console.log("Failed to acquire data");
    res.status(400).send({
      message: "Failed to acquire data",
    });
  } else {
    console.log("data>>> ", data);
    res.status(200).send(data);
  }
});

async function registerUser(userReq, res) {
  console.log("registerUser > ", userReq);
  const emailValid = await check_email(userReq.email);
  if (emailValid) {
    await saveUserToDB(userReq, res);
    return true;
  } else {
    console.log("Email already in use");
    res.status(401).send({ message: "Email already in use" });
    return false;
  }
}

app.post("/signUp", async (req, res) => {
  console.log("/signUp : ", req.body);
  try {
    const userRegistered = await registerUser(req.body.data, res);
    if (userRegistered) {
      console.log("/signUp", "Successful !");
    }
  } catch (error) {
    console.log("signUp catch error > ", error);
    console.log("Failed to signUp.");
    res.status(400).send({
      message: "Failed to signUp.",
    });
  }
});

app.post("/signIn", async (req, res) => {
  await signIn(req, res);
  // if (!req.body.email) {
  //   console.log("Request email was empty.");
  //   return res.status(400).send({
  //     message: "Request email was empty.",
  //   });
  // }
  // await User.findOne({ email: req.body.email }, function (err, user) {
  //   if (err) console.error(err);
  //   if (!user) {
  //     console.log("User not found.");
  //     return res.status(400).send({
  //       message: "User not found.",
  //     });
  //   } else {
  //     console.log("user > ", user);
  //     if (user.validPassword(req.body.password)) {
  //       const accessToken = generateJwtAccessToken({
  //         user: user?.name,
  //         email: user?.email,
  //       });
  //       const refreshToken = jwt.sign(
  //         {
  //           user: user?.name,
  //           email: user?.email,
  //         },
  //         process.env.REFRESH_TOKEN_SECRET
  //       );
  //       console.log({ accessToken: accessToken, refreshToken: refreshToken });
  //       saveJwtRefreshToken(user?.email, refreshToken);
  //       res.cookie("accessToken", accessToken);
  //       res.cookie("refreshToken", refreshToken);
  //       // res.send();

  //       return res.status(201).send({
  //         message: "User Logged In",
  //         accessToken: accessToken,
  //         refreshToken: refreshToken,
  //         userData: user,
  //       });
  //     } else {
  //       return res.status(400).send({
  //         message: "Wrong Password",
  //       });
  //     }
  //   }
  // }).clone();
});

async function check_email(email) {
  const oldEmail = await User.where("email").equals(email);
  console.log("oldEmail : ", oldEmail[0]);
  if (oldEmail && oldEmail[0]) return false;
  return true;
}

app.post("/register_email", async (req, res) => {
  console.log("Email > ", req.body.data);
  const validEmail = await check_email(req.body.data.email);
  console.log("Valid Email : ", validEmail);
  if (validEmail) res.status(200).send({ message: "Email not in use" });
  else res.status(403).send({ message: "email already in use" });
  // res.send(validEmail.name || req.body.email);
});

app.post("/logout", async (req, res) => {
  const tokens = await UserTokens.find().clone();
  if (tokens[0]) {
    try {
      await UserTokens.deleteMany({});
      console.log("Refresh Tokens Deleted");
      res.status(200).send({ message: "Logged out!!" });
    } catch (e) {
      console.log(e.message);
      res.status(400).send({ message: "Error!!" });
    }
  } else res.status(200).send({ message: "Logged out!!" });
});

app.listen(3000, () => {
  console.log("server running");
});

// module.exports = { app };
