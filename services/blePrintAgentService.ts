export type BleAgentPrintCode =
  | 'PRINT_SENT'
  | 'PAIR_REQUIRED'
  | 'DEVICE_NOT_FOUND'
  | 'BLE_UNAVAILABLE'
  | 'PRINT_FAILED';

type BleAgentErrorCode =
  | 'BLE_AGENT_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'INVALID_RESPONSE'
  | 'TIMEOUT'
  | BleAgentPrintCode;

export class BleAgentError extends Error {
  code: BleAgentErrorCode;
  jobId?: string;

  constructor(code: BleAgentErrorCode, message: string, jobId?: string) {
    super(message);
    this.code = code;
    this.jobId = jobId;
    this.name = 'BleAgentError';
  }
}

export interface BlePrintPayload {
  labelId: string;
  displayId: string;
  clientName: string;
  itemType: string;
  widthMm?: number;
  heightMm?: number;
  copies?: number;
}

export interface BleHealthResponse {
  status: string;
  version?: string;
  platform?: string;
  bluetooth?: string;
  pairedPrinter?: {
    deviceId: string;
    deviceName: string;
    model: string;
    updatedAt: string;
  } | null;
}

export interface BlePairResponse {
  ok: boolean;
  code: BleAgentPrintCode;
  message: string;
  jobId: string;
  printer?: {
    deviceId: string;
    deviceName: string;
    model: string;
  };
}

export interface BlePrintResponse {
  ok: boolean;
  code: BleAgentPrintCode;
  message: string;
  jobId: string;
}

const DEFAULT_TIMEOUT_MS = 20000;
const HEALTH_TIMEOUT_MS = 1500;

const getBleConfig = () => ({
  url: (import.meta.env.VITE_BLE_AGENT_URL || 'http://127.0.0.1:9131').trim(),
  token: (import.meta.env.VITE_BLE_AGENT_TOKEN || '').trim(),
});

const buildUrl = (baseUrl: string, path: string) => {
  const base = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

const buildHeaders = (token: string, contentType = false): HeadersInit => {
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const withTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new BleAgentError('TIMEOUT', 'BLE agent request timed out');
    }
    throw new BleAgentError(
      'BLE_AGENT_UNAVAILABLE',
      error?.message || 'BLE agent is unreachable',
    );
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeApiFailure = async (response: Response) => {
  const text = await response.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }

  if (response.status === 401 || response.status === 403) {
    throw new BleAgentError(
      'UNAUTHORIZED',
      parsed?.message || parsed?.error || 'BLE agent authorization failed',
      parsed?.jobId,
    );
  }

  const code = String(parsed?.code || '');
  if (
    code === 'PAIR_REQUIRED' ||
    code === 'DEVICE_NOT_FOUND' ||
    code === 'BLE_UNAVAILABLE' ||
    code === 'PRINT_FAILED'
  ) {
    throw new BleAgentError(
      code as BleAgentPrintCode,
      parsed?.message || `BLE agent returned ${code}`,
      parsed?.jobId,
    );
  }

  throw new BleAgentError(
    'PRINT_FAILED',
    parsed?.message || parsed?.error || `BLE agent returned ${response.status}`,
    parsed?.jobId,
  );
};

const assertPrintResponse = (value: any): BlePrintResponse => {
  if (!value || typeof value !== 'object') {
    throw new BleAgentError('INVALID_RESPONSE', 'BLE agent returned empty payload');
  }

  const code = String(value.code || '');
  const isKnown =
    code === 'PRINT_SENT' ||
    code === 'PAIR_REQUIRED' ||
    code === 'DEVICE_NOT_FOUND' ||
    code === 'BLE_UNAVAILABLE' ||
    code === 'PRINT_FAILED';

  if (!isKnown || typeof value.ok !== 'boolean' || typeof value.message !== 'string') {
    throw new BleAgentError('INVALID_RESPONSE', 'BLE agent response schema mismatch');
  }

  return {
    ok: value.ok,
    code: code as BleAgentPrintCode,
    message: value.message,
    jobId: String(value.jobId || ''),
  };
};

