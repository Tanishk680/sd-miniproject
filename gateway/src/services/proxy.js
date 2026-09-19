const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('../utils/logger');
const { getConfig } = require('../config/configLoader');
const healthChecker = require('./healthChecker');

let proxyRegistry = [];
let middlewareByRoute = new Map();

function clearProxies() {
  for (const mw of proxyRegistry) {
    if (typeof mw.close === 'function') mw.close();
  }
  proxyRegistry = [];
  middlewareByRoute = new Map();
  logger.info('Proxy table cleared');
}

function buildProxies() {
  clearProxies();

  const config = getConfig();
  for (const route of config.routes) {
    const proxy = createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      logLevel: 'silent',
      onProxyReq: (proxyReq, req) => {
        if (req.userId && req.headers['x-user-id'] === undefined) {
          proxyReq.setHeader('X-User-Id', req.userId);
        }
      },
      onError: (err, req, res) => {
        logger.error('Proxy error', {
          target: route.target,
          path: req.originalUrl,
          error: err.message
        });
        if (!res.headersSent) {
          res.status(502).json({ error: 'Bad Gateway', service: route.target });
        }
      }
    });

    proxyRegistry.push(proxy);
    middlewareByRoute.set(route.path, proxy);
    logger.info(`Route registered: ${route.path} -> ${route.target}${route.auth ? ' [auth]' : ''}`);
  }
}

function proxyMiddleware(req, res, next) {
  const config = getConfig();
  const route = config.routes.find((r) => req.path.startsWith(r.path));
  if (!route) return next();

  const backend = healthChecker.findBackendByTarget(route.target);
  if (backend && backend.status === 'UNHEALTHY') {
    logger.warn('Rejecting request to unhealthy backend', {
      target: route.target,
      path: req.originalUrl
    });
    return res.status(503).json({ error: 'Service Unavailable' });
  }

  const proxy = middlewareByRoute.get(route.path);
  if (!proxy) return next();
  return proxy(req, res, next);
}

function rebuild() {
  buildProxies();
}

module.exports = { buildProxies, proxyMiddleware, rebuild };