import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BleAgentError,
  getBleAgentHealth,
  isBleAgentAvailable,
  pairBlePrinter,
  printViaBleAgent,
} from './blePrintAgentService';

const basePayload = {
  labelId: 'label-1',
  displayId: '1234',
  clientName: 'Client',
  itemType: 'Dress',
  widthMm: 50,
  heightMm: 30,
  copies: 1,
};

describe('blePrintAgentService', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_BLE_AGENT_URL', 'http://127.0.0.1:9131');
    vi.stubEnv('VITE_BLE_AGENT_TOKEN', 'ble-token');
  });

  it('returns health successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok', bluetooth: 'poweredOn' }), { status: 200 }),
      ),
    );

    const result = await getBleAgentHealth();
    expect(result.status).toBe('ok');
  });

  it('returns false when BLE agent health fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(isBleAgentAvailable()).resolves.toBe(false);
  });

  it('throws UNAUTHORIZED on 401 print response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'bad token' }), { status: 401 }),
      ),
    );

    await expect(printViaBleAgent(basePayload)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws PAIR_REQUIRED when print endpoint requires pairing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, code: 'PAIR_REQUIRED', message: 'pair first', jobId: 'j1' }), {
          status: 500,
        }),
      ),
    );

    await expect(printViaBleAgent(basePayload)).rejects.toMatchObject({ code: 'PAIR_REQUIRED' });
  });

  it('throws INVALID_RESPONSE on malformed pair response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, message: 'missing fields' }), { status: 200 })),
    );

    await expect(pairBlePrinter()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('throws TIMEOUT when fetch aborts', async () => {
    const timeoutError = new Error('aborted');
    (timeoutError as any).name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));

    let thrown: unknown;
    try {
      await printViaBleAgent(basePayload);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BleAgentError);
    expect((thrown as BleAgentError).code).toBe('TIMEOUT');
  });
});
