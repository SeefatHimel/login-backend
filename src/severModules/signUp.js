const User = require("../models/user");
const { SaveUserToDB } = require("../services/mongoDBService");

async function RegisterUser(userReq, res) {
  console.log("registerUser > ", userReq);
  const emailValid = await check_email_in_DB(userReq.email);
  if (emailValid) {
    await SaveUserToDB(userReq, res);
    return true;
  } else {
    console.log("Email already in use");
    res.status(401).send({ message: "Email already in use" });
    return false;
  }
}
async function check_email_in_DB(email) {
  const oldEmail = await User.where("email").equals(email);
  console.log("oldEmail : ", oldEmail[0]);
  if (oldEmail && oldEmail[0]) return false;
  return true;
}
async function CheckEmailValidity(req, res) {
  console.log("Email > ", req.body.data);
  const validEmail = await check_email_in_DB(req.body.data.email);
  console.log("Valid Email : ", validEmail);
  if (validEmail) res.status(200).send({ message: "Email not in use" });
  else res.status(403).send({ message: "email already in use" });
  // res.send(validEmail.name || req.body.email);
}

module.exports = { RegisterUser, CheckEmailValidity };
