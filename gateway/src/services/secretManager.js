const logger = require('../utils/logger');

let jwtSecret = null;
let injectedSecretsClient = null;

// Test hook (see secretManager.mocktest.js): inject a fake
// `{ send(command) }` client so the Secrets Manager path can be
// verified without AWS credentials or the SDK installed.
function setSecretsClientForTests(client) {
  injectedSecretsClient = client || null;
}

async function fetchJwtFromSecretsManager(secretId, region) {
  let client = injectedSecretsClient;
  let command;
  if (client) {
    command = { SecretId: secretId }; // opaque to the injected fake
  } else {
    // Lazy require: the AWS SDK is only loaded when this path is used,
    // keeping local/dev boot dependency-free.
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    client = new SecretsManagerClient({ region });
    command = new GetSecretValueCommand({ SecretId: secretId });
  }

  const res = await client.send(command);
  const raw = res && res.SecretString;
  if (!raw) {
    throw new Error(`Secrets Manager secret ${secretId} has no SecretString value`);
  }

  // Contract: single JSON secret, e.g. {"JWT_SECRET": "...", ...}.
  // A non-JSON value is treated as the raw secret for flexibility.
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    parsed = null;
  }
  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.JWT_SECRET === 'string' && parsed.JWT_SECRET) {
      return parsed.JWT_SECRET;
    }
    throw new Error(`Secrets Manager secret ${secretId} is JSON but has no JWT_SECRET key`);
  }
  return raw;
}

async function getJwtSecret() {
  if (jwtSecret) return jwtSecret;

  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) {
    jwtSecret = fromEnv;
    return jwtSecret;
  }

  // AWS path: IAM instance role supplies credentials via the SDK's
  // default chain (no keys in code or config). Needs
  // secretsmanager:GetSecretValue on the secret.
  const secretId = process.env.AWS_JWT_SECRET_ID;
  if (secretId) {
    const region = process.env.AWS_REGION || 'us-east-1';
    logger.info('Fetching JWT secret from AWS Secrets Manager', { secretId, region });
    jwtSecret = await fetchJwtFromSecretsManager(secretId, region);
    return jwtSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT secret is required in production (set JWT_SECRET or AWS_JWT_SECRET_ID); refusing insecure fallback');
  }
  logger.warn('JWT_SECRET env var missing; using insecure development fallback');
  jwtSecret = 'dev-insecure-jwt-secret-change-me';
  return jwtSecret;
}

function resetJwtSecretCache() {
  jwtSecret = null;
}

module.exports = { getJwtSecret, resetJwtSecretCache, setSecretsClientForTests };