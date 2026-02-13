import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignedBody } from '../server/printApiSecurity.js';

describe('verifySignedBody', () => {
  it('rejects missing signature headers', () => {
    const result = verifySignedBody({
      secret: 'test-secret',
      timestamp: '',
      signature: '',
      rawBody: '{}',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it('accepts valid hmac signature', () => {
    const secret = 'test-secret';
    const rawBody = '{"printerId":"default-zebra"}';
    const timestamp = String(Date.now());
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const result = verifySignedBody({
      secret,
      timestamp,
      signature,
      rawBody,
    });

    expect(result.ok).toBe(true);
  });

  it('rejects invalid signature', () => {
    const result = verifySignedBody({
      secret: 'test-secret',
      timestamp: String(Date.now()),
      signature: 'deadbeef',
      rawBody: '{}',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });
});
