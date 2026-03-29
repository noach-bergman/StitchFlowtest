import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __testables, generateProfessionalReceipt, ReceiptGenerationError } from './openaiReceipt';

describe('openaiReceipt', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('extracts JSON when wrapped in markdown code block', () => {
    const parsed = __testables.extractJson(
      '```json\n{"billTo":"Client","items":[],"subtotal":100,"total":100}\n```',
    );
    expect(parsed.billTo).toBe('Client');
    expect(parsed.total).toBe(100);
  });

  it('accepts a parsed receipt object from the server', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: {
            receiptNumber: 'R-1',
            date: 'January 1, 2026',
            billTo: 'Dana',
            items: [{ service: 'Dress', description: 'Shorten hem', price: 120 }],
            subtotal: 120,
            total: 120,
            footerMessage: 'Thank you',
          },
          requestId: 'req12345',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await generateProfessionalReceipt(
      'דנה',
      [{ item: 'שמלה', description: 'קיצור אורך', price: 120 }],
      120,
    );

    expect(result.billTo).toBe('Dana');
    expect(result.items[0].service).toBe('Dress');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/generate-receipt',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('supports older string-based server responses for backward compatibility', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result:
            '{"receiptNumber":"R-1","date":"January 1, 2026","billTo":"Dana","items":[{"service":"Dress","description":"Shorten hem","price":120}],"subtotal":120,"total":120,"footerMessage":"Thank you"}',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await generateProfessionalReceipt(
      'דנה',
      [{ item: 'שמלה', description: 'קיצור אורך', price: 120 }],
      120,
    );

    expect(result.billTo).toBe('Dana');
    expect(result.items[0].service).toBe('Dress');
  });

  it('throws request id details on non-ok responses', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'AI generation failed',
          requestId: 'req-failed',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(generateProfessionalReceipt('לקוחה', [], 0)).rejects.toMatchObject({
      name: 'ReceiptGenerationError',
      message: 'AI generation failed',
      requestId: 'req-failed',
      status: 500,
    } satisfies Partial<ReceiptGenerationError>);
  });

  it('throws on invalid successful payloads', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: {
            billTo: 'Dana',
            items: 'wrong',
            subtotal: 120,
            total: 120,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(generateProfessionalReceipt('לקוחה', [], 0)).rejects.toBeInstanceOf(
      ReceiptGenerationError,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });
});
