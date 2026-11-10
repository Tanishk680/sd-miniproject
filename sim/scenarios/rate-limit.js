import http from 'k6/http';
import { check } from 'k6';
import { BASE, recordStatus, summary } from './lib.js';

export const options = {
  scenarios: {
    rateLimit: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RPS || 120),
      timeUnit: '1s',
      duration: __ENV.DURATION || '90s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 60),
      maxVUs: Number(__ENV.MAX_VUS || 300),
      gracefulStop: '3s'
    }
  },
  thresholds: {
    rate_limited: ['count>0']
  }
};

export default function () {
  const res = http.get(`${BASE}/api/products`);
  recordStatus(res);
  check(res, { '200 or 429': (r) => r.status === 200 || r.status === 429 });
}

export function handleSummary(data) {
  return summary(data);
}
