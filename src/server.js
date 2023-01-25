const mongoose = require("mongoose");
const { signIn } = require("./severModules/login");
const {
  GetJwtAccessToken,
  AuthenticateJwtAccessToken,
} = require("./services/tokenService");

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const UserTokens = require("./models/userTokens");
const { GetUserInfo } = require("./services/mongoDBService");

const {
  GoogleLogin,
  GetGoogleLoginLink,
} = require("./severModules/googleSignIn");
const { CheckEmailValidity, RegisterUser } = require("./severModules/signUp");

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

app.post("/token", async (req, res) => {
  const refreshToken = req.body.token;
  await GetJwtAccessToken(refreshToken, res);
});

app.get("/getLink", (req, res) => {
  GetGoogleLoginLink(req, res);
});

app.get("/login", async (req, res) => {
  const code = req.query.code ? req.query.code : req.body.code;
  console.log("Code ", code);
  await GoogleLogin(code, res);
});

app.get("/getData", AuthenticateJwtAccessToken, async (req, res) => {
  // console.log(req);
  await GetUserInfo(req, res);
});

app.post("/signUp", async (req, res) => {
  console.log("/signUp : ", req.body);
  try {
    const userRegistered = await RegisterUser(req.body.data, res);
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
});

app.post("/register_email", async (req, res) => {
  CheckEmailValidity(req, res);
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
