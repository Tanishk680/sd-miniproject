require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const { loadConfig, getConfig, getLastConfigError, CONFIG_PATH, watch, reload } = require('./config/configLoader');
const healthChecker = require('./services/healthChecker');
const proxy = require('./services/proxy');
const { authenticateGateway } = require('./middleware/auth');
const { requireAdmin } = require('./middleware/adminAuth');
const rateLimitMiddleware = require('./middleware/rateLimiter');
const metrics = require('./middleware/metrics');
const { createPublisher } = require('./services/metricsPublisher');

const app = express();

// CloudWatch custom metrics (RequestCount/Error4xx/Error5xx/AvgLatencyMs,
// namespace ECommerce/Gateway). Opt-in via AWS_CLOUDWATCH_METRICS=1 — off
// locally, on in production. Fail-safe: publish errors never touch requests.
const metricsPublisher = createPublisher({ enabled: process.env.AWS_CLOUDWATCH_METRICS === '1' });

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started,
      ip: req.ip === '::1' ? '127.0.0.1' : req.ip
    });
  });
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway', time: new Date().toISOString() });
});

app.get('/gateway/status', requireAdmin, (req, res) => {
  const config = getConfig();
  res.json({
    configPath: CONFIG_PATH,
    configLoaded: !!config,
    lastConfigError: getLastConfigError(),
    rateLimit: config ? config.rateLimit : null,
    routes: config ? config.routes : [],
    backends: healthChecker.getBackends(),
    cloudwatch: metricsPublisher.status()
  });
});

app.post('/gateway/reload', requireAdmin, (req, res) => {
  const result = reload(proxy.rebuild);
  res.status(result.ok ? 200 : 400).json({
    ok: result.ok,
    error: result.error || null,
    routes: result.ok ? result.value.routes : getConfig()?.routes
  });
});

app.get('/gateway/metrics', requireAdmin, (req, res) => {
  res.json(metrics.metricsReport(healthChecker, getConfig));
});

app.use(metrics.metricsMiddleware);
app.use(rateLimitMiddleware());
app.use(authenticateGateway());
app.use(proxy.proxyMiddleware);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

const configResult = loadConfig();
healthChecker.start(configResult.value);
proxy.buildProxies();
watch(proxy.rebuild);
metricsPublisher.start();

const PORT = process.env.PORT || 5000;
// Warm the JWT secret at boot: proves the Secrets Manager (or env) wiring
// before serving traffic. A broken secret config crashes loudly here
// instead of surfacing on the first authenticated request.
const { getJwtSecret } = require('./services/secretManager');
getJwtSecret().then(
  () => {
    app.listen(PORT, () => {
      logger.info(`[api-gateway] listening on port ${PORT}`);
    });
  },
  (err) => {
    logger.error('Gateway startup failed: JWT secret unavailable', { error: err.message });
    process.exit(1);
  }
);