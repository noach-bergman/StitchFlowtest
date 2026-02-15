import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Edit2,
  GripVertical,
  ListFilter,
  ListTodo,
  Plus,
  ShieldAlert,
  Trash2,
  UserCircle2,
  X
} from 'lucide-react';
import { Client, Folder, Order, Task, TaskKind, TaskPriority, TaskStatus, User } from '../types';
import { formatTaskDueDate, getEndOfDayTimestamp, getTaskSummary, isTaskDueToday, isTaskOverdue } from '../services/taskUtils';

const TASK_STATUSES: TaskStatus[] = ['חדש', 'בטיפול', 'בהמתנה', 'הושלם'];
const TASK_PRIORITIES: TaskPriority[] = ['נמוכה', 'רגילה', 'גבוהה', 'דחופה'];

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  נמוכה: 'bg-slate-100 text-slate-600 border-slate-200',
  רגילה: 'bg-blue-100 text-blue-700 border-blue-200',
  גבוהה: 'bg-amber-100 text-amber-700 border-amber-200',
  דחופה: 'bg-rose-100 text-rose-700 border-rose-200',
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  חדש: 'border-blue-100',
  בטיפול: 'border-violet-100',
  בהמתנה: 'border-amber-100',
  הושלם: 'border-emerald-100',
};

interface TaskFormState {
  title: string;
  description: string;
  kind: TaskKind;
  clientId: string;
  folderId: string;
  orderId: string;
}

type TaskChecklistItem = NonNullable<Task['folderChecklist']>[number];

export interface TaskPrefill {
  title?: string;
  description?: string;
  kind?: TaskKind;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: number | null;
  assigneeUserId?: string | null;
  clientId?: string;
  folderId?: string;
  orderId?: string;
}

interface TasksBoardProps {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void | Promise<void>;
  users: User[];
  currentUser: User;
  clients: Client[];
  folders: Folder[];
  orders: Order[];
  initialDraft?: TaskPrefill | null;
  onConsumeInitialDraft?: () => void;
}

const priorityRank: Record<TaskPriority, number> = {
  דחופה: 1,
  גבוהה: 2,
  רגילה: 3,
  נמוכה: 4,
};

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 9);
  }
  return Math.random().toString(36).slice(2, 11);
};

const derivePrefillKind = (prefill?: TaskPrefill | null): TaskKind => {
  if (prefill?.kind) return prefill.kind;
  if (prefill?.orderId) return 'order';
  if (prefill?.folderId) return 'folder';
  return 'general';
};

const buildDefaultForm = (prefill?: TaskPrefill | null): TaskFormState => ({
  title: prefill?.title || '',
  description: prefill?.description || '',
  kind: derivePrefillKind(prefill),
  clientId: prefill?.clientId || '',
  folderId: prefill?.folderId || '',
  orderId: prefill?.orderId || '',
});

