#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const PORT = Number(process.env.QZ_SIGNER_PORT || 9123);
const CERT_PATH = process.env.QZ_CERT_PATH || path.resolve(process.cwd(), 'qz/certificate.pem');
const KEY_PATH = process.env.QZ_PRIVATE_KEY_PATH || path.resolve(process.cwd(), 'qz/private-key.pem');
const HASH_ALGORITHM = (process.env.QZ_SIGNER_HASH || 'sha512').toLowerCase();
const ALLOWED_ORIGINS = (process.env.QZ_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const readPem = async (filePath) => {
  const value = await fs.readFile(filePath, 'utf8');
  if (!value.trim()) {
    throw new Error(`Empty PEM file: ${filePath}`);
  }
  return value;
};

const sendJson = (res, statusCode, payload) => {
  const data = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
};

const sendText = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

const applyCors = (req, res) => {
  const requestOrigin = req.headers.origin;
  if (!requestOrigin) return;
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
};

const parseJsonBody = async (req) =>
  await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

let certificate = '';
let privateKey = '';

try {
  certificate = await readPem(CERT_PATH);
  privateKey = await readPem(KEY_PATH);
} catch (error) {
  console.error('[qz-signer] Failed loading cert/key:', error.message);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      algorithm: HASH_ALGORITHM,
      certificatePath: CERT_PATH,
      keyPath: KEY_PATH,
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/qz/cert') {
    sendText(res, 200, certificate);
    return;
  }

  if (req.method === 'POST' && req.url === '/qz/sign') {
    try {
      const body = await parseJsonBody(req);
      const dataToSign = typeof body.data === 'string' ? body.data : '';
      if (!dataToSign) {
        sendJson(res, 400, { error: 'Missing "data" in request body' });
        return;
      }

      const signer = crypto.createSign(HASH_ALGORITHM);
      signer.update(dataToSign, 'utf8');
      signer.end();
      const signature = signer.sign(privateKey, 'base64');
      sendText(res, 200, signature);
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Signing request failed' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[qz-signer] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[qz-signer] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`[qz-signer] Using ${HASH_ALGORITHM.toUpperCase()} signatures`);
});
