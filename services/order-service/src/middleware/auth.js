const jwt = require('jsonwebtoken');

// Defense-in-depth: the gateway is the primary checkpoint, but this
// service verifies the JWT itself and NEVER trusts `X-User-Id` alone.
// `X-User-Id` (injected by the gateway) is only honored when it matches
// the verified token's `sub`; a mismatch or header-only request is 401.
module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const claimedUserId = req.headers['x-user-id'];

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-insecure-jwt-secret-change-me'
    );
    if (claimedUserId && claimedUserId !== payload.sub) {
      return res.status(401).json({ error: 'Identity mismatch' });
    }
    req.userId = payload.sub;
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};