const TasksBoard: React.FC<TasksBoardProps> = ({
  tasks,
  setTasks,
  users,
  currentUser,
  clients,
  folders,
  orders,
  initialDraft,
  onConsumeInitialDraft
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormState>(() => buildDefaultForm(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isClearCompletedModalOpen, setIsClearCompletedModalOpen] = useState(false);

  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'הכל'>('הכל');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const isViewer = currentUser.role === 'viewer';
  const canCreateTask = !isViewer;

  const allUsers = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((user) => map.set(user.id, user));
    map.set(currentUser.id, currentUser);
    return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username, 'he'));
  }, [users, currentUser]);

  const usersById = useMemo(() => new Map(allUsers.map((user) => [user.id, user])), [allUsers]);
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const foldersById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const ordersByFolderId = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of orders) {
      const list = map.get(order.folderId) || [];
      list.push(order);
      map.set(order.folderId, list);
    }
    return map;
  }, [orders]);

  const summary = useMemo(() => getTaskSummary(tasks), [tasks]);
  const completedTasksCount = useMemo(() => tasks.filter((task) => task.status === 'הושלם').length, [tasks]);

  useEffect(() => {
    if (!activeTask) return;
    const refreshed = tasks.find((task) => task.id === activeTask.id);
    if (!refreshed) {
      setActiveTask(null);
      return;
    }
    setActiveTask(refreshed);
  }, [tasks, activeTask]);

  const canEditTask = (task: Task): boolean => {
    if (isViewer) return false;
    if (isAdmin) return true;
    return task.status !== 'הושלם';
  };

  const getTaskKind = (task: Task): TaskKind => {
    if (task.kind) return task.kind;
    if (task.folderChecklist && task.folderChecklist.length > 0) return 'folder';
    if (task.orderSnapshot || task.orderId) return 'order';
    if (task.folderId) return 'folder';
    return 'general';
  };

  const getOrderSnapshot = (task: Task) => {
    if (task.orderSnapshot) return task.orderSnapshot;
    if (!task.orderId) return null;
    const order = ordersById.get(task.orderId);
    if (!order) return null;
    const folder = foldersById.get(order.folderId);
    return {
      orderId: order.id,
      displayId: order.displayId,
      itemType: order.itemType,
      description: order.description,
      clientName: order.clientName,
      folderName: folder?.name,
    };
  };

  const getFolderChecklist = (task: Task): TaskChecklistItem[] => {
    if (task.folderChecklist && task.folderChecklist.length > 0) return task.folderChecklist;
    if (!task.folderId) return [];
    const folderOrders = ordersByFolderId.get(task.folderId) || [];
    return folderOrders.map((order): TaskChecklistItem => ({
      orderId: order.id,
      displayId: order.displayId,
      itemType: order.itemType,
      description: order.description,
      done: false,
    }));
  };

  const saveTaskList = async (nextTasks: Task[]) => {
    setIsSaving(true);
    setBoardError(null);
    try {
      await Promise.resolve(setTasks(nextTasks));
    } catch (err: any) {
      setBoardError(`שמירת המשימות נכשלה: ${err?.message || 'שגיאה לא ידועה'}`);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const openCreateModal = (prefill?: TaskPrefill | null) => {
    if (!canCreateTask) return;
    setEditingTask(null);
    setForm(buildDefaultForm(prefill));
    setFormError(null);
    setBoardError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    if (!canEditTask(task)) return;
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      kind: getTaskKind(task),
      clientId: task.clientId || '',
      folderId: task.folderId || '',
      orderId: task.orderId || '',
    });
    setFormError(null);
    setBoardError(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!initialDraft) return;
    if (canCreateTask) {
      openCreateModal(initialDraft);
    }
    if (onConsumeInitialDraft) onConsumeInitialDraft();
  }, [initialDraft, canCreateTask, onConsumeInitialDraft]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (assigneeFilter === 'unassigned' && task.assigneeUserId) return false;
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && task.assigneeUserId !== assigneeFilter) return false;
      if (priorityFilter !== 'הכל' && task.priority !== priorityFilter) return false;
      if (showOverdueOnly && !isTaskOverdue(task)) return false;
      return true;
    });
  }, [tasks, assigneeFilter, priorityFilter, showOverdueOnly]);

  const groupedTasks = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      חדש: [],
      בטיפול: [],
      בהמתנה: [],
      הושלם: [],
    };

    filteredTasks.forEach((task) => grouped[task.status].push(task));
    TASK_STATUSES.forEach((status) => {
      grouped[status].sort((a, b) => {
        const aOverdue = isTaskOverdue(a);
        const bOverdue = isTaskOverdue(b);
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        if (priorityRank[a.priority] !== priorityRank[b.priority]) {
          return priorityRank[a.priority] - priorityRank[b.priority];
        }
        return b.updatedAt - a.updatedAt;
      });
    });
    return grouped;
  }, [filteredTasks]);

  const upsertTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('יש להזין כותרת משימה.');
      return;
    }

    const now = Date.now();
    const taskKind = form.kind || 'general';
    const linkedOrder = form.orderId ? ordersById.get(form.orderId) : null;
    const linkedFolder = form.folderId ? foldersById.get(form.folderId) : null;
    const linkedClient = form.clientId ? clientsById.get(form.clientId) : null;

    if (editingTask) {
      const nextTasks = tasks.map((task) => {
        if (task.id !== editingTask.id) return task;
        return {
          ...task,
          title: form.title.trim(),
          description: form.description.trim(),
          updatedAt: now,
        };
      });
      try {
        await saveTaskList(nextTasks);
        setIsModalOpen(false);
        setEditingTask(null);
        setForm(buildDefaultForm(null));
      } catch {
        // Error handled in saveTaskList
      }
      return;
    }

    const orderSnapshot = taskKind === 'order' && linkedOrder
      ? {
          orderId: linkedOrder.id,
          displayId: linkedOrder.displayId,
          itemType: linkedOrder.itemType,
          description: linkedOrder.description,
          clientName: linkedOrder.clientName,
          folderName: linkedFolder?.name,
        }
      : undefined;

    const folderChecklist = taskKind === 'folder' && linkedFolder
      ? (ordersByFolderId.get(linkedFolder.id) || []).map((order) => ({
          orderId: order.id,
          displayId: order.displayId,
          itemType: order.itemType,
          description: order.description,
          done: false,
        }))
      : undefined;

    const resolvedClientId = linkedOrder?.clientId || linkedFolder?.clientId || linkedClient?.id || form.clientId || undefined;
    const resolvedFolderId = linkedOrder?.folderId || linkedFolder?.id || form.folderId || undefined;
    const resolvedOrderId = linkedOrder?.id || form.orderId || undefined;

    const newTask: Task = {
      id: randomId(),
      title: form.title.trim(),
      description: form.description.trim(),
      kind: taskKind,
      status: 'חדש',
      priority: 'רגילה',
      dueAt: getEndOfDayTimestamp(now),
      assigneeUserId: null,
      createdByUserId: currentUser.id,
      clientId: resolvedClientId,
      folderId: resolvedFolderId,
      orderId: resolvedOrderId,
      orderSnapshot,
      folderChecklist,
      createdAt: now,
      updatedAt: now,
    };

    const nextTasks = [newTask, ...tasks];
    try {
      await saveTaskList(nextTasks);
      setIsModalOpen(false);
      setEditingTask(null);
      setForm(buildDefaultForm(null));
    } catch {
      // Error handled in saveTaskList
    }
  };

  const moveTaskToStatus = async (task: Task, status: TaskStatus) => {
    if (!canEditTask(task) || task.status === status) return;
    const now = Date.now();
    const nextTasks = tasks.map((item) => {
      if (item.id !== task.id) return item;
      return {
        ...item,
        status,
        updatedAt: now,
        completedAt: status === 'הושלם' ? (item.completedAt || now) : undefined,
      };
    });
    setActiveTask((prev) => nextTasks.find((t) => t.id === prev?.id) || null);
    try {
      await saveTaskList(nextTasks);
    } catch {
      // Error handled in saveTaskList
    }
  };

  const reassignTask = async (task: Task, assigneeUserId: string) => {
    if (!canEditTask(task)) return;
    const now = Date.now();
    const nextTasks = tasks.map((item) => {
      if (item.id !== task.id) return item;
      return {
        ...item,
        assigneeUserId: assigneeUserId || null,
        updatedAt: now,
      };
    });
    setActiveTask((prev) => nextTasks.find((t) => t.id === prev?.id) || null);
    try {
      await saveTaskList(nextTasks);
    } catch {
      // Error handled in saveTaskList
    }
  };

  const markTaskCompleted = async (task: Task) => {
    if (!canEditTask(task) || task.status === 'הושלם') return;
    const now = Date.now();
    const checklist = getTaskKind(task) === 'folder'
      ? getFolderChecklist(task).map((item) => ({ ...item, done: true, doneAt: item.doneAt || now }))
      : task.folderChecklist;
    const nextTasks = tasks.map((item) => {
      if (item.id !== task.id) return item;
      return {
        ...item,
        status: 'הושלם' as TaskStatus,
        folderChecklist: checklist,
        updatedAt: now,
        completedAt: item.completedAt || now,
      };
    });
    setActiveTask((prev) => nextTasks.find((t) => t.id === prev?.id) || null);
    try {
      await saveTaskList(nextTasks);
    } catch {
      // Error handled in saveTaskList
    }
  };

  const toggleChecklistItem = async (task: Task, orderId: string, done: boolean) => {
    if (!canEditTask(task) || getTaskKind(task) !== 'folder') return;
    const now = Date.now();
    const currentChecklist = getFolderChecklist(task);
    if (currentChecklist.length === 0) return;

    const nextChecklist = currentChecklist.map((item): TaskChecklistItem => {
      if (item.orderId !== orderId) return item;
      return {
        ...item,
        done,
        doneAt: done ? now : undefined,
      };
    });

    const allDone = nextChecklist.every((item) => item.done);
    const nextTasks = tasks.map((item) => {
      if (item.id !== task.id) return item;
      const nextStatus: TaskStatus = allDone
        ? 'הושלם'
        : (item.status === 'הושלם' ? 'חדש' : item.status);
      return {
        ...item,
        kind: 'folder' as TaskKind,
        folderChecklist: nextChecklist,
        status: nextStatus,
        updatedAt: now,
        completedAt: allDone ? (item.completedAt || now) : undefined,
      };
    });
    setActiveTask((prev) => nextTasks.find((t) => t.id === prev?.id) || null);
    try {
      await saveTaskList(nextTasks);
    } catch {
      // Error handled in saveTaskList
    }
  };

  const requestDeleteTask = (task: Task) => {
    if (!isAdmin) return;
    setTaskToDelete(task);
  };

  const confirmDeleteTask = async () => {
    if (!isAdmin || !taskToDelete) return;
    const targetId = taskToDelete.id;
    const nextTasks = tasks.filter((item) => item.id !== targetId);
    setActiveTask((prev) => (prev?.id === targetId ? null : prev));
    try {
      await saveTaskList(nextTasks);
    } catch {
      // Error handled in saveTaskList
    } finally {
      setTaskToDelete(null);
    }
  };

  const openClearCompletedModal = () => {
    if (isViewer || completedTasksCount === 0) return;
    setIsClearCompletedModalOpen(true);
  };

  const confirmClearCompletedTasks = async () => {
    if (isViewer || completedTasksCount === 0) return;
    const nextTasks = tasks.filter((item) => item.status !== 'הושלם');
    setActiveTask((prev) => (prev ? nextTasks.find((task) => task.id === prev.id) || null : null));
    try {
      await saveTaskList(nextTasks);
    } catch {
      // Error handled in saveTaskList
    } finally {
      setIsClearCompletedModalOpen(false);
    }
  };

  const getCreateContextLabel = () => {
    if (form.kind === 'order') {
      const order = form.orderId ? ordersById.get(form.orderId) : null;
      if (order) return `משימה להזמנה #${order.displayId} - ${order.itemType}`;
      return 'משימה להזמנה מקושרת';
    }
    if (form.kind === 'folder') {
      const folder = form.folderId ? foldersById.get(form.folderId) : null;
      if (folder) return `משימה לתיק "${folder.name}"`;
      return 'משימה לתיק מקושר';
    }
    return 'משימה כללית יומית';
  };

  return (
    <div className="space-y-6 text-right pb-24">
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="text-right">
            <h3 className="text-2xl font-black text-gray-800 font-heebo flex items-center gap-2 justify-end">
              לוח משימות צוות
              <ListTodo className="text-rose-500" />
            </h3>
            <p className="text-sm text-gray-400 font-bold">ניהול תפעולי יומי לפי סטטוס ודדליינים</p>
          </div>
          <div className="flex items-center gap-2">
            {!isViewer && (
              <button
                disabled={isSaving || completedTasksCount === 0}
                onClick={openClearCompletedModal}
                className="bg-amber-100 text-amber-800 border border-amber-200 px-4 py-3 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                נקה הושלמו ({completedTasksCount})
              </button>
            )}
            <button
              disabled={!canCreateTask || isSaving}
              onClick={() => openCreateModal(null)}
              className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl shadow-rose-100 active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Plus size={16} />
                משימה חדשה
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <SummaryCard title="מאחרות" value={summary.overdue} tone="rose" />
          <SummaryCard title="להיום" value={summary.dueToday} tone="amber" />
          <SummaryCard title="ללא שיוך" value={summary.unassigned} tone="slate" />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-end gap-2 mb-4">
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">סינון</span>
          <ListFilter className="text-gray-400" size={16} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-gray-100 bg-slate-50 text-sm font-bold outline-none"
          >
            <option value="all">כל העובדים</option>
            <option value="unassigned">ללא שיוך</option>
            {allUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'הכל')}
            className="px-4 py-3 rounded-2xl border border-gray-100 bg-slate-50 text-sm font-bold outline-none"
          >
            <option value="הכל">כל העדיפויות</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
          <button
            onClick={() => setShowOverdueOnly((prev) => !prev)}
            className={`px-4 py-3 rounded-2xl border text-sm font-black transition-all ${
              showOverdueOnly
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-50 text-slate-500 border-slate-100'
            }`}
          >
            {showOverdueOnly ? 'מציג רק מאחרות' : 'הצג רק מאחרות'}
          </button>
          <div className="px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-black text-center">
            דחופות+מאחרות: {summary.urgentOrOverdue}
          </div>
        </div>
      </div>

      {boardError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold flex items-center gap-2">
          <AlertTriangle size={16} />
          {boardError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {TASK_STATUSES.map((status) => (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!draggedTaskId) return;
              const dragged = tasks.find((task) => task.id === draggedTaskId);
              if (dragged) moveTaskToStatus(dragged, status);
              setDraggedTaskId(null);
            }}
            className={`bg-white rounded-[2rem] border p-4 shadow-sm min-h-72 ${STATUS_STYLES[status]}`}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black text-gray-400">{groupedTasks[status].length} משימות</span>
              <h4 className="text-lg font-black text-gray-800">{status}</h4>
            </div>

            <div className="space-y-3">
              {groupedTasks[status].map((task) => {
                const overdue = isTaskOverdue(task);
                const dueToday = isTaskDueToday(task);
                const assigneeName = task.assigneeUserId ? usersById.get(task.assigneeUserId)?.username : null;
                const taskKind = getTaskKind(task);
                const checklist = taskKind === 'folder' ? getFolderChecklist(task) : [];
                const completedChecklist = checklist.filter((item) => item.done).length;

                return (
                  <article
                    key={task.id}
                    draggable={canEditTask(task)}
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onDragEnd={() => setDraggedTaskId(null)}
                    onClick={() => setActiveTask(task)}
                    className={`rounded-2xl border p-4 bg-white shadow-sm transition-all cursor-pointer ${
                      overdue ? 'border-rose-200 ring-2 ring-rose-100' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-1">
                        {canEditTask(task) && task.status !== 'הושלם' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markTaskCompleted(task);
                            }}
                            disabled={isSaving}
                            className="p-2 rounded-lg bg-emerald-50 text-emerald-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="סמן כהושלמה"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        {canEditTask(task) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(task);
                            }}
                            disabled={isSaving}
                            className="p-2 rounded-lg bg-indigo-50 text-indigo-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="עריכת משימה"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteTask(task);
                            }}
                            disabled={isSaving}
                            className="p-2 rounded-lg bg-rose-50 text-rose-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="מחיקת משימה"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="text-right min-w-0">
                        <p className="font-black text-gray-800 leading-tight">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-3">
                      <span className={`px-2 py-1 rounded-full border text-[10px] font-black ${PRIORITY_STYLES[task.priority]}`}>
                        {task.priority}
                      </span>
                      {taskKind === 'order' && (
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                          משימת תיקון
                        </span>
                      )}
                      {taskKind === 'folder' && (
                        <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-1 rounded-full border border-violet-100">
                          תיק שלם ({completedChecklist}/{checklist.length})
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-gray-500 mt-3 space-y-1">
                      <p className="flex items-center gap-1 justify-end">
                        <CalendarClock size={12} className={overdue ? 'text-rose-500' : dueToday ? 'text-amber-500' : 'text-gray-400'} />
                        <span className={overdue ? 'text-rose-600 font-black' : dueToday ? 'text-amber-700 font-black' : ''}>
                          {formatTaskDueDate(task.dueAt)}
                        </span>
                      </p>
                      <p className="flex items-center gap-1 justify-end">
                        <UserCircle2 size={12} className="text-gray-400" />
                        {assigneeName || 'ללא שיוך'}
                      </p>
                      {(task.orderId || task.folderId || task.clientId) && (
                        <p className="text-[10px] text-slate-500 font-bold">
                          {task.orderId && ordersById.get(task.orderId) && `הזמנה #${ordersById.get(task.orderId)?.displayId}`}
                          {!task.orderId && task.folderId && foldersById.get(task.folderId)?.name}
                          {!task.orderId && !task.folderId && task.clientId && clientsById.get(task.clientId)?.name}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 mt-3 border-t border-gray-100 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.status}
                        disabled={!canEditTask(task) || isSaving}
                        onChange={(e) => moveTaskToStatus(task, e.target.value as TaskStatus)}
                        className="px-2 py-2 rounded-xl border border-gray-100 text-xs font-black bg-slate-50 outline-none"
                      >
                        {TASK_STATUSES.map((taskStatus) => (
                          <option key={taskStatus} value={taskStatus}>{taskStatus}</option>
                        ))}
                      </select>
                      <select
                        value={task.assigneeUserId || ''}
                        disabled={!canEditTask(task) || isSaving}
                        onChange={(e) => reassignTask(task, e.target.value)}
                        className="px-2 py-2 rounded-xl border border-gray-100 text-xs font-black bg-slate-50 outline-none"
                      >
                        <option value="">ללא שיוך</option>
                        {allUsers.map((user) => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                      </select>
                    </div>
                    {canEditTask(task) && (
                      <div className="pt-2 text-[10px] text-gray-300 flex items-center justify-end gap-1">
                        גרירה לעמודה
                        <GripVertical size={12} />
                      </div>
                    )}
                  </article>
                );
              })}
              {groupedTasks[status].length === 0 && (
                <div className="text-center text-xs text-gray-300 italic py-6">אין משימות</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white text-right">
              <h4 className="text-2xl font-black font-heebo">{editingTask ? 'עריכת משימה' : 'יצירת משימה חדשה'}</h4>
              <p className="text-xs text-slate-300 mt-1">המשימה נוצרת אוטומטית עבור היום הנוכחי</p>
            </div>

            <form onSubmit={upsertTask} className="p-6 space-y-4 text-right">
              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold">
                  {formError}
                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-black text-slate-700">
                {getCreateContextLabel()}
              </div>

              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="כותרת משימה"
                required
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none"
              />

              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="תיאור המשימה"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none min-h-24"
              />

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingTask(null);
                    setForm(buildDefaultForm(null));
                  }}
                  className="flex-1 py-3 text-gray-500 font-black rounded-2xl border border-gray-100"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 bg-rose-600 text-white font-black rounded-2xl shadow-lg disabled:opacity-50"
                >
                  {isSaving ? 'שומר...' : editingTask ? 'שמירת שינויים' : 'יצירת משימה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTask && (
        <TaskExecutionModal
          task={activeTask}
          isSaving={isSaving}
          canEdit={canEditTask(activeTask)}
          kind={getTaskKind(activeTask)}
          orderSnapshot={getOrderSnapshot(activeTask)}
          checklist={getFolderChecklist(activeTask)}
          onClose={() => setActiveTask(null)}
          onToggleChecklist={(orderId, done) => toggleChecklistItem(activeTask, orderId, done)}
          onMarkCompleted={() => markTaskCompleted(activeTask)}
        />
      )}

      {isClearCompletedModalOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in duration-200">
            <button
              onClick={() => setIsClearCompletedModalOpen(false)}
              disabled={isSaving}
              className="absolute mt-[-12px] mr-[-12px] right-8 top-8 p-2 rounded-full text-gray-300 hover:text-gray-500 transition-colors disabled:opacity-50"
              aria-label="סגור"
            >
              <X size={18} />
            </button>
            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">ניקוי משימות שהושלמו</h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              יימחקו לצמיתות <b>{completedTasksCount}</b> משימות שהושלמו.<br />
              <span className="text-rose-600 font-bold">פעולה זו היא סופית.</span>
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setIsClearCompletedModalOpen(false)}
                disabled={isSaving}
                className="flex-1 py-4 font-black text-gray-400 active:scale-95 transition-all disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={confirmClearCompletedTasks}
                disabled={isSaving}
                className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? 'מנקה...' : 'נקה משימות'}
              </button>
            </div>
          </div>
        </div>
      )}

      {taskToDelete && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in duration-200">
            <button
              onClick={() => setTaskToDelete(null)}
              className="absolute mt-[-12px] mr-[-12px] right-8 top-8 p-2 rounded-full text-gray-300 hover:text-gray-500 transition-colors"
              aria-label="סגור"
            >
              <X size={18} />
            </button>
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
              <ShieldAlert size={40} className="animate-pulse" />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">מחיקת משימה</h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              האם למחוק את <b>{taskToDelete.title}</b>?<br />
              <span className="text-rose-600 font-bold">פעולה זו היא סופית.</span>
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setTaskToDelete(null)}
                disabled={isSaving}
                className="flex-1 py-4 font-black text-gray-400 active:scale-95 transition-all disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={confirmDeleteTask}
                disabled={isSaving}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? 'מוחק...' : 'מחק משימה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ title: string; value: number; tone: 'rose' | 'amber' | 'slate' }> = ({ title, value, tone }) => {
  const styles = {
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    slate: 'bg-slate-50 border-slate-100 text-slate-700',
  };
  return (
    <div className={`rounded-2xl border p-4 ${styles[tone]}`}>
      <p className="text-xs font-black uppercase tracking-wider">{title}</p>
      <p className="text-3xl font-black font-heebo mt-1">{value}</p>
    </div>
  );
};

