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
  // and cache it. Local phase falls back to the shared default.
  logger.warn('JWT_SECRET env var missing; using insecure fallback');
  jwtSecret = 'dev-insecure-jwt-secret-change-me';
  return jwtSecret;
}

module.exports = { getJwtSecret };