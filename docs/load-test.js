import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:5000';

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '30s', target: 10 },
    { duration: '5s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.15']
  }
};

export default function () {
  // Public: product list
  const prodRes = http.get(`${BASE}/api/products`);
  check(prodRes, { 'products 200': (r) => r.status === 200 });

  // Public: search
  const searchRes = http.get(`${BASE}/api/products/search?q=keyboard`);
  check(searchRes, { 'search 200': (r) => r.status === 200 });

  // Public: product detail
  if (prodRes.status === 200) {
    const products = prodRes.json().products;
    if (products.length > 0) {
      const detail = http.get(`${BASE}/api/products/${products[0]._id}`);
      check(detail, { 'detail 200': (r) => r.status === 200 });
    }
  }

  // Auth: register + login + order
  const uname = `k6user${Date.now()}${__VU}`;
  const regRes = http.post(`${BASE}/api/users/register`, JSON.stringify({
    username: uname,
    email: `${uname}@test.com`,
    password: 'secret123'
  }), { headers: { 'Content-Type': 'application/json' } });
  check(regRes, { 'register 201': (r) => r.status === 201 });

  const loginRes = http.post(`${BASE}/api/users/login`, JSON.stringify({
    username: uname,
    password: 'secret123'
  }), { headers: { 'Content-Type': 'application/json' } });
  check(loginRes, { 'login 200': (r) => r.status === 200 });

  if (loginRes.status === 200) {
    const token = loginRes.json().token;
    const authH = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };

    // Place order
    if (prodRes.status === 200) {
      const products = prodRes.json().products;
      if (products.length > 0) {
        const orderRes = http.post(`${BASE}/api/orders`, JSON.stringify({
          items: [{ productId: products[0]._id, name: products[0].name, price: products[0].price, quantity: 1 }]
        }), authH);
        check(orderRes, { 'order 201': (r) => r.status === 201 });
      }
    }

    // Order history
    const histRes = http.get(`${BASE}/api/orders`, authH);
    check(histRes, { 'orders 200': (r) => r.status === 200 });

    // Profile
    const profRes = http.get(`${BASE}/api/users/profile`, { headers: { Authorization: `Bearer ${token}` } });
    check(profRes, { 'profile 200': (r) => r.status === 200 });
  }

  // Gateway admin
  const healthRes = http.get(`${BASE}/health`);
  check(healthRes, { 'health 200': (r) => r.status === 200 });

  const statusRes = http.get(`${BASE}/gateway/status`);
  check(statusRes, { 'status 200': (r) => r.status === 200 });

  sleep(0.5);
}

export function handleSummary(data) {
  const out = {};
  if (__ENV.SUMMARY_FILE) {
    out[__ENV.SUMMARY_FILE] = JSON.stringify(data, null, 2);
  }
  out['stdout'] = JSON.stringify({
    http_reqs: data.metrics.http_reqs?.values.count,
    http_fail_rate: (data.metrics.http_req_failed?.values.rate * 100).toFixed(2) + '%',
    p95_ms: data.metrics.http_req_duration?.values['p(95)']?.toFixed(1),
    p99_ms: data.metrics.http_req_duration?.values['p(99)']?.toFixed(1)
  }, null, 2);
  return out;
}