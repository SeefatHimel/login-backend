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

module.exports = { saveToDB };