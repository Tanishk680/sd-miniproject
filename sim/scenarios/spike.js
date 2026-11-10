import { readOne, summary } from './lib.js';

const PEAK = Number(__ENV.RATE_PEAK || 70);

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.RATE_START || 5),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 40),
      maxVUs: Number(__ENV.MAX_VUS || 120),
      gracefulStop: '3s',
      stages: [
        { duration: __ENV.RAMP || '10s', target: PEAK },
        { duration: __ENV.HOLD || '40s', target: PEAK },
        { duration: __ENV.DOWN || '10s', target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000']
  }
};

export default function () {
  readOne();
}

export function handleSummary(data) {
  return summary(data);
}
