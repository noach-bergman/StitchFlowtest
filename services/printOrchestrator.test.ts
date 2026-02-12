import { describe, expect, it, vi } from 'vitest';
import { BleAgentError } from './blePrintAgentService';
import { executePrintFlow } from './printOrchestrator';

const basePayload = {
  provider: 'auto' as const,
  dataUrl: 'data:image/png;base64,ZmFrZQ==',
  labelId: 'label-1',
  displayId: '1234',
  clientName: 'Client Name',
  itemType: 'Dress',
  widthMm: 50,
  heightMm: 30,
  copies: 1,
  jobName: 'Test Job',
};

describe('printOrchestrator (auto provider)', () => {
  it('uses BLE when BLE succeeds', async () => {
    const blePrint = vi.fn().mockResolvedValue(undefined);
    const qzPrint = vi.fn().mockResolvedValue(undefined);
    const browserPrint = vi.fn();

    const result = await executePrintFlow(basePayload, {
      blePrint,
      blePair: vi.fn(),
      qzEnabled: () => true,
      qzPrint,
      agentPrint: vi.fn(),
      browserPrint,
    });

    expect(result.provider).toBe('ble');
    expect(result.usedFallback).toBe(false);
    expect(blePrint).toHaveBeenCalledTimes(1);
    expect(qzPrint).not.toHaveBeenCalled();
    expect(browserPrint).not.toHaveBeenCalled();
  });

  it('tries pair and retries BLE when pair is required', async () => {
    const blePrint = vi
      .fn()
      .mockRejectedValueOnce(new BleAgentError('PAIR_REQUIRED', 'pair first'))
      .mockResolvedValue(undefined);
    const blePair = vi.fn().mockResolvedValue(undefined);

    const result = await executePrintFlow(basePayload, {
      blePrint,
      blePair,
      qzEnabled: () => true,
      qzPrint: vi.fn(),
      agentPrint: vi.fn(),
      browserPrint: vi.fn(),
    });

    expect(result.provider).toBe('ble');
    expect(blePair).toHaveBeenCalledTimes(1);
    expect(blePrint).toHaveBeenCalledTimes(2);
  });

  it('falls back to QZ when BLE fails', async () => {
    const blePrint = vi.fn().mockRejectedValue(new Error('ble down'));
    const qzPrint = vi.fn().mockResolvedValue(undefined);
    const browserPrint = vi.fn();

    const result = await executePrintFlow(basePayload, {
      blePrint,
      blePair: vi.fn(),
      qzEnabled: () => true,
      qzPrint,
      agentPrint: vi.fn(),
      browserPrint,
    });

    expect(result.provider).toBe('qz');
    expect(result.usedFallback).toBe(true);
    expect(result.errors?.ble).toBeTruthy();
    expect(qzPrint).toHaveBeenCalledTimes(1);
    expect(browserPrint).not.toHaveBeenCalled();
  });

  it('falls back to browser when BLE and QZ both fail', async () => {
    const blePrint = vi.fn().mockRejectedValue(new Error('ble down'));
    const qzPrint = vi.fn().mockRejectedValue(new Error('qz down'));
    const browserPrint = vi.fn();

    const result = await executePrintFlow(basePayload, {
      blePrint,
      blePair: vi.fn(),
      qzEnabled: () => true,
      qzPrint,
      agentPrint: vi.fn(),
      browserPrint,
    });

    expect(result.provider).toBe('browser');
    expect(result.usedFallback).toBe(true);
    expect(result.errors?.ble).toBeTruthy();
    expect(result.errors?.qz).toBeTruthy();
    expect(browserPrint).toHaveBeenCalledTimes(1);
  });
});
