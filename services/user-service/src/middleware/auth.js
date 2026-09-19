const jwt = require('jsonwebtoken');

module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-insecure-jwt-secret-change-me'
    );
    req.userId = payload.sub;
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};