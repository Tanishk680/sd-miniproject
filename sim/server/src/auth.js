const config = require('./config');
const store = require('./store');
const { tokenHash } = require('./admin');

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function requirePublic(req, res, next) {
  if (config.publicScenarioAccess) return next();
  return requireToken(req, res, next);
}

function requireToken(req, res, next) {
  if (!config.token) return next();

  const header = req.headers.authorization || '';
  if (header === `Bearer ${config.token}`) return next();

  return res.status(401).json({ error: 'Unauthorized' });
}

function adminFromRequest(req) {
  const token = bearerToken(req);
  if (!token) return null;
  return store.findAdminByTokenHash(tokenHash(token)) || null;
}

function requireAdmin(req, res, next) {
  const admin = adminFromRequest(req);
  if (!admin) {
    const err = new Error('Admin bearer token required');
    err.code = 'ADMIN_REQUIRED';
    return res.status(403).json({ error: err.message, code: err.code });
  }

  req.admin = admin;
  store.touchAdmin(admin.id, req.ip || null);
  return next();
}

module.exports = { requirePublic, requireToken, requireAdmin, adminFromRequest, bearerToken };
