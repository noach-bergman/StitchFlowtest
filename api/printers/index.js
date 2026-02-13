import { SupabasePrintersStore } from '../../server/printersStore.js';
import { createOrUpdatePrinter, listPrintersWithDefault } from '../../server/printersHandlers.js';
import { checkRateLimit, verifySignedBody } from '../../server/printApiSecurity.js';
import { methodNotAllowed, readJsonBody, sendJson } from '../../server/httpUtils.js';

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

  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const secret = process.env.PRINT_API_SHARED_SECRET || '';
  if (!secret) {
    return sendJson(res, 500, { error: 'Print API secret is not configured' }, withCommonHeaders(rate.headers));
  }

  try {
    const store = SupabasePrintersStore.fromEnv();

    if (req.method === 'GET') {
      const signatureCheck = verifySignedBody({
        secret,
        timestamp: getHeader(req, 'x-print-ts'),
        signature: getHeader(req, 'x-print-signature'),
        rawBody: '',
      });

      if (!signatureCheck.ok) {
        return sendJson(res, signatureCheck.status || 401, { error: signatureCheck.error }, withCommonHeaders(rate.headers));
      }

      const data = await listPrintersWithDefault({ store });
      return sendJson(res, 200, data, withCommonHeaders(rate.headers));
    }

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

    const result = await createOrUpdatePrinter({
      store,
      input: body,
    });

    return sendJson(res, 200, result, withCommonHeaders(rate.headers));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendJson(res, 400, { error: message }, withCommonHeaders(rate.headers));
  }
}
