const isReadable = (value) => value && typeof value.on === 'function';

export const readJsonBody = async (req) => {
  if (req?.body !== undefined) {
    if (typeof req.body === 'string') {
      const raw = req.body;
      return { raw, body: raw ? JSON.parse(raw) : {} };
    }

    if (Buffer.isBuffer(req.body)) {
      const raw = req.body.toString('utf8');
      return { raw, body: raw ? JSON.parse(raw) : {} };
    }

    if (typeof req.body === 'object' && req.body !== null) {
      return { raw: JSON.stringify(req.body), body: req.body };
    }
  }

  if (!isReadable(req)) {
    return { raw: '', body: {} };
  }

  const raw = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

  return { raw, body: raw ? JSON.parse(raw) : {} };
};

export const sendJson = (res, statusCode, payload, extraHeaders = {}) => {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    Object.entries(extraHeaders || {}).forEach(([key, value]) => {
      if (typeof res.setHeader === 'function') {
        res.setHeader(key, value);
      }
    });
    return res.status(statusCode).json(payload);
  }

  const body = JSON.stringify(payload);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    ...extraHeaders,
  };

  if (typeof res.writeHead === 'function') {
    res.writeHead(statusCode, headers);
    res.end(body);
    return;
  }

  if (typeof res.setHeader === 'function') {
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  }

  res.statusCode = statusCode;
  res.end(body);
};

export const methodNotAllowed = (res, allowedMethods) =>
  sendJson(res, 405, { error: 'Method not allowed', allowedMethods }, { Allow: allowedMethods.join(', ') });
