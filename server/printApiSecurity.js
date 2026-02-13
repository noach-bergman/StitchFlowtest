import { createHmac, timingSafeEqual } from 'node:crypto';

const rateBuckets = new Map();

const cleanupBuckets = (nowMs) => {
  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.resetAt <= nowMs) {
      rateBuckets.delete(key);
    }
  }
};

const toHexBuffer = (hex) => {
  try {
    return Buffer.from((hex || '').toLowerCase(), 'hex');
  } catch {
    return null;
  }
};

export const readClientIp = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for'] || req?.headers?.['X-Forwarded-For'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req?.socket?.remoteAddress || req?.ip || 'unknown';
};

export const checkRateLimit = (req, { windowMs = 60_000, maxRequests = 90 } = {}) => {
  const nowMs = Date.now();
  cleanupBuckets(nowMs);

  const ip = readClientIp(req);
  const key = `print-api:${ip}`;
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= nowMs) {
    const resetAt = nowMs + windowMs;
    rateBuckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': String(Math.max(0, maxRequests - 1)),
        'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
      },
    };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      status: 429,
      body: { error: 'Rate limit exceeded' },
      headers: {
        'Retry-After': String(Math.ceil((current.resetAt - nowMs) / 1000)),
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(current.resetAt / 1000)),
      },
    };
  }

  current.count += 1;
  return {
    allowed: true,
    headers: {
      'X-RateLimit-Limit': String(maxRequests),
      'X-RateLimit-Remaining': String(Math.max(0, maxRequests - current.count)),
      'X-RateLimit-Reset': String(Math.floor(current.resetAt / 1000)),
    },
  };
};

export const verifySignedBody = ({ secret, timestamp, signature, rawBody, maxSkewMs = 5 * 60_000 }) => {
  if (!secret) {
    return { ok: false, status: 500, error: 'PRINT_API_SHARED_SECRET is missing' };
  }

  if (!timestamp || !signature) {
    return { ok: false, status: 401, error: 'Missing signature headers' };
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, status: 401, error: 'Invalid signature timestamp' };
  }

  if (Math.abs(Date.now() - timestampMs) > maxSkewMs) {
    return { ok: false, status: 401, error: 'Signature timestamp expired' };
  }

  const payload = `${timestamp}.${rawBody || ''}`;
  const expectedHex = createHmac('sha256', secret).update(payload).digest('hex');

  const providedBuffer = toHexBuffer(signature);
  const expectedBuffer = toHexBuffer(expectedHex);

  if (!providedBuffer || !expectedBuffer || providedBuffer.length !== expectedBuffer.length) {
    return { ok: false, status: 403, error: 'Invalid signature' };
  }

  const valid = timingSafeEqual(providedBuffer, expectedBuffer);
  return valid ? { ok: true } : { ok: false, status: 403, error: 'Invalid signature' };
};
