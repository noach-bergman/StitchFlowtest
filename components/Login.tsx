
import React, { useState } from 'react';
import { LogIn, ShieldCheck, User as UserIcon, Lock, AlertCircle } from 'lucide-react';
import { dataService } from '../services/dataService';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const user = await dataService.login(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError('שם משתמש או סיסמה שגויים');
      }
    } catch (err) {
      setError('אירעה שגיאה בהתחברות');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-0 md:p-4 z-[100] font-assistant" dir="rtl">
      <div className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-[2.5rem] shadow-2xl shadow-rose-100/50 border border-rose-50 overflow-y-auto flex flex-col">
        <div className="bg-rose-600 p-12 md:p-10 text-center text-white relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
          <div className="w-24 h-24 md:w-20 md:h-20 bg-white/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 md:mb-6 backdrop-blur-md">
            <LogIn size={48} className="text-white md:w-10 md:h-10" />
          </div>
          <h1 className="text-4xl md:text-3xl font-black font-heebo tracking-tighter">StitchFlow</h1>
          <p className="text-rose-100 mt-3 md:mt-2 text-lg md:text-sm font-bold opacity-80">מערכת ניהול סטודיו חכמה</p>
        </div>

        <div className="p-10 md:p-10 flex-1">
          <form onSubmit={handleSubmit} className="space-y-8 md:space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] md:text-xs font-black text-gray-400 mr-2 uppercase tracking-widest">שם משתמש</label>
              <div className="relative">
                <UserIcon className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6 md:w-5 md:h-5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-[1.5rem] md:rounded-2xl py-6 md:py-4 pr-14 pl-6 outline-none focus:ring-4 focus:ring-rose-200/50 transition-all font-black text-xl md:text-base text-gray-700 shadow-inner"
                  placeholder="הכנס שם משתמש"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] md:text-xs font-black text-gray-400 mr-2 uppercase tracking-widest">סיסמה</label>
              <div className="relative">
                <Lock className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6 md:w-5 md:h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-[1.5rem] md:rounded-2xl py-6 md:py-4 pr-14 pl-6 outline-none focus:ring-4 focus:ring-rose-200/50 transition-all font-black text-xl md:text-base text-gray-700 shadow-inner"
                  placeholder="הכנס סיסמה"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 text-rose-600 bg-rose-50 p-6 md:p-4 rounded-2xl text-sm md:text-xs font-black animate-in slide-in-from-top-2 border border-rose-100">
                <AlertCircle size={20} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xl md:text-lg py-6 md:py-5 rounded-[2rem] md:rounded-2xl shadow-2xl shadow-rose-200 transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>התחבר למערכת</span>
                  <LogIn size={24} />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 md:mt-8 pt-10 md:pt-8 border-t border-gray-100 text-center">
            <div className="flex items-center justify-center gap-3 text-gray-400 text-[11px] font-black uppercase tracking-[0.2em]">
              <ShieldCheck size={18} />
              <span>Personal Couture Ledger</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
