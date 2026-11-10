const config = require('./config');

async function instant(query) {
  const url = new URL('/api/v1/query', config.prometheusUrl);
  url.searchParams.set('query', query);

  const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
  if (!res.ok) throw new Error(`Prometheus HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'success') throw new Error(body.error || 'Prometheus query failed');
  return body.data.result;
}

async function range(query, start, end, step) {
  const url = new URL('/api/v1/query_range', config.prometheusUrl);
  url.searchParams.set('query', query);
  url.searchParams.set('start', String(start));
  url.searchParams.set('end', String(end));
  url.searchParams.set('step', String(step));

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Prometheus HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'success') throw new Error(body.error || 'Prometheus range query failed');
  return body.data.result;
}

async function vectorMap(query, key = 'service') {
  const result = await instant(query);
  const map = {};
  for (const series of result) {
    const label = series.metric[key] || 'unknown';
    const value = Number(series.value[1]);
    map[label] = Number.isFinite(value) ? value : 0;
  }
  return map;
}

module.exports = { instant, range, vectorMap };
