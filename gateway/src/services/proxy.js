const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('../utils/logger');
const { getConfig } = require('../config/configLoader');
const { findMatchingRoute } = require('../utils/routeMatcher');
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
  const config = getConfig();
  // Build the new table first; only swap on success so a failed
  // rebuild never leaves the gateway with an empty proxy table.
  const nextRegistry = [];
  const nextByRoute = new Map();

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

    nextRegistry.push(proxy);
    nextByRoute.set(route.path, proxy);
    logger.info(`Route registered: ${route.path} -> ${route.target}${route.auth ? ' [auth]' : ''}`);
  }

  // Atomic swap: retire old middlewares only after the new table is ready.
  const oldRegistry = proxyRegistry;
  proxyRegistry = nextRegistry;
  middlewareByRoute = nextByRoute;
  for (const mw of oldRegistry) {
    if (typeof mw.close === 'function') {
      try { mw.close(); } catch (_e) { /* ignore close errors on retire */ }
    }
  }
}

function proxyMiddleware(req, res, next) {
  const config = getConfig();
  const route = findMatchingRoute(config.routes, req.path);
  if (!route) return next();

  const backend = healthChecker.findBackendByTarget(route.target);
  // Fail-closed readiness policy: only HEALTHY backends receive traffic.
  // UNKNOWN (startup, no successful check yet) and UNHEALTHY both get 503.
  // 502 remains reserved for a proxy/upstream error mid-request.
  if (!backend || backend.status !== 'HEALTHY') {
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