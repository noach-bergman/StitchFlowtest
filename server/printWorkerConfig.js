export const MAX_PRINT_ATTEMPTS = 5;
export const RETRY_DELAYS_MS = [2000, 5000, 15000, 30000, 60000];
export const DEFAULT_POLL_INTERVAL_MS = 2000;
export const DEFAULT_SOCKET_TIMEOUT_MS = 7000;

export const getRetryDelayMs = (attemptNumber) => {
  const safeAttempt = Math.max(1, Number(attemptNumber) || 1);
  return RETRY_DELAYS_MS[Math.min(safeAttempt - 1, RETRY_DELAYS_MS.length - 1)];
};
