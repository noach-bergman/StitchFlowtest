#!/usr/bin/env node

import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { buildB1PrintPacketBytes, packetDelay } from './lib/niimbotB1Protocol.mjs';

const require = createRequire(import.meta.url);
const nobleModule = require('@abandonware/noble');
const noble = nobleModule.default || nobleModule;

const HOST = '127.0.0.1';
const PORT = Number(process.env.NIIMBOT_BLE_AGENT_PORT || 9131);
const AGENT_TOKEN = (process.env.NIIMBOT_BLE_AGENT_TOKEN || '').trim();
const CACHE_DIR = process.env.NIIMBOT_BLE_CACHE_DIR || path.join(os.homedir(), '.stitchflow');
const CACHE_FILE = process.env.NIIMBOT_BLE_CACHE_FILE || path.join(CACHE_DIR, 'niimbot-ble.json');
const IDEMPOTENCY_WINDOW_MS = Number(process.env.NIIMBOT_BLE_IDEMPOTENCY_MS || 45000);
const SCAN_TIMEOUT_MS = Number(process.env.NIIMBOT_BLE_SCAN_TIMEOUT_MS || 12000);
const PACKET_TIMEOUT_MS = Number(process.env.NIIMBOT_BLE_PACKET_TIMEOUT_MS || 20000);
const ALLOWED_ORIGINS = (process.env.NIIMBOT_BLE_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const B1_SERVICE_UUID = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
const B1_CHARACTERISTIC_UUID = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';

if (!AGENT_TOKEN) {
  console.error('[niimbot-ble-agent] NIIMBOT_BLE_AGENT_TOKEN is required.');
  process.exit(1);
}

const normalizeUuid = (value) => String(value || '').replace(/-/g, '').toLowerCase();
const normalizedServiceUuid = normalizeUuid(B1_SERVICE_UUID);
const normalizedCharUuid = normalizeUuid(B1_CHARACTERISTIC_UUID);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const state = {
  cache: null,
  seenLabels: new Map(),
  queue: Promise.resolve(),
  activePeripheral: null,
  activeCharacteristic: null,
};

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

const isAuthorized = (req) => req.headers.authorization === `Bearer ${AGENT_TOKEN}`;

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

const readCache = async () => {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.deviceId || !parsed.deviceName) return null;
    return {
      deviceId: String(parsed.deviceId),
      deviceName: String(parsed.deviceName),
      model: String(parsed.model || 'B1'),
      updatedAt: String(parsed.updatedAt || new Date(0).toISOString()),
    };
  } catch {
    return null;
  }
};

const writeCache = async (payload) => {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  state.cache = payload;
};

const waitForPoweredOn = async (timeoutMs = 6000) => {
  if (noble.state === 'poweredOn') return true;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      noble.removeListener('stateChange', onStateChange);
      reject(new Error('Bluetooth adapter is not powered on'));
    }, timeoutMs);

    const onStateChange = (nextState) => {
      if (nextState === 'poweredOn') {
        clearTimeout(timeout);
        noble.removeListener('stateChange', onStateChange);
        resolve(true);
      }
    };

    noble.on('stateChange', onStateChange);
  });

  return true;
};

const isExpectedDeviceName = (name) => {
  const upper = String(name || '').toUpperCase();
  return upper.startsWith('B1') || upper.includes('NIIMBOT');
};

const stopScanningSafe = async () => {
  try {
    await noble.stopScanningAsync();
  } catch {
    // ignore
  }
};

const disconnectActive = async () => {
  const peripheral = state.activePeripheral;
  state.activeCharacteristic = null;
  state.activePeripheral = null;

  if (!peripheral) return;

  try {
    if (peripheral.state === 'connected' || peripheral.state === 'connecting') {
      await peripheral.disconnectAsync();
    }
  } catch {
    // ignore
  }
};

