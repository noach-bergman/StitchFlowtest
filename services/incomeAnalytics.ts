import { Order } from '../types';

export type ComparisonMode = 'mom' | 'yoy';
export type PeriodKind = 'week' | 'month' | 'year';

export interface PeriodSnapshot {
  total: number;
  count: number;
  start: Date;
  end: Date;
}

export interface ComparisonResult {
  current: PeriodSnapshot;
  baseline: PeriodSnapshot;
  deltaAmount: number;
  deltaPercent: number | null;
}

export interface DailyPoint {
  day: number;
  currentTotal: number;
  baselineTotal: number;
}

export interface MonthlyChartModel {
  monthLabel: string;
  baselineLabel: string;
  points: DailyPoint[];
  totalCurrent: number;
  totalBaseline: number;
  deltaAmount: number;
  deltaPercent: number | null;
}

interface PeriodRange {
  start: Date;
  end: Date;
}

const endOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const minDate = (a: Date, b: Date): Date => (a.getTime() <= b.getTime() ? a : b);

const resolveRevenueDate = (order: Order): number => order.readyAt ?? order.createdAt;

const getRangeTotals = (orders: Order[], startTs: number, endTs: number): { total: number; count: number } => {
  let total = 0;
  let count = 0;

  for (const order of orders) {
    if (!(order.price > 0)) continue;
    const targetTs = resolveRevenueDate(order);
    if (targetTs < startTs || targetTs > endTs) continue;
    total += order.price || 0;
    count += 1;
  }

  return { total, count };
};

const getWeekRange = (now: Date, offset: number): PeriodRange => {
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + (offset * 7));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const getMonthRange = (now: Date, offset: number): PeriodRange => {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const getYearRange = (now: Date, offset: number): PeriodRange => {
  const targetYear = now.getFullYear() + offset;
  const start = new Date(targetYear, 0, 1, 0, 0, 0, 0);
  const end = new Date(targetYear, 11, 31, 23, 59, 59, 999);
  return { start, end };
};

const getPeriodRange = (kind: PeriodKind, offset: number, now: Date): PeriodRange => {
  if (kind === 'week') return getWeekRange(now, offset);
  if (kind === 'month') return getMonthRange(now, offset);
  return getYearRange(now, offset);
};

const applyOpenPeriodCutoff = (range: PeriodRange, offset: number, now: Date): PeriodRange => {
  if (offset !== 0) return range;
  return {
    start: range.start,
    end: minDate(range.end, now),
  };
};

const alignBaselineRange = (current: PeriodRange, baselineFull: PeriodRange, offset: number): PeriodRange => {
  if (offset !== 0) return baselineFull;

  const elapsedMs = current.end.getTime() - current.start.getTime();
  const alignedEnd = new Date(baselineFull.start.getTime() + elapsedMs);

  return {
    start: baselineFull.start,
    end: minDate(alignedEnd, baselineFull.end),
  };
};

const getBaselineOffset = (kind: PeriodKind, offset: number, mode: ComparisonMode): number => {
  if (kind === 'week') return offset - 1;
  if (kind === 'year') return offset - 1;
  return mode === 'mom' ? offset - 1 : offset - 12;
};

const toSnapshot = (orders: Order[], range: PeriodRange): PeriodSnapshot => {
  const { total, count } = getRangeTotals(orders, range.start.getTime(), range.end.getTime());
  return {
    total,
    count,
    start: range.start,
    end: range.end,
  };
};

const computeDeltaPercent = (baselineTotal: number, deltaAmount: number): number | null => {
  if (baselineTotal <= 0) return null;
  return (deltaAmount / baselineTotal) * 100;
};

export const getPeriodSnapshot = (
  orders: Order[],
  kind: PeriodKind,
  offset: number,
  nowTs: number = Date.now(),
): PeriodSnapshot => {
  const now = new Date(nowTs);
  const fullRange = getPeriodRange(kind, offset, now);
  const boundedRange = applyOpenPeriodCutoff(fullRange, offset, now);
  return toSnapshot(orders, boundedRange);
};

export const getComparisonForPeriod = (
  orders: Order[],
  kind: PeriodKind,
  offset: number,
  mode: ComparisonMode,
  nowTs: number = Date.now(),
): ComparisonResult => {
  const now = new Date(nowTs);
  const currentFull = getPeriodRange(kind, offset, now);
  const currentRange = applyOpenPeriodCutoff(currentFull, offset, now);
  const baselineOffset = getBaselineOffset(kind, offset, mode);
  const baselineFull = getPeriodRange(kind, baselineOffset, now);
  const baselineRange = alignBaselineRange(currentRange, baselineFull, offset);

  const current = toSnapshot(orders, currentRange);
  const baseline = toSnapshot(orders, baselineRange);
  const deltaAmount = current.total - baseline.total;

  return {
    current,
    baseline,
    deltaAmount,
    deltaPercent: computeDeltaPercent(baseline.total, deltaAmount),
  };
};

export const getMonthlyDailyComparisonChart = (
  orders: Order[],
  monthOffset: number,
  mode: ComparisonMode,
  nowTs: number = Date.now(),
): MonthlyChartModel => {
  const now = new Date(nowTs);
  const currentFull = getPeriodRange('month', monthOffset, now);
  const currentRange = applyOpenPeriodCutoff(currentFull, monthOffset, now);
  const baselineOffset = getBaselineOffset('month', monthOffset, mode);
  const baselineFull = getPeriodRange('month', baselineOffset, now);
  const baselineRange = alignBaselineRange(currentRange, baselineFull, monthOffset);

  const currentYear = currentFull.start.getFullYear();
  const currentMonth = currentFull.start.getMonth();
  const baselineYear = baselineFull.start.getFullYear();
  const baselineMonth = baselineFull.start.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInBaselineMonth = new Date(baselineYear, baselineMonth + 1, 0).getDate();
  const visibleDays = monthOffset === 0 ? currentRange.end.getDate() : daysInMonth;
  const points: DailyPoint[] = [];

  for (let day = 1; day <= visibleDays; day += 1) {
    const currentDayStart = new Date(currentYear, currentMonth, day, 0, 0, 0, 0);
    const currentDayEnd = minDate(endOfDay(currentDayStart), currentRange.end);
    const currentTotals = getRangeTotals(orders, currentDayStart.getTime(), currentDayEnd.getTime());

    let baselineTotals = { total: 0, count: 0 };
    if (day <= daysInBaselineMonth) {
      const baselineDayStart = new Date(baselineYear, baselineMonth, day, 0, 0, 0, 0);
      const baselineDayEnd = minDate(endOfDay(baselineDayStart), baselineRange.end);

      if (baselineDayStart.getTime() <= baselineRange.end.getTime()) {
        baselineTotals = getRangeTotals(orders, baselineDayStart.getTime(), baselineDayEnd.getTime());
      }
    }

    points.push({
      day,
      currentTotal: currentTotals.total,
      baselineTotal: baselineTotals.total,
    });
  }

  const totalCurrent = points.reduce((sum, point) => sum + point.currentTotal, 0);
  const totalBaseline = points.reduce((sum, point) => sum + point.baselineTotal, 0);
  const deltaAmount = totalCurrent - totalBaseline;

  return {
    monthLabel: currentFull.start.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
    baselineLabel: baselineFull.start.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
    points,
    totalCurrent,
    totalBaseline,
    deltaAmount,
    deltaPercent: computeDeltaPercent(totalBaseline, deltaAmount),
  };
};
