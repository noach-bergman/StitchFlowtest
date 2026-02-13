import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Edit2,
  GripVertical,
  ListFilter,
  ListTodo,
  Plus,
  Trash2,
  UserCircle2
} from 'lucide-react';
import { Client, Folder, Order, Task, TaskPriority, TaskStatus, User } from '../types';
import { dateInputToDueAt, dueAtToDateInput, formatTaskDueDate, getTaskSummary, isTaskDueToday, isTaskOverdue } from '../services/taskUtils';

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
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assigneeUserId: string;
  clientId: string;
  folderId: string;
  orderId: string;
}

export interface TaskPrefill {
  title?: string;
  description?: string;
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

const buildDefaultForm = (prefill?: TaskPrefill | null): TaskFormState => ({
  title: prefill?.title || '',
  description: prefill?.description || '',
  status: prefill?.status || 'חדש',
  priority: prefill?.priority || 'רגילה',
  dueDate: dueAtToDateInput(prefill?.dueAt),
  assigneeUserId: prefill?.assigneeUserId || '',
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
  const [form, setForm] = useState<TaskFormState>(() => buildDefaultForm(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

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

  const summary = useMemo(() => getTaskSummary(tasks), [tasks]);

  const canEditTask = (task: Task): boolean => {
    if (isViewer) return false;
    if (isAdmin) return true;
    return task.status !== 'הושלם';
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
      status: task.status,
      priority: task.priority,
      dueDate: dueAtToDateInput(task.dueAt),
      assigneeUserId: task.assigneeUserId || '',
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

  const upsertTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('יש להזין כותרת משימה.');
      return;
    }
    if (!form.status || !form.priority) {
      setFormError('יש לבחור סטטוס ועדיפות.');
      return;
    }

    const now = Date.now();
    const dueAt = dateInputToDueAt(form.dueDate);
    const selectedOrder = form.orderId ? ordersById.get(form.orderId) : null;
    const selectedFolder = form.folderId ? foldersById.get(form.folderId) : null;

    const normalizedClientId = selectedOrder?.clientId || selectedFolder?.clientId || form.clientId || undefined;
    const normalizedFolderId = selectedOrder?.folderId || form.folderId || undefined;
    const normalizedOrderId = form.orderId || undefined;

    const base: Task = editingTask ? { ...editingTask } : {
      id: randomId(),
      createdAt: now,
      createdByUserId: currentUser.id,
      completedAt: undefined,
      title: '',
      description: '',
      status: 'חדש',
      priority: 'רגילה',
      dueAt: null,
      assigneeUserId: null,
      updatedAt: now,
    };

    const nextTask: Task = {
      ...base,
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      dueAt,
      assigneeUserId: form.assigneeUserId || null,
      clientId: normalizedClientId,
      folderId: normalizedFolderId,
      orderId: normalizedOrderId,
      updatedAt: now,
      completedAt: form.status === 'הושלם' ? (editingTask?.completedAt || now) : undefined,
    };

    const nextTasks = editingTask
      ? tasks.map((task) => (task.id === editingTask.id ? nextTask : task))
      : [nextTask, ...tasks];

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
    try {
      await saveTaskList(nextTasks);
    } catch {
      // Error handled in saveTaskList
    }
  };

  const deleteTask = async (task: Task) => {
    if (!isAdmin || !window.confirm(`למחוק את המשימה "${task.title}"?`)) return;
    const nextTasks = tasks.filter((item) => item.id !== task.id);
    try {
      await saveTaskList(nextTasks);
    } catch {
      // Error handled in saveTaskList
    }
  };

  const handleClientChange = (clientId: string) => {
    setForm((prev) => ({
      ...prev,
      clientId,
      folderId: prev.folderId && foldersById.get(prev.folderId)?.clientId === clientId ? prev.folderId : '',
      orderId: prev.orderId && ordersById.get(prev.orderId)?.clientId === clientId ? prev.orderId : '',
    }));
  };

  const handleFolderChange = (folderId: string) => {
    const folder = folderId ? foldersById.get(folderId) : null;
    setForm((prev) => ({
      ...prev,
      clientId: folder?.clientId || prev.clientId,
      folderId,
      orderId: prev.orderId && ordersById.get(prev.orderId)?.folderId === folderId ? prev.orderId : '',
    }));
  };

  const handleOrderChange = (orderId: string) => {
    const order = orderId ? ordersById.get(orderId) : null;
    setForm((prev) => ({
      ...prev,
      clientId: order?.clientId || prev.clientId,
      folderId: order?.folderId || prev.folderId,
      orderId,
    }));
  };

  const activeFolders = form.clientId
    ? folders.filter((folder) => folder.clientId === form.clientId)
    : folders;
  const activeOrders = form.folderId
    ? orders.filter((order) => order.folderId === form.folderId)
    : form.clientId
      ? orders.filter((order) => order.clientId === form.clientId)
      : orders;

  return (
    <div className="space-y-6 text-right pb-24">
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="text-right">
            <h3 className="text-2xl font-black text-gray-800 font-heebo flex items-center gap-2 justify-end">
              לוח משימות צוות
              <ListTodo className="text-rose-500" />
            </h3>
            <p className="text-sm text-gray-400 font-bold">ניהול תפעולי לפי סטטוס, דדליין ואחריות</p>
          </div>
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
                return (
                  <article
                    key={task.id}
                    draggable={canEditTask(task)}
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onDragEnd={() => setDraggedTaskId(null)}
                    className={`rounded-2xl border p-4 bg-white shadow-sm transition-all ${
                      overdue ? 'border-rose-200 ring-2 ring-rose-100' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-1">
                        {canEditTask(task) && (
                          <button
                            onClick={() => openEditModal(task)}
                            className="p-2 rounded-lg bg-indigo-50 text-indigo-600 active:scale-95"
                            title="עריכת משימה"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => deleteTask(task)}
                            className="p-2 rounded-lg bg-rose-50 text-rose-600 active:scale-95"
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

                    <div className="flex justify-end mt-3">
                      <span className={`px-2 py-1 rounded-full border text-[10px] font-black ${PRIORITY_STYLES[task.priority]}`}>
                        {task.priority}
                      </span>
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

                    <div className="pt-3 mt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
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
              <p className="text-xs text-slate-300 mt-1">הגדירי דדליין, עדיפות ואחריות לעובד</p>
            </div>

            <form onSubmit={upsertTask} className="p-6 space-y-4 text-right">
              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="כותרת משימה"
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none"
                />
                <input
                  value={form.dueDate}
                  type="date"
                  onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none"
                />
              </div>

              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="תיאור המשימה"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none min-h-24"
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}
                  className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none"
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
                  className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none"
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
                <select
                  value={form.assigneeUserId}
                  onChange={(e) => setForm((prev) => ({ ...prev, assigneeUserId: e.target.value }))}
                  className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none"
                >
                  <option value="">ללא שיוך</option>
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.id}>{user.username}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={form.clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none"
                >
                  <option value="">ללא לקוח</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
                <select
                  value={form.folderId}
                  onChange={(e) => handleFolderChange(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none"
                >
                  <option value="">ללא תיק</option>
                  {activeFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
                <select
                  value={form.orderId}
                  onChange={(e) => handleOrderChange(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none"
                >
                  <option value="">ללא הזמנה</option>
                  {activeOrders.map((order) => (
                    <option key={order.id} value={order.id}>#{order.displayId} - {order.itemType}</option>
                  ))}
                </select>
              </div>

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

export default TasksBoard;
