import { buildZebraLabelZpl } from '../services/labelZpl.js';

const assertString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
  return value.trim();
};

const optionalString = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const validateCreatePrintJobInput = (input) => {
  const printerId = optionalString(input?.printerId);
  const orderId = assertString(input?.orderId, 'orderId');
  const idempotencyKey = assertString(input?.idempotencyKey, 'idempotencyKey');

  const label = input?.label || {};
  const displayId = assertString(label.displayId, 'label.displayId');
  const clientName = assertString(label.clientName, 'label.clientName');
  const itemType = assertString(label.itemType, 'label.itemType');

  return {
    printerId,
    orderId,
    idempotencyKey,
    label: {
      displayId,
      clientName,
      itemType,
    },
  };
};

export const enqueuePrintJob = async ({ store, input, createdBy = 'unknown', source = 'web' }) => {
  if (!store) throw new Error('Store is required');
  const validated = validateCreatePrintJobInput(input);
  const printerId = validated.printerId || (await store.getDefaultPrinterId?.());

  if (!printerId) {
    const error = new Error('No default printer is configured');
    error.code = 'default_printer_missing';
    throw error;
  }

  const printer = await store.getPrinter(printerId);
  if (!printer || !printer.enabled) {
    const error = new Error('Printer is disabled or missing');
    error.code = 'printer_unavailable';
    throw error;
  }

  if ((printer.protocol || 'raw9100') !== 'raw9100') {
    const error = new Error('Unsupported printer protocol');
    error.code = 'unsupported_protocol';
    throw error;
  }

  if (Array.isArray(printer.allowedSources) && printer.allowedSources.length > 0 && !printer.allowedSources.includes(source)) {
    const error = new Error('Source is not allowed for this printer');
    error.code = 'source_not_allowed';
    throw error;
  }

  const zpl = buildZebraLabelZpl(validated.label);

  const { job } = await store.enqueueJob({
    createdBy,
    source,
    orderId: validated.orderId,
    printerId,
    zpl,
    idempotencyKey: validated.idempotencyKey,
  });

  return {
    jobId: job.id,
    status: job.status,
    attempts: job.attempts,
  };
};

export const readPrintJobStatus = async ({ store, jobId }) => {
  if (!store) throw new Error('Store is required');
  if (!jobId) {
    const error = new Error('Missing jobId');
    error.code = 'missing_job_id';
    throw error;
  }

  const job = await store.getJobById(jobId);
  if (!job) return null;

  return {
    jobId: job.id,
    status: job.status,
    attempts: job.attempts,
    lastError: job.lastError || undefined,
  };
};
