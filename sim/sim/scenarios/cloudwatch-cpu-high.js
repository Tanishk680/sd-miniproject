import { check } from 'k6';
import { login, registerUser, summary } from './lib.js';

export const options = {
  scenarios: {
    cloudwatchCpuHigh: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RPS || 80),
      timeUnit: '1s',
      duration: __ENV.DURATION || '10m',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 40),
      maxVUs: Number(__ENV.MAX_VUS || 200),
      gracefulStop: '3s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.05']
  }
};

export function setup() {
  const users = [];
  for (let i = 0; i < (Number(__ENV.USERS) || 20); i += 1) {
    users.push(registerUser('simburn'));
  }
  return { users };
}

export default function (data) {
  const user = data.users[__VU % data.users.length];
  const res = login(user.username, user.password);
  check(res, { 'login 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
  return summary(data);
}
