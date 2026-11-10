const config = require('./config');
const prom = require('./prometheus');
const topology = require('./topology.json');
const { mockSnapshot } = require('./mock');

const CONTAINER_LABEL = 'container_label_com_docker_compose_service';
const containerServices = [
  ...new Set(topology.nodes.filter((node) => node.container).map((node) => node.service))
];
const containerRegex = `(${containerServices.join('|')})`;
const containerSelector = `${CONTAINER_LABEL}=~"${containerRegex}"`;

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function buildSnapshot() {
  if (config.mockMode) return mockSnapshot();

  let failures = 0;
  async function safeMap(query, key) {
    try {
      return await prom.vectorMap(query, key);
    } catch (_err) {
      failures += 1;
      return {};
    }
  }

  const [rps, p95, errors5xx, errors4xx, inflight, cpu, mem, throttle, up, rateLimited, gateRejected] = await Promise.all([
    safeMap('sum(rate(http_requests_total[30s])) by (service)', 'service'),
    safeMap(
      'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[30s])) by (le, service))',
      'service'
    ),
    safeMap('sum(rate(http_requests_total{status=~"5.."}[30s])) by (service)', 'service'),
    safeMap('sum(rate(http_requests_total{status=~"4.."}[30s])) by (service)', 'service'),
    safeMap('sum(http_inflight_requests) by (service)', 'service'),
    safeMap(
      `sum(rate(container_cpu_usage_seconds_total{${containerSelector}}[60s])) by (${CONTAINER_LABEL})`,
      CONTAINER_LABEL
    ),
    safeMap(
      `sum(container_memory_working_set_bytes{${containerSelector}}) by (${CONTAINER_LABEL})`,
      CONTAINER_LABEL
    ),
    safeMap(
      `sum by (${CONTAINER_LABEL}) (rate(container_cpu_cfs_throttled_periods_total{${containerSelector}}[60s]))` +
        ` / clamp_min(sum by (${CONTAINER_LABEL}) (rate(container_cpu_cfs_periods_total{${containerSelector}}[60s])), 1e-9)`,
      CONTAINER_LABEL
    ),
    safeMap('max(up) by (job)', 'job'),
    safeMap('sum(rate(gateway_rate_limited_total[30s]))', 'job'),
    safeMap('sum(rate(gateway_health_gate_rejections_total[30s]))', 'job')
  ]);

  const nodes = {};
  for (const node of topology.nodes) {
    if (!node.service) {
      nodes[node.id] = { status: 'up', ts: Date.now(), rps: 0 };
      continue;
    }

    const isApp = !!node.app;
    const nodeRps = isApp ? rps[node.service] || 0 : 0;
    const error5xx = isApp ? errors5xx[node.service] || 0 : 0;
    const error4xx = isApp ? errors4xx[node.service] || 0 : 0;
    const containerUp = (mem[node.service] || 0) > 0;
    const status = isApp
      ? up[node.service] === 1
        ? 'up'
        : 'down'
      : containerUp
        ? 'up'
        : 'unknown';

    nodes[node.id] = {
      status,
      ts: Date.now(),
      rps: round(nodeRps, 3),
      p95: isApp ? round(p95[node.service] || 0, 4) : 0,
      errorRate: nodeRps > 0 ? round(error5xx / nodeRps, 4) : 0,
      clientErrorRate: nodeRps > 0 ? round(error4xx / nodeRps, 4) : 0,
      inflight: isApp ? Math.round(inflight[node.service] || 0) : 0,
      rateLimited: node.service === 'gateway' ? round(rateLimited.unknown || 0, 3) : 0,
      healthGateRejections: node.service === 'gateway' ? round(gateRejected.unknown || 0, 3) : 0,
      cpuCores: round(cpu[node.service] || 0, 4),
      memBytes: Math.round(mem[node.service] || 0),
      throttle: round(throttle[node.service] || 0, 4)
    };
  }

  const edges = {};
  for (const edge of topology.edges) {
    const source = nodes[edge.source];
    const target = nodes[edge.target];
    let rps = 0;
    if (edge.kind === 'db' || edge.kind === 'internal') rps = source.rps;
    else if (edge.source === 'traffic' || edge.source === 'frontend') rps = nodes.gateway.rps;
    else rps = target.rps;
    edges[edge.id] = { rps: round(rps, 3) };
  }

  return {
    ts: Date.now(),
    mode: 'live',
    degraded: failures > 0,
    nodes,
    edges
  };
}

module.exports = { buildSnapshot };
