import { describe, expect, it } from 'vitest';
import { Order } from '../types';
import {
  getComparisonForPeriod,
  getMonthlyDailyComparisonChart,
  getPeriodSnapshot,
} from './incomeAnalytics';

const ts = (year: number, month: number, day: number, hour = 0, minute = 0): number => {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
};

const makeOrder = (overrides: Partial<Order>): Order => ({
  id: overrides.id || 'order-1',
  displayId: overrides.displayId || '1',
  folderId: overrides.folderId || 'folder-1',
  clientId: overrides.clientId || 'client-1',
  clientName: overrides.clientName || 'Client',
  itemType: overrides.itemType || 'Dress',
  description: overrides.description || '',
  status: overrides.status || 'חדש',
  deadline: overrides.deadline || 'ללא יעד',
  price: overrides.price ?? 0,
  deposit: overrides.deposit ?? 0,
  fabricNotes: overrides.fabricNotes || '',
  createdAt: overrides.createdAt ?? ts(2026, 1, 1),
  updatedAt: overrides.updatedAt ?? ts(2026, 1, 1),
  readyAt: overrides.readyAt,
});

describe('incomeAnalytics', () => {
  it('compares full closed month against previous full month (MoM)', () => {
    const nowTs = ts(2026, 2, 15, 12, 0);
    const orders: Order[] = [
      makeOrder({ id: 'jan-1', price: 100, readyAt: ts(2026, 1, 10, 9, 0), createdAt: ts(2026, 1, 1) }),
      makeOrder({ id: 'jan-2', price: 50, createdAt: ts(2026, 1, 20, 8, 0) }),
      makeOrder({ id: 'dec-1', price: 40, readyAt: ts(2025, 12, 5, 14, 0), createdAt: ts(2025, 12, 1) }),
      makeOrder({ id: 'dec-2', price: 60, readyAt: ts(2025, 12, 30, 18, 0), createdAt: ts(2025, 12, 1) }),
      makeOrder({ id: 'ignore-zero', price: 0, readyAt: ts(2026, 1, 3, 10, 0), createdAt: ts(2026, 1, 3, 10, 0) }),
    ];

    const comparison = getComparisonForPeriod(orders, 'month', -1, 'mom', nowTs);

    expect(comparison.current.total).toBe(150);
    expect(comparison.current.count).toBe(2);
    expect(comparison.current.start.getMonth()).toBe(0);
    expect(comparison.current.end.getDate()).toBe(31);
    expect(comparison.baseline.total).toBe(100);
    expect(comparison.baseline.count).toBe(2);
    expect(comparison.deltaAmount).toBe(50);
    expect(comparison.deltaPercent).toBe(50);
  });

  it('uses same day/time cutoff for open current month comparison (MoM)', () => {
    const nowTs = ts(2026, 2, 15, 12, 0);
    const orders: Order[] = [
      makeOrder({ id: 'cur-1', price: 100, createdAt: ts(2026, 2, 1, 8, 0) }),
      makeOrder({ id: 'cur-2', price: 20, readyAt: ts(2026, 2, 15, 10, 0), createdAt: ts(2026, 2, 10) }),
      makeOrder({ id: 'cur-late', price: 999, readyAt: ts(2026, 2, 15, 13, 0), createdAt: ts(2026, 2, 15, 13, 0) }),
      makeOrder({ id: 'base-1', price: 50, createdAt: ts(2026, 1, 1, 9, 0) }),
      makeOrder({ id: 'base-2', price: 30, readyAt: ts(2026, 1, 15, 11, 0), createdAt: ts(2026, 1, 15, 11, 0) }),
      makeOrder({ id: 'base-late', price: 70, createdAt: ts(2026, 1, 15, 13, 0) }),
    ];

    const comparison = getComparisonForPeriod(orders, 'month', 0, 'mom', nowTs);

    expect(comparison.current.total).toBe(120);
    expect(comparison.baseline.total).toBe(80);
    expect(comparison.current.end.getDate()).toBe(15);
    expect(comparison.current.end.getHours()).toBe(12);
    expect(comparison.baseline.end.getDate()).toBe(15);
    expect(comparison.baseline.end.getHours()).toBe(12);
  });

  it('clamps YoY baseline for leap-year February alignment', () => {
    const nowTs = ts(2024, 2, 29, 12, 0);
    const orders: Order[] = [
      makeOrder({ id: 'cur-leap', price: 90, createdAt: ts(2024, 2, 29, 10, 0) }),
      makeOrder({ id: 'base-end', price: 40, createdAt: ts(2023, 2, 28, 20, 0) }),
      makeOrder({ id: 'base-overflow', price: 200, createdAt: ts(2023, 3, 1, 10, 0) }),
    ];

    const comparison = getComparisonForPeriod(orders, 'month', 0, 'yoy', nowTs);

    expect(comparison.current.total).toBe(90);
    expect(comparison.baseline.total).toBe(40);
    expect(comparison.baseline.end.getMonth()).toBe(1);
    expect(comparison.baseline.end.getDate()).toBe(28);
  });

  it('returns null deltaPercent when baseline is zero', () => {
    const nowTs = ts(2026, 3, 10, 8, 0);
    const orders: Order[] = [
      makeOrder({ id: 'current-only', price: 100, createdAt: ts(2026, 3, 3, 10, 0) }),
    ];

    const comparison = getComparisonForPeriod(orders, 'month', 0, 'mom', nowTs);

    expect(comparison.current.total).toBe(100);
    expect(comparison.baseline.total).toBe(0);
    expect(comparison.deltaPercent).toBeNull();
  });

  it('uses YTD comparison for current year against previous year', () => {
    const nowTs = ts(2026, 8, 10, 15, 30);
    const orders: Order[] = [
      makeOrder({ id: 'cur-jan', price: 120, createdAt: ts(2026, 1, 1, 12, 0) }),
      makeOrder({ id: 'cur-cutoff', price: 180, createdAt: ts(2026, 8, 10, 10, 0) }),
      makeOrder({ id: 'cur-after', price: 500, createdAt: ts(2026, 8, 10, 20, 0) }),
      makeOrder({ id: 'base-jan', price: 80, createdAt: ts(2025, 1, 1, 11, 0) }),
      makeOrder({ id: 'base-cutoff', price: 120, createdAt: ts(2025, 8, 10, 14, 0) }),
      makeOrder({ id: 'base-after', price: 700, createdAt: ts(2025, 8, 10, 23, 0) }),
    ];

    const comparison = getComparisonForPeriod(orders, 'year', 0, 'mom', nowTs);

    expect(comparison.current.total).toBe(300);
    expect(comparison.baseline.total).toBe(200);
    expect(comparison.current.end.getMonth()).toBe(7);
    expect(comparison.current.end.getDate()).toBe(10);
    expect(comparison.baseline.end.getMonth()).toBe(7);
    expect(comparison.baseline.end.getDate()).toBe(10);
  });

  it('prefers readyAt over createdAt when selecting the revenue date', () => {
    const nowTs = ts(2026, 4, 20, 12, 0);
    const orders: Order[] = [
      makeOrder({
        id: 'ready-wins',
        price: 100,
        createdAt: ts(2026, 4, 10, 9, 0),
        readyAt: ts(2026, 3, 15, 9, 0),
      }),
      makeOrder({ id: 'current', price: 50, createdAt: ts(2026, 4, 5, 10, 0) }),
    ];

    const comparison = getComparisonForPeriod(orders, 'month', 0, 'mom', nowTs);

    expect(comparison.current.total).toBe(50);
    expect(comparison.baseline.total).toBe(100);
  });

  it('builds monthly daily chart for open month with day-aligned baseline', () => {
    const nowTs = ts(2026, 2, 3, 10, 0);
    const orders: Order[] = [
      makeOrder({ id: 'cur-day-1', price: 10, createdAt: ts(2026, 2, 1, 8, 0) }),
      makeOrder({ id: 'cur-day-3', price: 20, createdAt: ts(2026, 2, 3, 9, 0) }),
      makeOrder({ id: 'base-day-1', price: 7, createdAt: ts(2026, 1, 1, 8, 0) }),
      makeOrder({ id: 'base-day-3', price: 5, createdAt: ts(2026, 1, 3, 9, 0) }),
    ];

    const chart = getMonthlyDailyComparisonChart(orders, 0, 'mom', nowTs);
    const snapshot = getPeriodSnapshot(orders, 'month', 0, nowTs);

    expect(chart.points).toHaveLength(3);
    expect(chart.points[0]).toEqual({ day: 1, currentTotal: 10, baselineTotal: 7 });
    expect(chart.points[2]).toEqual({ day: 3, currentTotal: 20, baselineTotal: 5 });
    expect(chart.totalCurrent).toBe(snapshot.total);
    expect(chart.totalCurrent).toBe(30);
    expect(chart.totalBaseline).toBe(12);
  });
});
