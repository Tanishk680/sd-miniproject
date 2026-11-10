import { readOne, summary } from './lib.js';

const PEAK = Number(__ENV.RATE_PEAK || 250);

export const options = {
  scenarios: {
    breaking: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.RATE_START || 10),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 60),
      maxVUs: Number(__ENV.MAX_VUS || 600),
      gracefulStop: '3s',
      stages: [
        { duration: __ENV.RAMP || '180s', target: PEAK },
        { duration: __ENV.HOLD || '30s', target: PEAK },
        { duration: __ENV.DOWN || '15s', target: 0 }
      ]
    }
  }
};

export default function () {
  readOne();
}

export function handleSummary(data) {
  return summary(data);
}
