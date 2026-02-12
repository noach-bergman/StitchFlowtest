export type LocalAgentPrintCode =
  | 'PRINT_SENT'
  | 'APP_NOT_FOUND'
  | 'AUTOMATION_DENIED'
  | 'PRINT_FAILED';

type LocalAgentErrorCode =
  | 'AGENT_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'INVALID_RESPONSE'
  | 'TIMEOUT'
  | LocalAgentPrintCode;

export class LocalAgentError extends Error {
  code: LocalAgentErrorCode;
  jobId?: string;

  constructor(code: LocalAgentErrorCode, message: string, jobId?: string) {
    super(message);
    this.code = code;
    this.jobId = jobId;
    this.name = 'LocalAgentError';
  }
}

export interface LocalAgentPrintPayload {
  dataUrl: string;
  widthMm?: number;
  heightMm?: number;
  copies?: number;
  jobName?: string;
  labelId?: string;
}

interface LocalAgentHealthResponse {
  status: string;
  version?: string;
  platform?: string;
  permissions?: {
    automation?: boolean;
    accessibility?: boolean;
    niimbotInstalled?: boolean;
  };
}

export interface LocalAgentPrintResponse {
  ok: boolean;
  code: LocalAgentPrintCode;
  message: string;
  jobId: string;
}

const DEFAULT_TIMEOUT_MS = 20000;
const HEALTH_TIMEOUT_MS = 1500;

const getAgentConfig = () => ({
  url: (import.meta.env.VITE_LOCAL_AGENT_URL || 'http://127.0.0.1:9130').trim(),
  token: (import.meta.env.VITE_LOCAL_AGENT_TOKEN || '').trim(),
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
      throw new LocalAgentError('TIMEOUT', 'Local agent request timed out');
    }
    throw new LocalAgentError(
      'AGENT_UNAVAILABLE',
      error?.message || 'Local agent is unreachable',
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
    throw new LocalAgentError(
      'UNAUTHORIZED',
      parsed?.message || parsed?.error || 'Local agent authorization failed',
      parsed?.jobId,
    );
  }

  const responseCode = String(parsed?.code || '');
  if (responseCode === 'APP_NOT_FOUND') {
    throw new LocalAgentError(
      'APP_NOT_FOUND',
      parsed?.message || 'NIIMBOT application not found',
      parsed?.jobId,
    );
  }
  if (responseCode === 'AUTOMATION_DENIED') {
    throw new LocalAgentError(
      'AUTOMATION_DENIED',
      parsed?.message || 'macOS automation permission denied',
      parsed?.jobId,
    );
  }

  throw new LocalAgentError(
    'PRINT_FAILED',
    parsed?.message || parsed?.error || `Local agent returned ${response.status}`,
    parsed?.jobId,
  );
};

const assertPrintResponse = (value: any): LocalAgentPrintResponse => {
  if (!value || typeof value !== 'object') {
    throw new LocalAgentError('INVALID_RESPONSE', 'Local agent returned empty payload');
  }

  const code = String(value.code || '');
  const isKnownCode =
    code === 'PRINT_SENT' ||
    code === 'APP_NOT_FOUND' ||
    code === 'AUTOMATION_DENIED' ||
    code === 'PRINT_FAILED';
  if (!isKnownCode || typeof value.ok !== 'boolean' || typeof value.message !== 'string') {
    throw new LocalAgentError('INVALID_RESPONSE', 'Local agent response schema mismatch');
  }

  return {
    ok: value.ok,
    code: code as LocalAgentPrintCode,
    message: value.message,
    jobId: String(value.jobId || ''),
  };
};

const requireToken = (token: string) => {
  if (!token) {
    throw new LocalAgentError(
      'UNAUTHORIZED',
      'VITE_LOCAL_AGENT_TOKEN is missing in environment',
    );
  }
};

export const getAgentHealth = async (): Promise<LocalAgentHealthResponse> => {
  const config = getAgentConfig();
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
    throw new LocalAgentError('INVALID_RESPONSE', 'Local agent health schema mismatch');
  }
  return payload;
};

export const isAgentAvailable = async (): Promise<boolean> => {
  try {
    await getAgentHealth();
    return true;
  } catch {
    return false;
  }
};

export const printViaAgent = async (
  payload: LocalAgentPrintPayload,
): Promise<LocalAgentPrintResponse> => {
  const config = getAgentConfig();
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
    throw new LocalAgentError(
      body.code,
      body.message || 'Local agent print failed',
      body.jobId,
    );
  }
  return body;
};

export const normalizeAgentError = (error: unknown) => {
  if (error instanceof LocalAgentError) {
    if (error.code === 'UNAUTHORIZED') {
      return 'Local Agent token לא תקין או חסר.';
    }
    if (error.code === 'AGENT_UNAVAILABLE' || error.code === 'TIMEOUT') {
      return 'Local Agent לא זמין כרגע.';
    }
    if (error.code === 'APP_NOT_FOUND') {
      return 'אפליקציית NIIMBOT לא נמצאה במחשב.';
    }
    if (error.code === 'AUTOMATION_DENIED') {
      return 'חסרה הרשאת Accessibility/Automation ל-Local Agent.';
    }
    return error.message || 'שגיאה בהדפסה דרך Local Agent.';
  }
  return 'שגיאה בהדפסה דרך Local Agent.';
};
