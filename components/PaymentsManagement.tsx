import React, { useMemo, useState } from 'react';
import { Folder, Order, PaymentStatus } from '../types';
import { ExternalLink, Search, Wallet } from 'lucide-react';
import { getEffectivePaidAmount, getFolderTotal, getPaymentStatus, getRemaining } from '../services/paymentUtils';

interface PaymentsManagementProps {
  folders: Folder[];
  orders: Order[];
  onNavigateToFolder: (folderId: string) => void;
}

const statusOptions: Array<'הכל' | PaymentStatus> = ['הכל', 'לא שולם', 'שולם חלקית', 'שולם'];

const statusStyles: Record<PaymentStatus, string> = {
  'לא שולם': 'bg-rose-50 text-rose-700 border-rose-200',
  'שולם חלקית': 'bg-amber-50 text-amber-700 border-amber-200',
  'שולם': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const PaymentsManagement: React.FC<PaymentsManagementProps> = ({ folders, orders, onNavigateToFolder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'הכל' | PaymentStatus>('הכל');

  const rows = useMemo(() => {
    const mappedRows = folders
      .filter((folder) => !folder.isArchived)
      .map((folder) => {
      const total = getFolderTotal(folder.id, orders);
      const paidAmount = getEffectivePaidAmount(folder, total);
      const status = getPaymentStatus(total, paidAmount);
      const remaining = getRemaining(total, paidAmount);

      return {
        folder,
        total,
        paidAmount,
        status,
        remaining,
      };
    });

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredRows = mappedRows.filter(({ folder, status }) => {
      const matchesSearch = !normalizedSearch
        || folder.name.toLowerCase().includes(normalizedSearch)
        || folder.clientName.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === 'הכל' || status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return filteredRows.sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return b.folder.createdAt - a.folder.createdAt;
    });
  }, [folders, orders, searchTerm, statusFilter]);

  return (
    <div className="space-y-6 pb-24 text-right">
      <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="text-right">
            <h3 className="text-2xl font-black text-gray-800 font-heebo">ניהול תשלומים</h3>
            <p className="text-sm text-gray-400 font-bold">מעקב יתרות וסטטוס תשלום לפי תיק</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
            <Wallet size={26} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 mt-6">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חיפוש לפי שם תיק או לקוח..."
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pr-11 pl-4 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl p-1.5 overflow-x-auto">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all ${statusFilter === status ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr] gap-3 px-6 py-4 border-b border-gray-100 bg-slate-50 text-[11px] text-gray-500 font-black uppercase tracking-widest">
          <span className="text-right">שם תיק</span>
          <span className="text-right">לקוח</span>
          <span className="text-right">מחיר כולל</span>
          <span className="text-right">שולם</span>
          <span className="text-right">יתרה</span>
          <span className="text-right">סטטוס</span>
          <span className="text-right">פעולה</span>
        </div>

        {rows.length === 0 ? (
          <div className="p-10 text-center text-gray-400 font-bold">לא נמצאו תיקים להצגה.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map(({ folder, total, paidAmount, remaining, status }) => (
              <div key={folder.id} className="px-6 py-5 hover:bg-slate-50/60 transition-colors">
                <div className="md:hidden space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <button
                      onClick={() => onNavigateToFolder(folder.id)}
                      className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-3 py-2 rounded-xl text-[10px] font-black"
                    >
                      <ExternalLink size={12} />
                      פתח תיק
                    </button>
                    <div className="text-right">
                      <p className="font-black text-gray-800">{folder.name}</p>
                      <p className="text-xs text-gray-400 font-bold">{folder.clientName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Metric label={'סה"כ'} value={`$${total.toLocaleString()}`} />
                    <Metric label="שולם" value={`$${paidAmount.toLocaleString()}`} />
                    <Metric label="יתרה" value={`$${remaining.toLocaleString()}`} />
                  </div>
                  <div className="flex justify-end">
                    <span className={`px-3 py-1.5 rounded-full border text-xs font-black ${statusStyles[status]}`}>{status}</span>
                  </div>
                </div>

                <div className="hidden md:grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr] gap-3 items-center">
                  <div className="text-right">
                    <p className="font-black text-gray-800">{folder.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold">{folder.deadline === 'ללא יעד' ? 'ללא יעד' : folder.deadline}</p>
                  </div>
                  <p className="font-bold text-gray-600 text-right">{folder.clientName}</p>
                  <p className="font-black text-gray-800 text-right">${total.toLocaleString()}</p>
                  <p className="font-black text-emerald-700 text-right">${paidAmount.toLocaleString()}</p>
                  <p className="font-black text-rose-600 text-right">${remaining.toLocaleString()}</p>
                  <div className="text-right">
                    <span className={`px-3 py-1.5 rounded-full border text-xs font-black ${statusStyles[status]}`}>{status}</span>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => onNavigateToFolder(folder.id)}
                      className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-xl text-[10px] font-black hover:bg-black transition-colors"
                    >
                      <ExternalLink size={12} />
                      פתח תיק
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2">
    <p className="text-[10px] font-black text-gray-400 mb-1">{label}</p>
    <p className="text-xs font-black text-gray-800">{value}</p>
  </div>
);

export default PaymentsManagement;
