import { describe, expect, it } from 'vitest';
import { InMemoryPrintersStore } from '../server/printersStore.js';
import { InMemoryPrintQueueStore } from '../server/printQueueStore.js';
import {
  createOrUpdatePrinter,
  createPrinterTestJob,
  patchPrinter,
  setDefaultPrinter,
  validateCreatePrinterInput,
} from '../server/printersHandlers.js';

describe('printers handlers', () => {
  it('validates create payload', () => {
    const valid = validateCreatePrinterInput({
      id: 'printer-1',
      name: 'Front Desk',
      publicHost: 'printer.example.com',
      publicPort: 49100,
      protocol: 'raw9100',
      enabled: true,
      allowedSources: ['web'],
    });

    expect(valid.id).toBe('printer-1');
    expect(valid.protocol).toBe('raw9100');

    expect(() =>
      validateCreatePrinterInput({
        id: 'bad id',
        name: 'Invalid',
        publicHost: 'printer.example.com',
        publicPort: 49100,
      })
    ).toThrow();
  });

  it('blocks disabling default printer', async () => {
    const store = new InMemoryPrintersStore();
    await createOrUpdatePrinter({
      store,
      input: {
        id: 'printer-1',
        name: 'Front Desk',
        publicHost: 'printer.example.com',
        publicPort: 49100,
        protocol: 'raw9100',
        enabled: true,
        allowedSources: ['web'],
      },
    });

    await setDefaultPrinter({ store, printerId: 'printer-1' });

    await expect(
      patchPrinter({
        store,
        printerId: 'printer-1',
        input: { enabled: false },
      })
    ).rejects.toMatchObject({ code: 'default_printer_disable_blocked' });
  });

  it('creates test print job for existing printer', async () => {
    const queueStore = new InMemoryPrintQueueStore();
    queueStore.addPrinter({
      id: 'printer-1',
      name: 'Front Desk',
      publicHost: '203.0.113.10',
      publicPort: 49100,
      protocol: 'raw9100',
      enabled: true,
      allowedSources: ['web'],
    });

    const result = await createPrinterTestJob({
      queueStore,
      printerId: 'printer-1',
      source: 'web',
      createdBy: 'tester',
    });

    expect(result.status).toBe('queued');
    expect(result.jobId).toBeTruthy();
  });
});
