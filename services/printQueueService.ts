import { buildPrintIdempotencyKey } from './labelZpl.js';
import { CreatePrintJobRequest, CreatePrintJobResponse, PrintJobStatusResponse } from '../types';

const envSource: Record<string, string | undefined> = {
  ...(((typeof import.meta !== 'undefined' && (import.meta as any).env) || {}) as Record<string, string | undefined>),
  ...(((typeof process !== 'undefined' && (process as any).env) || {}) as Record<string, string | undefined>),
};

const readEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = envSource[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const PRINT_API_BASE_URL = readEnv('VITE_PRINT_API_BASE_URL');
const PRINT_API_SHARED_SECRET = readEnv('VITE_PRINT_API_SHARED_SECRET');
const PRINT_SOURCE = readEnv('VITE_PRINT_SOURCE') || 'web';
const DEFAULT_PRINTER_ID = readEnv('VITE_PRINT_DEFAULT_PRINTER_ID') || 'default-zebra';
const DEFAULT_POLL_INTERVAL_MS = Number(readEnv('VITE_PRINT_STATUS_POLL_MS')) || 2000;
const DEFAULT_POLL_ATTEMPTS = Number(readEnv('VITE_PRINT_STATUS_MAX_ATTEMPTS')) || 30;

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const createSignature = async (timestamp: string, rawBody: string): Promise<string> => {
  if (!PRINT_API_SHARED_SECRET) return '';
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto is required for signed print requests.');
  }

  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(PRINT_API_SHARED_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = `${timestamp}.${rawBody}`;
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toHex(signature);
};

const buildSignedHeaders = async (rawBody: string): Promise<Record<string, string>> => {
  if (!PRINT_API_SHARED_SECRET) return {};
  const timestamp = String(Date.now());
  const signature = await createSignature(timestamp, rawBody);

  return {
    'x-print-ts': timestamp,
    'x-print-signature': signature,
  };
};

const buildApiUrl = (path: string) => {
  if (!PRINT_API_BASE_URL) return path;
  return `${PRINT_API_BASE_URL.replace(/\/$/, '')}${path}`;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = payload?.error || `Print API request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
};

export const enqueuePrintJob = async (input: CreatePrintJobRequest): Promise<CreatePrintJobResponse> => {
  const payload = {
    printerId: input.printerId || DEFAULT_PRINTER_ID,
    orderId: input.orderId,
    idempotencyKey: input.idempotencyKey,
    source: input.source || PRINT_SOURCE,
    label: {
      displayId: input.label.displayId,
      clientName: input.label.clientName,
      itemType: input.label.itemType,
    },
  };

  const rawBody = JSON.stringify(payload);
  const signedHeaders = await buildSignedHeaders(rawBody);

  const response = await fetch(buildApiUrl('/api/print-jobs'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...signedHeaders,
    },
    body: rawBody,
  });

  return parseResponse<CreatePrintJobResponse>(response);
};

export const getPrintJobStatus = async (jobId: string): Promise<PrintJobStatusResponse> => {
  const signedHeaders = await buildSignedHeaders('');

  const response = await fetch(buildApiUrl(`/api/print-jobs/${encodeURIComponent(jobId)}`), {
    method: 'GET',
    headers: {
      ...signedHeaders,
    },
  });

  return parseResponse<PrintJobStatusResponse>(response);
};

export const waitForPrintCompletion = async (
  jobId: string,
  {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxAttempts = DEFAULT_POLL_ATTEMPTS,
  }: { pollIntervalMs?: number; maxAttempts?: number } = {}
): Promise<PrintJobStatusResponse> => {
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts += 1;
    const status = await getPrintJobStatus(jobId);

    if (status.status === 'printed' || status.status === 'failed') {
      return status;
    }

    await delay(pollIntervalMs);
  }

  throw new Error('Timed out while waiting for print completion.');
};

export const createLabelPrintIdempotencyKey = ({
  orderId,
  displayId,
  printerId,
}: {
  orderId: string;
  displayId: string;
  printerId?: string;
}): string =>
  buildPrintIdempotencyKey({
    orderId,
    displayId,
    printerId: printerId || DEFAULT_PRINTER_ID,
  });
