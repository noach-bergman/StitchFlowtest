import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAgentHealth,
  printViaAgent,
  isAgentAvailable,
  LocalAgentError,
} from './localPrintAgentService';

const basePayload = {
  dataUrl: 'data:image/png;base64,ZmFrZQ==',
  widthMm: 50,
  heightMm: 30,
  copies: 1,
  jobName: 'Test Job',
  labelId: 'label-1',
};

describe('localPrintAgentService', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_LOCAL_AGENT_URL', 'http://127.0.0.1:9130');
    vi.stubEnv('VITE_LOCAL_AGENT_TOKEN', 'test-token');
  });

  it('returns health successfully when endpoint responds with status ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok', version: '1.0.0' }), { status: 200 }),
      ),
    );

    const health = await getAgentHealth();
    expect(health.status).toBe('ok');
  });

  it('returns false from isAgentAvailable when health fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection failed')));
    await expect(isAgentAvailable()).resolves.toBe(false);
  });

  it('throws UNAUTHORIZED on 401 from print-label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'bad token' }), { status: 401 }),
      ),
    );

    await expect(printViaAgent(basePayload)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws INVALID_RESPONSE on malformed print response schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, message: 'missing code/jobId' }), { status: 200 }),
      ),
    );

    await expect(printViaAgent(basePayload)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('throws TIMEOUT when fetch aborts', async () => {
    const timeoutError = new Error('aborted');
    (timeoutError as any).name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));

    let thrown: unknown;
    try {
      await printViaAgent(basePayload);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LocalAgentError);
    expect((thrown as LocalAgentError).code).toBe('TIMEOUT');
  });
});
