
import React, { useState, useEffect } from 'react';
import { Client, Order, Folder, OrderStatus } from '../types';
// Added ShieldAlert to the import list
import { Search, FolderOpen, ArrowRight, Plus, Archive, CheckCircle2, Scissors, Trash2, X, Edit2, DollarSign, FileText, RefreshCw, Hash, Printer, QrCode, ShieldAlert, Sparkles, AlertTriangle, MapPin, Share2, ListTodo } from 'lucide-react';
import { generateProfessionalReceipt } from '../services/gemini';
import { STATUS_COLORS } from '../constants';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

interface ClientFoldersProps {
  clients: Client[];
  setClients: (clients: Client[]) => void;
  folders: Folder[];
  setFolders: (folders: Folder[]) => void;
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  userRole?: string;
  initialFolderId?: string | null;
  highlightedOrderId?: string | null;
  onClearInitialFolder?: () => void;
  onCreateTaskFromFolder?: (folder: Folder) => void;
  onCreateTaskFromOrder?: (order: Order) => void;
}

const ClientFolders: React.FC<ClientFoldersProps> = ({ 
  clients, setClients, folders, setFolders, orders, setOrders, 
  onDeleteFolder, onDeleteOrder, userRole, initialFolderId, highlightedOrderId, onClearInitialFolder,
  onCreateTaskFromFolder, onCreateTaskFromOrder
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isQuickAddClientOpen, setIsQuickAddClientOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [isSharingReceipt, setIsSharingReceipt] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [loadingStep, setLoadingStep] = useState(0);
  
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [folderToArchive, setFolderToArchive] = useState<Folder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [pendingPriceDateUpdate, setPendingPriceDateUpdate] = useState<{ order: Order; isEditing: boolean } | null>(null);

  const [activeQrOrder, setActiveQrOrder] = useState<Order | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isPrintingLabel, setIsPrintingLabel] = useState(false);
  const [isSharingLabel, setIsSharingLabel] = useState(false);
  
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [tempDisplayId, setTempDisplayId] = useState('');
  const [showClientList, setShowClientList] = useState(false);

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const canCreateTask = userRole !== 'viewer';

  useEffect(() => {
    if (initialFolderId) {
      setSelectedFolderId(initialFolderId);
      const folder = folders.find(f => f.id === initialFolderId);
      if (folder?.isArchived) setViewMode('archived');
      if (onClearInitialFolder) onClearInitialFolder();
    }
  }, [initialFolderId, folders, onClearInitialFolder]);

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const folderOrders = orders.filter(o => o.folderId === selectedFolderId);
  const folderTotalPrice = folderOrders.reduce((sum, o) => sum + (o.price || 0), 0);

  const filteredFolders = folders.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         f.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesView = viewMode === 'archived' ? f.isArchived : !f.isArchived;
    return matchesSearch && matchesView;
  });

  const filteredClientsForSearch = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
    c.phone.includes(clientSearchTerm)
  );

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        const existingCount = folders.filter(f => f.clientId === selectedClientId).length;
        const suggestedName = existingCount > 0 ? `${client.name} #${existingCount + 1}` : client.name;
        setNewFolderName(suggestedName);
      }
    } else {
      setNewFolderName('');
    }
  }, [selectedClientId, clients, folders]);

  const randomId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 9);
    }
    return Math.random().toString(36).slice(2, 11);
  };

  const generateNewDisplayId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const values = new Uint16Array(1);
      crypto.getRandomValues(values);
      return (1000 + (values[0] % 9000)).toString();
    }
    return (Math.floor(1000 + Math.random() * 9000)).toString();
  };

  const persistOrder = (order: Order, isEditing: boolean) => {
    const nextOrders = isEditing
      ? orders.map(o => o.id === order.id ? order : o)
      : [order, ...orders];
    setOrders(nextOrders);
    setIsOrderModalOpen(false);
    setEditingOrder(null);

    if (!isEditing) {
      handleOpenQrLabel(order);
    }
  };

  const handleGenerateReceipt = async () => {
    if (!selectedFolder) return;
    setIsGeneratingReceipt(true);
    setReceiptData(null);
    setLoadingStep(1);
    setIsReceiptModalOpen(true);
    
    try {
      const data = await generateProfessionalReceipt(
        selectedFolder.clientName, 
        folderOrders.map(o => ({ item: o.itemType, description: o.description, price: o.price })), 
        folderTotalPrice
      );
      setReceiptData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  const getReceiptImageBlob = async (): Promise<Blob> => {
    const receiptContent = document.getElementById('receipt-preview');
    if (!receiptContent) throw new Error('Receipt preview not found');

    const canvas = await html2canvas(receiptContent, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate receipt image'));
      }, 'image/png');
    });
  };

  const handleShareReceiptImage = async () => {
    if (!receiptData || isSharingReceipt) return;
    setIsSharingReceipt(true);

    try {
      const blob = await getReceiptImageBlob();
      const rawName = (receiptData.billTo || selectedFolder?.clientName || 'receipt').toString();
      const normalizedName = rawName
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'receipt';
      const fileDate = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `receipt-${normalizedName}-${fileDate}.png`, { type: 'image/png' });

      let wasShared = false;
      if (navigator.share) {
        try {
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Receipt - ${receiptData.receiptNumber || 'StitchFlow'}`,
              text: `Receipt for ${receiptData.billTo || ''}`.trim(),
            });
            wasShared = true;
            alert('התמונה שותפה בהצלחה.');
          }
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
        }
      }

      if (!wasShared) {
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          alert('תמונת הקבלה הועתקה ללוח. אפשר להדביק ולשתף.');
          return;
        }
        alert('שיתוף תמונה לא נתמך במכשיר זה, וגם לא ניתן להעתיק תמונה ללוח.');
      }
    } catch (error) {
      console.error('Receipt image sharing failed:', error);
      alert('שגיאה בהכנת תמונת הקבלה לשיתוף.');
    } finally {
      setIsSharingReceipt(false);
    }
  };

  const handlePrintReceipt = () => {
    const receiptContent = document.getElementById('receipt-preview');
    if (!receiptContent) return;

    let isCleanedUp = false;
    let fallbackCleanupTimer: number | undefined;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      document.body.classList.remove('printing-receipt');
      window.removeEventListener('afterprint', cleanup);
      if (fallbackCleanupTimer) window.clearTimeout(fallbackCleanupTimer);
    };

    document.body.classList.add('printing-receipt');
    window.addEventListener('afterprint', cleanup, { once: true });

    // iOS/PWA browsers can be inconsistent with afterprint.
    fallbackCleanupTimer = window.setTimeout(cleanup, 60000);

    window.requestAnimationFrame(() => {
      window.print();
    });
  };

  const handleOpenQrLabel = async (order: Order) => {
    setActiveQrOrder(order);
    setIsGeneratingQr(true);
    setIsPrintingLabel(false);
    setIsSharingLabel(false);
    setQrDataUrl('');
    try {
      // Use DisplayId for QR to make it scanable and readable
      const url = await QRCode.toDataURL(order.displayId, {
        width: 400,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error("QR Generation error", err);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const getLabelImageBlob = async (): Promise<Blob> => {
    const labelContent = document.getElementById('label-preview');
    if (!labelContent) throw new Error('Label preview not found');

    const canvas = await html2canvas(labelContent, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate label image'));
      }, 'image/png');
    });
  };

  const handlePrintLabel = () => {
    if (!activeQrOrder || !qrDataUrl || isPrintingLabel) return;
    const labelContent = document.getElementById('label-preview');
    if (!labelContent) return;

    let isCleanedUp = false;
    let fallbackCleanupTimer: number | undefined;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      document.body.classList.remove('printing-label');
      window.removeEventListener('afterprint', cleanup);
      if (fallbackCleanupTimer) window.clearTimeout(fallbackCleanupTimer);
      setIsPrintingLabel(false);
    };

    setIsPrintingLabel(true);
    document.body.classList.add('printing-label');
    window.addEventListener('afterprint', cleanup, { once: true });

    // iOS/PWA browsers can be inconsistent with afterprint.
    fallbackCleanupTimer = window.setTimeout(cleanup, 60000);

    window.requestAnimationFrame(() => {
      window.print();
    });
  };

  const closeQrModal = () => {
    setActiveQrOrder(null);
    setIsPrintingLabel(false);
    setIsSharingLabel(false);
  };

  const handleShareLabelImage = async () => {
    if (!activeQrOrder || !qrDataUrl || isSharingLabel) return;
    setIsSharingLabel(true);

    try {
      const blob = await getLabelImageBlob();
      const normalizedName = (activeQrOrder.clientName || 'label')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'label';
      const fileDate = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `label-${normalizedName}-${activeQrOrder.displayId}-${fileDate}.png`, { type: 'image/png' });

      let wasShared = false;
      if (navigator.share) {
        try {
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Label #${activeQrOrder.displayId}`,
              text: `${activeQrOrder.clientName} - ${activeQrOrder.itemType}`.trim(),
            });
            wasShared = true;
            alert('התמונה שותפה בהצלחה.');
          }
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
        }
      }

      if (!wasShared) {
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          alert('תמונת התווית הועתקה ללוח. אפשר להדביק ולשתף.');
          return;
        }
        alert('שיתוף תמונה לא נתמך במכשיר זה, וגם לא ניתן להעתיק תמונה ללוח.');
      }
    } catch (error) {
      console.error('Label image sharing failed:', error);
      alert('שגיאה בהכנת תמונת התווית לשיתוף.');
    } finally {
      setIsSharingLabel(false);
    }
  };

  const handleAddFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    const newFolderId = randomId();
    const newFolder: Folder = {
      id: newFolderId,
      name: formData.get('name') as string,
      clientId: selectedClientId,
      clientName: client?.name || 'לא ידוע',
      createdAt: Date.now(),
      deadline: formData.get('deadline') as string || 'ללא יעד',
      status: 'פעיל',
      isPaid: false,
      isDelivered: false,
      isArchived: false
    };

    setFolders([newFolder, ...folders]);
    setSelectedFolderId(newFolderId);
    setIsFolderModalOpen(false);
    setSelectedClientId('');
    setClientSearchTerm('');
  };

  const handleAddOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFolderId) return;
    const formData = new FormData(e.currentTarget);
    const now = Date.now();
    
    const priceStr = formData.get('price') as string;
    const inputPrice = priceStr ? parseFloat(priceStr) : 0;
    const finalPrice = isNaN(inputPrice) ? 0 : Math.max(0, inputPrice);
    const isEditing = !!editingOrder;
    const priceChanged = isEditing && finalPrice !== (editingOrder.price || 0);

    const newOrder: Order = {
      id: editingOrder?.id || randomId(),
      displayId: tempDisplayId,
      folderId: selectedFolderId,
      clientId: selectedFolder?.clientId || '',
      clientName: selectedFolder?.clientName || '',
      itemType: formData.get('itemType') as string,
      description: formData.get('description') as string,
      status: (formData.get('status') as any) || 'חדש',
      deadline: selectedFolder?.deadline || 'ללא יעד',
      price: finalPrice,
      deposit: 0,
      fabricNotes: "",
      createdAt: editingOrder?.createdAt || now,
      updatedAt: now,
      readyAt: editingOrder?.readyAt
    };

    if (priceChanged) {
      setPendingPriceDateUpdate({ order: newOrder, isEditing });
      return;
    }

    persistOrder(newOrder, isEditing);
  };

  const resolvePendingPriceDateUpdate = (updateIncomeDateToToday: boolean) => {
    if (!pendingPriceDateUpdate) return;

    const finalizedOrder = updateIncomeDateToToday
      ? { ...pendingPriceDateUpdate.order, readyAt: Date.now(), updatedAt: Date.now() }
      : pendingPriceDateUpdate.order;

    setPendingPriceDateUpdate(null);
    persistOrder(finalizedOrder, pendingPriceDateUpdate.isEditing);
  };

  const handleQuickAddClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newClient: Client = {
      id: randomId(),
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: '',
      notes: '',
      measurements: {
        chest: 0,
        waist: 0,
        hips: 0,
        totalLength: 0,
      },
      createdAt: Date.now(),
    };

    setClients([newClient, ...clients]);
    setSelectedClientId(newClient.id);
    setClientSearchTerm(newClient.name);
    setIsQuickAddClientOpen(false);
    setShowClientList(false);
  };

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

  const toggleArchive = (folderId: string) => {
    setFolders(folders.map(f => f.id === folderId ? { ...f, isArchived: !f.isArchived } : f));
    setSelectedFolderId(null);
    setFolderToArchive(null);
  };

  return (
    <div className="space-y-6 text-right pb-32">
      <style>{`
        @media print {
          @page { size: auto; margin: 10mm; }

          body.printing-receipt {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body.printing-receipt #root * {
            visibility: hidden !important;
          }

          body.printing-receipt #receipt-preview,
          body.printing-receipt #receipt-preview * {
            visibility: visible !important;
          }

          body.printing-receipt #receipt-preview {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 820px !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            z-index: 2147483647 !important;
            font-family: 'Playfair Display', serif;
          }

          body.printing-label {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body.printing-label #root * {
            visibility: hidden !important;
          }

          body.printing-label #label-preview,
          body.printing-label #label-preview * {
            visibility: visible !important;
          }

          body.printing-label #label-preview {
            position: fixed !important;
            top: 6mm !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: min(90mm, 92vw) !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            overflow: visible !important;
            z-index: 2147483647 !important;
          }
        }
      `}</style>
      {!selectedFolderId ? (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 relative overflow-hidden">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl"></div>
             <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                <button 
                  onClick={() => setIsFolderModalOpen(true)} 
                  className="w-full md:w-auto bg-gradient-to-r from-rose-600 to-pink-600 text-white px-10 py-5 rounded-[2rem] font-black text-lg shadow-2xl shadow-rose-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <Plus className="w-6 h-6" /> תיק עבודה חדש
                </button>
                <div className="text-center md:text-right">
                  <h3 className="text-3xl font-black text-gray-800 font-heebo">ארכיון הסטודיו</h3>
                  <p className="text-gray-400 font-bold mt-1">נהלי את כל הפרויקטים במקום אחד</p>
                </div>
             </div>
             
             <div className="flex flex-col md:flex-row gap-4 mt-10">
                <div className="flex bg-slate-100 p-2 rounded-full border border-slate-200 gap-2 w-fit">
                   <button onClick={() => setViewMode('active')} className={`px-8 py-3 rounded-full text-xs font-black transition-all ${viewMode === 'active' ? 'bg-white text-rose-600 shadow-md' : 'text-gray-400'}`}>פעילים</button>
                   <button onClick={() => setViewMode('archived')} className={`px-8 py-3 rounded-full text-xs font-black transition-all ${viewMode === 'archived' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400'}`}>ארכיון</button>
                </div>
                <div className="relative flex-1">
                   <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400" />
                   <input 
                    type="text" 
                    placeholder="חיפוש לפי שם..." 
                    className="w-full bg-slate-50 border border-slate-100 rounded-full py-5 pr-14 text-base font-bold outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/5 transition-all text-right"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                   />
                </div>
             </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredFolders.map(folder => (
                <div key={folder.id} onClick={() => setSelectedFolderId(folder.id)} className={`group bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 transition-all hover:shadow-2xl hover:-translate-y-2 cursor-pointer relative overflow-hidden`}>
                   <div className={`absolute top-0 right-0 w-2 h-full ${folder.isDelivered ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                   <div className="flex justify-between items-start mb-6">
                      {isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); setFolderToDelete(folder); }} className="p-3 bg-rose-50 text-rose-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={18} />
                        </button>
                      )}
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-all ${folder.isDelivered ? 'bg-emerald-500 text-white' : 'bg-rose-50 text-rose-500'}`}>
                         {folder.isDelivered ? <CheckCircle2 size={28} /> : <FolderOpen size={28} />}
                      </div>
                   </div>
                   <h4 className="text-xl font-black text-gray-800 mb-1 truncate font-heebo">{folder.name}</h4>
                   <p className="text-sm text-gray-400 font-bold mb-8">{folder.clientName}</p>
                </div>
              ))}
           </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-left duration-500">
           <div className="bg-white rounded-[3rem] p-10 md:p-12 shadow-2xl border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-500"></div>
              <div className="flex flex-col md:flex-row justify-between items-center gap-8 md:gap-12">
                 <div className="flex items-center gap-6">
                    <button onClick={() => setSelectedFolderId(null)} className="p-5 bg-slate-50 hover:bg-slate-100 rounded-[1.5rem] transition-all active:scale-90">
                       <ArrowRight size={32} className="text-slate-400" />
                    </button>
                    <div className="text-right">
                       <h2 className="text-4xl font-black text-gray-800 font-heebo tracking-tighter">{selectedFolder?.name}</h2>
                       <p className="text-xs font-bold text-gray-400">{selectedFolder?.clientName}</p>
                    </div>
                 </div>
                 <div className="flex flex-col items-center">
                    <div className="bg-slate-900 text-white px-8 py-3 rounded-full font-black mt-3 shadow-xl font-heebo text-xl">
                       ${folderTotalPrice}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                 <button onClick={handleGenerateReceipt} className="flex flex-col items-center gap-3 py-6 rounded-[2rem] bg-slate-900 text-white shadow-xl hover:bg-black transition-all">
                    <FileText className="text-rose-400" /> <span className="text-xs font-black">הפק קבלה</span>
                 </button>
                 <button onClick={() => setFolders(folders.map(f => f.id === selectedFolderId ? {...f, isPaid: !f.isPaid} : f))} className={`flex flex-col items-center gap-3 py-6 rounded-[2rem] border transition-all ${selectedFolder?.isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    <DollarSign /> <span className="text-xs font-black">שולם</span>
                 </button>
                 <button onClick={() => setFolders(folders.map(f => f.id === selectedFolderId ? {...f, isDelivered: !f.isDelivered} : f))} className={`flex flex-col items-center gap-3 py-6 rounded-[2rem] border transition-all ${selectedFolder?.isDelivered ? 'bg-emerald-500 text-white border-transparent shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    <CheckCircle2 /> <span className="text-xs font-black">נמסר</span>
                 </button>
                 <button onClick={() => setFolderToArchive(selectedFolder!)} className="flex flex-col items-center gap-3 py-6 rounded-[2rem] bg-indigo-50 border border-indigo-100 text-indigo-500">
                    <Archive /> <span className="text-xs font-black">ארכיון</span>
                 </button>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center mt-8">
              <div className="flex items-center gap-3">
                {canCreateTask && onCreateTaskFromFolder && selectedFolder && (
                  <button
                    onClick={() => onCreateTaskFromFolder(selectedFolder)}
                    className="bg-indigo-50 text-indigo-600 px-5 py-4 rounded-full font-black text-sm border border-indigo-100 active:scale-95 transition-all inline-flex items-center gap-2"
                  >
                    <ListTodo size={16} />
                    משימה לתיק
                  </button>
                )}
                <button onClick={() => { setEditingOrder(null); setTempDisplayId(generateNewDisplayId()); setIsOrderModalOpen(true); }} className="bg-rose-600 text-white px-8 py-4 rounded-full font-black text-sm active:scale-95 transition-all">
                  הוסף פריט +
                </button>
              </div>
              <h4 className="text-xl font-black text-gray-800">פריטים בתיק ({folderOrders.length})</h4>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {folderOrders.map(order => (
                <div 
                  key={order.id} 
                  className={`bg-white rounded-[2.5rem] p-8 shadow-sm border relative group transition-all hover:shadow-xl ${order.id === highlightedOrderId ? 'border-rose-500 ring-4 ring-rose-500/10 animate-pulse' : 'border-gray-100'}`}
                >
                   <div className="absolute top-6 left-6 flex gap-2">
                      {canCreateTask && onCreateTaskFromOrder && (
                        <button onClick={() => onCreateTaskFromOrder(order)} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl active:scale-90 transition-all border border-indigo-100" title="צור משימה לצוות">
                          <ListTodo size={16} />
                        </button>
                      )}
                      <button onClick={() => handleOpenQrLabel(order)} className="p-3 bg-slate-50 text-slate-900 rounded-xl active:scale-90 transition-all border border-slate-100 hover:bg-slate-900 hover:text-white" title="הדפס תווית QR">
                        <QrCode size={16} />
                      </button>
                      <button onClick={() => { setEditingOrder(order); setTempDisplayId(order.displayId); setIsOrderModalOpen(true); }} className="p-3 bg-indigo-50 text-indigo-500 rounded-xl active:scale-90 transition-all"><Edit2 size={16} /></button>
                      {isAdmin && <button onClick={() => setOrderToDelete(order)} className="p-3 bg-rose-50 text-rose-500 rounded-xl active:scale-90 transition-all"><Trash2 size={16} /></button>}
                   </div>
                   <div className="text-right mt-4">
                      <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg">#{order.displayId}</span>
                      <h5 className="text-2xl font-black text-gray-800 mt-2">{order.itemType}</h5>
                      <p className="text-sm text-gray-400 mt-2 leading-relaxed h-12 overflow-hidden">{order.description || "ללא תיאור"}</p>
                   </div>
                   <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
                      <select 
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer border shadow-sm transition-all ${STATUS_COLORS[order.status]}`}
                      >
                        {['חדש', 'מדידות', 'בתפירה', 'מוכן'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="text-2xl font-black font-heebo text-gray-900">${order.price}</span>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Receipt Modal */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md no-print animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden flex flex-col max-h-[95vh]">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                 <h3 className="text-xl font-black font-heebo">הפקת קבלה</h3>
                 <button onClick={() => setIsReceiptModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
                {isGeneratingReceipt ? (
                   <div className="flex flex-col items-center justify-center h-64 space-y-6">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-slate-200 border-t-rose-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                           <Sparkles className="text-rose-500 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-lg font-black text-slate-800">Generating Invoice...</p>
                        <p className="text-sm text-slate-400 font-bold">Crafting a professional breakdown</p>
                      </div>
                   </div>
                ) : receiptData ? (
                   <div className="bg-white shadow-2xl rounded-3xl overflow-hidden font-sans text-left relative" id="receipt-preview" dir="ltr">
                      {/* Decorative Elements */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full -ml-16 -mb-16 blur-3xl"></div>
                      
                      {/* Header */}
                      <div className="bg-slate-900 text-white p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-500 via-slate-900 to-slate-900"></div>
                        <div className="relative z-10 flex justify-center items-center">
                           <div className="text-center">
                              <h1 className="text-5xl font-black text-white/90 tracking-tighter">INVOICE</h1>
                           </div>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="p-8 grid grid-cols-2 gap-8 border-b border-gray-100">
                         <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={10} /> Bill To</p>
                            <p className="font-bold text-slate-800 text-lg leading-tight">{receiptData.billTo}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Date Issued</p>
                            <p className="font-bold text-slate-800 text-lg font-serif">{receiptData.date}</p>
                         </div>
                      </div>

                      {/* Items Table */}
                      <div className="p-8">
                         <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-4">
                            <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Item Description</span>
                            <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Amount</span>
                         </div>
                         <div className="space-y-4">
                           {receiptData.items?.map((item: any, idx: number) => (
                             <div key={idx} className="flex justify-between items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0 group">
                                <div>
                                   <p className="font-bold text-slate-800 text-sm group-hover:text-rose-600 transition-colors">{item.service}</p>
                                   <p className="text-xs text-slate-400 font-medium mt-0.5">{item.description}</p>
                                </div>
                                <p className="font-bold font-serif text-slate-900">${item.price}</p>
                             </div>
                           ))}
                         </div>
                      </div>

                      {/* Totals Section */}
                      <div className="bg-slate-50 p-8">
                         <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                               <span className="font-bold text-gray-500 uppercase tracking-wider">Subtotal</span>
                               <span className="font-serif font-bold text-slate-600">${receiptData.subtotal}</span>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                               <span className="font-black text-slate-900 text-sm uppercase tracking-widest">Total Due</span>
                               <span className="font-serif font-black text-3xl text-rose-600">${receiptData.total}</span>
                            </div>
                         </div>
                      </div>

                      {/* Footer */}
                      <div className="p-8 text-center bg-white">
                         <p className="text-xs font-serif italic text-slate-400 leading-relaxed">
                            "{receiptData.footerMessage}"
                         </p>
                         <div className="mt-6 pt-6 border-t border-dashed border-gray-100 flex justify-center gap-4 text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                            <span>stitchflow.studio</span>
                            <span>•</span>
                            <span>Thank You</span>
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="text-center py-10">
                      <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                      <p className="font-black text-gray-800">Generation Failed</p>
                      <button onClick={() => setIsReceiptModalOpen(false)} className="mt-4 text-rose-600 font-bold underline">Close & Retry</button>
                   </div>
                )}
              </div>

              {!isGeneratingReceipt && receiptData && (
                 <div className="p-6 border-t border-gray-100 bg-white flex gap-4 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-10">
                    <button onClick={() => setIsReceiptModalOpen(false)} className="flex-1 py-4 font-black text-gray-400 hover:text-gray-600 transition-colors">Close</button>
                    <button onClick={handlePrintReceipt} className="flex-1 border border-slate-200 text-slate-700 font-black rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-slate-50">
                       <Printer size={18} /> הדפס
                    </button>
                    <button
                      onClick={handleShareReceiptImage}
                      disabled={isSharingReceipt}
                      className="flex-[2] bg-slate-900 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                       {isSharingReceipt ? <RefreshCw className="animate-spin" size={18} /> : <Share2 size={18} />}
                       {isSharingReceipt ? 'משתף...' : 'שתף תמונה'}
                    </button>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* QR Label Modal */}
      {activeQrOrder && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md no-print animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 overflow-hidden text-center">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
               <h3 className="text-xl font-black font-heebo">תווית לתיקון</h3>
               <button onClick={closeQrModal} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
            </div>
            <div className="p-10 space-y-6">
              <div id="label-preview" className="bg-white p-6 rounded-3xl border-2 border-dashed border-slate-200 space-y-4">
                <div className="flex justify-center bg-slate-50 p-4 rounded-2xl">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center">
                      <RefreshCw className="animate-spin text-rose-500" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-right">
                  <p className="font-bold text-gray-800 text-lg">{activeQrOrder.clientName}</p>
                  <p className="font-black text-rose-600">ID: #{activeQrOrder.displayId}</p>
                  <p className="text-xs font-bold text-gray-500 truncate">{activeQrOrder.itemType}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handlePrintLabel}
                  disabled={isGeneratingQr || !qrDataUrl || isPrintingLabel}
                  className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isPrintingLabel ? <RefreshCw className="animate-spin" size={20} /> : <Printer size={20} />}
                  {isPrintingLabel ? 'פותח הדפסה...' : 'הדפס'}
                </button>
                <button
                  onClick={handleShareLabelImage}
                  disabled={isGeneratingQr || !qrDataUrl || isSharingLabel}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSharingLabel ? <RefreshCw className="animate-spin" size={20} /> : <Share2 size={20} />}
                  {isSharingLabel ? 'משתף...' : 'שתף'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete/Archive Confirmation modals */}
      {folderToArchive && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
           <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-500 mx-auto mb-6">
                <Archive size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-800 mb-2">ארכיון</h3>
              <p className="text-sm text-gray-500 mb-8">האם להעביר את <b>{folderToArchive.name}</b> לארכיון?</p>
              <div className="flex gap-4">
                 <button onClick={() => setFolderToArchive(null)} className="flex-1 py-4 font-black text-gray-400 active:scale-95 transition-all">ביטול</button>
                 <button onClick={() => toggleArchive(folderToArchive.id)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">העבר</button>
              </div>
           </div>
        </div>
      )}

      {folderToDelete && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
           <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6 animate-pulse">
                <ShieldAlert size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-800 mb-2">מחיקה סופית</h3>
              <p className="text-sm text-gray-500 mb-8">זהירות! כל המידע על <b>{folderToDelete.name}</b> יימחק לצמיתות.</p>
              <div className="flex gap-4">
                 <button onClick={() => setFolderToDelete(null)} className="flex-1 py-4 font-black text-gray-400 active:scale-95 transition-all">ביטול</button>
                 <button onClick={() => { onDeleteFolder(folderToDelete.id); setFolderToDelete(null); setSelectedFolderId(null); }} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">מחק הכל</button>
              </div>
           </div>
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
           <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-800 mb-2">מחיקת פריט</h3>
              <p className="text-sm text-gray-500 mb-8">האם למחוק את <b>{orderToDelete.itemType}</b>?</p>
              <div className="flex gap-4">
                 <button onClick={() => setOrderToDelete(null)} className="flex-1 py-4 font-black text-gray-400 active:scale-95 transition-all">ביטול</button>
                 <button onClick={() => { onDeleteOrder(orderToDelete.id); setOrderToDelete(null); }} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">מחק פריט</button>
              </div>
           </div>
        </div>
      )}

      {pendingPriceDateUpdate && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
           <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-800 mb-2">עדכון תאריך הכנסה</h3>
              <p className="text-sm text-gray-500 mb-8">שינית את המחיר של <b>{pendingPriceDateUpdate.order.itemType}</b>. האם לעדכן את תאריך ההכנסה להיום?</p>
              <div className="flex gap-4">
                 <button onClick={() => resolvePendingPriceDateUpdate(false)} className="flex-1 py-4 font-black text-gray-400 active:scale-95 transition-all">השאר תאריך קיים</button>
                 <button onClick={() => resolvePendingPriceDateUpdate(true)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">עדכן להיום</button>
              </div>
           </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md no-print">
           <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="text-2xl font-black font-heebo">פתיחת תיק עבודה</h3>
                 <button onClick={() => { setIsFolderModalOpen(false); setClientSearchTerm(''); setSelectedClientId(''); setShowClientList(false); }} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={32} /></button>
              </div>
              <div className="p-10 space-y-8 text-right overflow-y-auto max-h-[70vh]">
                 <div className="space-y-4 relative">
                    <label className="text-[11px] font-black text-gray-400 uppercase mr-2">בחרי לקוח</label>
                    <div className="relative">
                       <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                       <input 
                        type="text" 
                        placeholder="חפשי לפי שם או טלפון..." 
                        autoComplete="off"
                        className="w-full pr-12 pl-4 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-gray-700 outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/10 transition-all shadow-sm"
                        value={clientSearchTerm}
                        onFocus={() => setShowClientList(true)}
                        onChange={(e) => {
                          setClientSearchTerm(e.target.value);
                          setSelectedClientId('');
                          setShowClientList(true);
                        }}
                       />
                    </div>
                    {showClientList && !selectedClientId && (
                      <div className="absolute z-[1100] top-full mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-gray-50">
                        {filteredClientsForSearch.length > 0 ? (
                          filteredClientsForSearch.map(c => (
                            <div 
                              key={c.id} 
                              onClick={() => { 
                                setSelectedClientId(c.id); 
                                setClientSearchTerm(c.name); 
                                setShowClientList(false); 
                              }} 
                              className="p-5 hover:bg-rose-50 cursor-pointer flex justify-between items-center transition-colors group"
                            >
                              <span className="text-xs text-gray-400 font-heebo group-hover:text-rose-500">{c.phone}</span>
                              <span className="font-black text-gray-800">{c.name}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-5 text-center text-gray-400 text-sm italic">לא נמצאו לקוחות</div>
                        )}
                        <div 
                          onClick={() => { setIsQuickAddClientOpen(true); setShowClientList(false); }} 
                          className="p-5 bg-slate-50 hover:bg-slate-100 cursor-pointer flex items-center justify-center gap-2 text-rose-600 font-black text-sm"
                        >
                          <Plus size={16} /> הוספת לקוח חדש +
                        </div>
                      </div>
                    )}
                 </div>

                 {selectedClientId && (
                   <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between animate-in zoom-in">
                      <button onClick={() => { setSelectedClientId(''); setClientSearchTerm(''); setShowClientList(true); }} className="text-rose-500 p-1 hover:bg-rose-100 rounded-lg"><X size={18} /></button>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-emerald-600 uppercase">לקוח נבחר</p>
                         <p className="font-black text-emerald-900">{clients.find(c => c.id === selectedClientId)?.name}</p>
                      </div>
                   </div>
                 )}

                 <form onSubmit={handleAddFolder} className="space-y-8">
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-gray-400 uppercase mr-2">שם התיק</label>
                       <input name="name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} required placeholder="למשל: שמלת ערב" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-gray-700 outline-none focus:bg-white transition-all shadow-sm" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-gray-400 uppercase mr-2">תאריך יעד</label>
                       <input name="deadline" type="date" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-gray-700 outline-none shadow-sm" />
                    </div>
                    <button type="submit" disabled={!selectedClientId} className="w-full bg-rose-600 text-white font-black text-xl py-6 rounded-3xl shadow-2xl active:scale-95 transition-all disabled:opacity-50">צור תיק עבודה</button>
                 </form>
              </div>
           </div>
        </div>
      )}

      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md no-print">
           <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden">
              <div className="p-8 bg-rose-600 text-white flex justify-between items-center">
                 <h3 className="text-2xl font-black font-heebo">{editingOrder ? 'עריכת פריט' : 'הוספת פריט'}</h3>
                 <button onClick={() => setIsOrderModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={32} /></button>
              </div>
              <form onSubmit={handleAddOrder} className="p-10 space-y-8 text-right">
                 <div className="bg-slate-900 p-6 rounded-[2rem] flex items-center justify-between shadow-inner border border-slate-800">
                    <button type="button" onClick={() => setTempDisplayId(generateNewDisplayId())} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                       <RefreshCw size={20} />
                    </button>
                    <div className="text-right">
                       <label className="text-[9px] font-black text-rose-500 uppercase tracking-widest block mb-1">Item ID</label>
                       <div className="text-4xl font-black text-white font-heebo tracking-tighter">#{tempDisplayId}</div>
                    </div>
                    <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white">
                       <Hash size={24} />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-gray-400 uppercase mr-2">סוג הבגד</label>
                    <input name="itemType" defaultValue={editingOrder?.itemType} placeholder="שמלה, חצאית..." required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none focus:bg-white transition-all shadow-sm" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-gray-400 uppercase mr-2">מחיר ($)</label>
                    <input name="price" type="number" step="0.1" min="0" defaultValue={editingOrder?.price} placeholder="0.00" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold outline-none font-heebo shadow-sm" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-gray-400 uppercase mr-2">תיאור התיקון</label>
                    <textarea name="description" defaultValue={editingOrder?.description} placeholder="מה צריך לעשות?" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold h-32 resize-none outline-none focus:bg-white transition-all shadow-sm" />
                 </div>
                 <button type="submit" className="w-full bg-slate-900 text-white font-black text-xl py-6 rounded-3xl shadow-2xl active:scale-95 transition-all">שמור פריט</button>
              </form>
           </div>
        </div>
      )}

      {isQuickAddClientOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md no-print">
           <div className="bg-white rounded-[3rem] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 overflow-hidden">
              <div className="p-6 bg-rose-600 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black font-heebo">הוספת לקוח מהירה</h3>
                 <button onClick={() => setIsQuickAddClientOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
              </div>
              <form onSubmit={handleQuickAddClient} className="p-8 space-y-6 text-right">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase pr-1">שם מלא</label>
                    <input name="name" required placeholder="שם הלקוח" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-gray-100 outline-none focus:bg-white font-bold shadow-sm" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase pr-1">טלפון</label>
                    <input name="phone" required placeholder="מספר נייד" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-gray-100 outline-none focus:bg-white font-bold font-heebo shadow-sm" />
                 </div>
                 <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} /> הוסף ובחר
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default ClientFolders;
