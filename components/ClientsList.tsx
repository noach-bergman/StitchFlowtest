
import React, { useState, useEffect } from 'react';
import { Client, Order, Folder, Measurements } from '../types';
import { Search, Plus, Edit2, Trash2, Phone, User, X, AlertTriangle, ShieldAlert, FileText, Wallet, Clock, CheckCircle2, Scissors, ExternalLink, Sparkles, Merge, ArrowLeftRight, Check, XCircle, SearchIcon } from 'lucide-react';
import { STATUS_COLORS } from '../constants';
import { dataService } from '../services/dataService';

interface ClientsListProps {
  clients: Client[];
  folders: Folder[];
  orders: Order[];
  setClients: (clients: Client[]) => void;
  onDeleteClient: (id: string) => void;
  userRole?: string;
  onNavigateToFolder: (folderId: string) => void;
  onMergeSuccess?: () => void;
}

interface DuplicateMatch {
  clientA: Client;
  clientB: Client;
  reason: string;
}

const ClientsList: React.FC<ClientsListProps> = ({ clients, folders, orders, setClients, onDeleteClient, userRole, onNavigateToFolder, onMergeSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [viewingReportClient, setViewingReportClient] = useState<Client | null>(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  
  // State for manual selection inside the modal
  const [showManualSelection, setShowManualSelection] = useState(false);
  const [manualClientA, setManualClientA] = useState<Client | null>(null);
  const [manualClientB, setManualClientB] = useState<Client | null>(null);
  const [manualSearchA, setManualSearchA] = useState('');
  const [manualSearchB, setManualSearchB] = useState('');

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const findDuplicates = () => {
    const matches: DuplicateMatch[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < clients.length; i++) {
      for (let j = i + 1; j < clients.length; j++) {
        const a = clients[i];
        const b = clients[j];
        const key = [a.id, b.id].sort().join('-');
        if (seen.has(key)) continue;

        let isMatch = false;
        let reason = "";

        const phoneA = a.phone.replace(/\D/g, '');
        const phoneB = b.phone.replace(/\D/g, '');
        if (phoneA && phoneB && phoneA === phoneB) {
          isMatch = true;
          reason = "מספר טלפון זהה";
        }

        const wordsA = a.name.toLowerCase().trim().split(/\s+/).sort().join(' ');
        const wordsB = b.name.toLowerCase().trim().split(/\s+/).sort().join(' ');
        if (!isMatch && wordsA === wordsB && wordsA.length > 3) {
          isMatch = true;
          reason = "שמות זהים בסדר הפוך";
        }

        if (!isMatch && (a.name.length > 5 && b.name.length > 5)) {
          if (a.name.toLowerCase().includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(a.name.toLowerCase())) {
             isMatch = true;
             reason = "שמות דומים מאוד";
          }
        }

        if (isMatch) {
          matches.push({ clientA: a, clientB: b, reason });
          seen.add(key);
        }
      }
    }
    setDuplicateMatches(matches);
    setShowManualSelection(false);
    setIsMergeModalOpen(true);
  };

  const performMerge = async (source: Client, target: Client) => {
    setIsMerging(true);
    try {
      const mergedMeasurements: Measurements = {
        chest: target.measurements?.chest || source.measurements?.chest,
        waist: target.measurements?.waist || source.measurements?.waist,
        hips: target.measurements?.hips || source.measurements?.hips,
        shoulderToShoulder: target.measurements?.shoulderToShoulder || source.measurements?.shoulderToShoulder,
        sleeveLength: target.measurements?.sleeveLength || source.measurements?.sleeveLength,
        totalLength: target.measurements?.totalLength || source.measurements?.totalLength,
      };

      const mergedNotes = [target.notes, source.notes].filter(n => n?.trim()).join('\n---\n');

      const mergedClient: Client = {
        ...target,
        phone: target.phone || source.phone,
        email: target.email || source.email,
        measurements: mergedMeasurements,
        notes: mergedNotes,
      };

      await dataService.mergeClients(source.id, target.id, mergedClient);
      
      setDuplicateMatches(prev => prev.filter(m => 
        !( (m.clientA.id === source.id && m.clientB.id === target.id) || 
           (m.clientA.id === target.id && m.clientB.id === source.id) )
      ));

      if (showManualSelection) {
        setManualClientA(null);
        setManualClientB(null);
        setShowManualSelection(false);
      }

      if (onMergeSuccess) {
        onMergeSuccess();
      } else {
        const updatedClients = await dataService.getClients();
        setClients(updatedClients);
      }

    } catch (err) {
      alert("שגיאה במיזוג: " + (err as any).message);
    } finally {
      setIsMerging(false);
    }
  };

  const handleAddClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newClient: Client = {
      id: editingClient?.id || Math.random().toString(36).substr(2, 9),
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      notes: formData.get('notes') as string,
      measurements: {
        chest: Number(formData.get('chest')),
        waist: Number(formData.get('waist')),
        hips: Number(formData.get('hips')),
        totalLength: Number(formData.get('totalLength')),
      },
      createdAt: editingClient?.createdAt || Date.now(),
    };

    if (editingClient) {
      setClients(clients.map(c => c.id === editingClient.id ? newClient : c));
    } else {
      setClients([newClient, ...clients]);
    }
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const getClientStats = (clientId: string) => {
    const clientOrders = orders.filter(o => o.clientId === clientId);
    const clientFolders = folders.filter(f => f.clientId === clientId);
    const revenue = clientOrders.filter(o => {
      const folder = folders.find(f => f.id === o.folderId);
      return o.status === 'מוכן' || folder?.isDelivered || folder?.isPaid;
    }).reduce((sum, o) => sum + (o.price || 0), 0);
    return {
      totalOrders: clientOrders.length,
      revenue,
      orders: clientOrders.sort((a, b) => b.createdAt - a.createdAt),
      activeFolders: clientFolders.filter(f => !f.isArchived && !f.isDelivered).length
    };
  };

  const manualFilteredA = manualSearchA ? clients.filter(c => c.name.includes(manualSearchA) || c.phone.includes(manualSearchA)) : [];
  const manualFilteredB = manualSearchB ? clients.filter(c => c.name.includes(manualSearchB) || c.phone.includes(manualSearchB)) : [];

  return (
    <div className="space-y-4 md:space-y-6 text-right pb-24">
      <div className="flex flex-col md:flex-row gap-5 justify-between items-center bg-white p-6 rounded-[2rem] md:rounded-3xl shadow-sm border border-gray-100">
        <div className="text-right w-full md:w-auto">
          <h3 className="text-xl md:text-xl font-bold text-gray-800 font-heebo">ניהול לקוחות</h3>
          <p className="text-sm md:text-xs text-gray-400 font-bold">ניהול פרטי קשר, מדידות והיסטוריית תיקונים</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={findDuplicates}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-black text-sm hover:bg-slate-200 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-rose-500" />
            מזג כפילויות
          </button>
          <button 
            onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
            className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-rose-600 text-white px-8 py-3 rounded-xl font-black text-sm transition-all shadow-xl shadow-rose-100 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            לקוח חדש
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 md:w-4 md:h-4" />
        <input
          type="text"
          placeholder="חיפוש לקוח לפי שם או טלפון..."
          className="w-full bg-white border border-gray-200 rounded-[1.5rem] md:rounded-xl py-5 md:py-3 pr-14 pl-6 text-base md:text-sm font-bold focus:ring-2 focus:ring-rose-200 outline-none transition-all text-right shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Main Merge Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in duration-300">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white rounded-t-[3rem]">
                 <div className="text-right">
                    <h3 className="text-2xl font-black font-heebo">מיזוג לקוחות</h3>
                    <p className="text-xs text-slate-400 font-bold">
                       {showManualSelection ? 'בחרי שני לקוחות למיזוג ידני' : `מצאנו ${duplicateMatches.length} הצעות למיזוג אוטומטי`}
                    </p>
                 </div>
                 <button onClick={() => setIsMergeModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={32} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                 {!showManualSelection ? (
                   <>
                     {duplicateMatches.length === 0 ? (
                       <div className="flex flex-col items-center justify-center h-full text-gray-400">
                          <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
                          <p className="text-xl font-black">אין כפילויות אוטומטיות!</p>
                          <p className="text-sm font-bold mt-2 mb-6">רוצה למזג לקוחות באופן ידני?</p>
                          <button 
                            onClick={() => setShowManualSelection(true)}
                            className="bg-rose-600 text-white px-8 py-3 rounded-2xl font-black text-sm active:scale-95 transition-all"
                          >
                            למיזוג ידני
                          </button>
                       </div>
                     ) : (
                       duplicateMatches.map((match, idx) => (
                         <div key={idx} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                            <div className="flex items-center justify-center gap-2 mb-2">
                               <span className="bg-rose-50 text-rose-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100">{match.reason}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                               <div className="flex-1 p-4 bg-slate-50 rounded-2xl text-center border border-slate-100">
                                  <p className="font-black text-gray-800">{match.clientA.name}</p>
                                  <p className="text-xs text-gray-400 font-bold font-heebo">{match.clientA.phone}</p>
                                  <button 
                                    onClick={() => performMerge(match.clientB, match.clientA)}
                                    className="mt-3 w-full bg-white text-rose-600 border border-rose-200 py-2 rounded-xl text-xs font-black hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50"
                                  >
                                    שמור את {match.clientA.name.split(' ')[0]}
                                  </button>
                               </div>
                               <ArrowLeftRight className="text-gray-300 shrink-0" />
                               <div className="flex-1 p-4 bg-slate-50 rounded-2xl text-center border border-slate-100">
                                  <p className="font-black text-gray-800">{match.clientB.name}</p>
                                  <p className="text-xs text-gray-400 font-bold font-heebo">{match.clientB.phone}</p>
                                  <button 
                                    onClick={() => performMerge(match.clientA, match.clientB)}
                                    className="mt-3 w-full bg-white text-rose-600 border border-rose-200 py-2 rounded-xl text-xs font-black hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50"
                                  >
                                    שמור את {match.clientB.name.split(' ')[0]}
                                  </button>
                               </div>
                            </div>
                         </div>
                       ))
                     )}
                     {duplicateMatches.length > 0 && (
                        <button 
                          onClick={() => setShowManualSelection(true)}
                          className="w-full py-4 text-rose-600 font-black text-sm border-2 border-dashed border-rose-100 rounded-2xl hover:bg-rose-50 transition-all"
                        >
                          לא מצאת מה שחיפשת? עברי למיזוג ידני
                        </button>
                     )}
                   </>
                 ) : (
                   <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Selection A */}
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase pr-2">בחרי לקוח ראשון</label>
                            {manualClientA ? (
                              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex justify-between items-center animate-in zoom-in">
                                 <button onClick={() => setManualClientA(null)} className="text-rose-400 hover:text-rose-600"><X size={16} /></button>
                                 <div className="text-right">
                                    <p className="font-black text-rose-900">{manualClientA.name}</p>
                                    <p className="text-[10px] font-bold text-rose-400">{manualClientA.phone}</p>
                                 </div>
                              </div>
                            ) : (
                              <div className="relative">
                                 <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                 <input 
                                  className="w-full pr-10 pl-4 py-3 rounded-2xl border border-gray-100 bg-white outline-none focus:ring-2 focus:ring-rose-200" 
                                  placeholder="חיפוש לקוח..."
                                  value={manualSearchA}
                                  onChange={(e) => setManualSearchA(e.target.value)}
                                 />
                                 {manualSearchA && (
                                   <div className="absolute z-10 top-full mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto divide-y">
                                      {manualFilteredA.map(c => (
                                        <div key={c.id} onClick={() => {setManualClientA(c); setManualSearchA('');}} className="p-3 hover:bg-rose-50 cursor-pointer text-sm font-bold">{c.name} ({c.phone})</div>
                                      ))}
                                   </div>
                                 )}
                              </div>
                            )}
                         </div>

                         {/* Selection B */}
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase pr-2">בחרי לקוח שני</label>
                            {manualClientB ? (
                              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex justify-between items-center animate-in zoom-in">
                                 <button onClick={() => setManualClientB(null)} className="text-indigo-400 hover:text-indigo-600"><X size={16} /></button>
                                 <div className="text-right">
                                    <p className="font-black text-indigo-900">{manualClientB.name}</p>
                                    <p className="text-[10px] font-bold text-indigo-400">{manualClientB.phone}</p>
                                 </div>
                              </div>
                            ) : (
                              <div className="relative">
                                 <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                 <input 
                                  className="w-full pr-10 pl-4 py-3 rounded-2xl border border-gray-100 bg-white outline-none focus:ring-2 focus:ring-rose-200" 
                                  placeholder="חיפוש לקוח..."
                                  value={manualSearchB}
                                  onChange={(e) => setManualSearchB(e.target.value)}
                                 />
                                 {manualSearchB && (
                                   <div className="absolute z-10 top-full mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto divide-y">
                                      {manualFilteredB.map(c => (
                                        <div key={c.id} onClick={() => {setManualClientB(c); setManualSearchB('');}} className="p-3 hover:bg-indigo-50 cursor-pointer text-sm font-bold">{c.name} ({c.phone})</div>
                                      ))}
                                   </div>
                                 )}
                              </div>
                            )}
                         </div>
                      </div>

                      {manualClientA && manualClientB && (
                        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-rose-100 shadow-xl space-y-6 animate-in slide-in-from-bottom">
                           <div className="flex items-center justify-between gap-6">
                              <div className="flex-1 p-6 bg-slate-50 rounded-3xl text-center border border-slate-100">
                                 <p className="font-black text-xl text-gray-800">{manualClientA.name}</p>
                                 <p className="text-xs font-bold text-gray-400 mt-1">{manualClientA.phone}</p>
                                 <button 
                                   onClick={() => performMerge(manualClientB, manualClientA)}
                                   className="mt-6 w-full bg-rose-600 text-white py-3 rounded-2xl font-black text-xs active:scale-95 transition-all"
                                 >
                                   שמור את {manualClientA.name.split(' ')[0]}
                                 </button>
                              </div>
                              <ArrowLeftRight className="text-rose-500 animate-pulse" size={32} />
                              <div className="flex-1 p-6 bg-slate-50 rounded-3xl text-center border border-slate-100">
                                 <p className="font-black text-xl text-gray-800">{manualClientB.name}</p>
                                 <p className="text-xs font-bold text-gray-400 mt-1">{manualClientB.phone}</p>
                                 <button 
                                   onClick={() => performMerge(manualClientA, manualClientB)}
                                   className="mt-6 w-full bg-rose-600 text-white py-3 rounded-2xl font-black text-xs active:scale-95 transition-all"
                                 >
                                   שמור את {manualClientB.name.split(' ')[0]}
                                 </button>
                              </div>
                           </div>
                           <p className="text-center text-[10px] font-bold text-gray-400">כל התיקים וההזמנות של הלקוח השני יעברו ללקוח שתבחרי לשמור.</p>
                        </div>
                      )}

                      <button 
                        onClick={() => setShowManualSelection(false)}
                        className="w-full py-3 text-gray-400 font-bold text-xs"
                      >
                        חזרה לזיהוי אוטומטי
                      </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* List Views */}
      <div className="md:hidden space-y-4">
        {filteredClients.map(client => (
          <div key={client.id} onClick={() => setViewingReportClient(client)} className="bg-white p-6 rounded-[2.2rem] border border-gray-100 shadow-sm flex flex-col gap-6 active:bg-gray-50 transition-all border-b-4 border-rose-500">
             <div className="flex justify-between items-start">
               <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); setEditingClient(client); setIsModalOpen(true); }} className="w-10 h-10 flex items-center justify-center text-blue-500 bg-blue-50 rounded-xl active:scale-90 transition-all border border-blue-100">
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setViewingReportClient(client); }} className="w-10 h-10 flex items-center justify-center text-rose-600 bg-rose-50 rounded-xl active:scale-90 transition-all border border-rose-100">
                    <FileText className="w-5 h-5" />
                  </button>
               </div>
               <div className="flex items-center gap-4">
                 <div className="text-right">
                    <p className="font-black text-lg text-gray-800 font-heebo">{client.name}</p>
                    <p className="text-sm text-gray-400 font-bold flex items-center gap-1 justify-end mt-1 font-heebo">
                      {client.phone} <Phone className="w-3 h-3 text-rose-500" />
                    </p>
                 </div>
                 <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                   {client.name.charAt(0)}
                 </div>
               </div>
             </div>
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl text-center">
                   <p className="text-[9px] font-black text-gray-400 uppercase">סה"כ הכנסה</p>
                   <p className="text-lg font-black text-emerald-600 font-heebo">${getClientStats(client.id).revenue}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl text-center">
                   <p className="text-[9px] font-black text-gray-400 uppercase">תיקונים שבוצעו</p>
                   <p className="text-lg font-black text-slate-800 font-heebo">{getClientStats(client.id).totalOrders}</p>
                </div>
             </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">לקוח</th>
              <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">טלפון</th>
              <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center">הכנסות</th>
              <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center">תיקונים</th>
              <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredClients.map(client => {
              const stats = getClientStats(client.id);
              return (
                <tr key={client.id} className="hover:bg-rose-50/30 transition-all group">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black group-hover:scale-110 transition-transform">
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm font-heebo">{client.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold">{client.email || 'אין דוא"ל'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-5 text-gray-600 font-bold text-sm font-heebo">{client.phone}</td>
                  <td className="p-5 text-sm font-black text-emerald-600 text-center font-heebo">${stats.revenue.toLocaleString()}</td>
                  <td className="p-5 text-xs font-black text-slate-400 text-center font-heebo">{stats.totalOrders}</td>
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setViewingReportClient(client)} className="w-10 h-10 flex items-center justify-center text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all active:scale-90" title="צפה בדוח תיקונים"><FileText className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingClient(client); setIsModalOpen(true); }} className="w-10 h-10 flex items-center justify-center text-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all active:scale-90"><Edit2 className="w-4 h-4" /></button>
                      {isAdmin && <button onClick={() => setClientToDelete(client)} className="w-10 h-10 flex items-center justify-center text-rose-500 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all active:scale-90"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Report Modal */}
      {viewingReportClient && (
        <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center p-0 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-t-[3rem] md:rounded-[3rem] w-full max-w-4xl h-[92vh] md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100">
              <div className="p-8 md:p-10 bg-slate-900 text-white flex justify-between items-center relative shrink-0">
                 <div className="absolute top-0 left-0 w-64 h-64 bg-rose-500/10 rounded-full blur-[100px] -ml-32 -mt-32"></div>
                 <div className="flex gap-4 relative z-10"><button onClick={() => setViewingReportClient(null)} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={28} /></button></div>
                 <div className="text-right relative z-10">
                    <h3 className="text-3xl font-black font-heebo tracking-tighter">כרטיס לקוח: {viewingReportClient.name}</h3>
                    <div className="flex items-center justify-end gap-3 mt-2"><span className="text-rose-400 font-bold font-heebo">{viewingReportClient.phone}</span><Phone size={14} className="text-rose-400" /></div>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 bg-slate-50/30">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center">
                       <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3"><Wallet size={20} /></div>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">סך הכנסות</p>
                       <p className="text-2xl font-black text-emerald-600 font-heebo">${getClientStats(viewingReportClient.id).revenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center">
                       <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mx-auto mb-3"><Scissors size={20} /></div>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">תיקונים</p>
                       <p className="text-2xl font-black text-rose-600 font-heebo">{getClientStats(viewingReportClient.id).totalOrders}</p>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center">
                       <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3"><Clock size={20} /></div>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">תיקים פעילים</p>
                       <p className="text-2xl font-black text-blue-600 font-heebo">{getClientStats(viewingReportClient.id).activeFolders}</p>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center">
                       <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={20} /></div>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">הצטרפות</p>
                       <p className="text-xs font-black text-slate-800 mt-2">{new Date(viewingReportClient.createdAt).toLocaleDateString('he-IL')}</p>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-xl font-black text-slate-800 font-heebo pr-2">היסטוריית תיקונים מלאה</h4>
                    <div className="space-y-3">
                       {getClientStats(viewingReportClient.id).orders.map(order => (
                         <div key={order.id} className="bg-white p-6 rounded-[1.8rem] border border-gray-100 shadow-sm flex justify-between items-center group hover:border-rose-200 transition-all">
                            <div className="text-left flex items-center gap-4">
                               <button onClick={() => { setViewingReportClient(null); onNavigateToFolder(order.folderId); }} className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-md active:scale-95"><ExternalLink size={12} /> פתח תיק</button>
                               <div className="text-left"><p className="text-xl font-black text-slate-900 font-heebo">${order.price}</p><p className="text-[9px] font-black text-gray-300 uppercase tracking-tighter mt-1">ID: #{order.displayId}</p></div>
                            </div>
                            <div className="text-right flex-1 pr-6 border-r-2 border-slate-50 mr-6"><div className="flex items-center justify-end gap-3 mb-1"><span className={`px-3 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${STATUS_COLORS[order.status]}`}>{order.status}</span><p className="font-black text-slate-800">{order.itemType}</p></div><p className="text-xs text-gray-400 font-bold">{order.description || "ללא תיאור"}</p><p className="text-[10px] text-slate-300 font-bold mt-2 flex items-center justify-end gap-1">{new Date(order.createdAt).toLocaleDateString('he-IL')} <Clock size={10} /></p></div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-white border-t border-gray-100 text-center shrink-0"><button onClick={() => setViewingReportClient(null)} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl">סגור דוח</button></div>
           </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-[3rem] md:rounded-3xl w-full max-w-2xl h-[95vh] md:h-auto overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-6 md:p-5 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10"><h3 className="text-xl font-black text-gray-800 font-heebo">{editingClient ? 'עריכת פרטי לקוח' : 'לקוח חדש בסטודיו'}</h3><button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-rose-500 p-2"><X size={32} /></button></div>
            <form onSubmit={handleAddClient} className="p-8 md:p-8 space-y-8 md:space-y-6 text-right">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 uppercase pr-2">שם מלא</label><input name="name" defaultValue={editingClient?.name} placeholder="שם הלקוח/ה" required className="w-full px-5 py-5 md:py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-rose-200 text-lg md:text-sm text-right bg-gray-50 font-bold" /></div>
                <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 uppercase pr-2">טלפון</label><input name="phone" defaultValue={editingClient?.phone} placeholder="טלפון ליצירת קשר" required className="w-full px-5 py-5 md:py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-rose-200 text-lg md:text-sm text-right bg-gray-50 font-bold font-heebo" /></div>
              </div>
              <div className="space-y-2">
                 <label className="text-[11px] font-black text-gray-400 uppercase pr-2">מדידות (ס"מ)</label>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3" dir="ltr">
                    <div className="relative"><span className="absolute top-1 left-3 text-[8px] font-black text-gray-300">CHEST</span><input name="chest" type="number" step="0.1" defaultValue={editingClient?.measurements.chest} placeholder="חזה" className="w-full px-3 py-6 md:py-3 rounded-2xl border border-gray-100 text-lg md:text-sm text-center font-black text-rose-600" /></div>
                    <div className="relative"><span className="absolute top-1 left-3 text-[8px] font-black text-gray-300">WAIST</span><input name="waist" type="number" step="0.1" defaultValue={editingClient?.measurements.waist} placeholder="מותן" className="w-full px-3 py-6 md:py-3 rounded-2xl border border-gray-100 text-lg md:text-sm text-center font-black text-rose-600" /></div>
                    <div className="relative"><span className="absolute top-1 left-3 text-[8px] font-black text-gray-300">HIPS</span><input name="hips" type="number" step="0.1" defaultValue={editingClient?.measurements.hips} placeholder="ירכיים" className="w-full px-3 py-6 md:py-3 rounded-2xl border border-gray-100 text-lg md:text-sm text-center font-black text-rose-600" /></div>
                    <div className="relative"><span className="absolute top-1 left-3 text-[8px] font-black text-gray-300">LENGTH</span><input name="totalLength" type="number" step="0.1" defaultValue={editingClient?.measurements.totalLength} placeholder="אורך" className="w-full px-3 py-6 md:py-3 rounded-2xl border border-gray-100 text-lg md:text-sm text-center font-black text-rose-600" /></div>
                 </div>
              </div>
              <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 uppercase pr-2">הערות</label><textarea name="notes" defaultValue={editingClient?.notes} placeholder="הערות נוספות על הלקוח/ה..." className="w-full px-5 py-5 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-rose-200 text-base bg-gray-50 h-32 resize-none text-right font-medium" /></div>
              <button type="submit" className="w-full bg-rose-600 text-white font-black text-lg py-6 md:py-4 rounded-3xl shadow-2xl shadow-rose-200 active:scale-95 transition-all mt-6">שמירה</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsList;
