
import React from 'react';
import { Client, Order, Folder } from '../types';
import { TrendingUp, Users, Scissors, Clock, FolderOpen, Package, Wallet, Cloud, ShieldCheck, ListTodo, Eye } from 'lucide-react';

interface DashboardProps {
  clients: Client[];
  folders: Folder[];
  orders: Order[];
  onNavigate: (tab: string) => void;
  userRole?: string;
  isWeeklyRevenueVisible: boolean;
  onRequestWeeklyRevenueReveal: () => void;
}

const DASHBOARD_THEME = {
  primary: '#E54886',
  secondary: '#F26AA3',
  softBlush: '#F8C8DC',
  background: '#FFF4F8',
  text: '#2B2B2B',
  muted: '#7A7A7A',
  accent: '#C9A227'
};

const dashboardVars = {
  '--ms-primary': DASHBOARD_THEME.primary,
  '--ms-secondary': DASHBOARD_THEME.secondary,
  '--ms-soft': DASHBOARD_THEME.softBlush,
  '--ms-bg': DASHBOARD_THEME.background,
  '--ms-text': DASHBOARD_THEME.text,
  '--ms-muted': DASHBOARD_THEME.muted,
  '--ms-accent': DASHBOARD_THEME.accent
} as React.CSSProperties;

const orderStatusPillClass: Record<string, string> = {
  חדש: 'bg-[#fde4f0] text-[#E54886] border border-[#e5488685]',
  מדידות: 'bg-[#fff2df] text-[#c98d1a] border border-[#c9a22785]',
  בתפירה: 'bg-[#ffe8f2] text-[#cf3c79] border border-[#e548867d]',
  מוכן: 'bg-[#eaf7ef] text-[#2f8a56] border border-[#2f8a5673]'
};

