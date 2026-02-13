import { describe, expect, it, vi } from 'vitest';
import { InMemoryPrintQueueStore } from '../server/printQueueStore.js';
import { enqueuePrintJob } from '../server/printQueueHandlers.js';
import { PrintWorker } from '../server/printWorker.js';

const retryDelays = [2000, 5000, 15000, 30000];

describe('print queue workflow', () => {
  it('keeps idempotency for duplicate requests', async () => {
    const store = new InMemoryPrintQueueStore();
    store.addPrinter({
      id: 'default-zebra',
      publicHost: '203.0.113.10',
      publicPort: 49100,
      enabled: true,
      protocol: 'raw9100',
      allowedSources: ['web'],
    });

    const payload = {
      printerId: 'default-zebra',
      orderId: 'order-123',
      idempotencyKey: 'idem-123',
      label: {
        displayId: '5001',
        clientName: 'Noah',
        itemType: 'Jacket',
      },
    };

    const first = await enqueuePrintJob({ store, input: payload, source: 'web', createdBy: 'test-user' });
    const second = await enqueuePrintJob({ store, input: payload, source: 'web', createdBy: 'test-user' });

    expect(first.jobId).toBe(second.jobId);
    expect(first.status).toBe('queued');
  });

  it('uses default printer when printerId is missing', async () => {
    const store = new InMemoryPrintQueueStore();
    store.addPrinter({
      id: 'printer-default',
      publicHost: '203.0.113.10',
      publicPort: 49100,
      enabled: true,
      protocol: 'raw9100',
      allowedSources: ['web'],
    });
    store.setDefaultPrinterId('printer-default');

    const result = await enqueuePrintJob({
      store,
      input: {
        orderId: 'order-default',
        idempotencyKey: 'idem-default',
        label: {
          displayId: '9001',
          clientName: 'Default Client',
          itemType: 'Trousers',
        },
      },
      source: 'web',
      createdBy: 'test-user',
    });

    const job = await store.getJobById(result.jobId);
    expect(result.status).toBe('queued');
    expect(job?.printerId).toBe('printer-default');
  });

  it('moves queued job to printed on successful transport', async () => {
    const store = new InMemoryPrintQueueStore();
    store.addPrinter({
      id: 'default-zebra',
      publicHost: '203.0.113.10',
      publicPort: 49100,
      enabled: true,
      protocol: 'raw9100',
      allowedSources: ['web'],
    });

    const queued = await enqueuePrintJob({
      store,
      source: 'web',
      createdBy: 'test-user',
      input: {
        printerId: 'default-zebra',
        orderId: 'order-200',
        idempotencyKey: 'idem-200',
        label: { displayId: '200', clientName: 'Client', itemType: 'Skirt' },
      },
    });

    const transport = {
      sendRaw: vi.fn(async () => undefined),
    };

    const silentLogger = { error: vi.fn(), log: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    const worker = new PrintWorker({ store, transport, logger: silentLogger, pollIntervalMs: 1 } as any);
    const result = await worker.runOnce();

    const finalJob = await store.getJobById(queued.jobId);
    expect(result.status).toBe('printed');
    expect(finalJob?.status).toBe('printed');
    expect(transport.sendRaw).toHaveBeenCalledTimes(1);
  });

  it('retries failed jobs and marks failed after max attempts', async () => {
    let nowMs = Date.now();
    const store = new InMemoryPrintQueueStore({ now: () => new Date(nowMs) });
    store.addPrinter({
      id: 'default-zebra',
      publicHost: '203.0.113.10',
      publicPort: 49100,
      enabled: true,
      protocol: 'raw9100',
      allowedSources: ['web'],
    });

    const queued = await enqueuePrintJob({
      store,
      source: 'web',
      createdBy: 'test-user',
      input: {
        printerId: 'default-zebra',
        orderId: 'order-500',
        idempotencyKey: 'idem-500',
        label: { displayId: '500', clientName: 'Client', itemType: 'Coat' },
      },
    });

    const transport = {
      sendRaw: vi.fn(async () => {
        throw new Error('socket failure');
      }),
    };

    const silentLogger = { error: vi.fn(), log: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    const worker = new PrintWorker({ store, transport, logger: silentLogger, pollIntervalMs: 1 } as any);

    for (const delay of retryDelays) {
      await worker.runOnce();
      const interim = await store.getJobById(queued.jobId);
      expect(interim?.status).toBe('queued');
      expect(interim?.attempts).toBeGreaterThan(0);

      const idleRun = await worker.runOnce();
      expect(idleRun.status).toBe('idle');

      nowMs += delay;
    }

    const finalRun = await worker.runOnce();
    const finalJob = await store.getJobById(queued.jobId);

    expect(finalRun.status).toBe('failed');
    expect(finalJob?.status).toBe('failed');
    expect(finalJob?.attempts).toBe(5);
    expect(transport.sendRaw).toHaveBeenCalledTimes(5);
  });
});