const findPeripheral = async ({ preferredId } = {}) => {
  await waitForPoweredOn();

  return await new Promise(async (resolve, reject) => {
    let settled = false;
    let timeout = null;

    const finish = async (err, peripheral) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      noble.removeListener('discover', onDiscover);
      await stopScanningSafe();
      if (err) reject(err);
      else resolve(peripheral);
    };

    const onDiscover = (peripheral) => {
      const localName = peripheral?.advertisement?.localName || '';
      const peripheralId = peripheral?.id || '';
      const isPreferred = preferredId && (preferredId === peripheralId || preferredId === peripheral?.address);
      const acceptable = isPreferred || isExpectedDeviceName(localName);
      if (acceptable) {
        finish(null, peripheral).catch(() => {});
      }
    };

    noble.on('discover', onDiscover);

    timeout = setTimeout(() => {
      finish(new Error('No suitable NIIMBOT BLE device discovered within scan timeout')).catch(() => {});
    }, SCAN_TIMEOUT_MS);

    try {
      await noble.startScanningAsync([normalizedServiceUuid], false);
    } catch {
      await noble.startScanningAsync([], false);
    }
  });
};

const resolveCharacteristic = (characteristics) => {
  const exact = characteristics.find((c) => normalizeUuid(c.uuid) === normalizedCharUuid);
  if (exact) return exact;

  return characteristics.find((c) => c.properties?.writeWithoutResponse || c.properties?.write);
};

const connectPeripheral = async (preferredId) => {
  const peripheral = await findPeripheral({ preferredId });
  await peripheral.connectAsync();

  const discovery = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
    [normalizedServiceUuid],
    [normalizedCharUuid],
  );

  const characteristic = resolveCharacteristic(discovery.characteristics || []);
  if (!characteristic) {
    await peripheral.disconnectAsync().catch(() => {});
    throw new Error('NIIMBOT writable characteristic not found');
  }

  if (characteristic.properties?.notify) {
    characteristic.on('data', () => {});
    await characteristic.subscribeAsync().catch(() => {});
  }

  peripheral.on('disconnect', () => {
    if (state.activePeripheral?.id === peripheral.id) {
      state.activePeripheral = null;
      state.activeCharacteristic = null;
    }
  });

  state.activePeripheral = peripheral;
  state.activeCharacteristic = characteristic;

  return {
    peripheral,
    characteristic,
  };
};

const ensureConnection = async (cachedPrinter) => {
  if (
    state.activePeripheral &&
    state.activeCharacteristic &&
    state.activePeripheral.state === 'connected'
  ) {
    return {
      peripheral: state.activePeripheral,
      characteristic: state.activeCharacteristic,
    };
  }

  await disconnectActive();
  return await connectPeripheral(cachedPrinter?.deviceId);
};

const sendPacket = async (packetBytes) => {
  const characteristic = state.activeCharacteristic;
  if (!characteristic) {
    throw new Error('BLE characteristic is not connected');
  }

  const withoutResponse = !!characteristic.properties?.writeWithoutResponse;
  await characteristic.writeAsync(packetBytes, withoutResponse);
  await packetDelay();
};

const classifyPrintError = (error, hasCache) => {
  const message = String(error?.message || error || '');
  const lower = message.toLowerCase();

  if (!hasCache) {
    return { code: 'PAIR_REQUIRED', message: 'Printer pairing is required.' };
  }

  if (lower.includes('powered on') || lower.includes('bluetooth') || noble.state !== 'poweredOn') {
    return { code: 'BLE_UNAVAILABLE', message: 'Bluetooth adapter is unavailable.' };
  }

  if (lower.includes('discover') || lower.includes('not found') || lower.includes('characteristic')) {
    return { code: 'DEVICE_NOT_FOUND', message: 'Paired NIIMBOT printer is not reachable.' };
  }

  return { code: 'PRINT_FAILED', message: message || 'BLE print failed.' };
};

const cleanupSeenLabels = () => {
  const now = Date.now();
  for (const [key, timestamp] of state.seenLabels.entries()) {
    if (now - timestamp > IDEMPOTENCY_WINDOW_MS) {
      state.seenLabels.delete(key);
    }
  }
};

const isDuplicateLabel = (labelId) => {
  if (!labelId) return false;
  cleanupSeenLabels();
  const prev = state.seenLabels.get(labelId);
  if (prev && Date.now() - prev < IDEMPOTENCY_WINDOW_MS) {
    return true;
  }
  state.seenLabels.set(labelId, Date.now());
  return false;
};

const enqueueJob = async (task) => {
  const run = state.queue.then(task, task);
  state.queue = run.catch(() => {});
  return await run;
};

