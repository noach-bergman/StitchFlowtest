import { Folder, Order, PaymentStatus } from '../types';

const toSafeNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

export const normalizePaidAmount = (folder: Pick<Folder, 'paidAmount' | 'isPaid'>): number => {
  const paidAmount = toSafeNumber(folder.paidAmount);
  if (paidAmount <= 0) return 0;
  return paidAmount;
};

export const getFolderTotal = (folderId: string, orders: Order[]): number => {
  return orders
    .filter((order) => order.folderId === folderId)
    .reduce((sum, order) => sum + Math.max(0, toSafeNumber(order.price)), 0);
};

export const getEffectivePaidAmount = (
  folder: Pick<Folder, 'paidAmount' | 'isPaid'>,
  total: number,
): number => {
  const normalizedPaid = normalizePaidAmount(folder);
  if (normalizedPaid > 0) return normalizedPaid;
  if (folder.isPaid && total > 0) return total;
  return normalizedPaid;
};

export const getPaymentStatus = (total: number, paidAmount: number): PaymentStatus => {
  const safeTotal = Math.max(0, toSafeNumber(total));
  const safePaid = Math.max(0, toSafeNumber(paidAmount));

  if (safePaid <= 0) return 'לא שולם';
  if (safeTotal > 0 && safePaid < safeTotal) return 'שולם חלקית';
  if (safeTotal > 0 && safePaid >= safeTotal) return 'שולם';
  return 'לא שולם';
};

export const getRemaining = (total: number, paidAmount: number): number => {
  const safeTotal = Math.max(0, toSafeNumber(total));
  const safePaid = Math.max(0, toSafeNumber(paidAmount));
  return Math.max(safeTotal - safePaid, 0);
};
