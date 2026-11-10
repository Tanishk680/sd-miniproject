import { check } from 'k6';
import { registerUser, recordStatus, summary } from './lib.js';

export const options = {
  scenarios: {
    cloudwatch5xx: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RPS || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '60s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 20),
      maxVUs: Number(__ENV.MAX_VUS || 120),
      gracefulStop: '3s'
    }
  },
  thresholds: {
    server_errors: ['count>0']
  }
};

export default function () {
  const res = registerUser('cloudwatchx', 'x');
  recordStatus(res);
  check(res, { '500 expected': (r) => r.status === 500 });
}

export function handleSummary(data) {
  return summary(data);
}
