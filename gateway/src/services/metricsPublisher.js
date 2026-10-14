const logger = require('../utils/logger');

// Publishes gateway counters as CloudWatch custom metrics (namespace
// ECommerce/Gateway by default): per-flush deltas of total requests,
// 4xx/5xx counts and average latency. Opt-in via AWS_CLOUDWATCH_METRICS=1
// (off locally). Fail-safe: publish errors are logged, never thrown into
// request handling; last error is visible in /gateway/status.
const DEFAULT_NAMESPACE = 'ECommerce/Gateway';
const DEFAULT_FLUSH_MS = 60000;

function sumByStatus(byStatus, prefix) {
  return Object.entries(byStatus || {}).reduce(
    (sum, [code, n]) => (String(code).startsWith(prefix) ? sum + Number(n) : sum),
    0
  );
}

function createPublisher(opts = {}) {
  const enabled = !!opts.enabled;
  const region = opts.region || process.env.AWS_REGION || 'us-east-1';
  const namespace = opts.namespace || process.env.AWS_METRICS_NAMESPACE || DEFAULT_NAMESPACE;
  const flushMs = opts.flushMs || Number(process.env.METRICS_FLUSH_MS) || DEFAULT_FLUSH_MS;
  const getSnapshot = opts.getSnapshot || require('../middleware/metrics').snapshot;
  let injectedClient = opts.client || null;
  let realClient = null;
  let timer = null;
  let last = null;
  let lastFlush = null;
  let lastError = null;
  let lastPublished = null;

  function setClientForTests(client) {
    injectedClient = client || null;
  }

  function buildClient() {
    if (injectedClient) return injectedClient;
    if (!realClient) {
      // Lazy require: the SDK is only loaded when publishing is enabled.
      const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
      realClient = { send: (command) => new CloudWatchClient({ region }).send(command) };
    }
    return realClient;
  }

  function toCommand(metricData) {
    if (injectedClient) return { MetricData: metricData, Namespace: namespace };
    const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
    return new PutMetricDataCommand({ Namespace: namespace, MetricData: metricData });
  }

  async function flushOnce(now = new Date()) {
    const snap = getSnapshot();
    const prev = last || { totalRequests: 0, byStatus: {}, totalLatencyMs: 0 };
    const dTotal = snap.totalRequests - prev.totalRequests;
    const dLatency = snap.totalLatencyMs - prev.totalLatencyMs;
    last = { totalRequests: snap.totalRequests, byStatus: { ...snap.byStatus }, totalLatencyMs: snap.totalLatencyMs };

    if (dTotal <= 0) {
      lastFlush = now.toISOString();
      return { published: 0 };
    }

    const d4xx = sumByStatus(snap.byStatus, '4') - sumByStatus(prev.byStatus, '4');
    const d5xx = sumByStatus(snap.byStatus, '5') - sumByStatus(prev.byStatus, '5');
    const dimensions = [{ Name: 'Service', Value: 'api-gateway' }];
    const metricData = [
      { MetricName: 'RequestCount', Dimensions: dimensions, Timestamp: now, Value: dTotal, Unit: 'Count' },
      { MetricName: 'Error4xx', Dimensions: dimensions, Timestamp: now, Value: Math.max(d4xx, 0), Unit: 'Count' },
      { MetricName: 'Error5xx', Dimensions: dimensions, Timestamp: now, Value: Math.max(d5xx, 0), Unit: 'Count' },
      { MetricName: 'AvgLatencyMs', Dimensions: dimensions, Timestamp: now, Value: Math.round(dLatency / dTotal), Unit: 'Milliseconds' }
    ];

    const client = buildClient();
    await client.send(toCommand(metricData));
    lastFlush = now.toISOString();
    lastError = null;
    lastPublished = { at: lastFlush, metrics: metricData.length, requests: dTotal };
    return { published: metricData.length };
  }

  async function safeFlush() {
    try {
      await flushOnce();
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
      logger.warn('CloudWatch metrics publish failed (requests unaffected)', { error: lastError });
    }
  }

  function start() {
    if (!enabled || timer) return;
    logger.info('CloudWatch metrics publisher started', { namespace, region, flushMs });
    timer = setInterval(safeFlush, flushMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function status() {
    return { enabled, namespace, region, flushMs, lastFlush, lastError, lastPublished };
  }

  return { start, stop, flushOnce, safeFlush, status, setClientForTests };
}

module.exports = { createPublisher, DEFAULT_NAMESPACE, DEFAULT_FLUSH_MS };
