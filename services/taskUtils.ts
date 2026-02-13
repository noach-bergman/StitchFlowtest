import { Task } from '../types';

export interface TaskSummary {
  overdue: number;
  dueToday: number;
  unassigned: number;
  urgentOrOverdue: number;
}

const startOfDay = (time: number): number => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const endOfDay = (time: number): number => {
  const date = new Date(time);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
};

export const dateInputToDueAt = (dateInput: string): number | null => {
  if (!dateInput) return null;
  const dueDate = new Date(dateInput);
  if (Number.isNaN(dueDate.getTime())) return null;
  dueDate.setHours(23, 59, 59, 999);
  return dueDate.getTime();
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
  const dayEnd = endOfDay(now);
  return task.dueAt >= dayStart && task.dueAt <= dayEnd;
};

export const getTaskSummary = (tasks: Task[], now = Date.now()): TaskSummary => {
  const overdue = tasks.filter(task => isTaskOverdue(task, now)).length;
  const dueToday = tasks.filter(task => isTaskDueToday(task, now)).length;
  const unassigned = tasks.filter(task => !isTaskClosed(task) && !task.assigneeUserId).length;
  const urgentOrOverdue = tasks.filter(task => !isTaskClosed(task) && (task.priority === 'דחופה' || isTaskOverdue(task, now))).length;

  return { overdue, dueToday, unassigned, urgentOrOverdue };
};

export const formatTaskDueDate = (dueAt: number | null | undefined): string => {
  if (!dueAt) return 'ללא יעד';
  return new Date(dueAt).toLocaleDateString('he-IL');
};
