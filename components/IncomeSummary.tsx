
import React, { useMemo, useState } from 'react';
import { Folder, Order } from '../types';
import { Wallet, TrendingUp, ChevronRight, ChevronLeft, Calendar, BarChart3 } from 'lucide-react';
import {
  ComparisonMode,
  DailyPoint,
  getComparisonForPeriod,
  getMonthlyDailyComparisonChart,
} from '../services/incomeAnalytics';

interface IncomeSummaryProps {
  folders: Folder[];
  orders: Order[];
}

const formatDateRange = (start: Date, end: Date, type: 'week' | 'month' | 'year') => {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (type === 'month') return start.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  if (type === 'year') return start.getFullYear().toString();
  return `${start.toLocaleDateString('he-IL', options)} - ${end.toLocaleDateString('he-IL', options)}`;
};

const formatDeltaCurrency = (value: number) => {
  if (value === 0) return '$0';
  const sign = value > 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toLocaleString()}`;
};

const formatDeltaPercent = (value: number | null) => {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const getDeltaTone = (deltaAmount: number) => {
  if (deltaAmount > 0) {
    return {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      text: 'text-emerald-700',
    };
  }
  if (deltaAmount < 0) {
    return {
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      text: 'text-rose-700',
    };
  }
  return {
    badge: 'bg-gray-50 text-gray-600 border-gray-200',
    text: 'text-gray-600',
  };
};

const IncomeSummary: React.FC<IncomeSummaryProps> = ({ folders: _folders, orders }) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('mom');
  const [viewNowTs] = useState(() => Date.now());

  const weeklyComparison = useMemo(
    () => getComparisonForPeriod(orders, 'week', weekOffset, 'mom', viewNowTs),
    [orders, weekOffset, viewNowTs],
  );

  const monthlyComparison = useMemo(
    () => getComparisonForPeriod(orders, 'month', monthOffset, comparisonMode, viewNowTs),
    [orders, monthOffset, comparisonMode, viewNowTs],
  );

  const yearlyComparison = useMemo(
    () => getComparisonForPeriod(orders, 'year', yearOffset, 'mom', viewNowTs),
    [orders, yearOffset, viewNowTs],
  );

  const monthlyChart = useMemo(
    () => getMonthlyDailyComparisonChart(orders, monthOffset, comparisonMode, viewNowTs),
    [orders, monthOffset, comparisonMode, viewNowTs],
  );

  const totalLifetimeRevenue = useMemo(
    () => orders.filter((order) => order.price > 0).reduce((sum, order) => sum + (order.price || 0), 0),
    [orders],
  );

  const monthlyComparisonLabel = comparisonMode === 'mom' ? 'לעומת חודש קודם' : 'לעומת שנה שעברה';
  const weeklyComparisonLabel = 'לעומת שבוע קודם';
  const yearlyComparisonLabel = yearOffset === 0 ? 'לעומת שנה קודמת (YTD)' : 'לעומת שנה קודמת';

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="bg-gradient-to-br from-[#8a3560] via-[#772d56] to-rose-900 p-10 md:p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden text-right">
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
              <p className="text-rose-100/90 mt-4 font-bold max-w-lg">הדוח מציג ערך עבודה לפי תקופה, עם השוואת MoM/YoY לאותה נקודת זמן.</p>
           </div>
           <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <p className="text-xs font-black text-rose-300 uppercase tracking-widest mb-1">ערך עבודה כולל (כל הזמנים)</p>
              <h3 className="text-5xl font-black font-heebo text-white">
                 <span className="text-rose-500">$</span>{totalLifetimeRevenue.toLocaleString()}
              </h3>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-rose-100 shadow-sm p-6 md:p-8 text-right">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-black text-[#2B2B2B] font-heebo">גרף השוואת הכנסות חודשי (יומי)</h3>
            <p className="text-sm text-[#7A7A7A] font-bold">השוואה לפי ימים בתוך החודש, מול תקופת בסיס מקבילה.</p>
          </div>
          <div className="inline-flex items-center gap-2 bg-[#fff1f8] border border-rose-200 rounded-2xl p-1.5 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setComparisonMode('mom')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${comparisonMode === 'mom' ? 'bg-white text-gray-900 shadow-sm' : 'text-[#7A7A7A] hover:text-gray-900'}`}
            >
              MoM
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode('yoy')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${comparisonMode === 'yoy' ? 'bg-white text-gray-900 shadow-sm' : 'text-[#7A7A7A] hover:text-gray-900'}`}
            >
              YoY
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 items-stretch">
          <div className="flex-1 border border-rose-100 rounded-2xl p-4 md:p-5 bg-[#fffafd]">
            <MonthlyComparisonChart
              points={monthlyChart.points}
              monthLabel={monthlyChart.monthLabel}
              baselineLabel={monthlyChart.baselineLabel}
              comparisonMode={comparisonMode}
            />
          </div>

          <div className="lg:w-[290px] bg-[#fff1f8] rounded-2xl p-5 border border-rose-100 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white rounded-2xl p-2.5 border border-rose-100">
                <button onClick={() => setMonthOffset((prev) => prev - 1)} className="p-2 hover:bg-[#fff1f8] rounded-xl transition-all text-[#7A7A7A] hover:text-gray-900"><ChevronRight size={20} /></button>
                <button
                  onClick={() => setMonthOffset(0)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${monthOffset === 0 ? 'bg-[#fff1f8] text-gray-900 border border-rose-100' : 'text-[#7A7A7A] hover:text-[#2B2B2B]'}`}
                >
                  חודש נוכחי
                </button>
                <button onClick={() => setMonthOffset((prev) => prev + 1)} className="p-2 hover:bg-[#fff1f8] rounded-xl transition-all text-[#7A7A7A] hover:text-gray-900"><ChevronLeft size={20} /></button>
              </div>

              <div className="bg-white border border-rose-100 rounded-2xl p-4">
                <p className="text-[10px] font-black text-[#7A7A7A] uppercase tracking-widest">תקופה נוכחית</p>
                <p className="text-sm font-black text-[#2B2B2B] mt-1">{monthlyChart.monthLabel}</p>
                <p className="text-2xl font-black font-heebo text-rose-600 mt-2">${monthlyChart.totalCurrent.toLocaleString()}</p>
              </div>

              <div className="bg-white border border-rose-100 rounded-2xl p-4">
                <p className="text-[10px] font-black text-[#7A7A7A] uppercase tracking-widest">{monthlyComparisonLabel}</p>
                <p className="text-sm font-black text-[#2B2B2B] mt-1">{monthlyChart.baselineLabel}</p>
                <p className="text-xl font-black font-heebo text-[#7A7A7A] mt-2">${monthlyChart.totalBaseline.toLocaleString()}</p>
              </div>
            </div>

            <div className={`mt-4 rounded-2xl border px-4 py-3 ${getDeltaTone(monthlyChart.deltaAmount).badge}`}>
              <p className="text-[10px] font-black uppercase tracking-widest">שינוי בתקופה</p>
              <p className="text-lg font-black mt-1">{formatDeltaCurrency(monthlyChart.deltaAmount)}</p>
              <p className="text-xs font-bold">{formatDeltaPercent(monthlyChart.deltaPercent)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <PeriodCard 
          title="ערך עבודה שבועי"
          amount={weeklyComparison.current.total}
          count={weeklyComparison.current.count}
          dateLabel={formatDateRange(weeklyComparison.current.start, weeklyComparison.current.end, 'week')}
          onPrev={() => setWeekOffset(prev => prev - 1)}
          onNext={() => setWeekOffset(prev => prev + 1)}
          color="rose"
          isCurrent={weekOffset === 0}
          onReset={() => setWeekOffset(0)}
          deltaAmount={weeklyComparison.deltaAmount}
          deltaPercent={weeklyComparison.deltaPercent}
          comparisonLabel={weeklyComparisonLabel}
        />

        <PeriodCard 
          title="ערך עבודה חודשי"
          amount={monthlyComparison.current.total}
          count={monthlyComparison.current.count}
          dateLabel={formatDateRange(monthlyComparison.current.start, monthlyComparison.current.end, 'month')}
          onPrev={() => setMonthOffset(prev => prev - 1)}
          onNext={() => setMonthOffset(prev => prev + 1)}
          color="indigo"
          isCurrent={monthOffset === 0}
          onReset={() => setMonthOffset(0)}
          deltaAmount={monthlyComparison.deltaAmount}
          deltaPercent={monthlyComparison.deltaPercent}
          comparisonLabel={monthlyComparisonLabel}
        />

        <PeriodCard 
          title="ערך עבודה שנתי"
          amount={yearlyComparison.current.total}
          count={yearlyComparison.current.count}
          dateLabel={formatDateRange(yearlyComparison.current.start, yearlyComparison.current.end, 'year')}
          onPrev={() => setYearOffset(prev => prev - 1)}
          onNext={() => setYearOffset(prev => prev + 1)}
          color="emerald"
          isCurrent={yearOffset === 0}
          onReset={() => setYearOffset(0)}
          deltaAmount={yearlyComparison.deltaAmount}
          deltaPercent={yearlyComparison.deltaPercent}
          comparisonLabel={yearlyComparisonLabel}
        />
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-rose-100 flex items-center gap-4 text-[#7A7A7A] shadow-sm text-right" dir="rtl">
         <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
            <TrendingUp size={20} />
         </div>
         <p className="text-xs font-bold leading-relaxed">
            <b>חשוב:</b> הדוחות כוללים כל פריט עם מחיר, לפי <span dir="ltr">readyAt || createdAt</span>, ומשווים לתקופת בסיס עד אותה נקודת זמן.
         </p>
      </div>
    </div>
  );
};

