
import React, { useState, useMemo } from 'react';
import { Folder, Order } from '../types';
import { Wallet, TrendingUp, ChevronRight, ChevronLeft, Calendar, BarChart3, Clock, RefreshCw } from 'lucide-react';

interface IncomeSummaryProps {
  folders: Folder[];
  orders: Order[];
}

const IncomeSummary: React.FC<IncomeSummaryProps> = ({ folders, orders }) => {
  const [weekOffset, setWeekOffset] = useState(0); 
  const [monthOffset, setMonthOffset] = useState(0); 
  const [yearOffset, setYearOffset] = useState(0); 

  const calculateForRange = (rangeStart: Date, rangeEnd: Date) => {
    const filtered = orders.filter(o => {
      // Logic changed: Include ALL orders with price > 0
      // We use readyAt if available (actual completion), fallback to createdAt (when it was booked)
      if (!(o.price > 0)) return false;

      const targetDate = o.readyAt || o.createdAt;
      return targetDate >= rangeStart.getTime() && targetDate <= rangeEnd.getTime();
    });

    const total = filtered.reduce((acc, curr) => acc + (curr.price || 0), 0);
    return { total, count: filtered.length };
  };

  const getPeriodData = (type: 'week' | 'month' | 'year', offset: number) => {
    const now = new Date();
    
    if (type === 'week') {
      const start = new Date();
      start.setDate(now.getDate() - now.getDay() + (offset * 7));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      const data = calculateForRange(start, end);
      return { ...data, start, end };
    } 
    
    if (type === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
      end.setHours(23, 59, 59, 999);
      const data = calculateForRange(start, end);
      return { ...data, start, end };
    } 
    
    if (type === 'year') {
      let yearlyTotal = 0;
      let yearlyCount = 0;
      const targetYear = now.getFullYear() + offset;

      for (let m = 0; m < 12; m++) {
        const mStart = new Date(targetYear, m, 1, 0, 0, 0, 0);
        const mEnd = new Date(targetYear, m + 1, 0, 23, 59, 59, 999);
        const mData = calculateForRange(mStart, mEnd);
        yearlyTotal += mData.total;
        yearlyCount += mData.count;
      }

      const start = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      const end = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      return { total: yearlyTotal, count: yearlyCount, start, end };
    }

    return { total: 0, count: 0, start: new Date(), end: new Date() };
  };

  const weekly = useMemo(() => getPeriodData('week', weekOffset), [orders, folders, weekOffset]);
  const monthly = useMemo(() => getPeriodData('month', monthOffset), [orders, folders, monthOffset]);
  const yearly = useMemo(() => getPeriodData('year', yearOffset), [orders, folders, yearOffset]);

  const formatDateRange = (start: Date, end: Date, type: 'week' | 'month' | 'year') => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    if (type === 'month') return start.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    if (type === 'year') return start.getFullYear().toString();
    return `${start.toLocaleDateString('he-IL', options)} - ${end.toLocaleDateString('he-IL', options)}`;
  };

  const totalLifetimeRevenue = orders
    .filter(o => o.price > 0)
    .reduce((a, b) => a + (b.price || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-rose-900 p-10 md:p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden text-right">
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
           <div className="absolute top-10 right-10 w-64 h-64 bg-white rounded-full blur-[100px]"></div>
           <div className="absolute bottom-10 left-10 w-64 h-64 bg-rose-500 rounded-full blur-[100px]"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-right">
           <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-white/10">
                 <BarChart3 size={12} className="text-rose-400" /> 
                 Full Volume Analytics
              </div>
              <h2 className="text-4xl md:text-5xl font-black font-heebo tracking-tighter">סיכום הכנסות וערך עבודה</h2>
              <p className="text-slate-400 mt-4 font-bold max-w-lg">הדוח מציג כעת את הערך הכולל של כל התיקונים שנרשמו במערכת (כולל ייבוא היסטורי), ללא קשר לסטטוס התשלום.</p>
           </div>
           <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <p className="text-xs font-black text-rose-300 uppercase tracking-widest mb-1">ערך עבודה כולל (כל הזמנים)</p>
              <h3 className="text-5xl font-black font-heebo text-white">
                 <span className="text-rose-500">$</span>{totalLifetimeRevenue.toLocaleString()}
              </h3>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <PeriodCard 
          title="ערך עבודה שבועי"
          amount={weekly.total}
          count={weekly.count}
          dateLabel={formatDateRange(weekly.start, weekly.end, 'week')}
          onPrev={() => setWeekOffset(prev => prev - 1)}
          onNext={() => setWeekOffset(prev => prev + 1)}
          color="rose"
          isCurrent={weekOffset === 0}
          onReset={() => setWeekOffset(0)}
        />

        <PeriodCard 
          title="ערך עבודה חודשי"
          amount={monthly.total}
          count={monthly.count}
          dateLabel={formatDateRange(monthly.start, monthly.end, 'month')}
          onPrev={() => setMonthOffset(prev => prev - 1)}
          onNext={() => setMonthOffset(prev => prev + 1)}
          color="indigo"
          isCurrent={monthOffset === 0}
          onReset={() => setMonthOffset(0)}
        />

        <PeriodCard 
          title="ערך עבודה שנתי"
          amount={yearly.total}
          count={yearly.count}
          dateLabel={formatDateRange(yearly.start, yearly.end, 'year')}
          onPrev={() => setYearOffset(prev => prev - 1)}
          onNext={() => setYearOffset(prev => prev + 1)}
          color="emerald"
          isCurrent={yearOffset === 0}
          onReset={() => setYearOffset(0)}
        />
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 flex items-center gap-4 text-gray-500 shadow-sm text-right" dir="rtl">
         <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
            <TrendingUp size={20} />
         </div>
         <p className="text-xs font-bold leading-relaxed">
            <b>חשוב:</b> הדוחות כוללים כעת את כל הפריטים שיש להם מחיר, גם אם הם לא סומנו כ"מוכנים" או "שולמו". זה נועד להבטיח שכל המידע ההיסטורי שלך יופיע בגרפים.
         </p>
      </div>
    </div>
  );
};

