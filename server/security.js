import crypto from 'crypto';

const RESERVED_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
]);

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:8080',
  'https://localhost:8080',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:8080',
  'https://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
];

let ephemeralDevSecret = null;

/**
 * Parse and validate an explicit list of allowed CORS origins.
 * Wildcards (`*`) are rejected. In production with no configured allowlist,
 * cross-origin browser requests are denied by default.
 */
export function parseAllowedOrigins(rawValue, nodeEnv = process.env.NODE_ENV) {
  const trimmed = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!trimmed) {
    return nodeEnv === 'production' ? [] : [...DEFAULT_DEV_ORIGINS];
  }

  const origins = trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (origins.includes('*')) {
    throw new Error('Wildcard "*" is not permitted in CORS_ALLOWED_ORIGINS.');
  }

  return Array.from(
    new Set(
      origins.map((origin) => {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error(`Unsupported CORS origin protocol: ${parsed.protocol}`);
        }
        return parsed.origin;
      })
    )
  );
}

/**
 * Create a CORS `origin` callback enforcing exact allowlist matching for
 * cross-origin browser requests while allowing same-origin / non-browser requests.
 */
export function createCorsOriginValidator(allowedOrigins) {
  const allowedSet = new Set(allowedOrigins);
  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedSet.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS policy'));
  };
}

/**
 * Resolve the HMAC session secret. Production requires an explicit >=32-char
 * `SESSION_SECRET`; development generates a process-local random secret once.
 */
export function resolveSessionSecret(env = process.env) {
  const configured = typeof env.SESSION_SECRET === 'string' ? env.SESSION_SECRET.trim() : '';
  if (configured) {
    if (configured.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters long.');
    }
    return configured;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable must be set in production.');
  }

  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralDevSecret;
}

/**
 * Validate user identifiers, blocking prototype-pollution keys and unsafe chars.
 */
export function isValidUserId(userId) {
  if (typeof userId !== 'string') return false;
  if (userId.length < 3 || userId.length > 32) return false;
  if (RESERVED_KEYS.has(userId)) return false;
  return /^[a-zA-Z0-9._-]+$/.test(userId);
}

/**
 * Safely look up a user record without walking Object.prototype.
 */
export function readOwnUser(usersMap, userId) {
  if (!usersMap || typeof usersMap !== 'object' || !isValidUserId(userId)) {
    return null;
  }
  return Object.hasOwn(usersMap, userId) ? usersMap[userId] : null;
}

/**
 * Sign a short-lived HMAC-SHA256 bearer token bound to a verified user ID.
 */
export function signAuthToken(userId, secret, ttlMs = 7 * 24 * 60 * 60 * 1000) {
  if (!isValidUserId(userId)) {
    throw new Error('Invalid userId for token signing.');
  }
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iat: now,
      exp: now + ttlMs,
    }),
    'utf8'
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

/**
 * Verify an HMAC-SHA256 bearer token and return its `{ sub, iat, exp }` claims,
 * or `null` when malformed, tampered, or expired.
 */
export function verifyAuthToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || typeof secret !== 'string' || !secret) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadPart, sigPart] = parts;
  if (!payloadPart || !sigPart) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadPart)
    .digest();

  let actualSig;
  try {
    actualSig = Buffer.from(sigPart, 'base64url');
  } catch {
    return null;
  }

  if (actualSig.length !== expectedSig.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (!claims || !isValidUserId(claims.sub)) return null;
    if (typeof claims.exp !== 'number' || claims.exp <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Parse a `Bearer <token>` Authorization header value.
 */
export function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') return null;
  const match = authorizationHeader.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : null;
}

/**
 * Create a lightweight fixed-window rate limiter keyed by client address.
 */
export function createRateLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 30 } = {}) {
  const hits = new Map();

  return (key, now = Date.now()) => {
    const bucketKey = key || 'unknown';
    const current = hits.get(bucketKey);
    if (!current || current.resetAt <= now) {
      hits.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
    }

    if (current.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - current.count),
      resetAt: current.resetAt,
    };
  };
}
