const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");
const mongoose = require("mongoose");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const User = require("./models/user");
const UserTokens = require("./models/userTokens");
const keys = require("./data/oauth2.keys.json");

const app = express();

mongoose.connect(
  "mongodb+srv://himel:himel@cluster0.6uvuj.mongodb.net/test",
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

async function saveToDB(name, email) {
  const oldUser = await User.where("email").equals(email);
  console.log(oldUser[0]);
  if (oldUser[0]) {
    console.log("User already Exists");
  } else {
    try {
      const user = await User.create({ name: name, email: email });
      console.log("User Added ", user);
    } catch (e) {
      console.log(e.message);
      return false;
    }
  }
  return true;
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
      await UserTokens.create({
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
app.get("/", (req, res) => {
  res.send({ hello: "hello" });
});
const oAuth2Client = new OAuth2Client(
  keys.web.client_id,
  keys.web.client_secret,
  keys.web.redirect_uris[1]
);

async function getGoogleTokens(code, res) {
  if (code) {
    const r = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(r.tokens);
    console.info("Tokens acquired.");
    return true;
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
function generateJwtAccessToken(user, email) {
  return jwt.sign(
    {
      user,
      email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "30s" }
  );
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
app.post("/token", (req, res) => {
  const refreshToken = req.body.token;
  console.log("123", refreshToken);
  if (refreshToken == null) return res.sendStatus(401);
  const refreshTokens = UserTokens.where("refresh_token").equals(refreshToken);
  if (refreshTokens[0]) return res.sendStatus(403);
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    const accessToken = generateJwtAccessToken({
      name: user?.name,
      email: user?.email,
    });
    res.json({ accessToken: accessToken });
  });
});
app.get("/getLink", (req, res) => {
  const authorizeUrl = getLink();
  res.send(authorizeUrl);
});

app.get("/login", async (req, res) => {
  if (!oAuth2Client?.credentials?.access_token) {
    const tokensFound = await getGoogleTokens(req.query.code, res);
    if (!tokensFound) {
      console.error("Failed to get Google tokens");
      res.sendStatus(401).send({
        message: "Failed to get Google tokens",
      });
    }
  }
  const userData = await getGoogleUserData(
    oAuth2Client?.credentials?.access_token
  );
  console.log("GoogleUserData >> ", userData);
  if (userData) {
    try {
      const savedToDB = await saveToDB(userData?.name, userData?.email);
      if (!savedToDB) {
        console.log("Failed to add user");
        res.status(400).send({
          message: "Failed to add user",
        });
      }
      const accessToken = generateJwtAccessToken({
        name: userData?.name,
        email: userData?.email,
      });
      const refreshToken = jwt.sign(
        {
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
      if (savedJwtRefreshToken) {
        res.cookie("accessToken", accessToken);
        res.cookie("refreshToken", refreshToken);
        res.send({
          accessToken: accessToken,
          refreshToken: refreshToken,
          userData: userData,
          message: "Logged in successfully",
        });
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
    res.sendStatus(401).send({
      message: "Failed to get Google User Data",
    });
  }
});

function authenticateJwtAccessToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  console.log("authHeader ", authHeader);
  const token = authHeader && authHeader.split(" ")[1];
  console.log("JwtAccessToken ", token);

  if (!token) {
    console.log("Token not found!");
    return res.sendStatus(404).send({
      message: "Token not found!",
    });
  } else {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
      console.log("err ", "err");
      if (err) {
        console.log("AccessToken Expired");
        res.status(401).send({
          message: "AccessToken Expired",
        });
        console.log("AccessToken Expired");
      } else {
        console.log("data.user.name ", data.user.name);
        console.log("req.user before ", req.user);
        req.user = data.user.name;
        // console.log("req", req);
        console.log("req.user after ", req.user);
        next();
      }
    });
  }
}

async function getDataFromDB(email) {
  try {
    const allData = await User.where("email").equals(email);
    return allData;
  } catch (error) {
    return -1;
  }
}

async function getLoggedInUser(token) {
  let tmp;
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
    console.log("User > ", data);
    tmp = data.user;
  });
  return tmp;
}

app.get("/getData", authenticateJwtAccessToken, async (req, res) => {
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
  const data = await getDataFromDB(loggedInUser.email);
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
  console.log(userReq);
  const emailValid = await check_email(userReq.email);
  if (emailValid) {
    // Creating empty user object
    const newUser = new User();
    newUser.name = userReq.firstName + " " + userReq.lastName;
    // newUser.firstName = userReq.firstName;
    // newUser.lastName = userReq.lastName;
    newUser.email = userReq.email;
    newUser.password = userReq.password;

    newUser.setPassword(userReq.password);

    // Save newUser object to database
    try {
      newUser.save((err, User) => {
        if (err) {
          console.log(err);
          console.log("Failed to add user.");
          return res.status(400).send({
            message: "Failed to add user.",
          });
        } else {
          console.log("User added successfully.");
          return res.status(201).send({
            message: "User added successfully.",
          });
        }
      });
    } catch (error) {
      console.log("error > ", error);
      console.log("Failed to add user.");
      return res.status(400).send({
        message: "Failed to add user.",
      });
    }
  } else {
    console.log("Email already in use");
    res.status(401).send({ message: "Email already in use" });
  }
}

app.post("/signUp", async (req, res) => {
  console.log("/signUp : ", req.body);
  try {
    await registerUser(req.body, res);
    console.log("/signUp", "Successful !");
    res.status(200).send({ message: "User Created !!", data: req.body.data });
  } catch (error) {
    console.log("signUp catch error > ", error);
    console.log("Failed to signUp.");
    res.status(400).send({
      message: "Failed to signUp.",
    });
  }
});

app.post("/signIn", async (req, res) => {
  console.log("email : ", req.body.email, " Pass : ", req.body.password);
  if (!req.body.email) {
    console.log("Request email was empty.");
    return res.status(400).send({
      message: "Request email was empty.",
    });
  }
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
          user: user?.name,
          email: user?.email,
        });
        const refreshToken = jwt.sign(
          {
            user: user?.name,
            email: user?.email,
          },
          process.env.REFRESH_TOKEN_SECRET
        );
        console.log({ accessToken: accessToken, refreshToken: refreshToken });
        saveJwtRefreshToken(user?.email, refreshToken);
        res.cookie("accessToken", accessToken);
        res.cookie("refreshToken", refreshToken);
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
  if (validEmail) res.status(200).send({ message: "email not in use" });
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
