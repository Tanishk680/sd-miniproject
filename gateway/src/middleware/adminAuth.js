const logger = require('../utils/logger');

// Protects /gateway/* admin endpoints (status/metrics/reload).
// If GATEWAY_ADMIN_TOKEN is set, clients must send it via
// `X-Admin-Token` (or `Authorization: Bearer <token>`).
// If unset: allowed in non-production (with a warn) so local demos keep
// working; denied in production (fail-closed).
function requireAdmin(req, res, next) {
  const expected = process.env.GATEWAY_ADMIN_TOKEN;
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Admin access disabled: GATEWAY_ADMIN_TOKEN not configured' });
    }
    logger.warn('Admin endpoint accessed without GATEWAY_ADMIN_TOKEN (dev mode)', {
      path: req.originalUrl
    });
    return next();
  }

  const headerToken = req.headers['x-admin-token'];
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (headerToken === expected || bearer === expected) return next();

  logger.warn('Forbidden admin access attempt', { path: req.originalUrl });
  return res.status(403).json({ error: 'Forbidden' });
}

module.exports = { requireAdmin };
