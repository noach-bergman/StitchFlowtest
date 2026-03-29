import { ActionPermissionId, PagePermissionId, PermissionKey, User, UserRole } from '../types';

export const PAGE_PERMISSION_IDS: PagePermissionId[] = [
  'dashboard',
  'tasks',
  'clients',
  'folders',
  'orders',
  'payments',
  'inventory',
  'income',
  'data-mgmt',
  'users',
];

export const ACTION_PERMISSION_IDS: ActionPermissionId[] = [
  'clients.write',
  'clients.delete',
  'clients.merge',
  'folders.write',
  'folders.delete',
  'folders.archive',
  'orders.write',
  'orders.delete',
  'payments.write',
  'tasks.write',
  'tasks.delete',
  'inventory.write',
  'users.write',
  'permissions.write',
];

export const PAGE_PERMISSION_LABELS: Record<PagePermissionId, string> = {
  dashboard: 'לוח בקרה',
  tasks: 'משימות צוות',
  clients: 'ניהול לקוחות',
  folders: 'תיקי לקוחות',
  orders: 'מעקב הזמנות',
  payments: 'ניהול תשלומים',
  inventory: 'ניהול מלאי',
  income: 'סיכום הכנסות',
  'data-mgmt': 'ניהול ענן ונתונים',
  users: 'ניהול צוות',
};

export const ACTION_PERMISSION_LABELS: Record<ActionPermissionId, string> = {
  'clients.write': 'לקוחות: יצירה/עריכה',
  'clients.delete': 'לקוחות: מחיקה',
  'clients.merge': 'לקוחות: מיזוג כפילויות',
  'folders.write': 'תיקים: יצירה/עריכה',
  'folders.delete': 'תיקים: מחיקה',
  'folders.archive': 'תיקים: ארכוב/החזרה',
  'orders.write': 'הזמנות: יצירה/עריכה/סטטוס',
  'orders.delete': 'הזמנות: מחיקה',
  'payments.write': 'תשלומים: עדכון',
  'tasks.write': 'משימות: יצירה/עריכה',
  'tasks.delete': 'משימות: מחיקה',
  'inventory.write': 'מלאי: יצירה/מחיקה',
  'users.write': 'ניהול צוות: יצירה/מחיקה',
  'permissions.write': 'ניהול הרשאות',
};

const ROLE_DEFAULT_PAGE_ACCESS: Record<UserRole, PagePermissionId[]> = {
  super_admin: [...PAGE_PERMISSION_IDS],
  admin: PAGE_PERMISSION_IDS.filter((id) => id !== 'data-mgmt' && id !== 'users'),
  staff: ['dashboard', 'tasks', 'clients', 'folders', 'orders', 'payments', 'inventory'],
  viewer: ['dashboard', 'tasks', 'clients', 'folders', 'orders', 'inventory'],
};

const ROLE_DEFAULT_ACTION_ACCESS: Record<UserRole, ActionPermissionId[]> = {
  super_admin: [...ACTION_PERMISSION_IDS],
  admin: [
    'clients.write',
    'clients.delete',
    'clients.merge',
    'folders.write',
    'folders.delete',
    'folders.archive',
    'orders.write',
    'orders.delete',
    'payments.write',
    'tasks.write',
    'tasks.delete',
    'inventory.write',
  ],
  staff: [
    'clients.write',
    'clients.merge',
    'folders.write',
    'folders.archive',
    'orders.write',
    'payments.write',
    'tasks.write',
    'inventory.write',
  ],
  viewer: [
    'clients.write',
    'clients.merge',
    'folders.write',
    'folders.archive',
    'orders.write',
    'inventory.write',
  ],
};

const USER_ROLES: UserRole[] = ['super_admin', 'admin', 'staff', 'viewer'];
const PAGE_PERMISSION_SET = new Set(PAGE_PERMISSION_IDS);
const ACTION_PERMISSION_SET = new Set(ACTION_PERMISSION_IDS);

