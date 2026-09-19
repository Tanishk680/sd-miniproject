const jwt = require('jsonwebtoken');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), username: user.username, email: user.email },
    process.env.JWT_SECRET || 'dev-insecure-jwt-secret-change-me',
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
}

module.exports = { signToken };