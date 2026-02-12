import qz from 'qz-tray';

type LabelBridgeErrorCode =
  | 'BRIDGE_DISABLED'
  | 'QZ_UNAVAILABLE'
  | 'PRINTER_NOT_FOUND'
  | 'PRINT_FAILED';

export class LabelBridgeError extends Error {
  code: LabelBridgeErrorCode;

  constructor(code: LabelBridgeErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'LabelBridgeError';
  }
}

export interface PrintLabelOptions {
  dataUrl: string;
  widthMm?: number;
  heightMm?: number;
  copies?: number;
  jobName?: string;
  labelId?: string;
}

export const normalizeQzError = (error: unknown) => {
  if (error instanceof LabelBridgeError) {
    if (error.code === 'QZ_UNAVAILABLE') return 'QZ Tray לא פעיל.';
    if (error.code === 'PRINTER_NOT_FOUND') return 'לא נמצאה מדפסת תואמת דרך QZ.';
    if (error.code === 'BRIDGE_DISABLED') return 'QZ bridge כבוי בהגדרות.';
    if (error.code === 'PRINT_FAILED') return 'שגיאת הדפסה דרך QZ.';
    return error.message || 'שגיאה בהדפסה דרך QZ.';
  }
  const message = typeof error === 'object' && error && 'message' in error
    ? String((error as any).message || '')
    : '';
  if (message.toLowerCase().includes('disabled')) {
    return 'QZ bridge כבוי בהגדרות.';
  }
  return 'שגיאה בהדפסה דרך QZ.';
};

const envPrinterName = (import.meta.env.VITE_QZ_PRINTER_NAME || '').trim();
const envUseBridge = String(import.meta.env.VITE_QZ_USE_BRIDGE || '').toLowerCase() === 'true';
const envWsUrl = (import.meta.env.VITE_QZ_TRAY_WS_URL || '').trim();
const envCertUrl = (import.meta.env.VITE_QZ_CERT_URL || '').trim();
const envSignUrl = (import.meta.env.VITE_QZ_SIGN_URL || '').trim();
const envSignAlgorithm = (import.meta.env.VITE_QZ_SIGN_ALGORITHM || 'SHA512').trim().toUpperCase();
let qzSecurityConfigured = false;
let warnedUnsignedFallback = false;

const warnUnsignedFallback = (reason: string) => {
  if (warnedUnsignedFallback) return;
  warnedUnsignedFallback = true;
  console.warn(`[QZ] Signed mode unavailable (${reason}). Falling back to unsigned mode.`);
};

const configureQzSecurity = () => {
  if (qzSecurityConfigured) return;
  if (!qz.security) return;

  if (envCertUrl && envSignUrl) {
    qz.security.setSignatureAlgorithm?.(envSignAlgorithm);
    qz.security.setCertificatePromise(async () => {
      try {
        const response = await fetch(envCertUrl, { cache: 'no-store' });
        if (!response.ok) {
          warnUnsignedFallback(`certificate endpoint returned ${response.status}`);
          return '';
        }
        return (await response.text()).trim();
      } catch (error: any) {
        warnUnsignedFallback(error?.message || 'certificate endpoint unreachable');
        return '';
      }
    });

    qz.security.setSignaturePromise(async (toSign: string) => {
      try {
        const response = await fetch(envSignUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: toSign }),
        });
        if (!response.ok) {
          warnUnsignedFallback(`signature endpoint returned ${response.status}`);
          return '';
        }
        return (await response.text()).trim();
      } catch (error: any) {
        warnUnsignedFallback(error?.message || 'signature endpoint unreachable');
        return '';
      }
    });
  } else {
    // Fallback POC mode: allow local unsigned requests (QZ may prompt for trust).
    qz.security.setCertificatePromise(async () => '');
    qz.security.setSignaturePromise(async () => '');
  }

  qzSecurityConfigured = true;
};

const toBase64Payload = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
};

const buildConnectOptions = () => {
  if (!envWsUrl) return undefined;

  try {
    const parsed = new URL(envWsUrl);
    const secure = parsed.protocol === 'wss:' || parsed.protocol === 'https:';
    const fallbackPort = secure ? 8181 : 8182;
    const resolvedPort = Number(parsed.port || fallbackPort);
    const host = parsed.hostname;

    if (!host || Number.isNaN(resolvedPort)) return undefined;

    return {
      host: [host],
      usingSecure: secure,
      port: secure
        ? { secure: [resolvedPort], insecure: [] as number[] }
        : { secure: [] as number[], insecure: [resolvedPort] },
    };
  } catch {
    return undefined;
  }
};

const resolvePrinterName = async (): Promise<string> => {
  try {
    if (envPrinterName) {
      const explicit = await qz.printers.find(envPrinterName);
      if (explicit && typeof explicit === 'string') return explicit;
      if (Array.isArray(explicit) && explicit.length > 0) {
        return String(explicit[0]);
      }
    }

    const defaultPrinter = await qz.printers.getDefault();
    if (defaultPrinter) return String(defaultPrinter);

    const all = await qz.printers.find();
    if (Array.isArray(all) && all.length > 0) return String(all[0]);
    if (typeof all === 'string' && all) return all;
  } catch (error: any) {
    throw new LabelBridgeError(
      'QZ_UNAVAILABLE',
      error?.message || 'Failed to query printers via QZ Tray',
    );
  }

  throw new LabelBridgeError(
    'PRINTER_NOT_FOUND',
    'No printer detected via QZ Tray',
  );
};

export const shouldUseLabelBridge = () => envUseBridge;

export const connectQz = async () => {
  if (!envUseBridge) {
    throw new LabelBridgeError(
      'BRIDGE_DISABLED',
      'QZ bridge disabled by environment',
    );
  }

  try {
    configureQzSecurity();
    if (qz.websocket.isActive()) return;
    const options = buildConnectOptions();
    await qz.websocket.connect(options);
  } catch (error: any) {
    throw new LabelBridgeError(
      'QZ_UNAVAILABLE',
      error?.message || 'Failed to connect to QZ Tray',
    );
  }
};

export const isQzAvailable = async () => {
  try {
    await connectQz();
    return true;
  } catch {
    return false;
  }
};

export const printLabelPng = async ({
  dataUrl,
  widthMm = 50,
  heightMm = 30,
  copies = 1,
  jobName = 'StitchFlow Label',
}: PrintLabelOptions) => {
  try {
    await connectQz();
    const printer = await resolvePrinterName();
    const config = qz.configs.create(printer, {
      copies,
      units: 'mm',
      size: { width: widthMm, height: heightMm },
      margins: 0,
      interpolation: 'nearest-neighbor',
      scaleContent: true,
      jobName,
    });

    await qz.print(config, [
      {
        type: 'pixel',
        format: 'image',
        flavor: 'base64',
        data: toBase64Payload(dataUrl),
      },
    ]);
  } catch (error: any) {
    if (error instanceof LabelBridgeError) throw error;
    throw new LabelBridgeError(
      'PRINT_FAILED',
      error?.message || 'QZ print failed',
    );
  }
};

export const disconnectQz = async () => {
  try {
    if (qz.websocket.isActive()) {
      await qz.websocket.disconnect();
    }
  } catch {
    // Ignore disconnect errors.
  }
};
