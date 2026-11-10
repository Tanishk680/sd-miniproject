import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

export const BASE = __ENV.BASE_URL || 'http://localhost:5000';
export const JSON_HEADERS = { 'Content-Type': 'application/json' };
const REQUEST = { timeout: '10s' };
const JSON_REQUEST = { headers: JSON_HEADERS, timeout: '10s' };
const rateLimited = new Counter('rate_limited');
const serverErrors = new Counter('server_errors');

export function recordStatus(res) {
  if (!res) return;
  if (res.status === 429) rateLimited.add(1);
  if (res.status >= 500) serverErrors.add(1);
}

export function readWorkload() {
  const list = http.get(`${BASE}/api/products`, REQUEST);
  recordStatus(list);
  check(list, {
    'list 200': (r) => r.status === 200,
    'list has products': (r) => r.status === 200 && r.json().products.length > 0
  });

  const search = http.get(`${BASE}/api/products/search?q=keyboard`, REQUEST);
  recordStatus(search);
  check(search, { 'search 200': (r) => r.status === 200 });

  if (list.status === 200 && list.json().products.length > 0) {
    const id = list.json().products[0]._id;
    const detail = http.get(`${BASE}/api/products/${id}`, REQUEST);
    recordStatus(detail);
    check(detail, { 'detail 200': (r) => r.status === 200 });
  }
}

const READ_PATHS = ['/api/products', '/api/products/search?q=keyboard'];

export function readOne() {
  const path = READ_PATHS[__ITER % READ_PATHS.length];
  const res = http.get(`${BASE}${path}`, REQUEST);
  recordStatus(res);
  check(res, { 'read 200': (r) => r.status === 200 });
}

export function registerUser(prefix, password = 'secret123') {
  const username = `${prefix}${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  //const password = 'secret123';
  http.post(
    `${BASE}/api/users/register`,
    JSON.stringify({ username, email: `${username}@test.com`, password }),
    JSON_REQUEST,
  );
  return { username, password };
}

export function login(username, password) {
  return http.post(
    `${BASE}/api/users/login`,
    JSON.stringify({ username, password }),
    JSON_REQUEST
  );
}

export function summary(data) {
  const metrics = data.metrics || {};
  const duration = metrics.http_req_duration?.values || {};
  const summaryData = {
    http_reqs: metrics.http_reqs?.values?.count || 0,
    rps: metrics.http_reqs?.values?.rate || 0,
    http_fail_rate: metrics.http_req_failed?.values?.rate || 0,
    rate_limited: metrics.rate_limited?.values?.count || 0,
    server_errors: metrics.server_errors?.values?.count || 0,
    p50_ms: duration.med || duration['p(50)'] || 0,
    p95_ms: duration['p(95)'] || 0,
    p99_ms: duration['p(99)'] || 0,
    max_ms: duration.max || 0
  };

  const out = { stdout: JSON.stringify(summaryData, null, 2) };
  if (__ENV.SUMMARY_FILE) {
    out[__ENV.SUMMARY_FILE] = JSON.stringify(data);
  }
  return out;
}
