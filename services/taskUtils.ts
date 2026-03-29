import { Task, TaskKind } from '../types';

export interface TaskSummary {
  overdue: number;
  dueToday: number;
  unassigned: number;
  urgentOrOverdue: number;
}

export interface TaskHousekeepingResult {
  tasks: Task[];
  changed: boolean;
  normalizedCount: number;
  removedCompletedCount: number;
}

export const TASKS_LAST_HOUSEKEEPING_DAY_KEY = 'stitchflow_tasks_last_housekeeping_day';

const startOfDay = (time: number): number => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const getEndOfDayTimestamp = (time: number): number => {
  const date = new Date(time);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
};

export const getLocalDayKey = (time = Date.now()): string => {
  const date = new Date(time);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getStoredTaskHousekeepingDay = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TASKS_LAST_HOUSEKEEPING_DAY_KEY);
};

export const setStoredTaskHousekeepingDay = (dayKey: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TASKS_LAST_HOUSEKEEPING_DAY_KEY, dayKey);
};

const inferTaskKind = (task: Task): TaskKind => {
  if (task.kind) return task.kind;
  if (task.folderChecklist && task.folderChecklist.length > 0) return 'folder';
  if (task.orderSnapshot || task.orderId) return 'order';
  if (task.folderId) return 'folder';
  return 'general';
};

const normalizeTaskForDailyBoard = (task: Task, now: number): { task: Task; changed: boolean } => {
  const inferredKind = inferTaskKind(task);
  const normalizedDueAt = task.dueAt ?? getEndOfDayTimestamp(task.createdAt || now);
  const changed = task.kind !== inferredKind || task.dueAt !== normalizedDueAt;
  if (!changed) return { task, changed: false };

  return {
    task: {
      ...task,
      kind: inferredKind,
      dueAt: normalizedDueAt,
    },
    changed: true,
  };
};

export const dateInputToDueAt = (dateInput: string): number | null => {
  if (!dateInput) return null;
  const dueDate = new Date(dateInput);
  if (Number.isNaN(dueDate.getTime())) return null;
  return getEndOfDayTimestamp(dueDate.getTime());
};

export const dueAtToDateInput = (dueAt: number | null | undefined): string => {
  if (!dueAt) return '';
  return new Date(dueAt).toISOString().slice(0, 10);
};

export const isTaskClosed = (task: Task): boolean => task.status === 'הושלם';

export const isTaskOverdue = (task: Task, now = Date.now()): boolean => {
  if (isTaskClosed(task) || !task.dueAt) return false;
  return task.dueAt < now;
};

export const isTaskDueToday = (task: Task, now = Date.now()): boolean => {
  if (isTaskClosed(task) || !task.dueAt) return false;
  const dayStart = startOfDay(now);
  const dayEnd = getEndOfDayTimestamp(now);
  return task.dueAt >= dayStart && task.dueAt <= dayEnd;
};

export const getTaskSummary = (tasks: Task[], now = Date.now()): TaskSummary => {
  const overdue = tasks.filter(task => isTaskOverdue(task, now)).length;
  const dueToday = tasks.filter(task => isTaskDueToday(task, now)).length;
  const unassigned = tasks.filter(task => !isTaskClosed(task) && !task.assigneeUserId).length;
  const urgentOrOverdue = tasks.filter(task => !isTaskClosed(task) && (task.priority === 'דחופה' || isTaskOverdue(task, now))).length;

  return { overdue, dueToday, unassigned, urgentOrOverdue };
};

export const applyDailyTaskHousekeeping = (
  tasks: Task[],
  now = Date.now(),
  shouldCleanupCompleted = false
): TaskHousekeepingResult => {
  const startToday = startOfDay(now);
  const nextTasks: Task[] = [];
  let normalizedCount = 0;
  let removedCompletedCount = 0;

  for (const task of tasks) {
    const normalized = normalizeTaskForDailyBoard(task, now);
    if (normalized.changed) normalizedCount += 1;

    if (shouldCleanupCompleted && normalized.task.status === 'הושלם') {
      const completedAt = normalized.task.completedAt ?? normalized.task.updatedAt ?? normalized.task.createdAt ?? now;
      if (completedAt < startToday) {
        removedCompletedCount += 1;
        continue;
      }
    }

    nextTasks.push(normalized.task);
  }

  return {
    tasks: nextTasks,
    changed: normalizedCount > 0 || removedCompletedCount > 0,
    normalizedCount,
    removedCompletedCount,
  };
};

export const formatTaskDueDate = (dueAt: number | null | undefined): string => {
  if (!dueAt) return 'ללא יעד';
  return new Date(dueAt).toLocaleDateString('he-IL');
};
