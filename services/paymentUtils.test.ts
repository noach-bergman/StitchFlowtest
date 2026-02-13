import { describe, expect, it } from 'vitest';
import { getPaymentStatus, getRemaining, normalizePaidAmount } from './paymentUtils';

describe('paymentUtils', () => {
  it('marks unpaid when paid is 0 out of total 100', () => {
    expect(getPaymentStatus(100, 0)).toBe('לא שולם');
  });

  it('marks partially paid when paid is between 0 and total', () => {
    expect(getPaymentStatus(100, 30)).toBe('שולם חלקית');
  });

  it('marks paid when paid equals total', () => {
    expect(getPaymentStatus(100, 100)).toBe('שולם');
  });

  it('marks paid and zero remaining when paid exceeds total', () => {
    expect(getPaymentStatus(100, 140)).toBe('שולם');
    expect(getRemaining(100, 140)).toBe(0);
  });

  it('normalizes negative paid amounts to zero', () => {
    expect(normalizePaidAmount({ paidAmount: -50, isPaid: false })).toBe(0);
  });
});
