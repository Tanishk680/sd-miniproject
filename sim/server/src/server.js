const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const config = require('./config');
const topology = require('./topology.json');
const { buildSnapshot } = require('./snapshot');
const store = require('./store');
const runs = require('./runs');
const chaos = require('./chaos');
const { tokenHash, ensureAdminIdentities } = require('./admin');
const {
  requirePublic,
  requireScenarioAuth,
  requireAdmin,
  adminFromRequest,
  requireWsAuth
} = require('./auth');

const app = express();
if (config.trustProxy) app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
ensureAdminIdentities();

const rateLimiters = new Map();

function rateLimit({ limit, windowMs, keyFromReq = (req) => req.ip || 'unknown' }) {
  const name = String(limit || 0) + ':' + String(windowMs || 0);
  return function limiter(req, res, next) {
    const namePlusKey = name + ':' + keyFromReq(req);
    const now = Date.now();
    const existing = rateLimiters.get(namePlusKey) || { hits: [], resetAt: now + windowMs };
    rateLimiters.set(namePlusKey, existing);
    existing.hits = existing.hits.filter((hit) => now - hit < windowMs);
    if (existing.hits.length >= limit) {
      const failed = now - existing.hits[0];
      const retryAfter = Math.max(1, Math.ceil((windowMs - failed) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
    }
    existing.hits.push(now);
    return next();
  };
}

const publicRunLimiter = rateLimit({
  limit: Number(process.env.SIM_RUN_LIMIT_PER_WINDOW || 15),
  windowMs: Number(process.env.SIM_RUN_LIMIT_WINDOW_MS || 60000)
});
const chaosLimiter = rateLimit({
  limit: Number(process.env.SIM_CHAOS_LIMIT_PER_WINDOW || 30),
  windowMs: Number(process.env.SIM_CHAOS_LIMIT_WINDOW_MS || 60000)
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: config.mockMode ? 'mock' : 'live',
    authRequired: false,
    tokenRequired: Boolean(config.token),
    publicScenarioAccess: config.publicScenarioAccess,
    adminRequired: Boolean(config.adminIdentities.length),
    ts: Date.now()
  });
});

app.get('/api/me', (req, res) => {
  res.json({
    adminRequired: Boolean(config.adminIdentities.length),
    admin: Boolean(adminFromRequest(req))
  });
});

app.get('/api/topology', requirePublic, (_req, res) => {
  res.json(topology);
});

function requireAdminScenario(req, res, next) {
  const scenario = runs.getScenario(req.body?.scenario);
  return scenario?.adminOnly ? requireAdmin(req, res, next) : next();
}

app.get('/api/settings', requirePublic, (_req, res) => {
  res.json({
    mode: config.mockMode ? 'mock' : 'live',
    authRequired: false,
    tokenRequired: Boolean(config.token),
    publicScenarioAccess: config.publicScenarioAccess,
    adminRequired: Boolean(config.adminIdentities.length),
    rateLimitRps: config.gatewayRateLimitRps,
    activeRun: runs.activeRun(),
    scenarios: runs.listScenarios(Boolean(adminFromRequest(_req))),
    chaos: {
      ...chaos.capabilities(),
      actions: chaos.actions,
      services: chaos.services
    }
  });
});

app.get('/api/scenarios', requirePublic, (req, res) => {
  res.json({ scenarios: runs.listScenarios(Boolean(adminFromRequest(req))) });
});

app.get('/api/snapshot', requirePublic, async (_req, res) => {
  try {
    const snapshot = await buildSnapshot();
    snapshot.runId = runs.activeRunId();
    res.json(snapshot);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/runs', requireScenarioAuth, publicRunLimiter, requireAdminScenario, (req, res) => {
  try {
    const run = runs.startRun({
      scenarioId: req.body?.scenario,
      label: req.body?.label,
      env: req.body?.env,
      admin: Boolean(req.admin)
    });
    res.status(201).json(run);
  } catch (err) {
    const status = err.code === 'RUN_ACTIVE' ? 409 : 400;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

app.post('/api/runs/:id/stop', requireScenarioAuth, (req, res) => {
  if (!runs.stopRun(req.params.id)) {
    return res.status(404).json({ error: 'No matching active run' });
  }
  return res.json({ ok: true });
});

app.post('/api/chaos', chaosLimiter, requireAdmin, async (req, res) => {
  try {
    const result = await chaos.runChaos(req.body || {});
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    const status = err.code === 'SSH_NOT_CONFIGURED' ? 400 : 500;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

app.get('/api/runs', requirePublic, (_req, res) => {
  res.json({ runs: store.listRuns(), active: runs.activeRun() });
});

app.get('/api/runs/:id', requirePublic, (req, res) => {
  const run = store.getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  return res.json(run);
});

app.get('/api/runs/:id/export', requirePublic, (req, res) => {
  const run = store.getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.setHeader('Content-Disposition', `attachment; filename="run-${run.id}.json"`);
  return res.json(run);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: (info, callback) => callback(requireWsAuth(info.req))
});

let latest = null;
let ticking = false;

function broadcast(snapshot) {
  const data = JSON.stringify(snapshot);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

runs.onEvent((event) => broadcast(event));

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    latest = await buildSnapshot();
    const runId = runs.activeRunId();
    latest.runId = runId;
    if (runId) store.insertSample(runId, latest);
    broadcast(latest);
  } catch (err) {
    broadcast({
      ts: Date.now(),
      mode: config.mockMode ? 'mock' : 'live',
      error: err.message,
      nodes: {},
      edges: {}
    });
  } finally {
    ticking = false;
  }
}

wss.on('connection', (ws) => {
  if (latest) {
    ws.send(JSON.stringify(latest));
  }
});

const timer = setInterval(tick, config.snapshotIntervalMs);
tick();

server.listen(config.port, config.host, () => {
  const mode = config.mockMode ? 'mock' : 'live';
  console.log(`[live-twin] ${mode} server on http://${config.host}:${config.port} (ws /ws)`);
});

function shutdown() {
  clearInterval(timer);
  runs.shutdown();
  wss.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => {
    store.close();
    process.exit(0);
  }, 3000).unref();
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});
