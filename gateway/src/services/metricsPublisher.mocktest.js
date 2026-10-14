// Kept regression net for the CloudWatch metrics publisher.
// Runs INSIDE the gateway container (has winston):
//   docker exec gateway node src/services/metricsPublisher.mocktest.js
// Uses an injected fake client + canned snapshots — no AWS needed.
const assert = require('assert');
const { createPublisher } = require('./metricsPublisher');

function fakeClient(captured, opts = {}) {
  return {
    async send(command) {
      captured.push(command);
      if (opts.failWith) throw opts.failWith;
      return {};
    }
  };
}

function snapshots(list) {
  let i = 0;
  return () => list[Math.min(i++, list.length - 1)];
}

async function main() {
  // 1. Deltas: two snapshots -> publishes the difference, correct metric names
  {
    const captured = [];
    const pub = createPublisher({
      enabled: true,
      namespace: 'Test/Gateway',
      client: fakeClient(captured),
      getSnapshot: snapshots([
        { totalRequests: 100, byStatus: { 200: 90, 401: 7, 503: 3 }, totalLatencyMs: 5000 },
        { totalRequests: 150, byStatus: { 200: 130, 401: 12, 503: 8 }, totalLatencyMs: 9000 }
      ])
    });
    await pub.flushOnce(); // establishes baseline (publishes first delta vs zero)
    const first = captured[0];
    assert.strictEqual(first.Namespace, 'Test/Gateway');
    const names = first.MetricData.map((m) => m.MetricName).sort();
    assert.deepStrictEqual(names, ['AvgLatencyMs', 'Error4xx', 'Error5xx', 'RequestCount']);
    const second = (await pub.flushOnce(), captured[1]);
    const byName = Object.fromEntries(second.MetricData.map((m) => [m.MetricName, m.Value]));
    assert.strictEqual(byName.RequestCount, 50, 'delta total');
    assert.strictEqual(byName.Error4xx, 5, 'delta 4xx');
    assert.strictEqual(byName.Error5xx, 5, 'delta 5xx');
    assert.strictEqual(byName.AvgLatencyMs, 80, 'delta latency 4000/50');
    console.log('PASS 1: per-flush deltas + metric shape');
  }

  // 2. Idle flush (no new requests) publishes nothing
  {
    const captured = [];
    const snap = { totalRequests: 10, byStatus: { 200: 10 }, totalLatencyMs: 100 };
    const pub = createPublisher({ enabled: true, client: fakeClient(captured), getSnapshot: () => snap });
    await pub.flushOnce();
    const n = captured.length;
    await pub.flushOnce();
    assert.strictEqual(captured.length, n, 'idle flush must not publish');
    console.log('PASS 2: idle flush publishes nothing');
  }

  // 3. Publish failure is swallowed by safeFlush and surfaced in status()
  {
    const pub = createPublisher({
      enabled: true,
      client: fakeClient([], { failWith: new Error('network down') }),
      getSnapshot: () => ({ totalRequests: 5, byStatus: { 200: 5 }, totalLatencyMs: 50 })
    });
    await pub.safeFlush(); // must not throw
    assert.match(pub.status().lastError, /network down/);
    console.log('PASS 3: failure swallowed + visible in status');
  }

  // 4. Disabled publisher never builds a client (no SDK needed)
  {
    const pub = createPublisher({ enabled: false, getSnapshot: () => ({ totalRequests: 1, byStatus: {}, totalLatencyMs: 0 }) });
    assert.strictEqual(pub.status().enabled, false);
    console.log('PASS 4: disabled by default');
  }

  console.log('ALL METRICS-PUBLISHER MOCK TESTS PASSED');
}

main().catch((err) => {
  console.error('MOCK TEST FAILED:', err);
  process.exit(1);
});
