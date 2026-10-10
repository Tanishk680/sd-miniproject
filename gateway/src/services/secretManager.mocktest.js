// Kept regression net for the Secrets Manager path (no test framework in repo).
// Runs INSIDE the gateway container (has winston): 
//   docker exec gateway node src/services/secretManager.mocktest.js
// Uses an injected fake client — no AWS credentials or network needed.
const assert = require('assert');
const { getJwtSecret, resetJwtSecretCache, setSecretsClientForTests } = require('./secretManager');

function fakeClient(secretString, opts = {}) {
  const counter = opts.counter || { calls: 0 };
  return {
    async send() {
      counter.calls += 1;
      if (opts.failWith) throw opts.failWith;
      return { SecretString: secretString };
    }
  };
}

function scrubEnv() {
  delete process.env.JWT_SECRET;
  delete process.env.AWS_JWT_SECRET_ID;
  delete process.env.AWS_REGION;
  delete process.env.NODE_ENV;
  resetJwtSecretCache();
  setSecretsClientForTests(null);
}

async function main() {
  // 1. Single JSON secret contract: {"JWT_SECRET": "...", ...}
  scrubEnv();
  process.env.AWS_JWT_SECRET_ID = 'prod/ecommerce/app';
  process.env.AWS_REGION = 'us-east-1';
  setSecretsClientForTests(fakeClient(JSON.stringify({ JWT_SECRET: 'jwt-from-aws', GATEWAY_ADMIN_TOKEN: 'x' })));
  assert.strictEqual(await getJwtSecret(), 'jwt-from-aws', 'JSON secret should yield JWT_SECRET');
  console.log('PASS 1: JSON secret shape');

  // 2. Plain-string secret fallback
  scrubEnv();
  process.env.AWS_JWT_SECRET_ID = 'prod/ecommerce/app';
  setSecretsClientForTests(fakeClient('plain-secret-value'));
  assert.strictEqual(await getJwtSecret(), 'plain-secret-value', 'plain string should be used as-is');
  console.log('PASS 2: plain-string secret');

  // 3. JSON without JWT_SECRET key -> clear error
  scrubEnv();
  process.env.AWS_JWT_SECRET_ID = 'prod/ecommerce/app';
  setSecretsClientForTests(fakeClient(JSON.stringify({ OTHER: 'y' })));
  await assert.rejects(getJwtSecret(), /no JWT_SECRET key/, 'missing key should throw');
  console.log('PASS 3: JSON missing JWT_SECRET throws');

  // 4. SDK/network failure propagates (gateway surfaces it, never silent fallback)
  scrubEnv();
  process.env.AWS_JWT_SECRET_ID = 'prod/ecommerce/app';
  setSecretsClientForTests(fakeClient(null, { failWith: new Error('credentials missing') }));
  await assert.rejects(getJwtSecret(), /credentials missing/, 'SDK error should propagate');
  console.log('PASS 4: SDK error propagates');

  // 5. Caching: N reads -> 1 SDK call
  scrubEnv();
  process.env.AWS_JWT_SECRET_ID = 'prod/ecommerce/app';
  const counter = { calls: 0 };
  setSecretsClientForTests(fakeClient(JSON.stringify({ JWT_SECRET: 'cached' }), { counter }));
  assert.strictEqual(await getJwtSecret(), 'cached');
  assert.strictEqual(await getJwtSecret(), 'cached');
  assert.strictEqual(await getJwtSecret(), 'cached');
  assert.strictEqual(counter.calls, 1, 'expected exactly 1 SDK call');
  console.log('PASS 5: secret cached after first fetch');

  // 6. Env precedence: JWT_SECRET set -> SDK never touched
  scrubEnv();
  process.env.JWT_SECRET = 'from-env';
  process.env.AWS_JWT_SECRET_ID = 'prod/ecommerce/app';
  const counter2 = { calls: 0 };
  setSecretsClientForTests(fakeClient(JSON.stringify({ JWT_SECRET: 'should-not-be-used' }), { counter: counter2 }));
  assert.strictEqual(await getJwtSecret(), 'from-env');
  assert.strictEqual(counter2.calls, 0, 'SDK should not be called when env is set');
  console.log('PASS 6: JWT_SECRET env takes precedence');

  scrubEnv();
  console.log('ALL SECRET-MANAGER MOCK TESTS PASSED');
}

main().catch((err) => {
  console.error('MOCK TEST FAILED:', err);
  process.exit(1);
});
