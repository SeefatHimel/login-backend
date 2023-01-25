function GetValidUserData(user) {
  return {
    id: user.id,
    email: user.email,
    verified_email: user.verified_email ? user.verified_email : false,
    name: user.name,
    picture: user.picture
      ? user.picture
      : "https://static.vecteezy.com/system/resources/previews/007/033/146/original/profile-icon-login-head-icon-vector.jpg",
    locale: user.locale ? user.locale : "bn",
  };
}

module.exports = { GetValidUserData };
