import { describe, expect, it, vi } from 'vitest';
import { executePrintFlow } from './printOrchestrator';

const basePayload = {
  provider: 'auto' as const,
  dataUrl: 'data:image/png;base64,ZmFrZQ==',
  widthMm: 50,
  heightMm: 30,
  copies: 1,
  jobName: 'Test Job',
  labelId: 'label-1',
};

describe('printOrchestrator (auto provider)', () => {
  it('uses QZ when QZ succeeds', async () => {
    const qzPrint = vi.fn().mockResolvedValue(undefined);
    const agentPrint = vi.fn().mockResolvedValue(undefined);
    const browserPrint = vi.fn();

    const result = await executePrintFlow(basePayload, {
      qzEnabled: () => true,
      qzPrint,
      agentPrint,
      browserPrint,
    });

    expect(result.provider).toBe('qz');
    expect(result.usedFallback).toBe(false);
    expect(qzPrint).toHaveBeenCalledTimes(1);
    expect(agentPrint).not.toHaveBeenCalled();
    expect(browserPrint).not.toHaveBeenCalled();
  });

  it('falls back to Local Agent when QZ fails', async () => {
    const qzPrint = vi.fn().mockRejectedValue(new Error('qz down'));
    const agentPrint = vi.fn().mockResolvedValue(undefined);
    const browserPrint = vi.fn();

    const result = await executePrintFlow(basePayload, {
      qzEnabled: () => true,
      qzPrint,
      agentPrint,
      browserPrint,
    });

    expect(result.provider).toBe('agent');
    expect(result.usedFallback).toBe(true);
    expect(result.errors?.qz).toBeTruthy();
    expect(agentPrint).toHaveBeenCalledTimes(1);
    expect(browserPrint).not.toHaveBeenCalled();
  });

  it('falls back to browser when QZ and Local Agent both fail', async () => {
    const qzPrint = vi.fn().mockRejectedValue(new Error('qz down'));
    const agentPrint = vi.fn().mockRejectedValue(new Error('agent down'));
    const browserPrint = vi.fn();

    const result = await executePrintFlow(basePayload, {
      qzEnabled: () => true,
      qzPrint,
      agentPrint,
      browserPrint,
    });

    expect(result.provider).toBe('browser');
    expect(result.usedFallback).toBe(true);
    expect(result.errors?.qz).toBeTruthy();
    expect(result.errors?.agent).toBeTruthy();
    expect(browserPrint).toHaveBeenCalledTimes(1);
  });
});
