const User = require("../models/user");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

async function SaveToDB(name, email) {
  const oldUser = await User.where("email").equals(email);
  console.log(oldUser[0]);
  if (oldUser[0]) {
    console.log("User already Exists");
  } else {
    try {
      const user = await User.create({
        id: uuidv4(),
        name: name,
        email: email,
      });
      console.log("User Added ", user);
      return user.id;
    } catch (e) {
      console.log(e.message);
      return false;
    }
  }
  return oldUser[0].id;
}
async function GetDataFromDBbyEmail(email) {
  console.log("GetDataFromDBbyEmail > ", email);
  try {
    const userData = await User.where("email").equals(email);
    console.log(
      "🚀 ~ file: mongoDBService.js:29 ~ GetDataFromDBbyEmail ~ userData",
      userData,
    );
    return userData;
  } catch (error) {
    console.log("GetDataFromDBbyEmail Err ", error);
    return -1;
  }
}
async function SaveUserToDB(userReq, res) {
  const oldUser = await User.where("email").equals(userReq.email);
  console.log("28");
  console.log(oldUser[0]);
  if (oldUser[0]) {
    console.log("User already Exists");
  } else {
    const newUser = new User();
    newUser.name = userReq.firstName + " " + userReq.lastName;
    newUser.id = uuidv4();
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

async function GetUserInfo(req,res)
{
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
  const data = await GetDataFromDBbyEmail(loggedInUser.email);
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
}
module.exports = { SaveToDB, SaveUserToDB, GetDataFromDBbyEmail  ,GetUserInfo};
