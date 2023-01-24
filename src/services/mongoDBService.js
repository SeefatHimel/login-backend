const User = require("../models/user");
const { v4: uuidv4 } = require("uuid");

async function saveToDB(name, email) {
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
async function getDataFromDBbyEmail(email) {
  console.log("getDataFromDBbyEmail > ", email);
  try {
    const userData = await User.where("email").equals(email);
    console.log(
      "🚀 ~ file: mongoDBService.js:29 ~ getDataFromDBbyEmail ~ userData",
      userData,
      userData[0]
    );
    return userData;
  } catch (error) {
    console.log("getDataFromDBbyEmail Err ", error);
    return -1;
  }
}
async function saveUserToDB(userReq, res) {
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

module.exports = { saveToDB, saveUserToDB, getDataFromDBbyEmail };
