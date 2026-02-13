import { SupabasePrintQueueStore } from '../../../server/printQueueStore.js';
import { createPrinterTestJob, readSourceFromBody, resolvePrinterIdFromRequest } from '../../../server/printersHandlers.js';
import { checkRateLimit, verifySignedBody } from '../../../server/printApiSecurity.js';
import { methodNotAllowed, readJsonBody, sendJson } from '../../../server/httpUtils.js';

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

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const secret = process.env.PRINT_API_SHARED_SECRET || '';
  if (!secret) {
    return sendJson(res, 500, { error: 'Print API secret is not configured' }, withCommonHeaders(rate.headers));
  }

  try {
    const { raw, body } = await readJsonBody(req);
    const signatureCheck = verifySignedBody({
      secret,
      timestamp: getHeader(req, 'x-print-ts'),
      signature: getHeader(req, 'x-print-signature'),
      rawBody: raw,
    });

    if (!signatureCheck.ok) {
      return sendJson(res, signatureCheck.status || 401, { error: signatureCheck.error }, withCommonHeaders(rate.headers));
    }

    const source = readSourceFromBody(body);
    const printerId = resolvePrinterIdFromRequest(req);
    const queueStore = SupabasePrintQueueStore.fromEnv();

    const result = await createPrinterTestJob({
      queueStore,
      printerId,
      createdBy: getHeader(req, 'x-print-user') || 'admin-ui',
      source,
    });

    return sendJson(res, 200, { jobId: result.jobId, status: result.status }, withCommonHeaders(rate.headers));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error && typeof error === 'object' ? error.code : undefined;

    if (code === 'printer_not_found' || code === 'printer_unavailable') {
      return sendJson(res, 404, { error: message }, withCommonHeaders(rate.headers));
    }

    return sendJson(res, 400, { error: message }, withCommonHeaders(rate.headers));
  }
}
