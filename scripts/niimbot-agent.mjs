#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const HOST = '127.0.0.1';
const PORT = Number(process.env.NIIMBOT_AGENT_PORT || 9130);
const APP_NAME = process.env.NIIMBOT_APP_NAME || 'NIIMBOT';
const AGENT_TOKEN = (process.env.NIIMBOT_AGENT_TOKEN || '').trim();
const TEMP_DIR = process.env.NIIMBOT_TEMP_DIR || '/tmp/stitchflow-labels';
const DEDUP_WINDOW_MS = Number(process.env.NIIMBOT_DEDUP_WINDOW_MS || 45000);
const AUTOMATION_TIMEOUT_MS = Number(process.env.NIIMBOT_AUTOMATION_TIMEOUT_MS || 20000);
const SCRIPT_PATH = process.env.NIIMBOT_PRINT_SCRIPT || path.resolve(process.cwd(), 'scripts/niimbot-print.applescript');
const ALLOWED_ORIGINS = (process.env.NIIMBOT_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!AGENT_TOKEN) {
  console.error('[niimbot-agent] NIIMBOT_AGENT_TOKEN is required.');
  process.exit(1);
}

const recentLabels = new Map();

const sendJson = (res, statusCode, payload) => {
  const data = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
};

const applyCors = (req, res) => {
  const requestOrigin = req.headers.origin;
  if (!requestOrigin) return;
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
};

const isAuthorized = (req) => {
  const expected = `Bearer ${AGENT_TOKEN}`;
  return req.headers.authorization === expected;
};

const parseJsonBody = async (req) =>
  await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024 * 2) {
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

const safeExec = async (cmd, args, timeoutMs = 8000) => {
  return await execFileAsync(cmd, args, {
    timeout: timeoutMs,
    encoding: 'utf8',
  });
};

const classifyErrorCode = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (
    normalized.includes('not authorized') ||
    normalized.includes('assistive access') ||
    normalized.includes('automation') ||
    normalized.includes('(-1743)')
  ) {
    return 'AUTOMATION_DENIED';
  }
  if (
    normalized.includes('app not found') ||
    normalized.includes('unable to find application') ||
    normalized.includes('not found')
  ) {
    return 'APP_NOT_FOUND';
  }
  return 'PRINT_FAILED';
};

const cleanupRecentLabels = () => {
  const now = Date.now();
  for (const [key, timestamp] of recentLabels.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      recentLabels.delete(key);
    }
  }
};

const isDuplicateLabel = (labelId) => {
  if (!labelId) return false;
  cleanupRecentLabels();
  const prev = recentLabels.get(labelId);
  if (prev && Date.now() - prev < DEDUP_WINDOW_MS) {
    return true;
  }
  recentLabels.set(labelId, Date.now());
  return false;
};

const toJobId = (labelId) => {
  const normalized = String(labelId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return normalized || crypto.randomUUID();
};

const parseDataUrl = (value) => {
  const dataUrl = String(value || '');
  const commaIndex = dataUrl.indexOf(',');
  const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  if (!payload) {
    throw new Error('Missing dataUrl payload');
  }
  return Buffer.from(payload, 'base64');
};

const checkNiimbotInstalled = async () => {
  try {
    await safeExec('open', ['-Ra', APP_NAME], 5000);
    return true;
  } catch {
    return false;
  }
};

const checkAutomationPermission = async () => {
  try {
    await safeExec('osascript', ['-e', 'tell application "System Events" to count processes'], 5000);
    return true;
  } catch {
    return false;
  }
};

const checkAccessibilityPermission = async () => {
  try {
    await safeExec('osascript', ['-e', 'tell application "System Events" to keystroke ""'], 5000);
    return true;
  } catch {
    return false;
  }
};

const openNiimbotApp = async () => {
  await safeExec('open', ['-a', APP_NAME], 8000);
};

const runPrintScript = async (filePath) => {
  await safeExec('osascript', [SCRIPT_PATH, APP_NAME, filePath], AUTOMATION_TIMEOUT_MS);
};

const healthPayload = async () => {
  const [niimbotInstalled, automation, accessibility] = await Promise.all([
    checkNiimbotInstalled(),
    checkAutomationPermission(),
    checkAccessibilityPermission(),
  ]);

  return {
    status: 'ok',
    version: '1.0.0',
    platform: os.platform(),
    appName: APP_NAME,
    permissions: {
      automation,
      accessibility,
      niimbotInstalled,
    },
  };
};

const handlePrintLabel = async (payload) => {
  const labelId = String(payload.labelId || '').trim();
  const jobId = toJobId(labelId);
  const jobPrefix = `[niimbot-agent][${jobId}]`;

  if (isDuplicateLabel(labelId)) {
    console.log(`${jobPrefix} Duplicate label request ignored`);
    return {
      ok: true,
      code: 'PRINT_SENT',
      message: 'Duplicate label request ignored.',
      jobId,
    };
  }

  const imageBuffer = parseDataUrl(payload.dataUrl);
  await fs.mkdir(TEMP_DIR, { recursive: true });
  const filePath = path.resolve(TEMP_DIR, `${jobId}.png`);
  await fs.writeFile(filePath, imageBuffer);

  const niimbotInstalled = await checkNiimbotInstalled();
  if (!niimbotInstalled) {
    return {
      ok: false,
      code: 'APP_NOT_FOUND',
      message: 'NIIMBOT app is not installed.',
      jobId,
    };
  }

  try {
    console.log(`${jobPrefix} Opening app and sending import+print automation`);
    await openNiimbotApp();
    await runPrintScript(filePath);
    return {
      ok: true,
      code: 'PRINT_SENT',
      message: 'Print command sent via NIIMBOT app.',
      jobId,
    };
  } catch (error) {
    const rawError = error?.stderr || error?.message || String(error);
    const code = classifyErrorCode(rawError);
    const message =
      code === 'AUTOMATION_DENIED'
        ? 'macOS denied Accessibility/Automation permission.'
        : rawError || 'Print automation failed.';
    console.error(`${jobPrefix} ${code}: ${message}`);
    return {
      ok: false,
      code,
      message,
      jobId,
    };
  }
};

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, {
      ok: false,
      code: 'PRINT_FAILED',
      message: 'Unauthorized: invalid bearer token.',
      jobId: '',
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    const health = await healthPayload();
    sendJson(res, 200, health);
    return;
  }

  if (req.method === 'POST' && req.url === '/print-label') {
    try {
      const body = await parseJsonBody(req);
      if (typeof body.dataUrl !== 'string' || !body.dataUrl.trim()) {
        sendJson(res, 400, {
          ok: false,
          code: 'PRINT_FAILED',
          message: 'Missing required field: dataUrl',
          jobId: '',
        });
        return;
      }
      const result = await handlePrintLabel(body);
      sendJson(res, result.ok ? 200 : 500, result);
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        code: 'PRINT_FAILED',
        message: error?.message || 'Invalid print request',
        jobId: '',
      });
    }
    return;
  }

  sendJson(res, 404, {
    ok: false,
    code: 'PRINT_FAILED',
    message: 'Not found',
    jobId: '',
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[niimbot-agent] Listening on http://${HOST}:${PORT}`);
  console.log(`[niimbot-agent] App name: ${APP_NAME}`);
  console.log(`[niimbot-agent] Temp dir: ${TEMP_DIR}`);
  console.log(`[niimbot-agent] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
