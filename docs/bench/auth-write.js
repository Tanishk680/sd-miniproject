// Layer 1 (auth/write path): profile + order create/history with PRE-REGISTERED
// tokens minted once in setup(). No per-iteration registration, so this measures
// the auth/write path rather than user-creation throughput.
// Env: BASE_URL, BENCH_VUS (default 10), ADMIN_TOKEN (unused here, kept for parity),
//      RAMP/STEADY/DOWN, SUMMARY_FILE.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:5000';
const VUS = Number(__ENV.BENCH_VUS || 10);

export const options = {
  stages: [
    { duration: __ENV.RAMP || '30s', target: VUS },
    { duration: __ENV.STEADY || '120s', target: VUS },
    { duration: __ENV.DOWN || '10s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05']
  }
};

export function setup() {
  const tokens = [];
  let productId = null;
  const prods = http.get(`${BASE}/api/products`);
  if (prods.status === 200 && prods.json().products.length > 0) {
    productId = prods.json().products[0]._id;
  }
  for (let i = 0; i < VUS; i++) {
    const uname = `benchw${Date.now()}${i}`;
    http.post(`${BASE}/api/users/register`, JSON.stringify({
      username: uname, email: `${uname}@test.com`, password: 'secret123'
    }), { headers: { 'Content-Type': 'application/json' } });
    const login = http.post(`${BASE}/api/users/login`, JSON.stringify({
      username: uname, password: 'secret123'
    }), { headers: { 'Content-Type': 'application/json' } });
    if (login.status === 200) {
      tokens.push(login.json().token);
    }
  }
  if (tokens.length === 0) {
    throw new Error('setup: no tokens minted — is the stack up?');
  }
  return { tokens, productId };
}

export default function (data) {
  const token = data.tokens[__VU % data.tokens.length];
  const authH = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };

  const prof = http.get(`${BASE}/api/users/profile`, { headers: { Authorization: `Bearer ${token}` } });
  check(prof, { 'profile 200': (r) => r.status === 200 });

  if (data.productId) {
    const order = http.post(`${BASE}/api/orders`, JSON.stringify({
      items: [{ productId: data.productId, quantity: 1 }]
    }), authH);
    check(order, { 'order 201': (r) => r.status === 201 });
  }

  const hist = http.get(`${BASE}/api/orders`, authH);
  check(hist, { 'history 200': (r) => r.status === 200 });

  sleep(1);
}

export function handleSummary(data) {
  const out = {};
  if (__ENV.SUMMARY_FILE) {
    out[__ENV.SUMMARY_FILE] = JSON.stringify(data, null, 2);
  }
  out['stdout'] = JSON.stringify({
    http_reqs: data.metrics.http_reqs?.values.count,
    http_fail_rate: ((data.metrics.http_req_failed?.values.rate || 0) * 100).toFixed(2) + '%',
    p50_ms: data.metrics.http_req_duration?.values['p(50)']?.toFixed(1),
    p95_ms: data.metrics.http_req_duration?.values['p(95)']?.toFixed(1),
    p99_ms: data.metrics.http_req_duration?.values['p(99)']?.toFixed(1)
  }, null, 2);
  return out;
}
