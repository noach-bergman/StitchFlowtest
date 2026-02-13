import { DEFAULT_POLL_INTERVAL_MS } from './printWorkerConfig.js';

const toMessage = (error) => {
  if (!error) return 'Unknown printer error';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  return String(error);
};

export class PrintWorker {
  constructor({ store, transport, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, logger = console } = {}) {
    if (!store) throw new Error('PrintWorker requires a store');
    if (!transport) throw new Error('PrintWorker requires a transport');

    this.store = store;
    this.transport = transport;
    this.pollIntervalMs = pollIntervalMs;
    this.logger = logger;
    this.intervalId = null;
    this.isTickRunning = false;
  }

  async runOnce() {
    const job = await this.store.claimNextQueuedJob();
    if (!job) {
      return { processed: false, status: 'idle' };
    }

    const printer = await this.store.getPrinter(job.printerId);
    if (!printer || !printer.enabled) {
      const failure = await this.store.recordFailure(job, 'Printer is disabled or missing');
      return { processed: true, status: failure.status, attempts: failure.attempts, jobId: job.id };
    }

    if ((printer.protocol || 'raw9100') !== 'raw9100') {
      const failure = await this.store.recordFailure(job, `Unsupported printer protocol: ${printer.protocol}`);
      return { processed: true, status: failure.status, attempts: failure.attempts, jobId: job.id };
    }

    try {
      await this.transport.sendRaw({
        host: printer.publicHost,
        port: printer.publicPort,
        payload: job.zpl,
      });

      await this.store.markPrinted(job.id);
      return { processed: true, status: 'printed', attempts: job.attempts, jobId: job.id };
    } catch (error) {
      const message = toMessage(error);
      this.logger.error(`[print-worker] failed sending job ${job.id}: ${message}`);
      const failure = await this.store.recordFailure(job, message);
      return { processed: true, status: failure.status, attempts: failure.attempts, jobId: job.id };
    }
  }

  start() {
    if (this.intervalId) return;

    const tick = async () => {
      if (this.isTickRunning) return;
      this.isTickRunning = true;
      try {
        await this.runOnce();
      } catch (error) {
        this.logger.error(`[print-worker] unhandled tick error: ${toMessage(error)}`);
      } finally {
        this.isTickRunning = false;
      }
    };

    this.intervalId = setInterval(tick, this.pollIntervalMs);
    tick();
  }

  stop() {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }
}
