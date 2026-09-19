const logger = require('../utils/logger');

const INTERVAL_MS = Number(process.env.HEALTH_CHECK_INTERVAL_MS || 10000);
const TIMEOUT_MS = Number(process.env.HEALTH_CHECK_TIMEOUT_MS || 3000);

let backends = [];
let timer = null;

function normalizeBackends(routes) {
  const map = new Map();
  for (const route of routes) {
    const existing = map.get(route.target);
    if (existing) {
      existing.paths.push(route.path);
    } else {
      map.set(route.target, {
        id: route.target,
        target: route.target,
        healthPath: route.healthPath || '/health',
        status: 'UNKNOWN',
        latencyMs: null,
        lastError: null,
        lastChecked: null,
        paths: [route.path]
      });
    }
  }
  return Array.from(map.values());
}

async function checkBackend(backend) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let healthy;

  try {
    const res = await fetch(`${backend.target}${backend.healthPath}`, {
      signal: controller.signal
    });
    healthy = res.ok;
    const previous = backend.status;
    backend.status = healthy ? 'HEALTHY' : 'UNHEALTHY';
    backend.latencyMs = Date.now() - started;
    backend.lastError = healthy ? null : `HTTP ${res.status}`;
    backend.lastChecked = new Date().toISOString();
    if (previous && previous !== backend.status) {
      logger.warn('Backend status changed', {
        backend: backend.target,
        from: previous,
        to: backend.status,
        latencyMs: backend.latencyMs
      });
    }
  } catch (err) {
    const previous = backend.status;
    backend.status = 'UNHEALTHY';
    backend.latencyMs = null;
    backend.lastError = err.name === 'AbortError' ? 'timeout' : err.message;
    backend.lastChecked = new Date().toISOString();
    if (previous && previous !== backend.status) {
      logger.warn('Backend status changed', {
        backend: backend.target,
        from: previous,
        to: backend.status,
        error: backend.lastError
      });
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function runChecks() {
  await Promise.all(backends.map((b) => checkBackend(b)));
  logger.info('Health check cycle complete', {
    backends: backends.map((b) => ({ target: b.target, status: b.status, latencyMs: b.latencyMs }))
  });
}

function start(config) {
  if (timer) clearInterval(timer);
  backends = normalizeBackends(config.routes);
  logger.info(`Health checker started for ${backends.length} backend(s), interval ${INTERVAL_MS}ms`);
  runChecks();
  timer = setInterval(runChecks, INTERVAL_MS);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function getBackends() {
  return backends;
}

function isHealthy(target) {
  const backend = backends.find((b) => b.target === target);
  return backend ? backend.status === 'HEALTHY' : false;
}

function findBackendByTarget(target) {
  return backends.find((b) => b.target === target) || null;
}

module.exports = { start, stop, getBackends, isHealthy, findBackendByTarget };