const TaskExecutionModal: React.FC<{
  task: Task;
  kind: TaskKind;
  orderSnapshot: Task['orderSnapshot'] | null;
  checklist: NonNullable<Task['folderChecklist']>;
  canEdit: boolean;
  isSaving: boolean;
  onClose: () => void;
  onToggleChecklist: (orderId: string, done: boolean) => void;
  onMarkCompleted: () => void;
}> = ({ task, kind, orderSnapshot, checklist, canEdit, isSaving, onClose, onToggleChecklist, onMarkCompleted }) => {
  const completedCount = checklist.filter((item) => item.done).length;
  return (
    <div className="fixed inset-0 z-[205] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="p-6 bg-slate-900 text-white text-right flex justify-between items-center">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
          <div>
            <h4 className="text-2xl font-black font-heebo">{task.title}</h4>
            <p className="text-xs text-slate-300 mt-1">מה צריך לבצע עכשיו</p>
          </div>
        </div>

        <div className="p-6 space-y-4 text-right">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700">
            סטטוס: <span className="text-rose-600">{task.status}</span> | יעד: {formatTaskDueDate(task.dueAt)}
          </div>

          {kind === 'order' && orderSnapshot && (
            <div className="space-y-2 p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50">
              <p className="text-xs font-black text-indigo-600">תיקון יחיד</p>
              <p className="font-black text-gray-800">#{orderSnapshot.displayId} - {orderSnapshot.itemType}</p>
              <p className="text-sm text-gray-600">{orderSnapshot.description || 'ללא תיאור'}</p>
              <p className="text-xs text-gray-500">לקוח: {orderSnapshot.clientName}</p>
              {orderSnapshot.folderName && <p className="text-xs text-gray-500">תיק: {orderSnapshot.folderName}</p>}
            </div>
          )}

          {kind === 'folder' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-violet-100 bg-violet-50/60">
                <span className="text-xs font-black text-violet-700">{completedCount}/{checklist.length} הושלמו</span>
                <span className="text-xs font-black text-violet-700">תיק שלם</span>
              </div>
              {checklist.length === 0 && (
                <div className="p-4 rounded-2xl border border-gray-100 text-sm text-gray-500">
                  אין תיקונים בתיק כרגע.
                </div>
              )}
              {checklist.map((item) => (
                <label key={item.orderId} className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-gray-100 bg-white">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!canEdit || isSaving}
                    onChange={(e) => onToggleChecklist(item.orderId, e.target.checked)}
                    className="mt-1 w-5 h-5 accent-emerald-600"
                  />
                  <div className="text-right flex-1">
                    <p className="font-black text-gray-800">#{item.displayId} - {item.itemType}</p>
                    <p className="text-xs text-gray-500">{item.description || 'ללא תיאור'}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {kind === 'general' && (
            <div className="space-y-2 p-4 rounded-2xl border border-gray-100 bg-gray-50">
              <p className="text-xs font-black text-gray-500">משימה כללית</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description || 'ללא תיאור'}</p>
            </div>
          )}

          {canEdit && task.status !== 'הושלם' && (
            <button
              onClick={onMarkCompleted}
              disabled={isSaving}
              className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-black disabled:opacity-50"
            >
              {isSaving ? 'שומר...' : 'סמן משימה כהושלמה'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TasksBoard;
