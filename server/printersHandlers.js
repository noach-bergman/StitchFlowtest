import { randomUUID } from 'node:crypto';
import { enqueuePrintJob } from './printQueueHandlers.js';

const MAX_HOST_LENGTH = 255;
const MAX_ID_LENGTH = 64;
const MAX_NAME_LENGTH = 120;

const assertString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return value.trim();
};

const assertOptionalString = (value, fieldName) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid value for ${fieldName}`);
  }
  return value.trim();
};

const normalizePrinterId = (value, fieldName = 'id') => {
  const id = assertString(value, fieldName);
  if (id.length > MAX_ID_LENGTH) {
    throw new Error(`Invalid value for ${fieldName}: max length is ${MAX_ID_LENGTH}`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid value for ${fieldName}: use letters, numbers, hyphen, underscore`);
  }
  return id;
};

const normalizeName = (value) => {
  const name = assertString(value, 'name');
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Invalid value for name: max length is ${MAX_NAME_LENGTH}`);
  }
  return name;
};

const normalizeHost = (value) => {
  if (typeof value !== 'string') throw new Error('Missing required field: publicHost');
  if (value !== value.trim()) throw new Error('Invalid value for publicHost: remove leading/trailing spaces');
  const host = value.trim();
  if (!host) throw new Error('Missing required field: publicHost');
  if (host.length > MAX_HOST_LENGTH) throw new Error(`Invalid value for publicHost: max length is ${MAX_HOST_LENGTH}`);
  if (/\s/.test(host)) throw new Error('Invalid value for publicHost: spaces are not allowed');
  return host;
};

const normalizePort = (value) => {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    throw new Error('Invalid value for publicPort: must be integer between 1 and 65535');
  }
  return num;
};

const normalizeProtocol = (value) => {
  const protocol = (value ?? 'raw9100').toString().trim();
  if (protocol !== 'raw9100') {
    throw new Error('Invalid value for protocol: only raw9100 is supported');
  }
  return protocol;
};

const normalizeAllowedSources = (value) => {
  if (value === undefined || value === null) return ['web'];
  if (!Array.isArray(value)) {
    throw new Error('Invalid value for allowedSources: expected array of strings');
  }

  const normalized = Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => !!item)
    )
  );

  return normalized.length > 0 ? normalized : ['web'];
};

const normalizeEnabled = (value, defaultValue = true) => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value !== 'boolean') throw new Error('Invalid value for enabled: expected boolean');
  return value;
};

export const listPrintersWithDefault = async ({ store }) => {
  const printers = await store.listPrinters();
  const defaultPrinterId = await store.getDefaultPrinterId();
  return { printers, defaultPrinterId };
};

export const validateCreatePrinterInput = (input) => ({
  id: normalizePrinterId(input?.id),
  name: normalizeName(input?.name),
  publicHost: normalizeHost(input?.publicHost),
  publicPort: normalizePort(input?.publicPort),
  protocol: normalizeProtocol(input?.protocol),
  enabled: normalizeEnabled(input?.enabled, true),
  allowedSources: normalizeAllowedSources(input?.allowedSources),
});

export const createOrUpdatePrinter = async ({ store, input }) => {
  const validated = validateCreatePrinterInput(input);
  const printer = await store.upsertPrinter(validated);
  return { printer };
};

export const validatePatchPrinterInput = (input) => {
  const output = {};

  if (input?.name !== undefined) output.name = normalizeName(input.name);
  if (input?.publicHost !== undefined) output.publicHost = normalizeHost(input.publicHost);
  if (input?.publicPort !== undefined) output.publicPort = normalizePort(input.publicPort);
  if (input?.protocol !== undefined) output.protocol = normalizeProtocol(input.protocol);
  if (input?.enabled !== undefined) output.enabled = normalizeEnabled(input.enabled);
  if (input?.allowedSources !== undefined) output.allowedSources = normalizeAllowedSources(input.allowedSources);

  if (Object.keys(output).length === 0) {
    throw new Error('No updatable fields were provided');
  }

  return output;
};

export const patchPrinter = async ({ store, printerId, input }) => {
  const id = normalizePrinterId(printerId, 'printerId');
  const validated = validatePatchPrinterInput(input);

  const existing = await store.getPrinter(id);
  if (!existing) {
    const error = new Error('Printer not found');
    error.code = 'printer_not_found';
    throw error;
  }

  if (validated.enabled === false) {
    const defaultPrinterId = await store.getDefaultPrinterId();
    if (defaultPrinterId && defaultPrinterId === id) {
      const error = new Error('Cannot disable the default printer. Set another default printer first.');
      error.code = 'default_printer_disable_blocked';
      throw error;
    }
  }

  const printer = await store.updatePrinter(id, validated);
  return { printer };
};

export const setDefaultPrinter = async ({ store, printerId }) => {
  const id = normalizePrinterId(printerId, 'printerId');
  const printer = await store.getPrinter(id);
  if (!printer) {
    const error = new Error('Printer not found');
    error.code = 'printer_not_found';
    throw error;
  }

  if (!printer.enabled) {
    const error = new Error('Cannot set disabled printer as default');
    error.code = 'default_printer_disabled';
    throw error;
  }

  await store.setDefaultPrinterId(id);
  return { defaultPrinterId: id };
};

export const createPrinterTestJob = async ({ queueStore, printerId, createdBy = 'admin-ui' }) => {
  const id = normalizePrinterId(printerId, 'printerId');

  const suffix = Date.now().toString().slice(-6);
  const displayId = `TEST-${suffix}`;

  return enqueuePrintJob({
    store: queueStore,
    source: 'web',
    createdBy,
    input: {
      printerId: id,
      orderId: `test-order-${randomUUID().slice(0, 8)}`,
      idempotencyKey: `test:${id}:${randomUUID()}`,
      label: {
        displayId,
        clientName: 'Printer Health Check',
        itemType: 'Connectivity Test',
      },
    },
  });
};

export const resolvePrinterIdFromRequest = (req) => {
  const fromQuery = req?.query?.id;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();

  const url = req?.url || '';
  const path = url.split('?')[0] || '';
  const parts = path.split('/').filter(Boolean);
  const printersIndex = parts.indexOf('printers');

  if (printersIndex >= 0 && parts[printersIndex + 1]) {
    const candidate = parts[printersIndex + 1];
    if (candidate !== 'default' && candidate !== 'test') {
      return candidate;
    }
  }

  return '';
};

export const readSourceFromBody = (body) => {
  const source = assertOptionalString(body?.source, 'source');
  return source || 'web';
};
