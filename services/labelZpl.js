const sanitizeAscii = (value, fallback = 'N/A') => {
  const raw = (value ?? '').toString();
  const normalized = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\^~\\]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || fallback;
};

const sanitizeQrValue = (value) => sanitizeAscii(value, 'UNKNOWN').replace(/[,;:]/g, '-').slice(0, 80);
const sanitizeLine = (value, fallback = 'N/A', maxLen = 36) => sanitizeAscii(value, fallback).slice(0, maxLen);

export const buildZebraLabelZpl = ({ displayId, clientName, itemType }) => {
  const qrValue = sanitizeQrValue(displayId);
  const idLine = sanitizeLine(displayId, 'UNKNOWN', 20);
  const clientLine = sanitizeLine(clientName, 'Client', 24);
  const itemLine = sanitizeLine(itemType, 'Item', 28);

  return [
    '^XA',
    '^PW400',
    '^LL240',
    '^LH0,0',
    `^FO16,18^BQN,2,4^FDLA,${qrValue}^FS`,
    `^FO168,24^A0N,34,34^FD#${idLine}^FS`,
    `^FO168,74^A0N,28,28^FD${clientLine}^FS`,
    `^FO168,112^A0N,24,24^FD${itemLine}^FS`,
    '^XZ',
  ].join('\n');
};

export const isAsciiOnly = (text) => /^[\x00-\x7F]*$/.test((text ?? '').toString());

export const buildPrintIdempotencyKey = ({ orderId, displayId, printerId }) => {
  const safeOrderId = sanitizeLine(orderId, 'no-order', 64).toLowerCase();
  const safeDisplayId = sanitizeLine(displayId, 'no-display', 32).toLowerCase();
  const safePrinterId = sanitizeLine(printerId, 'default-zebra', 64).toLowerCase();
  return `${safePrinterId}:${safeOrderId}:${safeDisplayId}`;
};