const performBlePrint = async (payload, cachedPrinter) => {
  const retries = [250, 700, 1300];

  for (let attempt = 0; attempt < retries.length; attempt++) {
    try {
      await ensureConnection(cachedPrinter);
      const packets = buildB1PrintPacketBytes(payload);
      for (const packet of packets) {
        await sendPacket(packet);
      }
      return true;
    } catch (error) {
      await disconnectActive();
      if (attempt === retries.length - 1) {
        throw error;
      }
      await sleep(retries[attempt]);
    }
  }

  return false;
};

const pairPrinter = async () => {
  await disconnectActive();
  await waitForPoweredOn();

  const { peripheral } = await connectPeripheral();

  const cachePayload = {
    deviceId: String(peripheral.id || peripheral.address || ''),
    deviceName: String(peripheral.advertisement?.localName || 'NIIMBOT'),
    model: 'B1',
    updatedAt: new Date().toISOString(),
  };

  await writeCache(cachePayload);
  return cachePayload;
};

const withDeadline = async (promise, timeoutMs, message = 'Operation timeout') => {
  let timeout = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

state.cache = await readCache();

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
    sendJson(res, 200, {
      status: 'ok',
      version: '1.0.0',
      platform: os.platform(),
      bluetooth: noble.state,
      pairedPrinter: state.cache,
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/pair') {
    const jobId = `pair-${Date.now()}`;

    try {
      const printer = await withDeadline(pairPrinter(), PACKET_TIMEOUT_MS, 'Pairing timeout');
      sendJson(res, 200, {
        ok: true,
        code: 'PRINT_SENT',
        message: 'Printer paired successfully.',
        printer,
        jobId,
      });
    } catch (error) {
      const classification = classifyPrintError(error, false);
      sendJson(res, 500, {
        ok: false,
        code: classification.code,
        message: classification.message,
        jobId,
      });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/print-label') {
    const body = await parseJsonBody(req).catch((error) => {
      sendJson(res, 400, {
        ok: false,
        code: 'PRINT_FAILED',
        message: error?.message || 'Invalid JSON body',
        jobId: '',
      });
      return null;
    });

    if (!body) return;

    const labelId = String(body.labelId || '').trim();
    const displayId = String(body.displayId || '').trim();
    const clientName = String(body.clientName || '').trim();
    const itemType = String(body.itemType || '').trim();
    const widthMm = Number(body.widthMm || 50);
    const heightMm = Number(body.heightMm || 30);
    const copies = Number(body.copies || 1);

    if (!displayId) {
      sendJson(res, 400, {
        ok: false,
        code: 'PRINT_FAILED',
        message: 'displayId is required.',
        jobId: '',
      });
      return;
    }

    const jobId = labelId || `job-${Date.now()}`;

    if (isDuplicateLabel(labelId)) {
      sendJson(res, 200, {
        ok: true,
        code: 'PRINT_SENT',
        message: 'Duplicate label request ignored.',
        jobId,
      });
      return;
    }

    try {
      await enqueueJob(async () => {
        const cached = state.cache || (await readCache());
        if (!cached?.deviceId) {
          throw new Error('Pairing required');
        }

        await withDeadline(
          performBlePrint(
            {
              labelId,
              displayId,
              clientName,
              itemType,
              widthMm,
              heightMm,
              copies,
            },
            cached,
          ),
          PACKET_TIMEOUT_MS,
          'BLE print timeout',
        );
      });

      sendJson(res, 200, {
        ok: true,
        code: 'PRINT_SENT',
        message: 'Label sent via BLE printer.',
        jobId,
      });
    } catch (error) {
      const classification = classifyPrintError(error, !!state.cache?.deviceId);
      sendJson(res, 500, {
        ok: false,
        code: classification.code,
        message: classification.message,
        jobId,
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

process.on('SIGINT', async () => {
  await stopScanningSafe();
  await disconnectActive();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopScanningSafe();
  await disconnectActive();
  process.exit(0);
});

server.listen(PORT, HOST, () => {
  console.log(`[niimbot-ble-agent] Listening on http://${HOST}:${PORT}`);
  console.log(`[niimbot-ble-agent] BLE state: ${noble.state}`);
  console.log(`[niimbot-ble-agent] Cache file: ${CACHE_FILE}`);
  console.log(`[niimbot-ble-agent] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
