
import React, { useState } from 'react';
import { Order, Client, OrderStatus, Folder } from '../types';
import { Calendar, HelpCircle, Scissors, ChevronRight, Trash2, Clock, Edit2, ShieldAlert, X } from 'lucide-react';
import { STATUS_COLORS } from '../constants';

interface OrdersListProps {
  orders: Order[];
  clients: Client[];
  folders: Folder[];
  setOrders: (orders: Order[]) => void;
  onDeleteOrder: (id: string) => void;
  userRole?: string;
}

const OrdersList: React.FC<OrdersListProps> = ({ orders, clients, folders, setOrders, onDeleteOrder, userRole }) => {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'הכל' | 'פעיל'>('פעיל');
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  // Update check
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  const filteredOrders = orders.filter(o => {
    const folder = folders.find(f => f.id === o.folderId);
    if (!folder) return false;

    if (activeFilter === 'פעיל') return !folder.isDelivered;
    if (activeFilter === 'הכל') return true;
    return o.status === activeFilter;
  });

  const updateStatus = (orderId: string, status: OrderStatus) => {
    const now = Date.now();
    setOrders(orders.map(o => {
      if (o.id === orderId) {
        return { 
          ...o, 
          status,
          updatedAt: now,
          readyAt: status === 'מוכן' ? now : o.readyAt 
        };
      }
      return o;
    }));
  };

  const getFolderDeadline = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    return folder?.deadline || 'ללא יעד';
  };

  const isFolderDelivered = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    return folder?.isDelivered || false;
  };

  const confirmDelete = () => {
    if (orderToDelete) {
      onDeleteOrder(orderToDelete.id);
      setOrderToDelete(null);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 text-right pb-10">
      {/* Horizontal Scroll Filter */}
      <div className="bg-white p-3 md:p-2 rounded-3xl md:rounded-2xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar flex gap-4" dir="rtl">
        {['פעיל', 'הכל', 'חדש', 'מדידות', 'בתפירה', 'מוכן'].map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter as any)}
            className={`whitespace-nowrap px-8 md:px-4 py-5 md:py-3 rounded-2xl text-sm md:text-xs font-black transition-all active:scale-95 ${
              activeFilter === filter ? 'bg-rose-600 text-white shadow-xl shadow-rose-100' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {filter === 'פעיל' ? 'פתוחות' : filter}
          </button>
        ))}
      </div>

      <div className="bg-blue-50 p-5 rounded-[2rem] border border-blue-100 flex items-center gap-4 text-blue-700">
        <HelpCircle className="w-6 h-6 flex-shrink-0 text-blue-400" />
        <p className="text-xs font-bold leading-relaxed">שינוי סטטוס מתבצע כאן. מסירת בגדים מתבצעת כעת רק דרך מסך <b>תיקי לקוחות</b>.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrders.map(order => {
          const delivered = isFolderDelivered(order.folderId);
          return (
            <div key={order.id} className={`bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 relative group transition-all active:scale-[0.98] ${delivered ? 'opacity-60 grayscale' : ''}`}>
              <div className={`absolute top-0 right-0 w-2.5 h-full rounded-r-full ${delivered ? 'bg-emerald-400' : STATUS_COLORS[order.status].split(' ')[0]}`} />
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-2 z-10">
                  {isAdmin && (
                    <button 
                      onClick={() => setOrderToDelete(order)}
                      className="w-12 h-12 flex items-center justify-center text-rose-400 bg-rose-50 rounded-2xl active:scale-90 transition-all shadow-sm border border-rose-100"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  )}
                </div>
                <div className="min-w-0 text-right flex-1 pr-4">
                  <span className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${delivered ? 'bg-emerald-100 text-emerald-700' : STATUS_COLORS[order.status]}`}>
                    {delivered ? 'DELIVERED' : order.status}
                  </span>
                  <h3 className="text-xl md:text-base font-black text-gray-800 mt-2 truncate leading-tight">{order.itemType}</h3>
                  <p className="text-sm text-gray-400 font-bold truncate mt-1">{order.clientName}</p>
                </div>
                <div className="text-left flex-shrink-0 ml-3">
                  <p className="text-2xl md:text-sm font-black text-gray-900 font-heebo tracking-tighter">${order.price}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-5 mb-6 flex items-center justify-between text-right border border-gray-100">
                <ChevronRight className="w-5 h-5 text-gray-300 rotate-180" />
                <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
                  <span>יעד: <span className="font-black text-rose-600">{getFolderDeadline(order.folderId)}</span></span>
                  <Clock className="w-4 h-4 text-rose-500" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                {!delivered ? (
                  <select 
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                    className="text-sm font-black bg-rose-50 text-rose-600 px-5 py-3 rounded-2xl outline-none cursor-pointer text-right border border-rose-100 shadow-sm active:scale-95"
                  >
                    {['חדש', 'מדידות', 'בתפירה', 'מוכן'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                     התיק נמסר בהצלחה ✓
                  </span>
                )}
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">SF-ID {order.displayId}</span>
              </div>
            </div>
          );
        })}
        {filteredOrders.length === 0 && (
          <div className="col-span-full py-24 text-center text-gray-300 italic">
            <Scissors className="w-20 h-20 mx-auto mb-6 opacity-5" />
            <p className="text-xl font-black">אין פריטים בסטטוס זה</p>
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200 text-center">
             <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
               <ShieldAlert size={40} className="animate-pulse" />
             </div>
             <h3 className="text-2xl font-black text-gray-800 mb-2">מחיקת פריט</h3>
             <p className="text-sm text-gray-500 mb-8 leading-relaxed">
               האם אתה בטוח שברצונך למחוק את <b>{orderToDelete.itemType}</b>?<br/>
               <span className="text-rose-600 font-bold">פעולה זו היא סופית.</span>
             </p>
             <div className="flex gap-4">
                <button onClick={() => setOrderToDelete(null)} className="flex-1 py-4 font-black text-gray-400 active:scale-95 transition-all">ביטול</button>
                <button onClick={confirmDelete} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">כן, מחק</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersList;