const assertPairResponse = (value: any): BlePairResponse => {
  const parsed = assertPrintResponse(value);
  return {
    ...parsed,
    printer:
      value?.printer && typeof value.printer === 'object'
        ? {
            deviceId: String(value.printer.deviceId || ''),
            deviceName: String(value.printer.deviceName || ''),
            model: String(value.printer.model || ''),
          }
        : undefined,
  };
};

const requireToken = (token: string) => {
  if (!token) {
    throw new BleAgentError(
      'UNAUTHORIZED',
      'VITE_BLE_AGENT_TOKEN is missing in environment',
    );
  }
};

export const getBleAgentHealth = async (): Promise<BleHealthResponse> => {
  const config = getBleConfig();
  requireToken(config.token);

  const response = await withTimeout(
    buildUrl(config.url, '/health'),
    {
      method: 'GET',
      headers: buildHeaders(config.token, false),
      cache: 'no-store',
    },
    HEALTH_TIMEOUT_MS,
  );

  if (!response.ok) {
    await normalizeApiFailure(response);
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.status !== 'ok') {
    throw new BleAgentError('INVALID_RESPONSE', 'BLE agent health schema mismatch');
  }

  return payload;
};

export const isBleAgentAvailable = async (): Promise<boolean> => {
  try {
    await getBleAgentHealth();
    return true;
  } catch {
    return false;
  }
};

export const pairBlePrinter = async (): Promise<BlePairResponse> => {
  const config = getBleConfig();
  requireToken(config.token);

  const response = await withTimeout(
    buildUrl(config.url, '/pair'),
    {
      method: 'POST',
      headers: buildHeaders(config.token, true),
      body: JSON.stringify({}),
    },
    DEFAULT_TIMEOUT_MS,
  );

  if (!response.ok) {
    await normalizeApiFailure(response);
  }

  const body = assertPairResponse(await response.json().catch(() => null));
  if (!body.ok) {
    throw new BleAgentError(body.code, body.message || 'BLE pair failed', body.jobId);
  }

  return body;
};

export const printViaBleAgent = async (
  payload: BlePrintPayload,
): Promise<BlePrintResponse> => {
  const config = getBleConfig();
  requireToken(config.token);

  const response = await withTimeout(
    buildUrl(config.url, '/print-label'),
    {
      method: 'POST',
      headers: buildHeaders(config.token, true),
      body: JSON.stringify(payload),
    },
    DEFAULT_TIMEOUT_MS,
  );

  if (!response.ok) {
    await normalizeApiFailure(response);
  }

  const body = assertPrintResponse(await response.json().catch(() => null));
  if (!body.ok) {
    throw new BleAgentError(body.code, body.message || 'BLE print failed', body.jobId);
  }

  return body;
};

export const isPairRequiredError = (error: unknown): boolean =>
  error instanceof BleAgentError && error.code === 'PAIR_REQUIRED';

export const normalizeBleError = (error: unknown) => {
  if (error instanceof BleAgentError) {
    if (error.code === 'UNAUTHORIZED') {
      return 'BLE Agent token לא תקין או חסר.';
    }
    if (error.code === 'BLE_AGENT_UNAVAILABLE' || error.code === 'TIMEOUT') {
      return 'BLE Agent לא זמין כרגע.';
    }
    if (error.code === 'PAIR_REQUIRED') {
      return 'נדרש זיווג למדפסת Bluetooth.';
    }
    if (error.code === 'DEVICE_NOT_FOUND') {
      return 'מדפסת NIIMBOT לא נמצאה דרך Bluetooth.';
    }
    if (error.code === 'BLE_UNAVAILABLE') {
      return 'Bluetooth כבוי או לא זמין במחשב.';
    }
    return error.message || 'שגיאה בהדפסה דרך BLE Agent.';
  }

  return 'שגיאה בהדפסה דרך BLE Agent.';
};
