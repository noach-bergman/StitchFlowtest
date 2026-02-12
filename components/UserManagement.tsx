
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { dataService } from '../services/dataService';
import { UserPlus, Shield, User as UserIcon, Trash2, Key, Check, AlertCircle, RefreshCw, Star } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await dataService.getUsers();
      setUsers(data);
    } catch (err) {
      setError("שגיאה בטעינת משתמשים");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      username: formData.get('username') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as UserRole,
      permissions: [(formData.get('role') as string)],
      createdAt: Date.now()
    };

    // Check if username already exists
    if (users.some(u => u.username === newUser.username)) {
      setError("שם משתמש זה כבר תפוס");
      return;
    }

    try {
      await dataService.saveUser(newUser);
      setUsers([newUser, ...users]);
      setIsModalOpen(false);
    } catch (err) {
      setError("שגיאה בשמירת משתמש");
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (username === 'admin') {
      alert("לא ניתן למחוק את חשבון הניהול הראשי");
      return;
    }
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את המשתמש ${username}?`)) return;

    try {
      await dataService.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
    } catch (err) {
      alert("שגיאה במחיקת משתמש");
    }
  };

  const roleLabels: Record<UserRole, string> = {
    super_admin: 'מנהל על',
    admin: 'מנהל סטודיו',
    staff: 'צוות תפירה',
    viewer: 'צפייה בלבד'
  };

  const roleColors: Record<UserRole, string> = {
    super_admin: 'bg-slate-900 text-white border-slate-800',
    admin: 'bg-rose-100 text-rose-700 border-rose-200',
    staff: 'bg-blue-100 text-blue-700 border-blue-200',
    viewer: 'bg-gray-100 text-gray-700 border-gray-200'
  };

  return (
    <div className="space-y-6 text-right font-assistant">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-right">
          <h3 className="text-2xl font-black text-gray-800 font-heebo">ניהול צוות והרשאות על</h3>
          <p className="text-sm text-gray-400">רק מנהל על יכול לצפות במסך זה ולהגדיר גישות</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-black transition-all active:scale-95"
        >
          <UserPlus size={18} />
          הוסף משתמש חדש
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
          <RefreshCw className="animate-spin" size={32} />
          <p className="font-bold">טוען רשימת משתמשים...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Default Admin Card (Static) */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 relative overflow-hidden group shadow-2xl">
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

          {/* Dynamic Users */}
          {users.map(user => (
            <div key={user.id} className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all group animate-in zoom-in duration-300">
               <div className="flex justify-between items-start mb-4">
                  <button 
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform ${user.role === 'super_admin' ? 'bg-slate-900 text-white' : 'bg-rose-50 text-rose-600'}`}>
                    {user.role === 'super_admin' ? <Shield size={24} /> : <UserIcon size={24} />}
                  </div>
               </div>
               <h4 className="text-lg font-bold text-gray-800">{user.username}</h4>
               <p className="text-[10px] text-gray-400 mb-4 flex items-center gap-1 justify-end">
                 <Key size={10} /> סיסמה: {user.password ? '••••••' : 'לא מוגדר'}
               </p>
               <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-[10px] font-bold ${roleColors[user.role]}`}>
                 {roleLabels[user.role]}
               </div>
            </div>
          ))}

          {users.length === 0 && !isLoading && (
            <div className="col-span-full py-12 text-center text-gray-300 italic border-2 border-dashed border-gray-100 rounded-[2rem]">
              אין משתמשים נוספים במערכת
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
            <div className="p-8 bg-rose-600 text-white relative">
               <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mt-16 blur-2xl"></div>
               <h3 className="text-2xl font-black font-heebo">הוספת משתמש חדש</h3>
               <p className="text-rose-100 text-sm mt-1">בחר תפקיד מתאים לפי רמת הגישה</p>
            </div>
            
            <form onSubmit={handleAddUser} className="p-8 space-y-5 text-right">
              {error && (
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 pr-1 uppercase">שם משתמש</label>
                <input name="username" required placeholder="למשל: sarah_couture" className="w-full px-5 py-3 rounded-2xl border border-gray-100 outline-none focus:ring-2 focus:ring-rose-200 transition-all font-bold text-gray-700" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 pr-1 uppercase">סיסמה</label>
                <input name="password" type="password" autoComplete="new-password" required placeholder="הגדר סיסמה" className="w-full px-5 py-3 rounded-2xl border border-gray-100 outline-none focus:ring-2 focus:ring-rose-200 transition-all font-bold text-gray-700" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 pr-1 uppercase">דרגת הרשאה</label>
                <select name="role" required className="w-full px-5 py-3 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 appearance-none focus:ring-2 focus:ring-rose-200">
                  <option value="staff">צוות (לקוחות, תיקים, הזמנות)</option>
                  <option value="admin">מנהל (הכל חוץ מצוות וענן)</option>
                  <option value="super_admin">מנהל על (גישה מלאה להכל)</option>
                  <option value="viewer">צופה (צפייה בלבד)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors">ביטול</button>
                <button type="submit" className="flex-[2] bg-rose-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Check size={18} />
                  צור חשבון
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
