const http = require('http');
const client = require('prom-client');

const SERVICE = process.env.METRICS_SERVICE || 'user-service';
const METRICS_PORT = Number(process.env.METRICS_PORT || 9461);

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, eventLoopMonitoringPrecision: 10 });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests handled, by route, method and status',
  labelNames: ['service', 'route', 'method', 'status'],
  registers: [registry]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['service', 'route', 'method', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry]
});

const httpInflight = new client.Gauge({
  name: 'http_inflight_requests',
  help: 'Requests currently in flight',
  labelNames: ['service'],
  registers: [registry]
});

const userPasswordHashDuration = new client.Histogram({
  name: 'user_password_hash_duration_seconds',
  help: 'bcrypt hash/compare duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry]
});

function normalizePath(path) {
  const parts = (path || '/').split('/').filter(Boolean);
  const normalized = parts.map((part) =>
    /^[0-9a-fA-F]{24}$/.test(part) || /^\d+$/.test(part) ? ':id' : part
  );
  const label = '/' + normalized.join('/');
  return label.length > 80 ? '/:long' : label;
}

function metricsMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  const route = normalizePath(req.path);
  httpInflight.labels(SERVICE).inc();

  let recorded = false;
  const record = () => {
    if (recorded) return;
    recorded = true;
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    const labels = {
      service: SERVICE,
      route,
      method: req.method,
      status: String(res.statusCode)
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, seconds);
    httpInflight.labels(SERVICE).dec();
  };

  res.on('finish', record);
  res.on('close', record);
  next();
}

function startMetricsServer() {
  if (process.env.METRICS_ENABLED === '0') return null;

  const server = http.createServer(async (req, res) => {
    if (req.url !== '/metrics') {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    try {
      const body = await registry.metrics();
      res.setHeader('Content-Type', registry.contentType);
      res.end(body);
    } catch (_err) {
      res.statusCode = 500;
      res.end('metrics collection failed');
    }
  });

  server.on('error', (err) => {
    console.error(`[${SERVICE}] metrics server error: ${err.message}`);
  });
  server.listen(METRICS_PORT, () => {
    console.log(`[${SERVICE}] metrics on :${METRICS_PORT}/metrics`);
  });
  return server;
}

module.exports = {
  registry,
  metricsMiddleware,
  startMetricsServer,
  userPasswordHashDuration,
  SERVICE
};