const Dashboard: React.FC<DashboardProps> = ({
  clients,
  folders,
  orders,
  onNavigate,
  userRole,
  isWeeklyRevenueVisible,
  onRequestWeeklyRevenueReveal
}) => {
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

  const isSuperAdmin = userRole === 'super_admin';
  const isStaffOrAbove = userRole !== 'viewer';
  const weeklyRevenueDisplay = isWeeklyRevenueVisible ? `$${weeklyRevenue.toLocaleString()}` : '$••••••';

  return (
    <div
      className="relative space-y-6 md:space-y-8 pb-32 pt-4 px-0.5 md:px-0 overflow-hidden"
      style={dashboardVars}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(circle at 82% 28%, rgba(242,106,163,0.5), transparent 40%), radial-gradient(circle at 14% 72%, rgba(248,200,220,0.56), transparent 43%), linear-gradient(180deg, #ffeef6 0%, #ffdff0 52%, #ffd0e5 100%)'
        }}
      />
      <div className="pointer-events-none absolute -top-24 right-2 w-80 h-80 rounded-full bg-[#f8c8dc]/58 blur-3xl -z-10" />
      <div className="pointer-events-none absolute top-[39%] -left-24 w-96 h-96 rounded-full bg-[#f8c8dc]/48 blur-3xl -z-10" />
      <div className="pointer-events-none absolute -bottom-32 right-8 w-80 h-80 rounded-full bg-[#f26aa355] blur-3xl -z-10" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60" style={{ backgroundImage: 'radial-gradient(rgba(229,72,134,0.16) 1px, transparent 1px)', backgroundSize: '4px 4px' }} />

      {/* Welcome Section */}
      <div
        className="relative p-8 md:p-10 rounded-[1.85rem] md:rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-7 overflow-hidden border border-[#e548867f]"
        style={{
          background: 'linear-gradient(145deg, #fff6fb 0%, #ffddeb 44%, #f5c2d8 100%)',
          boxShadow: '0 16px 36px rgba(229,72,134,0.24)'
        }}
      >
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#ffffff96] rounded-full -ml-28 -mt-28 blur-[95px]" />
        <div className="absolute bottom-0 right-0 w-56 h-56 bg-[#f26aa322] rounded-full -mr-16 -mb-16 blur-[85px]" />
        <div className="absolute top-14 right-[20%] w-28 h-28 rounded-full bg-white/55 blur-2xl" />

        <div className="text-center md:text-right z-10 max-w-3xl">
           <h2
             className="text-[2.12rem] md:text-[2.65rem] leading-[1.2] tracking-[0.01em]"
             style={{ color: '#682048', fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontWeight: 500 }}
           >
             בוקר טוב, סטודיו Malki Style ✨
           </h2>
           <p className="mt-3 text-[1rem] md:text-[1.2rem] leading-relaxed font-semibold" style={{ color: '#6F4A61' }}>
             יש לך <span className="font-black" style={{ color: 'var(--ms-primary)' }}>{activeOrdersCount}</span> עבודות פעילות
             <span className="mx-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle" style={{ backgroundColor: 'var(--ms-accent)' }} />
             ו־<span className="font-black" style={{ color: 'var(--ms-primary)' }}>{urgentOrders}</span> דחופות להיום.
           </p>
        </div>
        <div className="flex gap-4 z-10">
          <button
            onClick={() => onNavigate('folders')}
            className="px-7 py-3.5 rounded-full font-black text-base transition-all duration-200 border bg-white shadow-[0_9px_24px_rgba(229,72,134,0.2)] hover:bg-[var(--ms-primary)] hover:text-white hover:shadow-[0_11px_26px_rgba(229,72,134,0.28)] active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e5488661] inline-flex items-center gap-2.5"
            style={{ borderColor: '#e5488688', color: '#8b3664' }}
          >
            <Scissors size={17} strokeWidth={1.9} />
            ניהול תיקים
          </button>
        </div>
      </div>

      {/* Boutique Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="עבודות פעילות" value={activeOrdersCount.toString()} icon={<Scissors className="w-5 h-5" />} />
        <StatCard
          title="ערך עבודה שבועי"
          value={weeklyRevenueDisplay}
          icon={<TrendingUp className="w-5 h-5" />}
          actionIcon={<Eye className="w-4 h-4" />}
          actionLabel={isWeeklyRevenueVisible ? 'נתון גלוי' : 'חשיפת ערך עבודה שבועי'}
          onActionClick={isWeeklyRevenueVisible ? undefined : onRequestWeeklyRevenueReveal}
        />
        <StatCard title="סך לקוחות" value={clients.length.toString()} icon={<Users className="w-5 h-5" />} />
        <StatCard title="עבודות דחופות" value={urgentOrders.toString()} icon={<Clock className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-3 rounded-[1.85rem] md:rounded-[2rem] p-6 md:p-8 text-right border bg-white/95" style={{ borderColor: '#e5488676', boxShadow: '0 12px 25px rgba(229,72,134,0.16)' }}>
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs font-black px-5 py-2.5 rounded-full border transition-all duration-200 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e5488661] hover:bg-[#E54886] hover:text-white"
              style={{ color: '#8b3664', backgroundColor: '#fff0f7', borderColor: '#e548867d' }}
            >
              הצג את כל ההזמנות
            </button>
            <h3 className="text-xl font-black" style={{ color: 'var(--ms-text)' }}>פעילות אחרונה</h3>
          </div>
          
          <div className="space-y-4">
             {orders.slice().sort((a,b) => b.createdAt - a.createdAt).slice(0, 5).map(order => {
               const folder = folders.find(f => f.id === order.folderId);
               const pillClass = folder?.isDelivered
                 ? 'bg-[#f2f9f4] text-[#2f8a56] border border-[#2f8a5642]'
                 : (orderStatusPillClass[order.status] || 'bg-[#fdf2f7] text-[#cf3c79] border border-[#e548864f]');
               return (
                 <div
                   key={order.id}
                   onClick={() => onNavigate('orders')}
                   className="p-5 md:p-6 rounded-[1.45rem] md:rounded-[1.55rem] border flex justify-between items-center cursor-pointer group transition-all duration-200 hover:-translate-y-0.5"
                   style={{
                     backgroundColor: '#fff8fc',
                     borderColor: '#e5488678',
                     boxShadow: '0 8px 18px rgba(229,72,134,0.13)'
                   }}
                 >
                    <div className="flex items-center gap-4">
                       <div className="text-left">
                          <p className="text-xl font-black font-heebo" style={{ color: 'var(--ms-primary)' }}>${order.price}</p>
                          <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${pillClass}`}>
                            {folder?.isDelivered ? 'נמסר' : order.status}
                          </span>
                       </div>
                    </div>
                    <div className="text-right flex-1 pr-6">
                      <p className="font-black text-lg transition-colors duration-200 group-hover:text-[#E54886]" style={{ color: 'var(--ms-text)' }}>{order.itemType}</p>
                      <p className="text-xs font-bold flex items-center justify-end gap-1 mt-1" style={{ color: 'var(--ms-muted)' }}>
                        {order.clientName} • <Clock size={12} /> {new Date(order.createdAt).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>
      </div>

      {/* Full Navigation Grid for Mobile */}
      <div className="rounded-[1.85rem] md:rounded-[2rem] p-6 md:p-8 text-right border bg-white/95" style={{ borderColor: '#e5488676', boxShadow: '0 12px 25px rgba(229,72,134,0.16)' }}>
         <h3 className="text-xl font-black mb-6" style={{ color: 'var(--ms-text)' }}>כל הכלים והניהול</h3>
         <div className="grid grid-cols-3 gap-4">
            <NavGridButton label="משימות" icon={<ListTodo />} onClick={() => onNavigate('tasks')} />
            <NavGridButton label="לקוחות" icon={<Users />} onClick={() => onNavigate('clients')} />
            <NavGridButton label="תיקים" icon={<FolderOpen />} onClick={() => onNavigate('folders')} />
            <NavGridButton label="הזמנות" icon={<Scissors />} onClick={() => onNavigate('orders')} />
            {isStaffOrAbove && <NavGridButton label="תשלומים" icon={<Wallet />} onClick={() => onNavigate('payments')} />}
            <NavGridButton label="מלאי" icon={<Package />} onClick={() => onNavigate('inventory')} />
            {isSuperAdmin && <NavGridButton label="ענן" icon={<Cloud />} onClick={() => onNavigate('data-mgmt')} />}
            {isSuperAdmin && <NavGridButton label="צוות" icon={<ShieldCheck />} onClick={() => onNavigate('users')} />}
         </div>
      </div>
    </div>
  );
};

