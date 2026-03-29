type ReceiptSourceItem = {
  item: string;
  description: string;
  price: number;
};

export interface GeneratedReceiptItem {
  service: string;
  description: string;
  price: number;
}

export interface GeneratedReceipt {
  receiptNumber?: string;
  date?: string;
  billTo: string;
  items: GeneratedReceiptItem[];
  subtotal: number;
  total: number;
  footerMessage?: string;
}

type ReceiptApiSuccess = {
  result?: GeneratedReceipt | string;
  requestId?: string;
};

type ReceiptApiFailure = {
  error?: string;
  requestId?: string;
};

export class ReceiptGenerationError extends Error {
  requestId?: string;
  status?: number;

  constructor(message: string, options: { requestId?: string; status?: number } = {}) {
    super(message);
    this.name = 'ReceiptGenerationError';
    this.requestId = options.requestId;
    this.status = options.status;
  }
}

/**
 * Helper to extract JSON from potentially markdown-wrapped string.
 */
const extractJson = (text: string): GeneratedReceipt => {
  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText) as GeneratedReceipt;
  } catch (error) {
    console.error('Failed to parse AI JSON response:', text);
    throw error;
  }
};

const isGeneratedReceipt = (value: unknown): value is GeneratedReceipt => {
  if (!value || typeof value !== 'object') return false;

  const receipt = value as Record<string, unknown>;
  return (
    typeof receipt.billTo === 'string' &&
    Array.isArray(receipt.items) &&
    typeof receipt.subtotal === 'number' &&
    Number.isFinite(receipt.subtotal) &&
    typeof receipt.total === 'number' &&
    Number.isFinite(receipt.total)
  );
};

const readJsonResponse = async (response: Response): Promise<ReceiptApiSuccess | ReceiptApiFailure | null> => {
  try {
    return (await response.json()) as ReceiptApiSuccess | ReceiptApiFailure;
  } catch {
    return null;
  }
};

export const generateProfessionalReceipt = async (
  clientName: string,
  items: ReceiptSourceItem[],
  totalPrice: number,
): Promise<GeneratedReceipt> => {
  try {
    const response = await fetch('/api/generate-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName, items, totalPrice }),
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
      const errorPayload = data as ReceiptApiFailure | null;
      throw new ReceiptGenerationError(
        errorPayload?.error || `Server error: ${response.status}`,
        {
          requestId: errorPayload?.requestId,
          status: response.status,
        },
      );
    }

    const result = (data as ReceiptApiSuccess | null)?.result;
    if (typeof result === 'string') {
      return extractJson(result);
    }

    if (isGeneratedReceipt(result)) {
      return result;
    }

    throw new ReceiptGenerationError('Empty or invalid response from server', {
      requestId: (data as ReceiptApiFailure | null)?.requestId,
      status: response.status,
    });
  } catch (error) {
    console.error('AI Receipt Generation Failed:', error);
    if (error instanceof ReceiptGenerationError) {
      throw error;
    }
    throw new ReceiptGenerationError(
      error instanceof Error ? error.message : 'Receipt generation request failed',
    );
  }
};

export const __testables = {
  extractJson,
  isGeneratedReceipt,
  readJsonResponse,
};
