let counters = {
  startedAt: Date.now(),
  totalRequests: 0,
  byRoute: new Map(),
  byStatus: new Map(),
  totalLatencyMs: 0
};

function metricsMiddleware(req, res, next) {
  counters.totalRequests++;

  const parts = req.path.split('/').filter(Boolean);
  const routeKey = parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : `/${parts[0] || ''}`;
  counters.byRoute.set(routeKey, (counters.byRoute.get(routeKey) || 0) + 1);

  const started = Date.now();
  res.on('finish', () => {
    const statusKey = String(res.statusCode);
    counters.byStatus.set(statusKey, (counters.byStatus.get(statusKey) || 0) + 1);
    counters.totalLatencyMs += Date.now() - started;
  });
  next();
}

function metricsReport(healthChecker, getConfig) {
  const config = getConfig();
  return {
    uptimeSeconds: Math.round((Date.now() - counters.startedAt) / 1000),
    totalRequests: counters.totalRequests,
    requestsByRoute: Object.fromEntries(counters.byRoute),
    requestsByStatus: Object.fromEntries(counters.byStatus),
    avgLatencyMs: counters.totalRequests
      ? Math.round(counters.totalLatencyMs / counters.totalRequests)
      : 0,
    backends: healthChecker.getBackends().map((b) => ({
      target: b.target,
      status: b.status,
      latencyMs: b.latencyMs
    })),
    config: config ? { loaded: true, routeCount: config.routes.length } : { loaded: false }
  };
}

function reset() {
  counters = {
    startedAt: Date.now(),
    totalRequests: 0,
    byRoute: new Map(),
    byStatus: new Map(),
    totalLatencyMs: 0
  };
}

module.exports = { metricsMiddleware, metricsReport, reset };