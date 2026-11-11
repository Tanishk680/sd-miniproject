const config = require('./config');
const store = require('./store');
const { tokenHash } = require('./admin');

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

function tokenFromRequest(req) {
  const headerToken = bearerToken(req);
  if (headerToken) return headerToken;

  if (req.query && req.query.token) {
    const value = String(req.query.token).trim();
    return value || null;
  }

  if (req.url) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const queryToken = url.searchParams.get('token');
      return queryToken ? queryToken.trim() || null : null;
    } catch (_err) {
      return null;
    }
  }

  return null;
}

function adminFromToken(token) {
  if (!token) return null;
  return store.findAdminByTokenHash(tokenHash(token)) || null;
}

function adminFromRequest(req) {
  return adminFromToken(bearerToken(req));
}

function requirePublic(req, res, next) {
  if (config.publicScenarioAccess) return next();
  return requireToken(req, res, next);
}

function requireToken(req, res, next) {
  const token = bearerToken(req);
  if (token && config.token && token === config.token) return next();
  return res.status(401).json({ error: 'Bearer token required' });
}

function requireScenarioAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Bearer token required' });
  }

  const admin = adminFromToken(token);
  if (admin) {
    req.admin = admin;
    store.touchAdmin(admin.id, req.ip || null);
    return next();
  }

  if (config.token && token === config.token) {
    req.scenarioAuth = true;
    return next();
  }

  return res.status(401).json({ error: 'Bearer token required' });
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

function requireWsAuth(req) {
  const token = tokenFromRequest(req);
  if (!token) return false;
  if (adminFromToken(token)) return true;
  if (config.token && token === config.token) return true;
  return false;
}

module.exports = {
  requirePublic,
  requireToken,
  requireScenarioAuth,
  requireAdmin,
  adminFromRequest,
  adminFromToken,
  bearerToken,
  tokenFromRequest,
  requireWsAuth
};
