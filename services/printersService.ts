import {
  CreatePrinterPayload,
  Printer,
  PrinterListResponse,
  SetDefaultPrinterResponse,
  TestPrintResponse,
  UpdatePrinterPayload,
} from '../types';
import { getPrintJobStatus } from './printQueueService';

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
    const message = payload?.error || `Printers API request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
};

const requestJson = async <T>(path: string, method: string, body?: unknown): Promise<T> => {
  const rawBody = body ? JSON.stringify(body) : '';
  const signedHeaders = await buildSignedHeaders(rawBody);

  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      ...(rawBody ? { 'content-type': 'application/json' } : {}),
      ...signedHeaders,
    },
    ...(rawBody ? { body: rawBody } : {}),
  });

  return parseResponse<T>(response);
};

export const listPrinters = async (): Promise<PrinterListResponse> => requestJson('/api/printers', 'GET');

export const createPrinter = async (payload: CreatePrinterPayload): Promise<{ printer: Printer }> =>
  requestJson('/api/printers', 'POST', payload);

export const updatePrinter = async (printerId: string, payload: UpdatePrinterPayload): Promise<{ printer: Printer }> =>
  requestJson(`/api/printers/${encodeURIComponent(printerId)}`, 'PATCH', payload);

export const setDefaultPrinter = async (printerId: string): Promise<SetDefaultPrinterResponse> =>
  requestJson(`/api/printers/${encodeURIComponent(printerId)}/default`, 'POST', {});

export const sendPrinterTest = async (printerId: string): Promise<TestPrintResponse> =>
  requestJson(`/api/printers/${encodeURIComponent(printerId)}/test`, 'POST', { source: PRINT_SOURCE });

export const waitForPrinterTestCompletion = async (
  jobId: string,
  {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxAttempts = DEFAULT_POLL_ATTEMPTS,
  }: { pollIntervalMs?: number; maxAttempts?: number } = {}
) => {
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

  throw new Error('Timed out while waiting for test print completion.');
};
