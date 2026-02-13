import { SupabasePrintQueueStore } from '../../server/printQueueStore.js';
import { TcpPrintTransport } from '../../server/printTransport.js';
import { PrintWorker } from '../../server/printWorker.js';
import { DEFAULT_POLL_INTERVAL_MS, DEFAULT_SOCKET_TIMEOUT_MS } from '../../server/printWorkerConfig.js';

const pollIntervalMs = Number(process.env.PRINT_WORKER_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS);
const socketTimeoutMs = Number(process.env.PRINT_SOCKET_TIMEOUT_MS || DEFAULT_SOCKET_TIMEOUT_MS);
const failedAlertThreshold = Number(process.env.PRINT_FAILED_ALERT_THRESHOLD || 10);
const failedAlertWindowMinutes = Number(process.env.PRINT_FAILED_ALERT_WINDOW_MINUTES || 10);

const store = SupabasePrintQueueStore.fromEnv();
const transport = new TcpPrintTransport({ timeoutMs: socketTimeoutMs });
const worker = new PrintWorker({ store, transport, pollIntervalMs, logger: console });

const runFailureMonitor = async () => {
  try {
    const since = new Date(Date.now() - failedAlertWindowMinutes * 60_000).toISOString();
    const count = await store.getFailedCountSince(since);
    if (count > failedAlertThreshold) {
      console.warn(`[print-worker] ALERT: ${count} failed jobs in the last ${failedAlertWindowMinutes} minutes`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[print-worker] failed to run failure monitor: ${message}`);
  }
};

console.log(`[print-worker] starting poll=${pollIntervalMs}ms timeout=${socketTimeoutMs}ms`);
worker.start();

const monitorInterval = setInterval(runFailureMonitor, 60_000);
runFailureMonitor();

const shutdown = (signal) => {
  console.log(`[print-worker] received ${signal}, stopping worker...`);
  clearInterval(monitorInterval);
  worker.stop();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
