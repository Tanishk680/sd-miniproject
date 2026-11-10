const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getConfig } = require('../config/configLoader');
const { getJwtSecret } = require('../services/secretManager');
const { findMatchingRoute } = require('../utils/routeMatcher');
const { gatewayAuthFailures } = require('../metrics/prometheus');

function authenticateGateway() {
  return async function (req, res, next) {
    const config = getConfig();
    if (!config) return next();

    const route = findMatchingRoute(config.routes, req.path);
    if (!route || !route.auth) return next();

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      gatewayAuthFailures.labels('missing_token').inc();
      logger.warn('Missing token on protected route', { path: req.originalUrl });
      return res.status(401).json({ error: 'Missing token' });
    }

    try {
      const secret = await getJwtSecret();
      const payload = jwt.verify(token, secret);
      req.userId = payload.sub;
      req.tokenPayload = payload;
      return next();
    } catch (_err) {
      gatewayAuthFailures.labels('invalid_token').inc();
      logger.warn('Invalid or expired token', { path: req.originalUrl });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { authenticateGateway };