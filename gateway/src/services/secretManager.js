const logger = require('../utils/logger');

let jwtSecret = null;

async function getJwtSecret() {
  if (jwtSecret) return jwtSecret;

  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) {
    jwtSecret = fromEnv;
    return jwtSecret;
  }

  // AWS phase: retrieve the secret from AWS Secrets Manager here
  // (IAM role + secretsmanager:GetSecretValue) and cache it.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production (or wire AWS Secrets Manager); refusing insecure fallback');
  }
  logger.warn('JWT_SECRET env var missing; using insecure development fallback');
  jwtSecret = 'dev-insecure-jwt-secret-change-me';
  return jwtSecret;
}

function resetJwtSecretCache() {
  jwtSecret = null;
}

module.exports = { getJwtSecret, resetJwtSecretCache };