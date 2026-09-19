require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const { loadConfig, getConfig, getLastConfigError, CONFIG_PATH, watch, reload } = require('./config/configLoader');
const healthChecker = require('./services/healthChecker');
const proxy = require('./services/proxy');
const { authenticateGateway } = require('./middleware/auth');
const rateLimitMiddleware = require('./middleware/rateLimiter');
const metrics = require('./middleware/metrics');

const app = express();

app.use(cors());

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

app.get('/gateway/status', (req, res) => {
  const config = getConfig();
  res.json({
    configPath: CONFIG_PATH,
    configLoaded: !!config,
    lastConfigError: getLastConfigError(),
    rateLimit: config ? config.rateLimit : null,
    routes: config ? config.routes : [],
    backends: healthChecker.getBackends()
  });
});

app.post('/gateway/reload', (req, res) => {
  const result = reload(proxy.rebuild);
  res.status(result.ok ? 200 : 400).json({
    ok: result.ok,
    error: result.error || null,
    routes: result.ok ? result.value.routes : getConfig()?.routes
  });
});

app.get('/gateway/metrics', (req, res) => {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`[api-gateway] listening on port ${PORT}`);
});