const NavGridButton: React.FC<{label: string, icon: any, onClick: () => void}> = ({label, icon, onClick}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 group active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e548864a] rounded-2xl"
  >
    <div
      className="w-full aspect-square rounded-[1.4rem] flex items-center justify-center border transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[#e5488688]"
      style={{
        backgroundColor: '#ffedf6',
        borderColor: '#e548867f',
        color: '#E54886',
        boxShadow: '0 7px 16px rgba(229,72,134,0.16)'
      }}
    >
       {React.cloneElement(icon, { size: 27, strokeWidth: 1.8 })}
    </div>
    <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: '#7A7A7A' }}>{label}</span>
  </button>
);

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  actionIcon?: React.ReactNode;
  actionLabel?: string;
  onActionClick?: () => void;
}> = ({ title, value, icon, actionIcon, actionLabel, onActionClick }) => {
  return (
    <div
      className="bg-white rounded-[1.5rem] md:rounded-[1.7rem] p-5 md:p-6 border flex flex-col justify-between h-40 md:h-36 text-right transition-all duration-200 hover:-translate-y-0.5 group overflow-hidden relative"
      style={{
        borderColor: '#e5488680',
        boxShadow: '0 9px 20px rgba(229,72,134,0.17)'
      }}
    >
      <div className="absolute -bottom-7 -left-7 w-20 h-20 rounded-full bg-[#f7dce8]/75" />
      <div className="z-10 flex items-start justify-between">
        {actionIcon ? (
          onActionClick ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onActionClick();
              }}
              aria-label={actionLabel || title}
              className="w-8 h-8 rounded-xl border transition-colors duration-200 flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e5488659] hover:text-[#E54886]"
              style={{ backgroundColor: '#fff0f7', borderColor: '#e548867d', color: '#7A7A7A' }}
            >
              {actionIcon}
            </button>
          ) : (
            <span className="w-8 h-8 rounded-xl border flex items-center justify-center" style={{ backgroundColor: '#fff0f7', borderColor: '#e548867d', color: '#9ca3af' }}>
              {actionIcon}
            </span>
          )
        ) : (
          <span />
        )}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform duration-200"
          style={{
            backgroundColor: '#f8d0e2',
            color: '#E54886',
            border: '1px solid rgba(229,72,134,0.58)',
            boxShadow: '0 6px 14px rgba(229,72,134,0.2)'
          }}
        >
          {icon}
        </div>
      </div>
      <div className="z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1" style={{ color: '#7A7A7A' }}>{title}</p>
        <h4 className="text-3xl font-black font-heebo" style={{ color: '#E54886' }}>{value}</h4>
      </div>
    </div>
  );
};

export default Dashboard;
