export function fmtNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function fmtInt(value) {
  if (!Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString();
}

export function fmtRps(value) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 100) return Math.round(value).toString();
  return value.toFixed(value >= 10 ? 1 : 2);
}

export function fmtSeconds(value) {
  if (!Number.isFinite(value) || value <= 0) return '0ms';
  const ms = value * 1000;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function fmtPct(value, digits = 1) {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}${units[unit]}`;
}

export function fmtCpu(cores) {
  if (!Number.isFinite(cores)) return '—';
  return `${cores.toFixed(3)}c`;
}

export function clock(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

export function elapsed(startedAt) {
  if (!startedAt) return '0s';
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function currentPhase(phases, startedAt, now = Date.now()) {
  if (!Array.isArray(phases) || phases.length === 0 || !startedAt) return null;
  const elapsedMs = Math.max(0, now - startedAt);
  let cursor = 0;

  for (let index = 0; index < phases.length; index += 1) {
    const durationMs = phases[index].durationMs || 0;
    if (elapsedMs < cursor + durationMs) {
      return {
        ...phases[index],
        index,
        elapsedMs: elapsedMs - cursor,
        remainingMs: cursor + durationMs - elapsedMs,
        done: false
      };
    }
    cursor += durationMs;
  }

  return {
    ...phases[phases.length - 1],
    index: phases.length - 1,
    elapsedMs: cursor,
    remainingMs: 0,
    done: true
  };
}

export function phaseBoundaries(phases, startedAt) {
  if (!Array.isArray(phases) || phases.length === 0 || !startedAt) return [];
  let cursor = startedAt;
  return phases.map((phase) => {
    cursor += phase.durationMs || 0;
    return { name: phase.name, at: cursor };
  });
}

export function loadClass(node) {
  if (!node) return 'unknown';
  if (node.status === 'down') return 'down';
  if (node.status === 'unknown') return 'unknown';
  if (node.errorRate > 0.05) return 'bad';
  if (node.rateLimited > 0.01) return 'warm';
  if (node.cpuCores > 0.35 || node.rps > 65) return 'warm';
  return 'good';
}
