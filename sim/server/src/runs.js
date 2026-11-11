const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const config = require('./config');
const scenarios = require('./scenarios');

const events = new EventEmitter();
const ALLOWED_ENV = new Set([
  'RPS',
  'DURATION',
  'RATE_START',
  'RATE_PEAK',
  'RAMP',
  'HOLD',
  'DOWN',
  'USERS',
  'PRE_VUS',
  'MAX_VUS'
]);

let active = null;
let seq = 0;

function parseDurationMs(value) {
  if (typeof value === 'number') return value;
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2];
  return amount * ({ ms: 1, s: 1000, m: 60000, h: 3600000 }[unit] || 1);
}

function phasesFor(scenario) {
  if (scenario.phases) return scenario.phases;
  const env = scenario.env || {};
  if (env.RAMP || env.HOLD || env.DOWN) {
    return [
      { name: 'ramp', durationMs: parseDurationMs(env.RAMP) },
      { name: 'hold', durationMs: parseDurationMs(env.HOLD) },
      { name: 'down', durationMs: parseDurationMs(env.DOWN) }
    ].filter((phase) => phase.durationMs > 0);
  }
  return [{
    name: 'steady',
    durationMs: parseDurationMs(env.DURATION) || scenario.defaultsMs || 0
  }];
}

function listScenarios(isAdmin = false) {
  return scenarios
    .filter((scenario) => !scenario.adminOnly || isAdmin)
    .map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      defaultsMs: scenario.defaultsMs,
      adminOnly: Boolean(scenario.adminOnly),
      signal: scenario.signal,
      phases: phasesFor(scenario)
    }));
}

function getScenario(id) {
  return scenarios.find((scenario) => scenario.id === id) || null;
}

function activeRun() {
  if (!active) return null;
  return {
    id: active.id,
    scenario: active.scenarioId,
    label: active.label,
    startedAt: active.startedAt
  };
}

function activeRunId() {
  return active ? active.id : null;
}

function onEvent(listener) {
  events.on('event', listener);
  return () => events.off('event', listener);
}

function emit(event) {
  events.emit('event', event);
}

function extractMetrics(data) {
  if (!data || !data.metrics) return null;
  const metrics = data.metrics;
  const duration = metrics.http_req_duration?.values || {};
  return {
    http_reqs: metrics.http_reqs?.values?.count || 0,
    rps: metrics.http_reqs?.values?.rate || 0,
    http_fail_rate: metrics.http_req_failed?.values?.rate || 0,
    rate_limited: metrics.rate_limited?.values?.count || 0,
    server_errors: metrics.server_errors?.values?.count || 0,
    p50_ms: duration.med || duration['p(50)'] || 0,
    p95_ms: duration['p(95)'] || 0,
    p99_ms: duration['p(99)'] || 0,
    max_ms: duration.max || 0
  };
}

function verdictFor(scenario, metrics) {
  if (!metrics) return null;
  const failRate = metrics.http_fail_rate || 0;
  const limited = metrics.rate_limited || 0;
  const serverErrors = metrics.server_errors || 0;

  if (scenario.id === 'rate-limit') {
    return limited > 0
      ? { code: 'limit-triggered', label: `429s observed (${limited})`, tone: 'warn' }
      : { code: 'limit-not-reached', label: 'no 429 observed', tone: 'warn' };
  }
  if (scenario.id === 'breaking-point') {
    if (limited > 0) {
      return { code: 'breaking-point', label: `breaking point: ${limited} 429s`, tone: 'danger' };
    }
    if (serverErrors > 0 || failRate > 0.05) {
      return { code: 'breaking-point', label: 'breaking point: errors', tone: 'danger' };
    }
    return { code: 'no-break', label: 'no errors observed', tone: 'ok' };
  }
  if (scenario.id === 'auth-failure-flood') {
    return failRate > 0.05
      ? { code: 'auth-errors', label: '401s observed', tone: 'info' }
      : { code: 'auth-clean', label: 'no 401s observed', tone: 'warn' };
  }
  if (limited > 0) {
    return { code: 'rate-limited', label: `429s observed (${limited})`, tone: 'warn' };
  }
  if (serverErrors > 0 || failRate > 0.05) {
    return { code: 'errors', label: `${Math.round(failRate * 100)}% failed`, tone: 'bad' };
  }
  return { code: 'clean', label: 'clean run', tone: 'ok' };
}

function killTree(proc) {
  if (!proc || proc.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { windowsHide: true });
    return;
  }
  proc.kill('SIGINT');
  setTimeout(() => {
    if (proc.exitCode === null) proc.kill('SIGKILL');
  }, 5000).unref();
}

const NUMERIC_ENV = new Set(['RPS', 'RATE_START', 'RATE_PEAK', 'USERS', 'PRE_VUS', 'MAX_VUS']);
const DURATION_ENV = new Set(['DURATION', 'RAMP', 'HOLD', 'DOWN']);
const NUMERIC_LIMITS = {
  RPS: { min: 1, max: 250 },
  RATE_START: { min: 1, max: 250 },
  RATE_PEAK: { min: 1, max: 250 },
  USERS: { min: 1, max: 500 },
  PRE_VUS: { min: 1, max: 500 },
  MAX_VUS: { min: 1, max: 1000 }
};
const MAX_DURATION_MS = 15 * 60 * 1000;

