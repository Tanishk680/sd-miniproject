import { check } from 'k6';
import { login, registerUser, summary } from './lib.js';

const USERS = Number(__ENV.USERS || 20);

export const options = {
  scenarios: {
    login: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RPS || 15),
      timeUnit: '1s',
      duration: __ENV.DURATION || '60s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 20),
      maxVUs: Number(__ENV.MAX_VUS || 120),
      gracefulStop: '3s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.05']
  }
};

export function setup() {
  const users = [];
  for (let i = 0; i < USERS; i += 1) {
    users.push(registerUser('simlogin'));
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
