import { describe, expect, it } from 'vitest';
import { Task } from '../types';
import { getTaskSummary, isTaskDueToday, isTaskOverdue } from './taskUtils';

const baseTask: Task = {
  id: 'task-1',
  title: 'בדיקה',
  description: '',
  status: 'חדש',
  priority: 'רגילה',
  dueAt: null,
  assigneeUserId: null,
  createdByUserId: 'user-1',
  createdAt: 0,
  updatedAt: 0,
};

describe('taskUtils', () => {
  it('marks task as overdue when due date is in the past and task is open', () => {
    const now = new Date('2026-02-13T12:00:00.000Z').getTime();
    const task: Task = { ...baseTask, dueAt: new Date('2026-02-12T23:00:00.000Z').getTime() };
    expect(isTaskOverdue(task, now)).toBe(true);
  });

  it('does not mark completed task as overdue', () => {
    const now = new Date('2026-02-13T12:00:00.000Z').getTime();
    const task: Task = { ...baseTask, status: 'הושלם', dueAt: new Date('2026-02-12T23:00:00.000Z').getTime() };
    expect(isTaskOverdue(task, now)).toBe(false);
  });

  it('detects tasks due today', () => {
    const now = new Date('2026-02-13T10:00:00.000Z').getTime();
    const task: Task = { ...baseTask, dueAt: new Date('2026-02-13T20:00:00.000Z').getTime() };
    expect(isTaskDueToday(task, now)).toBe(true);
  });

  it('builds summary counts for overdue, today, unassigned and urgent', () => {
    const now = new Date('2026-02-13T12:00:00.000Z').getTime();
    const tasks: Task[] = [
      { ...baseTask, id: 'overdue', dueAt: new Date('2026-02-12T08:00:00.000Z').getTime() },
      { ...baseTask, id: 'today', dueAt: new Date('2026-02-13T18:00:00.000Z').getTime(), assigneeUserId: 'staff-1' },
      { ...baseTask, id: 'urgent', priority: 'דחופה', assigneeUserId: 'staff-1' },
      { ...baseTask, id: 'done', status: 'הושלם', dueAt: new Date('2026-02-11T08:00:00.000Z').getTime() },
    ];

    expect(getTaskSummary(tasks, now)).toEqual({
      overdue: 1,
      dueToday: 1,
      unassigned: 1,
      urgentOrOverdue: 2,
    });
  });
});
