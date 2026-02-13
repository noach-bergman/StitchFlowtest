import { SupabasePrintQueueStore } from '../../server/printQueueStore.js';
import { readPrintJobStatus } from '../../server/printQueueHandlers.js';
import { checkRateLimit, verifySignedBody } from '../../server/printApiSecurity.js';
import { methodNotAllowed, sendJson } from '../../server/httpUtils.js';

const getHeader = (req, name) => {
  const target = name.toLowerCase();
  const headers = req?.headers || {};
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      const value = headers[key];
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
};

const extractJobId = (req) => {
  if (req?.query?.jobId) {
    return String(req.query.jobId);
  }

  const url = req?.url || '';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
};

const withCommonHeaders = (headers = {}) => ({
  'Cache-Control': 'no-store',
  ...headers,
});

export default async function handler(req, res) {
  const rate = checkRateLimit(req);
  if (!rate.allowed) {
    return sendJson(res, rate.status, rate.body, withCommonHeaders(rate.headers));
  }

  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true }, withCommonHeaders(rate.headers));
  }

  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const secret = process.env.PRINT_API_SHARED_SECRET || '';
  if (!secret) {
    return sendJson(res, 500, { error: 'Print API secret is not configured' }, withCommonHeaders(rate.headers));
  }

  const signatureCheck = verifySignedBody({
    secret,
    timestamp: getHeader(req, 'x-print-ts'),
    signature: getHeader(req, 'x-print-signature'),
    rawBody: '',
  });

  if (!signatureCheck.ok) {
    return sendJson(res, signatureCheck.status || 401, { error: signatureCheck.error }, withCommonHeaders(rate.headers));
  }

  try {
    const jobId = extractJobId(req);
    const store = SupabasePrintQueueStore.fromEnv();
    const status = await readPrintJobStatus({ store, jobId });

    if (!status) {
      return sendJson(res, 404, { error: 'Print job not found' }, withCommonHeaders(rate.headers));
    }

    return sendJson(res, 200, status, withCommonHeaders(rate.headers));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendJson(res, 400, { error: message }, withCommonHeaders(rate.headers));
  }
}