interface MonthlyComparisonChartProps {
  points: DailyPoint[];
  monthLabel: string;
  baselineLabel: string;
  comparisonMode: ComparisonMode;
}

const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({
  points,
  monthLabel,
  baselineLabel,
  comparisonMode,
}) => {
  const chartWidth = 760;
  const chartHeight = 300;
  const padding = { top: 18, right: 22, bottom: 36, left: 28 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const maxValue = Math.max(
    1,
    ...points.map((point) => point.currentTotal),
    ...points.map((point) => point.baselineTotal),
  );

  const pointX = (index: number) => {
    if (points.length <= 1) return padding.left + (plotWidth / 2);
    return padding.left + ((plotWidth * index) / (points.length - 1));
  };

  const pointY = (value: number) => {
    const normalized = value / maxValue;
    return padding.top + plotHeight - (normalized * plotHeight);
  };

  const toPath = (key: 'currentTotal' | 'baselineTotal') => {
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${pointX(index)} ${pointY(point[key])}`)
      .join(' ');
  };

  const tickIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]))
    .filter((index) => index >= 0);

  const gridTicks = 4;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-black text-[#2B2B2B]">{monthLabel}</p>
          <p className="text-[11px] font-bold text-[#7A7A7A]">{comparisonMode === 'mom' ? 'לעומת חודש קודם' : 'לעומת חודש מקביל בשנה קודמת'}</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#7A7A7A]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {monthLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            {baselineLabel}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-[240px]">
        <defs>
          <linearGradient id="monthly-current-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {Array.from({ length: gridTicks + 1 }).map((_, i) => {
          const y = padding.top + ((plotHeight * i) / gridTicks);
          return (
            <line
              key={`grid-${i}`}
              x1={padding.left}
              y1={y}
              x2={padding.left + plotWidth}
              y2={y}
              stroke="#f9d8e8"
              strokeWidth="1"
            />
          );
        })}

        <path
          d={`${toPath('currentTotal')} L ${pointX(points.length - 1)} ${padding.top + plotHeight} L ${pointX(0)} ${padding.top + plotHeight} Z`}
          fill="url(#monthly-current-fill)"
        />

        <path d={toPath('baselineTotal')} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPath('currentTotal')} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point, index) => (
          <g key={`dot-${point.day}`}>
            <circle cx={pointX(index)} cy={pointY(point.currentTotal)} r="3" fill="#f43f5e" />
            <circle cx={pointX(index)} cy={pointY(point.baselineTotal)} r="2.5" fill="#6366f1" />
          </g>
        ))}

        {tickIndexes.map((index) => (
          <text
            key={`tick-${index}`}
            x={pointX(index)}
            y={chartHeight - 10}
            textAnchor="middle"
            className="fill-[#7A7A7A] text-[10px] font-bold"
          >
            יום {points[index]?.day}
          </text>
        ))}
      </svg>
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
  deltaAmount: number;
  deltaPercent: number | null;
  comparisonLabel: string;
}

const PeriodCard: React.FC<PeriodCardProps> = ({
  title,
  amount,
  count,
  dateLabel,
  onPrev,
  onNext,
  onReset,
  color,
  isCurrent,
  deltaAmount,
  deltaPercent,
  comparisonLabel,
}) => {
  const styles = {
    rose: { bg: 'bg-rose-50/50', text: 'text-rose-600', btn: 'bg-rose-600', border: 'border-rose-100', icon: 'text-rose-500' },
    indigo: { bg: 'bg-indigo-50/50', text: 'text-indigo-600', btn: 'bg-indigo-600', border: 'border-indigo-100', icon: 'text-indigo-500' },
    emerald: { bg: 'bg-emerald-50/50', text: 'text-emerald-600', btn: 'bg-emerald-600', border: 'border-emerald-100', icon: 'text-emerald-500' }
  }[color];
  const deltaTone = getDeltaTone(deltaAmount);

  return (
    <div className={`bg-white rounded-[2.5rem] p-8 shadow-sm border border-rose-100 flex flex-col h-[420px] transition-all hover:shadow-2xl hover:-translate-y-1 group relative overflow-hidden text-right`}>
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-5 ${styles.btn}`}></div>
      
      <div className="flex justify-between items-center mb-8 relative z-10">
         <div className={`w-12 h-12 ${styles.bg} rounded-2xl flex items-center justify-center ${styles.text} shadow-sm group-hover:scale-110 transition-transform`}>
            <Wallet size={24} />
         </div>
         <div className="flex items-center gap-2 bg-[#fff3f9] p-1.5 rounded-2xl border border-rose-100">
            <button onClick={onPrev} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-[#7A7A7A] hover:text-gray-900"><ChevronRight size={20} /></button>
            <button 
              onClick={onReset} 
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${isCurrent ? 'bg-white text-gray-900 shadow-sm' : 'text-[#7A7A7A] hover:text-[#7A7A7A]'}`}
            >
              נוכחי
            </button>
            <button onClick={onNext} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-[#7A7A7A] hover:text-gray-900"><ChevronLeft size={20} /></button>
         </div>
      </div>

      <div className="text-right mb-10 flex-1">
         <h4 className="text-xl font-black text-[#2B2B2B] font-heebo">{title}</h4>
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

         <div className={`border rounded-2xl px-3 py-2 mb-4 ${deltaTone.badge}`}>
            <p className="text-[10px] font-black uppercase tracking-widest">{comparisonLabel}</p>
            <p className="text-sm font-black">{formatDeltaCurrency(deltaAmount)} • {formatDeltaPercent(deltaPercent)}</p>
         </div>

         <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles.bg} ${styles.text}`}>
              {isCurrent ? 'תקופה פעילה' : 'היסטוריה'}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#7A7A7A]">תיקונים סה"כ</span>
              <span className="text-xs font-black text-[#2B2B2B]">{count}</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default IncomeSummary;
