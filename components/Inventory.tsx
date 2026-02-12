
import React, { useState } from 'react';
import { Fabric } from '../types';
import { Layers, Plus, Ruler, Droplets, Trash2, X, ShieldAlert } from 'lucide-react';

interface InventoryProps {
  inventory: Fabric[];
  setInventory: (inventory: Fabric[]) => void;
}

const Inventory: React.FC<InventoryProps> = ({ inventory, setInventory }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fabricToDelete, setFabricToDelete] = useState<Fabric | null>(null);

  const handleAddFabric = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newFabric: Fabric = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.get('name') as string,
      color: formData.get('color') as string,
      type: formData.get('type') as string,
      quantity: parseFloat(formData.get('quantity') as string) || 0,
      unitPrice: parseFloat(formData.get('unitPrice') as string) || 0,
    };
    setInventory([...inventory, newFabric]);
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (fabricToDelete) {
      setInventory(inventory.filter(i => i.id !== fabricToDelete.id));
      setFabricToDelete(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 text-right pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="text-right w-full md:w-auto">
          <h3 className="text-xl md:text-2xl font-bold text-gray-800">מלאי בדים ואביזרים</h3>
          <p className="text-sm text-gray-400">ניהול מלאי זמין ועלויות</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold shadow-md hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          הוסף בד
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {inventory.length === 0 ? (
          <div className="col-span-full py-20 bg-white rounded-[2rem] border-2 border-dashed border-gray-100 flex flex-col items-center text-gray-300">
            <Layers className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">המלאי שלך ריק כרגע</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-4 text-rose-600 font-bold hover:underline"
            >
              הוסף את הפריט הראשון שלך
            </button>
          </div>
        ) : (
          inventory.map(item => (
            <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all group">
              <div className="h-32 bg-gray-50 flex items-center justify-center relative">
                <div 
                  className="w-16 h-16 rounded-2xl shadow-inner border border-white/50" 
                  style={{ backgroundColor: item.color }} 
                />
                <button 
                  onClick={() => setFabricToDelete(item)}
                  className="absolute top-2 left-2 p-3 bg-white/90 text-rose-500 rounded-xl md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-sm border border-rose-50 active:scale-90"
                >
                  <Trash2 size={20} className="md:w-4 md:h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h4 className="font-bold text-gray-800 text-lg">{item.name}</h4>
                  <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded uppercase">{item.type}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-t border-gray-50 pt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">כמות זמינה</span>
                    <div className="flex items-center gap-1 font-black text-gray-700">
                      <Ruler size={12} className="text-rose-400" />
                      <span>{item.quantity} מ'</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">מחיר למטר</span>
                    <div className="flex items-center gap-1 font-black text-emerald-600">
                      <span className="font-heebo">${item.unitPrice}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      {fabricToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200 text-center">
             <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
               <ShieldAlert size={40} className="animate-pulse" />
             </div>
             <h3 className="text-2xl font-black text-gray-800 mb-2">מחיקת בד מהמלאי</h3>
             <p className="text-sm text-gray-500 mb-8 leading-relaxed">
               האם אתה בטוח שברצונך למחוק את <b>{fabricToDelete.name}</b>?<br/>
               <span className="text-rose-600 font-bold text-xs">הפעולה לא ניתנת לביטול.</span>
             </p>
             <div className="flex gap-4">
                <button onClick={() => setFabricToDelete(null)} className="flex-1 py-4 font-black text-gray-400 active:scale-95 transition-all">ביטול</button>
                <button onClick={confirmDelete} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">כן, מחק</button>
             </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md h-[80vh] md:h-auto overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold font-heebo">הוספת בד חדש</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2"><X size={28} /></button>
            </div>
            <form onSubmit={handleAddFabric} className="p-8 space-y-6 text-right">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 pr-1 uppercase">שם הבד</label>
                <input name="name" required placeholder="למשל: שיפון משי, קטיפה שחורה" className="w-full px-5 py-4 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-rose-200 transition-all text-lg md:text-sm text-right bg-gray-50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 pr-1 uppercase">סוג</label>
                  <input name="type" placeholder="למשל: בד, אביזר" className="w-full px-5 py-4 rounded-2xl border border-gray-200 outline-none text-lg md:text-sm text-right bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 pr-1 uppercase">צבע</label>
                  <input type="color" name="color" defaultValue="#e11d48" className="w-full h-14 p-1 rounded-2xl border border-gray-200 outline-none cursor-pointer bg-gray-50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 pr-1 uppercase">כמות (מטרים)</label>
                  <input type="number" step="0.1" name="quantity" required placeholder="0.0" className="w-full px-5 py-4 rounded-2xl border border-gray-200 outline-none text-lg md:text-sm text-right font-heebo bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 pr-1 uppercase">מחיר למטר ($)</label>
                  <input type="number" step="0.1" name="unitPrice" required placeholder="0.0" className="w-full px-5 py-4 rounded-2xl border border-gray-200 outline-none text-lg md:text-sm text-right font-heebo bg-gray-50" />
                </div>
              </div>
              <button type="submit" className="w-full bg-rose-600 text-white font-black text-lg py-5 rounded-3xl shadow-2xl active:scale-95 transition-all mt-4">הוסף למלאי</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
