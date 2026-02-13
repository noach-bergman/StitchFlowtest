import { describe, expect, it } from 'vitest';
import { buildPrintIdempotencyKey, buildZebraLabelZpl, isAsciiOnly } from './labelZpl.js';

describe('buildZebraLabelZpl', () => {
  it('builds valid ZPL with required commands', () => {
    const zpl = buildZebraLabelZpl({
      displayId: 'A-1234',
      clientName: 'Noah',
      itemType: 'Dress',
    });

    expect(zpl.startsWith('^XA')).toBe(true);
    expect(zpl).toContain('^PW400');
    expect(zpl).toContain('^BQN');
    expect(zpl.trim().endsWith('^XZ')).toBe(true);
    expect(isAsciiOnly(zpl)).toBe(true);
  });

  it('strips non-ascii and control characters', () => {
    const zpl = buildZebraLabelZpl({
      displayId: 'תיק-777',
      clientName: 'לקוחה ^ ~ \\',
      itemType: 'חצאית\nפריט',
    });

    expect(isAsciiOnly(zpl)).toBe(true);
    expect(zpl).not.toMatch(/[\u0590-\u05FF]/);
    expect(zpl).not.toContain('^ ~');
  });
});

describe('buildPrintIdempotencyKey', () => {
  it('is deterministic for same inputs', () => {
    const a = buildPrintIdempotencyKey({
      orderId: 'order-1',
      displayId: '1001',
      printerId: 'default-zebra',
    });

    const b = buildPrintIdempotencyKey({
      orderId: 'order-1',
      displayId: '1001',
      printerId: 'default-zebra',
    });

    expect(a).toBe(b);
  });
});
