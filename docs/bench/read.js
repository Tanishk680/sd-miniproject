// Layer 1 (read path): product list + search + detail through the gateway.
// Pure gateway+read workload — no auth, no DB writes.
// Env: BASE_URL (default http://localhost:5000), BENCH_VUS (default 10),
//      RAMP/STEADY/DOWN durations (default 30s/120s/10s), SUMMARY_FILE.
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

export default function () {
  const list = http.get(`${BASE}/api/products`);
  check(list, {
    'list 200': (r) => r.status === 200,
    'list has products': (r) => r.status === 200 && r.json().products.length > 0
  });

  const search = http.get(`${BASE}/api/products/search?q=keyboard`);
  check(search, { 'search 200': (r) => r.status === 200 });

  if (list.status === 200 && list.json().products.length > 0) {
    const id = list.json().products[0]._id;
    const detail = http.get(`${BASE}/api/products/${id}`);
    check(detail, { 'detail 200': (r) => r.status === 200 });
  }

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
