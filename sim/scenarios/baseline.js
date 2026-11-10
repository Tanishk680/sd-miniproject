import { readOne, summary } from './lib.js';

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RPS || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '90s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 20),
      maxVUs: Number(__ENV.MAX_VUS || 120),
      gracefulStop: '3s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000']
  }
};

export default function () {
  readOne();
}

export function handleSummary(data) {
  return summary(data);
}
