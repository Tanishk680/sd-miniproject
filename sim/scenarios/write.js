import http from 'k6/http';
import { check } from 'k6';
import { BASE, JSON_HEADERS, login, registerUser, summary } from './lib.js';

const USERS = Number(__ENV.USERS || 20);

export const options = {
  scenarios: {
    write: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RPS || 5),
      timeUnit: '1s',
      duration: __ENV.DURATION || '90s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 10),
      maxVUs: Number(__ENV.MAX_VUS || 60),
      gracefulStop: '3s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000']
  }
};

export function setup() {
  const tokens = [];
  let productId = null;
  const products = http.get(`${BASE}/api/products`);
  if (products.status === 200 && products.json().products.length > 0) {
    productId = products.json().products[0]._id;
  }

  for (let i = 0; i < USERS; i += 1) {
    const user = registerUser('simw');
    const res = login(user.username, user.password);
    if (res.status === 200) tokens.push(res.json().token);
  }

  if (tokens.length === 0) throw new Error('setup: no tokens minted');
  return { tokens, productId };
}

export default function (data) {
  const token = data.tokens[__VU % data.tokens.length];
  const authHeaders = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };

  const profile = http.get(`${BASE}/api/users/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  check(profile, { 'profile 200': (r) => r.status === 200 });

  if (data.productId) {
    const order = http.post(
      `${BASE}/api/orders`,
      JSON.stringify({ items: [{ productId: data.productId, quantity: 1 }] }),
      authHeaders
    );
    check(order, { 'order 201': (r) => r.status === 201 });
  }

  const history = http.get(`${BASE}/api/orders`, authHeaders);
  check(history, { 'history 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
  return summary(data);
}
