import http from 'k6/http';
import { check } from 'k6';
import { BASE, summary } from './lib.js';

export const options = {
  scenarios: {
    authFlood: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RPS || 50),
      timeUnit: '1s',
      duration: __ENV.DURATION || '60s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 50),
      maxVUs: Number(__ENV.MAX_VUS || 300),
      gracefulStop: '3s'
    }
  }
};

export default function () {
  const res = http.get(`${BASE}/api/users/profile`, {
    headers: { Authorization: 'Bearer invalid-token-for-simulation' }
  });
  check(res, { '401 expected': (r) => r.status === 401 });
}

export function handleSummary(data) {
  return summary(data);
}
