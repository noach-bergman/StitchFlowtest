import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

type ReceiptSourceItem = {
  item: string;
  description: string;
  price: number;
};

type ReceiptGenerationPayload = {
  clientName: string;
  items: ReceiptSourceItem[];
  totalPrice: number;
};

type GeneratedReceiptItem = {
  service: string;
  description: string;
  price: number;
};

type GeneratedReceipt = {
  receiptNumber?: string;
  date?: string;
  billTo: string;
  items: GeneratedReceiptItem[];
  subtotal: number;
  total: number;
  footerMessage?: string;
};

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

const serializeError = (error: unknown) => {
  const candidate = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    code?: unknown;
    type?: unknown;
  };

  return {
    name: typeof candidate?.name === 'string' ? candidate.name : 'Error',
    message: typeof candidate?.message === 'string' ? candidate.message : String(error),
    status: typeof candidate?.status === 'number' ? candidate.status : undefined,
    code: typeof candidate?.code === 'string' ? candidate.code : undefined,
    type: typeof candidate?.type === 'string' ? candidate.type : undefined,
  };
};

const writeLog = (
  level: 'info' | 'error',
  event: string,
  requestId: string,
  details: Record<string, unknown> = {},
) => {
  const entry = JSON.stringify({
    scope: 'receipt_generation',
    level,
    event,
    requestId,
    ...details,
  });

  if (level === 'error') {
    console.error(entry);
    return;
  }

  console.log(entry);
};

const clipText = (text: string, maxLength = 240) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const isReceiptSourceItem = (value: unknown): value is ReceiptSourceItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.item === 'string' &&
    typeof item.description === 'string' &&
    typeof item.price === 'number' &&
    Number.isFinite(item.price)
  );
};

const isReceiptGenerationPayload = (value: unknown): value is ReceiptGenerationPayload => {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.clientName === 'string' &&
    Array.isArray(payload.items) &&
    payload.items.every(isReceiptSourceItem) &&
    typeof payload.totalPrice === 'number' &&
    Number.isFinite(payload.totalPrice)
  );
};

const isGeneratedReceiptItem = (value: unknown): value is GeneratedReceiptItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.service === 'string' &&
    typeof item.description === 'string' &&
    typeof item.price === 'number' &&
    Number.isFinite(item.price)
  );
};

const isGeneratedReceipt = (value: unknown): value is GeneratedReceipt => {
  if (!value || typeof value !== 'object') return false;

  const receipt = value as Record<string, unknown>;
  return (
    typeof receipt.billTo === 'string' &&
    Array.isArray(receipt.items) &&
    receipt.items.every(isGeneratedReceiptItem) &&
    typeof receipt.subtotal === 'number' &&
    Number.isFinite(receipt.subtotal) &&
    typeof receipt.total === 'number' &&
    Number.isFinite(receipt.total) &&
    (receipt.receiptNumber === undefined || typeof receipt.receiptNumber === 'string') &&
    (receipt.date === undefined || typeof receipt.date === 'string') &&
    (receipt.footerMessage === undefined || typeof receipt.footerMessage === 'string')
  );
};

const parseGeneratedReceipt = (text: string): GeneratedReceipt => {
  const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanText) as unknown;

  if (!isGeneratedReceipt(parsed)) {
    throw new Error('OpenAI response did not match expected receipt schema');
  }

  return parsed;
};

const summarizePayload = (payload: ReceiptGenerationPayload) => ({
  clientName: payload.clientName,
  itemCount: payload.items.length,
  totalPrice: payload.totalPrice,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = createRequestId();

  if (req.method !== 'POST') {
    writeLog('error', 'receipt_generation_invalid_method', requestId, {
      method: req.method ?? 'UNKNOWN',
    });
    return res.status(405).json({ error: 'Method Not Allowed', requestId });
  }

  if (!isReceiptGenerationPayload(req.body)) {
    writeLog('error', 'receipt_generation_invalid_payload', requestId, {
      bodyType: typeof req.body,
    });
    return res.status(400).json({ error: 'Invalid receipt generation payload.', requestId });
  }

  const { clientName, items, totalPrice } = req.body;
  const payloadSummary = summarizePayload(req.body);

  const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    writeLog('error', 'receipt_generation_missing_api_key', requestId, payloadSummary);
    return res.status(500).json({ error: 'Missing OpenAI API key on server.', requestId });
  }

  const client = new OpenAI({ apiKey });

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  try {
    writeLog('info', 'receipt_generation_started', requestId, payloadSummary);

    const response = await client.chat.completions.create({
      model: 'gpt-5-nano-2025-08-07',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a professional fashion atelier assistant. Return only valid JSON and nothing else.',
        },
        {
          role: 'user',
          content: `Task: Create a professional invoice/receipt in ENGLISH based on the provided data.

STRICT RULES:
1. Output ONLY a valid JSON object.
2. The output MUST be in English.
3. In the "service" field, translate the item name to professional English. Keep it direct and accurate to the original input (e.g., "Dress", "Trousers", "Skirt"). Do not over-embellish or use fancy abstract terms.
4. In the "description" field, translate the specific work details to concise, professional English. Keep it strictly based on the original input text, just polished (e.g., "Shorten hem", "Waist reduction").
5. The "footerMessage" should be a classy thank you note.
6. Use the provided date EXACTLY.

Required JSON shape:
{
  "receiptNumber": "string",
  "date": "string",
  "billTo": "string",
  "items": [{ "service": "string", "description": "string", "price": number }],
  "subtotal": number,
  "total": number,
  "footerMessage": "string"
}

Data:
Current Date: ${today}
Client Name (Hebrew source): ${clientName}
Items: ${JSON.stringify(items)}
Total: $${totalPrice}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      writeLog('error', 'receipt_generation_empty_openai_response', requestId, payloadSummary);
      return res.status(502).json({ error: 'Empty response from OpenAI', requestId });
    }

    let receipt: GeneratedReceipt;
    try {
      receipt = parseGeneratedReceipt(text);
    } catch (error) {
      writeLog('error', 'receipt_generation_invalid_openai_json', requestId, {
        ...payloadSummary,
        responsePreview: clipText(text),
        error: serializeError(error),
      });
      return res.status(502).json({ error: 'Invalid JSON returned from OpenAI', requestId });
    }

    writeLog('info', 'receipt_generation_completed', requestId, {
      ...payloadSummary,
      receiptItemCount: receipt.items.length,
      receiptTotal: receipt.total,
    });

    return res.status(200).json({ result: receipt, requestId });
  } catch (error) {
    writeLog('error', 'receipt_generation_failed', requestId, {
      ...payloadSummary,
      error: serializeError(error),
    });
    return res.status(500).json({ error: 'AI generation failed', requestId });
  }
}

export const __testables = {
  isReceiptGenerationPayload,
  isGeneratedReceipt,
  parseGeneratedReceipt,
};
