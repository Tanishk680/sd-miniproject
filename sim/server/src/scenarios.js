const scenarios = [
  {
    id: 'baseline',
    name: 'Baseline',
    script: 'baseline.js',
    description: 'Steady 20 HTTP rps read traffic. Use this as the calm reference run.',
    env: { RPS: '20', DURATION: '90s' },
    defaultsMs: 95000,
    signal: {
      label: 'Steady',
      tone: 'ok',
      targetRps: 20,
      crossesLimit: false,
      expectation: 'No throttling expected'
    }
  },
  {
    id: 'read',
    name: 'Read path (existing)',
    script: 'read.js',
    description: 'The original read k6 case: list, search and detail through the gateway (3 requests per iteration).',
    env: { RPS: '20', DURATION: '90s' },
    defaultsMs: 95000,
    signal: {
      label: 'Legacy 3x',
      tone: 'info',
      targetRps: 60,
      crossesLimit: false,
      expectation: 'Legacy workload: about 60 HTTP rps'
    }
  },
  {
    id: 'write',
    name: 'Auth + write (existing)',
    script: 'write.js',
    description: 'Pre-registered users hit profile, order create and history.',
    env: { RPS: '5', DURATION: '90s', USERS: '20' },
    defaultsMs: 110000,
    signal: {
      label: 'Write path',
      tone: 'info',
      targetRps: 15,
      crossesLimit: false,
      expectation: 'Auth and order writes stay healthy'
    }
  },
  {
    id: 'ramp',
    name: 'Traffic ramp',
    script: 'ramp.js',
    description: 'Ramp from 5 to 80 HTTP rps, hold, then drop. Shows queueing and p95 growth.',
    env: { RATE_START: '5', RATE_PEAK: '80', RAMP: '60s', HOLD: '60s', DOWN: '15s' },
    defaultsMs: 150000,
    signal: {
      label: 'Ramp',
      tone: 'info',
      targetRps: 80,
      crossesLimit: false,
      expectation: 'Approaches the 83 rps gateway cap'
    }
  },
  {
    id: 'spike',
    name: 'Traffic spike',
    script: 'spike.js',
    description: 'Jump to 70 HTTP rps for 40s, below the 83 rps gateway limit. Shows latency under a sharp load increase.',
    env: { RATE_START: '5', RATE_PEAK: '70', RAMP: '10s', HOLD: '40s', DOWN: '10s' },
    defaultsMs: 75000,
    signal: {
      label: 'Spike',
      tone: 'info',
      targetRps: 70,
      crossesLimit: false,
      expectation: 'Stays below the 83 rps gateway cap'
    }
  },
  {
    id: 'soak',
    name: 'Soak',
    script: 'soak.js',
    description: 'Hold 25 HTTP rps for 5 minutes to expose memory drift and connection growth.',
    env: { RPS: '25', DURATION: '300s' },
    defaultsMs: 320000,
    signal: {
      label: 'Soak',
      tone: 'info',
      targetRps: 25,
      crossesLimit: false,
      expectation: 'Watch memory and connection drift'
    }
  },
  {
    id: 'breaking-point',
    name: 'Find breaking point',
    script: 'breaking-point.js',
    description: 'Ramp past the 83 rps gateway cap. 429s and latency mark the breaking point.',
    env: { RATE_START: '10', RATE_PEAK: '250', RAMP: '180s', HOLD: '30s', DOWN: '15s' },
    defaultsMs: 240000,
    signal: {
      label: 'Capacity',
      tone: 'danger',
      targetRps: 250,
      crossesLimit: true,
      expectation: 'Expect 429s once the ramp crosses 83 rps'
    }
  },
  {
    id: 'login-storm',
    name: 'Login storm',
    script: 'login-storm.js',
    description: 'Real bcrypt cost: 15 logins/sec against pre-registered users.',
    env: { RPS: '15', DURATION: '60s', USERS: '20' },
    defaultsMs: 90000,
    signal: {
      label: 'Auth load',
      tone: 'info',
      targetRps: 15,
      crossesLimit: false,
      expectation: 'bcrypt-bound login latency'
    }
  },
  {
    id: 'auth-failure-flood',
    name: 'Auth failure flood',
    script: 'auth-flood.js',
    description: 'Invalid bearer tokens at 50 rps. Shows auth failures without DB writes.',
    env: { RPS: '50', DURATION: '60s' },
    defaultsMs: 75000,
    signal: {
      label: 'Auth errors',
      tone: 'warn',
      targetRps: 50,
      crossesLimit: false,
      expectation: '401s expected; 5xx should stay at zero'
    }
  },
  {
    id: 'cloudwatch-5xx',
    name: 'CloudWatch 5xx spike',
    script: 'cloudwatch-5xx.js',
    description: 'Deliberately triggers enough gateway 5xx responses to fire gateway-5xx-spike.',
    env: { RPS: '20', DURATION: '60s' },
    defaultsMs: 70000,
    adminOnly: true,
    signal: {
      label: '5xx alarm',
      tone: 'danger',
      targetRps: 20,
      crossesLimit: false,
      expectation: 'CloudWatch gateway-5xx-spike should fire during the run'
    }
  },
  {
    id: 'cloudwatch-cpu-high',
    name: 'CloudWatch CPU saturation',
    script: 'cloudwatch-cpu-high.js',
    description: 'Sustains staged user-service CPU load high enough for ec2-cpu-high.',
    env: { RPS: '80', DURATION: '10m', USERS: '20' },
    defaultsMs: 620000,
    adminOnly: true,
    signal: {
      label: 'CPU alarm',
      tone: 'danger',
      targetRps: 80,
      crossesLimit: false,
      expectation: 'CloudWatch ec2-cpu-high should fire if CPU crosses 80%'
    }
  },
];

module.exports = scenarios;