interface PeriodCardProps {
  title: string;
  amount: number;
  count: number;
  dateLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  color: 'rose' | 'indigo' | 'emerald';
  isCurrent: boolean;
}

const PeriodCard: React.FC<PeriodCardProps> = ({ title, amount, count, dateLabel, onPrev, onNext, onReset, color, isCurrent }) => {
  const styles = {
    rose: { bg: 'bg-rose-50/50', text: 'text-rose-600', btn: 'bg-rose-600', border: 'border-rose-100', icon: 'text-rose-500' },
    indigo: { bg: 'bg-indigo-50/50', text: 'text-indigo-600', btn: 'bg-indigo-600', border: 'border-indigo-100', icon: 'text-indigo-500' },
    emerald: { bg: 'bg-emerald-50/50', text: 'text-emerald-600', btn: 'bg-emerald-600', border: 'border-emerald-100', icon: 'text-emerald-500' }
  }[color];

  return (
    <div className={`bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col h-[420px] transition-all hover:shadow-2xl hover:-translate-y-1 group relative overflow-hidden text-right`}>
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-5 ${styles.btn}`}></div>
      
      <div className="flex justify-between items-center mb-8 relative z-10">
         <div className={`w-12 h-12 ${styles.bg} rounded-2xl flex items-center justify-center ${styles.text} shadow-sm group-hover:scale-110 transition-transform`}>
            <Wallet size={24} />
         </div>
         <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
            <button onClick={onPrev} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-gray-400 hover:text-gray-900"><ChevronRight size={20} /></button>
            <button 
              onClick={onReset} 
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${isCurrent ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              נוכחי
            </button>
            <button onClick={onNext} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-gray-400 hover:text-gray-900"><ChevronLeft size={20} /></button>
         </div>
      </div>

      <div className="text-right mb-10 flex-1">
         <h4 className="text-xl font-black text-gray-800 font-heebo">{title}</h4>
         <div className="flex items-center justify-end gap-1.5 mt-1">
            <span className={`text-xs font-black uppercase tracking-tighter ${styles.text}`}>{dateLabel}</span>
            <Calendar size={12} className="text-gray-300" />
         </div>
      </div>

      <div className="text-right mt-auto">
         <div className="mb-4">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">ערך כולל לתקופה</p>
            <h3 className={`text-6xl font-black font-heebo tracking-tighter ${styles.text}`}>
               <span className="text-3xl mr-1">$</span>{amount.toLocaleString()}
            </h3>
         </div>
         
         <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
               <span className="text-xs font-black text-gray-800">{count}</span>
               <span className="text-[10px] font-bold text-gray-400">תיקונים סה"כ</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles.bg} ${styles.text}`}>
               {isCurrent ? 'תקופה פעילה' : 'היסטוריה'}
            </div>
         </div>
      </div>
    </div>
  );
};

export default IncomeSummary;