const isUserRole = (value: string): value is UserRole => USER_ROLES.includes(value as UserRole);
const isPagePermissionId = (value: string): value is PagePermissionId => PAGE_PERMISSION_SET.has(value as PagePermissionId);
const isActionPermissionId = (value: string): value is ActionPermissionId =>
  ACTION_PERMISSION_SET.has(value as ActionPermissionId);

const toPageKey = (value: PagePermissionId): PermissionKey => `page:${value}`;
const toActionKey = (value: ActionPermissionId): PermissionKey => `action:${value}`;

const ALL_PAGE_PERMISSION_KEYS: PermissionKey[] = PAGE_PERMISSION_IDS.map(toPageKey);
const ALL_ACTION_PERMISSION_KEYS: PermissionKey[] = ACTION_PERMISSION_IDS.map(toActionKey);

export const ALL_PERMISSION_KEYS: PermissionKey[] = [...ALL_PAGE_PERMISSION_KEYS, ...ALL_ACTION_PERMISSION_KEYS];

const PAGE_PERMISSION_KEY_SET = new Set(ALL_PAGE_PERMISSION_KEYS);
const ACTION_PERMISSION_KEY_SET = new Set(ALL_ACTION_PERMISSION_KEYS);

const normalizePermissionToken = (token: unknown): PermissionKey[] => {
  if (typeof token !== 'string') return [];
  const value = token.trim();
  if (!value) return [];

  if (value === 'all') {
    return [...ALL_PERMISSION_KEYS];
  }

  if (isUserRole(value)) {
    return getRoleDefaultPermissions(value);
  }

  if (PAGE_PERMISSION_KEY_SET.has(value as PermissionKey)) {
    return [value as PermissionKey];
  }

  if (ACTION_PERMISSION_KEY_SET.has(value as PermissionKey)) {
    return [value as PermissionKey];
  }

  if (value.startsWith('page:')) {
    const pageId = value.slice('page:'.length);
    if (isPagePermissionId(pageId)) return [toPageKey(pageId)];
    return [];
  }

  if (value.startsWith('action:')) {
    const actionId = value.slice('action:'.length);
    if (isActionPermissionId(actionId)) return [toActionKey(actionId)];
    return [];
  }

  if (isPagePermissionId(value)) {
    return [toPageKey(value)];
  }

  if (isActionPermissionId(value)) {
    return [toActionKey(value)];
  }

  return [];
};

const sortPermissions = (keys: Iterable<PermissionKey>): PermissionKey[] => {
  const lookup = new Set(keys);
  return ALL_PERMISSION_KEYS.filter((key) => lookup.has(key));
};

export const getRoleDefaultPermissions = (role: UserRole): PermissionKey[] => {
  if (role === 'super_admin') {
    return [...ALL_PERMISSION_KEYS];
  }

  const pagePermissions = ROLE_DEFAULT_PAGE_ACCESS[role].map(toPageKey);
  const actionPermissions = ROLE_DEFAULT_ACTION_ACCESS[role].map(toActionKey);
  return sortPermissions([...pagePermissions, ...actionPermissions]);
};

export const getEffectivePermissions = (user: User | null | undefined): PermissionKey[] => {
  if (!user) return [];

  if (user.role === 'super_admin') {
    return [...ALL_PERMISSION_KEYS];
  }

  const rawPermissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (rawPermissions.length === 0) {
    return getRoleDefaultPermissions(user.role);
  }

  const normalized = new Set<PermissionKey>();
  rawPermissions.forEach((permission) => {
    normalizePermissionToken(permission).forEach((resolved) => normalized.add(resolved));
  });

  if (normalized.size === 0) {
    return getRoleDefaultPermissions(user.role);
  }

  return sortPermissions(normalized);
};

export const normalizeUserPermissions = (user: User): User => ({
  ...user,
  permissions: getEffectivePermissions(user),
});

export const hasPageAccess = (user: User | null | undefined, pageId: PagePermissionId): boolean => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const permissions = new Set(getEffectivePermissions(user));
  return permissions.has(toPageKey(pageId));
};

export const hasActionAccess = (user: User | null | undefined, actionId: ActionPermissionId): boolean => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const permissions = new Set(getEffectivePermissions(user));
  return permissions.has(toActionKey(actionId));
};