function validateRunParams({ scenarioId, label, env } = {}) {
  if (typeof scenarioId !== 'string' || !/^[a-z0-9-]+$/.test(scenarioId)) {
    const err = new Error('Invalid scenario id');
    err.code = 'BAD_SCENARIO';
    throw err;
  }

  if (label !== undefined && label !== null && typeof label !== 'string') {
    const err = new Error('Label must be a string');
    err.code = 'BAD_LABEL';
    throw err;
  }

  if (env === undefined || env === null) return;
  if (typeof env !== 'object' || Array.isArray(env)) {
    const err = new Error('env must be an object');
    err.code = 'BAD_ENV';
    throw err;
  }

  for (const [key, rawValue] of Object.entries(env)) {
    if (!ALLOWED_ENV.has(key)) {
      const err = new Error(`Env override not allowed: ${key}`);
      err.code = 'BAD_ENV';
      throw err;
    }

    if (NUMERIC_ENV.has(key)) {
      const value = Number(rawValue);
      const limits = NUMERIC_LIMITS[key] || { min: 1, max: 1000 };
      if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
        const err = new Error(`${key} must be a number between ${limits.min} and ${limits.max}`);
        err.code = 'BAD_ENV';
        throw err;
      }
    }

    if (DURATION_ENV.has(key)) {
      const ms = parseDurationMs(rawValue);
      if (!ms || ms > MAX_DURATION_MS) {
        const err = new Error(`${key} must be a duration between 1ms and ${MAX_DURATION_MS}ms`);
        err.code = 'BAD_ENV';
        throw err;
      }
    }
  }
}

function sanitizeEnv(env) {
  const result = {};
  for (const [key, value] of Object.entries(env || {})) {
    if (!ALLOWED_ENV.has(key)) {
      const err = new Error(`Env override not allowed: ${key}`);
      err.code = 'BAD_ENV';
      throw err;
    }
    result[key] = String(value);
  }
  return result;
}

function startRun({ scenarioId, label, env, admin = false } = {}) {
  validateRunParams({ scenarioId, label, env });
  if (active) {
    const err = new Error('A run is already in progress');
    err.code = 'RUN_ACTIVE';
    throw err;
  }

  const scenario = getScenario(scenarioId);
  if (!scenario) {
    const err = new Error('Unknown scenario');
    err.code = 'BAD_SCENARIO';
    throw err;
  }
  if (scenario.adminOnly && !admin) {
    const err = new Error('Admin bearer token required');
    err.code = 'ADMIN_REQUIRED';
    throw err;
  }

  const id = `${Date.now().toString(36)}-${(++seq).toString(36)}`;
  const runDir = config.runsDir;
  fs.mkdirSync(runDir, { recursive: true });
  const summaryFile = path.join(runDir, `${id}.json`);
  const scriptPath = path.join(config.scenariosDir, scenario.script);
  const childEnv = {
    ...process.env,
    BASE_URL: config.gatewayUrl,
    SUMMARY_FILE: summaryFile,
    ...scenario.env,
    ...sanitizeEnv(env)
  };

  const startedAt = Date.now();
  const runLabel = (label || scenario.name).slice(0, 120);
  store.createRun({ id, label: runLabel, scenario: scenario.id, mode: config.mockMode ? 'mock' : 'live' });

  let stderr = '';
  let finalized = false;
  let reason = null;

  const proc = spawn(
    config.k6Bin,
    ['run', '--quiet', '--summary-trend-stats', 'min,avg,med,p(90),p(95),p(99),max', scriptPath],
    {
      cwd: config.scenariosDir,
      env: childEnv,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  proc.stdout.on('data', () => {});
  proc.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });

  const timeout = setTimeout(() => {
    if (!active || active.id !== id) return;
    active.stopped = true;
    reason = 'max-duration';
    emit({ type: 'run-note', id, message: 'Stopping at max duration' });
    killTree(proc);
  }, Math.min(config.maxRunMs, scenario.defaultsMs + 60000));

  active = {
    id,
    scenarioId: scenario.id,
    label: runLabel,
    startedAt,
    proc,
    stopped: false
  };

  store.insertEvent(id, 'start', { scenario: scenario.id, env: sanitizeEnv(env) });
  emit({ type: 'run-start', run: activeRun() });

  function finish(code) {
    if (finalized) return;
    finalized = true;
    clearTimeout(timeout);

    const stopped = active?.id === id ? active.stopped : reason !== null;
    if (reason === null && active?.id === id && active.stopped) reason = 'user';
    if (active?.id === id) active = null;

    let summary = null;
    try {
      summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    } catch (_err) {
      summary = null;
    }

    const metrics = extractMetrics(summary);
    const verdict = verdictFor(scenario, metrics);
    const status = stopped ? 'aborted' : code === 0 ? 'completed' : 'failed';
    const payload = { exitCode: code, metrics, verdict, reason: reason || undefined };
    if (!metrics && stderr) payload.stderr = stderr;

    store.finishRun(id, status, payload);
    store.insertEvent(id, 'end', { status, metrics, verdict, reason: reason || null });
    emit({ type: 'run-end', id, status, metrics, verdict, error: !metrics ? stderr : null });
  }

  proc.on('close', (code) => finish(code));
  proc.on('error', (err) => {
    stderr = `${stderr}\nspawn error: ${err.message}`;
    reason = 'spawn-error';
    finish(-1);
  });

  return { id, label: runLabel, scenario: scenario.id };
}

function stopRun(id) {
  if (!active || active.id !== id) return false;
  active.stopped = true;
  emit({ type: 'run-note', id, message: 'Stop requested' });
  killTree(active.proc);
  return true;
}

function shutdown() {
  if (!active) return;
  active.stopped = true;
  emit({ type: 'run-note', id: active.id, message: 'Server shutting down; stopping run' });
  killTree(active.proc);
}

module.exports = {
  listScenarios,
  getScenario,
  startRun,
  stopRun,
  activeRun,
  activeRunId,
  onEvent,
  shutdown
};
