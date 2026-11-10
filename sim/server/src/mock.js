const topology = require('./topology.json');

function wave(t, base, amplitude, period, phase = 0) {
  return base + amplitude * Math.sin((t / period) * Math.PI * 2 + phase);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mockSnapshot() {
  const t = Date.now() / 1000;
  const surge = Math.floor(t / 15) % 5 === 0 ? 1.8 : 1;
  const gatewayRps = clamp(wave(t, 14, 5, 20) * surge, 0, 1000);
  const perService = {
    'user-service': clamp(gatewayRps * 0.22, 0, 1000),
    'product-service': clamp(gatewayRps * 0.62, 0, 1000),
    'order-service': clamp(gatewayRps * 0.16, 0, 1000)
  };

  const nodes = {};
  for (const node of topology.nodes) {
    if (!node.service) {
      nodes[node.id] = { status: 'up', ts: Date.now(), rps: round(gatewayRps, 3) };
      continue;
    }

    const isApp = !!node.app;
    const rps = node.service === 'gateway'
      ? gatewayRps
      : isApp
        ? perService[node.service]
        : 0;
    const errorRate = isApp ? clamp((surge > 1 ? 0.04 : 0.004) + wave(t, 0.002, 0.002, 11, 1), 0, 1) : 0;
    const baseCpu = isApp ? 0.03 : node.kind === 'db' ? 0.02 : 0.005;
    const cpuCores = clamp(wave(t, baseCpu, baseCpu / 2, 17, node.position.x / 100), 0, 2);
    const memBase = node.kind === 'db' ? 80 : node.kind === 'edge' ? 6 : 55;

    nodes[node.id] = {
      status: 'up',
      ts: Date.now(),
      rps: round(rps, 3),
      p95: isApp ? round(clamp(wave(t, 0.035, 0.02, 9, node.position.x / 80), 0.002, 2), 4) : 0,
      errorRate: round(errorRate, 4),
      rateLimited: 0,
      healthGateRejections: 0,
      inflight: isApp ? Math.round(clamp(wave(t, 2, 2, 5), 0, 100)) : 0,
      cpuCores: round(cpuCores, 4),
      memBytes: Math.round((memBase + wave(t, 8, 5, 23, node.position.y / 50)) * 1024 * 1024),
      throttle: round(clamp(wave(t, 0.005, 0.004, 13, 2), 0, 1), 4)
    };
  }

  const edges = {};
  for (const edge of topology.edges) {
    const source = nodes[edge.source];
    const target = nodes[edge.target];
    let rps = 0;
    if (edge.source === 'traffic' || edge.source === 'frontend') rps = nodes.gateway.rps;
    else if (edge.kind === 'db' || edge.kind === 'internal') rps = source.rps;
    else rps = target.rps;
    edges[edge.id] = { rps: round(rps, 3) };
  }

  return { ts: Date.now(), mode: 'mock', nodes, edges };
}

module.exports = { mockSnapshot };
