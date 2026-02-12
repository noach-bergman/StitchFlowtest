
import React from 'react';
import { Client, Order, Folder } from '../types';
import { TrendingUp, Users, Scissors, Clock, ArrowUpRight, FolderOpen, Target, Sparkles, Package, Wallet, Cloud, ShieldCheck, MessageSquare } from 'lucide-react';
import { STATUS_COLORS, NAV_ITEMS } from '../constants';

interface DashboardProps {
  clients: Client[];
  folders: Folder[];
  orders: Order[];
  onNavigate: (tab: string) => void;
  userRole?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ clients, folders, orders, onNavigate, userRole }) => {
  const activeOrdersCount = orders.filter(o => {
    const folder = folders.find(f => f.id === o.folderId);
    return folder && !folder.isDelivered;
  }).length;
  
  const now = new Date();
  
  // Calculate Start of Week (Sunday 00:00:00)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Calculate End of Week (Saturday 23:59:59)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  // Weekly Revenue Logic Adjusted: Include ALL orders with price
  const weeklyRevenue = orders
    .filter(o => {
      if (!(o.price > 0)) return false;
      const targetDate = o.readyAt || o.createdAt;
      return targetDate >= startOfWeek.getTime() && targetDate <= endOfWeek.getTime();
    })
    .reduce((acc, curr) => acc + (curr.price || 0), 0);

  const urgentOrders = orders.filter(o => {
    const folder = folders.find(f => f.id === o.folderId);
    if (!folder || folder.isDelivered || folder.deadline === 'ללא יעד') return false;
    const deadlineDate = new Date(folder.deadline.split('.').reverse().join('-')); 
    const today = new Date().setHours(0, 0, 0, 0);
    const threeDaysFromNow = today + 3 * 24 * 60 * 60 * 1000;
    return deadlineDate.getTime() <= threeDaysFromNow;
  }).length;

  const isAtLeastAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  return (
    <div className="space-y-6 md:space-y-8 pb-32 pt-4"> 
      {/* Welcome Section */}
      <div className="bg-gradient-to-l from-slate-900 to-slate-800 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-rose-500/10 rounded-full -ml-32 -mt-32 blur-[100px]"></div>
        <div className="text-center md:text-right z-10">
           <h2 className="text-3xl font-black font-heebo">בוקר טוב, סטודיו StitchFlow ✨</h2>
           <p className="text-slate-400 mt-2 font-bold">יש לך {activeOrdersCount} עבודות פעילות ו-{urgentOrders} דחופות להיום.</p>
        </div>
        <div className="flex gap-4 z-10">
          <button onClick={() => onNavigate('folders')} className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl font-black text-sm transition-all border border-white/10">ניהול תיקים</button>
          <button onClick={() => onNavigate('ai-assistant')} className="bg-rose-600 hover:bg-rose-700 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-xl shadow-rose-600/30">עוזרת AI</button>
        </div>
      </div>

      {/* Vibrant Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="עבודות פעילות" value={activeOrdersCount.toString()} icon={<Scissors className="w-6 h-6" />} color="indigo" />
        <StatCard title="ערך עבודה שבועי" value={`$${weeklyRevenue.toLocaleString()}`} icon={<TrendingUp className="w-6 h-6" />} color="emerald" />
        <StatCard title="סך לקוחות" value={clients.length.toString()} icon={<Users className="w-6 h-6" />} color="violet" />
        <StatCard title="עבודות דחופות" value={urgentOrders.toString()} icon={<Clock className="w-6 h-6" />} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 text-right">
          <div className="flex justify-between items-center mb-8">
            <button onClick={() => onNavigate('orders')} className="text-xs font-black text-rose-600 bg-rose-50 px-5 py-2 rounded-full hover:bg-rose-100 transition-colors">הצג את כל ההזמנות</button>
            <h3 className="text-xl font-black text-gray-800">פעילות אחרונה</h3>
          </div>
          
          <div className="space-y-4">
             {orders.slice().sort((a,b) => b.createdAt - a.createdAt).slice(0, 5).map(order => {
               const folder = folders.find(f => f.id === order.folderId);
               return (
                 <div key={order.id} onClick={() => onNavigate('orders')} className="p-6 bg-slate-50/50 rounded-3xl border border-gray-50 flex justify-between items-center hover:bg-white hover:shadow-xl hover:border-rose-100 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                       <div className="text-left">
                          <p className="text-xl font-black text-gray-900 font-heebo">${order.price}</p>
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${folder?.isDelivered ? 'bg-emerald-100 text-emerald-700' : STATUS_COLORS[order.status]}`}>
                            {folder?.isDelivered ? 'נמסר' : order.status}
                          </span>
                       </div>
                    </div>
                    <div className="text-right flex-1 pr-6">
                      <p className="font-black text-gray-800 text-lg group-hover:text-rose-600 transition-colors">{order.itemType}</p>
                      <p className="text-xs text-gray-400 font-bold flex items-center justify-end gap-1 mt-1">
                        {order.clientName} • <Clock size={12} /> {new Date(order.createdAt).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>

        {/* AI & Quick Actions */}
        <div className="flex flex-col gap-6">
          <div 
            onClick={() => onNavigate('ai-assistant')}
            className="bg-gradient-to-br from-indigo-600 via-rose-500 to-pink-600 rounded-[2.5rem] p-8 text-white shadow-2xl relative cursor-pointer overflow-hidden group h-full flex flex-col justify-between"
          >
            <div className="relative z-10 text-right">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 mr-auto border border-white/20 shadow-lg group-hover:scale-110 transition-transform">
                <Sparkles className="text-white w-8 h-8 animate-pulse" />
              </div>
              <h4 className="font-black text-2xl mb-2 font-heebo italic">מעצבת AI אישית</h4>
              <p className="text-sm opacity-90 leading-relaxed font-bold">שילובי בדים וייעוץ עיצובי חכם.</p>
            </div>
            <div className="relative z-10 mt-8 flex items-center justify-end gap-2 font-black text-xs uppercase tracking-widest bg-black/20 w-fit pr-4 py-2 rounded-full mr-auto">
               <span>Open AI</span>
               <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Full Navigation Grid for Mobile */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 text-right">
         <h3 className="text-xl font-black text-gray-800 mb-6">כל הכלים והניהול</h3>
         <div className="grid grid-cols-3 gap-4">
            <NavGridButton label="לקוחות" icon={<Users />} color="bg-blue-50 text-blue-600 border-blue-100" onClick={() => onNavigate('clients')} />
            <NavGridButton label="תיקים" icon={<FolderOpen />} color="bg-rose-50 text-rose-600 border-rose-100" onClick={() => onNavigate('folders')} />
            <NavGridButton label="הזמנות" icon={<Scissors />} color="bg-indigo-50 text-indigo-600 border-indigo-100" onClick={() => onNavigate('orders')} />
            <NavGridButton label="מלאי" icon={<Package />} color="bg-amber-50 text-amber-600 border-amber-100" onClick={() => onNavigate('inventory')} />
            {isAtLeastAdmin && <NavGridButton label="הכנסות" icon={<Wallet />} color="bg-emerald-50 text-emerald-600 border-emerald-100" onClick={() => onNavigate('income')} />}
            {isSuperAdmin && <NavGridButton label="ענן" icon={<Cloud />} color="bg-slate-100 text-slate-600 border-slate-200" onClick={() => onNavigate('data-mgmt')} />}
            {isSuperAdmin && <NavGridButton label="צוות" icon={<ShieldCheck />} color="bg-violet-50 text-violet-600 border-violet-100" onClick={() => onNavigate('users')} />}
            <NavGridButton label="עוזרת AI" icon={<MessageSquare />} color="bg-pink-50 text-pink-600 border-pink-100" onClick={() => onNavigate('ai-assistant')} />
         </div>
      </div>
    </div>
  );
};

