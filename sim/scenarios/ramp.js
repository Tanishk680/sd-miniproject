import { readOne, summary } from './lib.js';

const PEAK = Number(__ENV.RATE_PEAK || 80);

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.RATE_START || 5),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 30),
      maxVUs: Number(__ENV.MAX_VUS || 300),
      gracefulStop: '3s',
      stages: [
        { duration: __ENV.RAMP || '60s', target: PEAK },
        { duration: __ENV.HOLD || '60s', target: PEAK },
        { duration: __ENV.DOWN || '15s', target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000']
  }
};

export default function () {
  readOne();
}

export function handleSummary(data) {
  return summary(data);
}
