import { PrintProvider } from '../types';
import {
  printLabelPng,
  shouldUseLabelBridge,
  normalizeQzError,
} from './labelPrintService';
import {
  printViaAgent,
  normalizeAgentError,
  LocalAgentPrintPayload,
} from './localPrintAgentService';
import {
  BlePrintPayload,
  isPairRequiredError,
  normalizeBleError,
  pairBlePrinter,
  printViaBleAgent,
} from './blePrintAgentService';

type SuccessfulProvider = 'ble' | 'qz' | 'agent' | 'browser';

export interface PrintExecutionResult {
  provider: SuccessfulProvider;
  usedFallback: boolean;
  message: string;
  errors?: {
    ble?: string;
    qz?: string;
    agent?: string;
  };
}

export type PrintOrchestratorPayload = LocalAgentPrintPayload & {
  labelId: BlePrintPayload['labelId'];
  displayId: BlePrintPayload['displayId'];
  clientName: BlePrintPayload['clientName'];
  itemType: BlePrintPayload['itemType'];
  provider?: PrintProvider;
};

interface PrintOrchestratorDependencies {
  blePrint: (payload: BlePrintPayload) => Promise<void>;
  blePair: () => Promise<void>;
  qzEnabled: () => boolean;
  qzPrint: (payload: LocalAgentPrintPayload) => Promise<void>;
  agentPrint: (payload: LocalAgentPrintPayload) => Promise<void>;
  browserPrint: () => void;
}

const toProvider = (value: string | undefined): PrintProvider => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ble') return 'ble';
  if (normalized === 'qz') return 'qz';
  if (normalized === 'agent') return 'agent';
  if (normalized === 'browser') return 'browser';
  return 'auto';
};

const envProvider = toProvider(import.meta.env.VITE_PRINT_PROVIDER);

const defaultDependencies: PrintOrchestratorDependencies = {
  blePrint: async (payload) => {
    await printViaBleAgent(payload);
  },
  blePair: async () => {
    await pairBlePrinter();
  },
  qzEnabled: () => shouldUseLabelBridge(),
  qzPrint: async (payload) => {
    await printLabelPng(payload);
  },
  agentPrint: async (payload) => {
    await printViaAgent(payload);
  },
  browserPrint: () => {
    window.print();
  },
};

export const resolvePrintProvider = (override?: PrintProvider) => override || envProvider;

const withBrowserFallback = (
  message: string,
  errors: PrintExecutionResult['errors'],
  browserPrint: () => void,
): PrintExecutionResult => {
  browserPrint();
  return {
    provider: 'browser',
    usedFallback: true,
    message,
    errors,
  };
};

const attemptBle = async (
  payload: PrintOrchestratorPayload,
  deps: PrintOrchestratorDependencies,
) => {
  try {
    await deps.blePrint(payload);
    return;
  } catch (error) {
    if (isPairRequiredError(error)) {
      await deps.blePair();
      await deps.blePrint(payload);
      return;
    }
    throw error;
  }
};

const attemptQz = async (
  payload: PrintOrchestratorPayload,
  deps: PrintOrchestratorDependencies,
) => {
  if (!deps.qzEnabled()) {
    throw new Error('QZ bridge disabled by environment');
  }
  await deps.qzPrint(payload);
};

const attemptAgent = async (
  payload: PrintOrchestratorPayload,
  deps: PrintOrchestratorDependencies,
) => {
  await deps.agentPrint(payload);
};

export const executePrintFlow = async (
  payload: PrintOrchestratorPayload,
  overrides?: Partial<PrintOrchestratorDependencies>,
): Promise<PrintExecutionResult> => {
  const deps = { ...defaultDependencies, ...overrides };
  const provider = resolvePrintProvider(payload.provider);
  const errors: PrintExecutionResult['errors'] = {};

  if (provider === 'browser') {
    deps.browserPrint();
    return {
      provider: 'browser',
      usedFallback: false,
      message: 'נפתחה הדפסת דפדפן.',
    };
  }

  if (provider === 'ble') {
    try {
      await attemptBle(payload, deps);
      return {
        provider: 'ble',
        usedFallback: false,
        message: 'התווית נשלחה למדפסת דרך BLE.',
      };
    } catch (error) {
      errors.ble = normalizeBleError(error);
    }

    try {
      await attemptQz(payload, deps);
      return {
        provider: 'qz',
        usedFallback: true,
        message: `${errors.ble} עוברים ל-QZ וההדפסה הצליחה.`,
        errors,
      };
    } catch (error) {
      errors.qz = normalizeQzError(error);
      return withBrowserFallback(
        `${errors.ble} ${errors.qz} עוברים להדפסת דפדפן.`,
        errors,
        deps.browserPrint,
      );
    }
  }

  if (provider === 'qz') {
    try {
      await attemptQz(payload, deps);
      return {
        provider: 'qz',
        usedFallback: false,
        message: 'התווית נשלחה למדפסת דרך QZ.',
      };
    } catch (error) {
      errors.qz = normalizeQzError(error);
      return withBrowserFallback(
        `${errors.qz} עוברים להדפסת דפדפן.`,
        errors,
        deps.browserPrint,
      );
    }
  }

  if (provider === 'agent') {
    try {
      await attemptAgent(payload, deps);
      return {
        provider: 'agent',
        usedFallback: false,
        message: 'התווית נשלחה למדפסת דרך Local Agent.',
      };
    } catch (error) {
      errors.agent = normalizeAgentError(error);
      return withBrowserFallback(
        `${errors.agent} עוברים להדפסת דפדפן.`,
        errors,
        deps.browserPrint,
      );
    }
  }

  try {
    await attemptBle(payload, deps);
    return {
      provider: 'ble',
      usedFallback: false,
      message: 'התווית נשלחה למדפסת דרך BLE.',
    };
  } catch (error) {
    errors.ble = normalizeBleError(error);
  }

  try {
    await attemptQz(payload, deps);
    return {
      provider: 'qz',
      usedFallback: true,
      message: `${errors.ble} עוברים ל-QZ וההדפסה הצליחה.`,
      errors,
    };
  } catch (error) {
    errors.qz = normalizeQzError(error);
    return withBrowserFallback(
      `${errors.ble} ${errors.qz} עוברים להדפסת דפדפן.`,
      errors,
      deps.browserPrint,
    );
  }
};