const NavGridButton: React.FC<{label: string, icon: any, color: string, onClick: () => void}> = ({label, icon, color, onClick}) => (
  <button onClick={onClick} className="flex flex-col items-center gap-2 group active:scale-95 transition-all">
    <div className={`w-full aspect-square rounded-3xl flex items-center justify-center border shadow-sm group-hover:shadow-md transition-all ${color}`}>
       {React.cloneElement(icon, { size: 28 })}
    </div>
    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">{label}</span>
  </button>
);

const StatCard: React.FC<{ title: string, value: string, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => {
  const colorMap: Record<string, { bg: string, text: string, icon: string, border: string }> = {
    indigo: { bg: 'bg-indigo-50/50', text: 'text-indigo-600', icon: 'bg-indigo-600', border: 'border-indigo-100' },
    emerald: { bg: 'bg-emerald-50/50', text: 'text-emerald-600', icon: 'bg-emerald-600', border: 'border-emerald-100' },
    violet: { bg: 'bg-violet-50/50', text: 'text-violet-600', icon: 'bg-violet-600', border: 'border-violet-100' },
    rose: { bg: 'bg-rose-50/50', text: 'text-rose-600', icon: 'bg-rose-600', border: 'border-rose-100' },
    amber: { bg: 'bg-amber-50/50', text: 'text-amber-600', icon: 'bg-amber-600', border: 'border-amber-100' }
  };
  const current = colorMap[color];
  return (
    <div className={`bg-white rounded-[2.2rem] p-6 shadow-sm border ${current.border} flex flex-col justify-between h-40 md:h-36 text-right hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden relative`}>
      <div className={`absolute -left-4 -bottom-4 w-16 h-16 rounded-full opacity-10 ${current.icon}`}></div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${current.icon} group-hover:scale-110 transition-transform mr-auto`}>
        {icon}
      </div>
      <div className="z-10">
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-wider mb-1">{title}</p>
        <h4 className={`text-3xl font-black font-heebo ${current.text}`}>{value}</h4>
      </div>
    </div>
  );
};

export default Dashboard;
