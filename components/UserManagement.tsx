import React, { useEffect, useMemo, useState } from 'react';
import { User, UserRole, PermissionKey } from '../types';
import { dataService } from '../services/dataService';
import {
  ACTION_PERMISSION_IDS,
  ACTION_PERMISSION_LABELS,
  ALL_PERMISSION_KEYS,
  getRoleDefaultPermissions,
  hasActionAccess,
  normalizeUserPermissions,
  PAGE_PERMISSION_IDS,
  PAGE_PERMISSION_LABELS,
} from '../services/permissions';
import { UserPlus, Shield, User as UserIcon, Trash2, Key, Check, AlertCircle, RefreshCw, Star, Save } from 'lucide-react';

interface UserManagementProps {
  currentUser: User;
  users: User[];
  onUserUpdated: (user: User) => void;
  onUsersReload: () => Promise<void>;
}

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 9);
  }
  return Math.random().toString(36).slice(2, 11);
};

const orderPermissions = (permissions: PermissionKey[]): PermissionKey[] => {
  const keys = new Set(permissions);
  return ALL_PERMISSION_KEYS.filter((permission) => keys.has(permission));
};

const UserManagement: React.FC<UserManagementProps> = ({
  currentUser,
  users,
  onUserUpdated,
  onUsersReload
}) => {
  const [localUsers, setLocalUsers] = useState<User[]>(() => users.map((user) => normalizeUserPermissions(user)));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);
  const [roleSavingUserId, setRoleSavingUserId] = useState<string | null>(null);

  const [selectedPermissionUserId, setSelectedPermissionUserId] = useState<string>('');
  const [permissionDraft, setPermissionDraft] = useState<PermissionKey[]>([]);
  const [isPermissionDirty, setIsPermissionDirty] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const canManageUsers = hasActionAccess(currentUser, 'users.write');
  const canManagePermissions = currentUser.role === 'super_admin' && hasActionAccess(currentUser, 'permissions.write');

  useEffect(() => {
    setLocalUsers(users.map((user) => normalizeUserPermissions(user)));
  }, [users]);

  useEffect(() => {
    if (localUsers.length === 0) {
      setSelectedPermissionUserId('');
      return;
    }

    const hasSelectedUser = localUsers.some((user) => user.id === selectedPermissionUserId);
    if (!selectedPermissionUserId || !hasSelectedUser) {
      setSelectedPermissionUserId(localUsers[0].id);
    }
  }, [localUsers, selectedPermissionUserId]);

  const selectedPermissionUser = useMemo(
    () => localUsers.find((user) => user.id === selectedPermissionUserId) || null,
    [localUsers, selectedPermissionUserId],
  );

  const selectedIsSuperAdmin = selectedPermissionUser?.role === 'super_admin';

  useEffect(() => {
    if (!selectedPermissionUser) {
      setPermissionDraft([]);
      setIsPermissionDirty(false);
      return;
    }

    const normalized = normalizeUserPermissions(selectedPermissionUser);
    setPermissionDraft(normalized.permissions);
    setIsPermissionDirty(false);
  }, [selectedPermissionUserId, localUsers]);

  const roleLabels: Record<UserRole, string> = {
    super_admin: 'מנהל על',
    admin: 'מנהל סטודיו',
    staff: 'צוות תפירה',
    viewer: 'צפייה בלבד'
  };

  const roleColors: Record<UserRole, string> = {
    super_admin: 'bg-[#6f2f54] text-white border-slate-800',
    admin: 'bg-rose-100 text-rose-700 border-rose-200',
    staff: 'bg-blue-100 text-blue-700 border-blue-200',
    viewer: 'bg-gray-100 text-gray-700 border-rose-200'
  };

  const handleRefreshUsers = async () => {
    setIsRefreshingUsers(true);
    setActionNotice(null);
    try {
      await onUsersReload();
      setActionNotice('רשימת משתמשים עודכנה בהצלחה');
    } catch (err) {
      setActionNotice('שגיאה בטעינת משתמשים');
    } finally {
      setIsRefreshingUsers(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canManageUsers) {
      setError('אין לך הרשאה ליצור משתמשים');
      return;
    }

    setError(null);
    const formData = new FormData(e.currentTarget);
    const role = formData.get('role') as UserRole;
    const username = String(formData.get('username') || '').trim();

    const newUser: User = {
      id: randomId(),
      username,
      password: formData.get('password') as string,
      role,
      permissions: getRoleDefaultPermissions(role),
      createdAt: Date.now()
    };

    if (localUsers.some((user) => user.username.toLowerCase() === newUser.username.toLowerCase())) {
      setError('שם משתמש זה כבר תפוס');
      return;
    }

    try {
      await dataService.saveUser(newUser);
      const normalizedUser = normalizeUserPermissions(newUser);
      setLocalUsers((prevUsers) => [normalizedUser, ...prevUsers]);
      onUserUpdated(normalizedUser);
      setSelectedPermissionUserId(normalizedUser.id);
      setIsModalOpen(false);
      setActionNotice(`המשתמש ${normalizedUser.username} נוצר בהצלחה`);
    } catch (err) {
      setError('שגיאה בשמירת משתמש');
    }
  };

  const handleDeleteUserRequest = (user: User) => {
    if (!canManageUsers) {
      setActionNotice('אין לך הרשאה למחוק משתמשים');
      return;
    }

    if (user.username === 'admin') {
      setActionNotice('לא ניתן למחוק את חשבון הניהול הראשי');
      return;
    }

    if (user.id === currentUser.id) {
      setActionNotice('לא ניתן למחוק את המשתמש שמחובר כרגע');
      return;
    }

    if (user.role === 'super_admin') {
      setActionNotice('לא ניתן למחוק משתמש עם תפקיד מנהל על');
      return;
    }

    setUserToDelete(user);
  };

  const handleConfirmDeleteUser = async () => {
    if (!canManageUsers || !userToDelete) return;

    setIsDeletingUser(true);
    setActionNotice(null);
    try {
      await dataService.deleteUser(userToDelete.id);
      setLocalUsers((prevUsers) => prevUsers.filter((user) => user.id !== userToDelete.id));
      await onUsersReload();
      setActionNotice(`המשתמש ${userToDelete.username} נמחק בהצלחה`);
      setUserToDelete(null);
    } catch (err) {
      setActionNotice('שגיאה במחיקת משתמש');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleChangeUserRole = async (user: User, nextRole: UserRole) => {
    if (!canManageUsers) {
      setActionNotice('אין לך הרשאה לעדכן תפקיד משתמש');
      return;
    }

    if (user.id === currentUser.id) {
      setActionNotice('לא ניתן לשנות את התפקיד של המשתמש שמחובר כרגע');
      return;
    }

    if (user.username === 'admin') {
      setActionNotice('לא ניתן לשנות את התפקיד של חשבון הניהול הראשי');
      return;
    }

    if (user.role === nextRole) {
      return;
    }

    const previousUser = normalizeUserPermissions(user);
    const updatedUser = normalizeUserPermissions({
      ...user,
      role: nextRole,
      permissions: getRoleDefaultPermissions(nextRole),
    });

    setRoleSavingUserId(user.id);
    setActionNotice(null);
    setLocalUsers((prevUsers) => prevUsers.map((entry) => (entry.id === user.id ? updatedUser : entry)));
    onUserUpdated(updatedUser);

    try {
      await dataService.saveUser(updatedUser);
      setActionNotice(`התפקיד של ${updatedUser.username} עודכן ל-${roleLabels[nextRole]}`);
    } catch (err) {
      setLocalUsers((prevUsers) => prevUsers.map((entry) => (entry.id === user.id ? previousUser : entry)));
      onUserUpdated(previousUser);
      setActionNotice('שגיאה בעדכון תפקיד משתמש');
    } finally {
      setRoleSavingUserId((currentId) => (currentId === user.id ? null : currentId));
    }
  };

  const applyPermissionPreset = (permissions: PermissionKey[]) => {
    if (!canManagePermissions || selectedIsSuperAdmin) return;
    setPermissionDraft(orderPermissions(permissions));
    setIsPermissionDirty(true);
  };

  const togglePermission = (permission: PermissionKey) => {
    if (!canManagePermissions || selectedIsSuperAdmin) return;
    setPermissionDraft((prevPermissions) => {
      const hasPermission = prevPermissions.includes(permission);
      const nextPermissions = hasPermission
        ? prevPermissions.filter((item) => item !== permission)
        : [...prevPermissions, permission];
      return orderPermissions(nextPermissions);
    });
    setIsPermissionDirty(true);
  };

  const savePermissions = async () => {
    if (!selectedPermissionUser || !canManagePermissions || selectedIsSuperAdmin) return;

    const previousUser = normalizeUserPermissions(selectedPermissionUser);
    const nextUser = normalizeUserPermissions({
      ...selectedPermissionUser,
      permissions: orderPermissions(permissionDraft),
    });

    setIsSavingPermissions(true);
    setActionNotice(null);

    setLocalUsers((prevUsers) => prevUsers.map((user) => (user.id === nextUser.id ? nextUser : user)));
    onUserUpdated(nextUser);

    try {
      await dataService.saveUser(nextUser);
      setIsPermissionDirty(false);
      setActionNotice(`הרשאות נשמרו עבור ${nextUser.username}. השינוי יופיע למשתמש המחובר לאחר רענון נתונים`);
    } catch (err) {
      setLocalUsers((prevUsers) => prevUsers.map((user) => (user.id === previousUser.id ? previousUser : user)));
      onUserUpdated(previousUser);
      setActionNotice('שגיאה בשמירת הרשאות');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const draftPermissions = selectedIsSuperAdmin ? ALL_PERMISSION_KEYS : permissionDraft;

  return (
    <div className="space-y-6 text-right font-assistant">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-rose-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-right">
          <h3 className="text-2xl font-black text-[#2B2B2B] font-heebo">ניהול צוות והרשאות</h3>
          <p className="text-sm text-[#7A7A7A]">ניהול משתמשים והרשאות גישה למסכים ופעולות</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshUsers}
            disabled={isRefreshingUsers}
            className="flex items-center gap-2 bg-[#fff1f8] text-[#7A7A7A] px-4 py-3 rounded-2xl font-bold border border-rose-200 disabled:opacity-60"
          >
            {isRefreshingUsers ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            רענן
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!canManageUsers}
            className="flex items-center gap-2 bg-[#6f2f54] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-black transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <UserPlus size={18} />
            הוסף משתמש חדש
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm font-black flex items-center justify-between">
          <button onClick={() => setActionNotice(null)} className="text-rose-400 hover:text-rose-600 p-1">
            <AlertCircle size={16} />
          </button>
          <span>{actionNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#6f2f54] border border-slate-800 rounded-[2rem] p-6 relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Star className="text-white w-20 h-20 rotate-12" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-rose-500 mb-4 shadow-sm border border-white/10">
              <Shield size={24} />
            </div>
            <h4 className="text-lg font-bold text-white">admin</h4>
            <p className="text-[10px] font-black uppercase text-rose-500 mb-4 tracking-widest">SUPER ADMIN (מערכת)</p>
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold">
              מנהל על ראשי
            </div>
          </div>
        </div>

        {localUsers.map((user) => (
          <div key={user.id} className="bg-white border border-rose-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-4">
              <button
                onClick={() => handleDeleteUserRequest(user)}
                disabled={!canManageUsers || user.role === 'super_admin' || user.id === currentUser.id}
                className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={18} />
              </button>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform ${user.role === 'super_admin' ? 'bg-[#6f2f54] text-white' : 'bg-rose-50 text-rose-600'}`}>
                {user.role === 'super_admin' ? <Shield size={24} /> : <UserIcon size={24} />}
              </div>
            </div>
            <h4 className="text-lg font-bold text-[#2B2B2B]">{user.username}</h4>
            <p className="text-[10px] text-[#7A7A7A] mb-4 flex items-center gap-1 justify-end">
              <Key size={10} /> סיסמה: {user.password ? '••••••' : 'לא מוגדר'}
            </p>
            <div className="mb-4">
              <label className="block text-[10px] font-black text-[#7A7A7A] uppercase mb-2">תפקיד משתמש</label>
              <div className="flex items-center gap-2">
                <select
                  value={user.role}
                  onChange={(event) => handleChangeUserRole(user, event.target.value as UserRole)}
                  disabled={!canManageUsers || user.id === currentUser.id || user.username === 'admin' || roleSavingUserId === user.id}
                  className="flex-1 px-3 py-2 rounded-xl border border-rose-100 bg-[#fff3f9] font-bold text-sm text-gray-700 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="staff">צוות תפירה</option>
                  <option value="admin">מנהל סטודיו</option>
                  <option value="super_admin">מנהל על</option>
                  <option value="viewer">צפייה בלבד</option>
                </select>
                {roleSavingUserId === user.id && <RefreshCw size={14} className="animate-spin text-rose-500" />}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-[10px] font-bold ${roleColors[user.role]}`}>
                {roleLabels[user.role]}
              </div>
              <span className="text-[10px] font-black text-[#7A7A7A]">הרשאות: {normalizeUserPermissions(user).permissions.length}</span>
            </div>
          </div>
        ))}

        {localUsers.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-300 italic border-2 border-dashed border-rose-100 rounded-[2rem]">
            אין משתמשים נוספים במערכת
          </div>
        )}
      </div>

      <div className="bg-white border border-rose-100 rounded-[2.5rem] p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="text-right">
            <h4 className="text-xl font-black text-[#2B2B2B] font-heebo">הרשאות משתמש</h4>
            <p className="text-sm text-[#7A7A7A] font-bold">שליטה על גישה לדפים ופעולות מרכזיות</p>
          </div>
          <div className="w-full md:w-72">
            <label className="block text-[10px] font-black text-[#7A7A7A] uppercase mb-2">בחר משתמש</label>
            <select
              value={selectedPermissionUserId}
              onChange={(event) => setSelectedPermissionUserId(event.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-rose-100 bg-[#fff3f9] font-bold text-gray-700 outline-none"
            >
              {localUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} ({roleLabels[user.role]})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedPermissionUser && (
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between bg-[#fff1f8] border border-rose-100 rounded-2xl p-4">
              <div className="flex items-center justify-end gap-3">
                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-[10px] font-bold ${roleColors[selectedPermissionUser.role]}`}>
                  {roleLabels[selectedPermissionUser.role]}
                </div>
                <p className="font-black text-[#2B2B2B]">{selectedPermissionUser.username}</p>
              </div>
              {selectedIsSuperAdmin ? (
                <span className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1">
                  למנהל על יש הרשאות מלאות ונעולות
                </span>
              ) : !canManagePermissions ? (
                <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 rounded-full px-3 py-1">
                  רק מנהל על יכול לערוך הרשאות
                </span>
              ) : (
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                  אפשר לערוך ולהחיל שינויים
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPermissionPreset(ALL_PERMISSION_KEYS)}
                disabled={!canManagePermissions || selectedIsSuperAdmin}
                className="px-4 py-2 rounded-xl bg-[#6f2f54] text-white text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                בחר הכל
              </button>
              <button
                type="button"
                onClick={() => applyPermissionPreset([])}
                disabled={!canManagePermissions || selectedIsSuperAdmin}
                className="px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                נקה הכל
              </button>
              <button
                type="button"
                onClick={() => applyPermissionPreset(getRoleDefaultPermissions(selectedPermissionUser.role))}
                disabled={!canManagePermissions || selectedIsSuperAdmin}
                className="px-4 py-2 rounded-xl bg-[#fff1f8] border border-rose-200 text-[#7A7A7A] text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                שחזר ברירת מחדל לפי תפקיד
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="border border-rose-100 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-black text-[#2B2B2B]">גישה לדפים</p>
                {PAGE_PERMISSION_IDS.map((pageId) => {
                  const key = `page:${pageId}` as PermissionKey;
                  const isEnabled = draftPermissions.includes(key);
                  return (
                    <label key={key} className="flex items-center justify-between gap-3 bg-[#fff9fc] border border-rose-100 rounded-xl px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => togglePermission(key)}
                        disabled={!canManagePermissions || selectedIsSuperAdmin}
                        className="w-4 h-4 accent-rose-600 disabled:opacity-50"
                      />
                      <span className="text-sm font-bold text-[#2B2B2B]">{PAGE_PERMISSION_LABELS[pageId]}</span>
                    </label>
                  );
                })}
              </div>

              <div className="border border-rose-100 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-black text-[#2B2B2B]">פעולות מערכת</p>
                {ACTION_PERMISSION_IDS.map((actionId) => {
                  const key = `action:${actionId}` as PermissionKey;
                  const isEnabled = draftPermissions.includes(key);
                  return (
                    <label key={key} className="flex items-center justify-between gap-3 bg-[#fff9fc] border border-rose-100 rounded-xl px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => togglePermission(key)}
                        disabled={!canManagePermissions || selectedIsSuperAdmin}
                        className="w-4 h-4 accent-rose-600 disabled:opacity-50"
                      />
                      <span className="text-sm font-bold text-[#2B2B2B]">{ACTION_PERMISSION_LABELS[actionId]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={savePermissions}
                disabled={!canManagePermissions || selectedIsSuperAdmin || !isPermissionDirty || isSavingPermissions}
                className="inline-flex items-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingPermissions ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                {isSavingPermissions ? 'שומר הרשאות...' : 'שמור הרשאות'}
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
            <div className="p-8 bg-rose-600 text-white relative">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mt-16 blur-2xl"></div>
              <h3 className="text-2xl font-black font-heebo">הוספת משתמש חדש</h3>
              <p className="text-rose-100 text-sm mt-1">הרשאות ברירת מחדל יוגדרו לפי תפקיד</p>
            </div>

            <form onSubmit={handleAddUser} className="p-8 space-y-5 text-right">
              {error && (
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7A7A7A] pr-1 uppercase">שם משתמש</label>
                <input name="username" required placeholder="למשל: sarah_couture" className="w-full px-5 py-3 rounded-2xl border border-rose-100 outline-none focus:ring-2 focus:ring-[#e5488640] transition-all font-bold text-gray-700" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7A7A7A] pr-1 uppercase">סיסמה</label>
                <input name="password" type="password" autoComplete="new-password" required placeholder="הגדר סיסמה" className="w-full px-5 py-3 rounded-2xl border border-rose-100 outline-none focus:ring-2 focus:ring-[#e5488640] transition-all font-bold text-gray-700" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7A7A7A] pr-1 uppercase">דרגת הרשאה</label>
                <select name="role" required className="w-full px-5 py-3 rounded-2xl border border-rose-100 outline-none bg-[#fff3f9] font-bold text-gray-700 appearance-none focus:ring-2 focus:ring-[#e5488640]">
                  <option value="staff">צוות (לקוחות, תיקים, הזמנות)</option>
                  <option value="admin">מנהל (ללא ניהול צוות/הרשאות)</option>
                  <option value="super_admin">מנהל על (גישה מלאה)</option>
                  <option value="viewer">צופה (לפי ברירת מחדל מוגדרת)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-[#7A7A7A]">
                  ביטול
                </button>
                <button type="submit" disabled={!canManageUsers} className="flex-[2] bg-rose-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  <Check size={18} />
                  צור חשבון
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center animate-in zoom-in duration-200">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
              <Trash2 size={36} />
            </div>
            <h3 className="text-2xl font-black text-[#2B2B2B] mb-2">מחיקת משתמש</h3>
            <p className="text-sm text-[#7A7A7A] mb-8">
              האם למחוק את המשתמש <b>{userToDelete.username}</b>?<br />
              פעולה זו היא סופית.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="flex-1 py-4 font-black text-[#7A7A7A] active:scale-95 transition-all disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingUser || !canManageUsers}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDeletingUser ? 'מוחק...' : 'מחק משתמש'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
