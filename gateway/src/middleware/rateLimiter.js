const logger = require('../utils/logger');
const { getConfig } = require('../config/configLoader');
const { findMatchingRoute } = require('../utils/routeMatcher');

class SlidingWindowRateLimiter {
  constructor(windowMs, max) {
    this.windowMs = windowMs;
    this.max = max;
    this.timestamps = new Map();
  }

  hit(key) {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let list = this.timestamps.get(key);
    if (list) {
      list = list.filter((t) => t > cutoff);
    } else {
      list = [];
    }
    list.push(now);
    this.timestamps.set(key, list);

    if (list.length > this.max) {
      const oldest = list[0];
      const nextAllowed = oldest + this.windowMs;
      return { allowed: false, retryAfterMs: Math.max(nextAllowed - now, 0) };
    }
    return { allowed: true, retryAfterMs: 0 };
  }
}

function clientIp(req) {
  if (req.ip === '::1') return '127.0.0.1';
  return req.ip;
}

function rateLimitMiddleware() {
  const limiters = new Map();

  function limiterFor(opts) {
    const key = `${opts.windowMs}-${opts.max}`;
    if (!limiters.has(key)) {
      limiters.set(key, new SlidingWindowRateLimiter(opts.windowMs, opts.max));
    }
    return limiters.get(key);
  }

  return (req, res, next) => {
    if (req.path.startsWith('/health') || req.path.startsWith('/gateway/')) return next();

    const config = getConfig();
    if (!config) return next();

    const route = findMatchingRoute(config.routes, req.path);
    const opts = (route && route.rateLimit) || config.rateLimit || { windowMs: 60000, max: 100 };

    const limiter = limiterFor(opts);
    const ip = clientIp(req);
    const result = limiter.hit(ip);

    res.setHeader('X-RateLimit-Limit', opts.max);

    if (result.allowed) return next();

    const retryAfter = Math.ceil(result.retryAfterMs / 1000);
    logger.warn('Rate limit exceeded', { ip, path: req.originalUrl });
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many requests', retryAfter });
  };
}

module.exports = rateLimitMiddleware;