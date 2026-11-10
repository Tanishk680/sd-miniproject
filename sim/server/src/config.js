const path = require('path');

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
  } catch (_err) {
    // no local env file
  }
}

const serverRoot = path.join(__dirname, '..');
const simRoot = path.join(serverRoot, '..');

function parseAdminIdentities(raw) {
  const value = String(raw || '').trim();
  if (!value) return [];
  return value
    .split(/,/, Number.MAX_SAFE_INTEGER)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^([^=]+?)=(.+)$/);
      if (!match) return null;
      const name = match[1].trim();
      const token = match[2].trim();
      return name && token ? { name, token } : null;
    })
    .filter(Boolean);
}

module.exports = {
  publicScenarioAccess: process.env.SIM_PUBLIC_SCENARIO_ACCESS !== '0',
  adminIdentities: parseAdminIdentities(process.env.SIM_ADMIN_IDENTITIES),
  adminIdentitiesRaw: process.env.SIM_ADMIN_IDENTITIES || '',
  trustProxy: process.env.SIM_TRUST_PROXY === '1',
  port: Number(process.env.SIM_PORT || 7070),
  host: process.env.SIM_HOST || '127.0.0.1',
  token: process.env.SIM_TOKEN || '',
  prometheusUrl: process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090',
  gatewayUrl: process.env.GATEWAY_URL || 'http://127.0.0.1:5000',
  gatewayAdminToken: process.env.GATEWAY_ADMIN_TOKEN || '',
  gatewayRateLimitRps: Number(process.env.GATEWAY_RATE_LIMIT_RPS || 83),
  mockMode: process.env.MOCK_MODE === '1',
  snapshotIntervalMs: Number(process.env.SNAPSHOT_INTERVAL_MS || 1000),
  maxRunMs: Number(process.env.MAX_RUN_MS || 6 * 60 * 1000),
  k6Bin: process.env.K6_BIN || 'k6',
  dataDir: path.join(serverRoot, 'data'),
  scenariosDir: path.join(simRoot, 'scenarios'),
  dbPath: process.env.SIM_DB
    ? path.resolve(serverRoot, process.env.SIM_DB)
    : path.join(serverRoot, 'data', 'twin.sqlite'),
  ssh: {
    host: process.env.EC2_HOST || '',
    user: process.env.EC2_USER || 'ec2-user',
    keyPath: process.env.EC2_KEY_PATH || ''
  }
};
