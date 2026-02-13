
import React, { useState, useEffect, useRef } from 'react';
import { Cloud, CloudOff, RefreshCw, Smartphone, LogOut, User as UserIcon, QrCode } from 'lucide-react';
import { NAV_ITEMS } from './constants';
import Dashboard from './components/Dashboard';
import ClientsList from './components/ClientsList';
import ClientFolders from './components/ClientFolders';
import OrdersList from './components/OrdersList';
import PaymentsManagement from './components/PaymentsManagement';
import TasksBoard, { TaskPrefill } from './components/TasksBoard';
import Inventory from './components/Inventory';
import IncomeSummary from './components/IncomeSummary';
import DataManagement from './components/DataManagement';
import UserManagement from './components/UserManagement';
import Login from './components/Login';
import QrScanner from './components/QrScanner';
import { Client, Order, Fabric, Folder, Task, User } from './types';
import { dataService } from './services/dataService';
import { getTaskSummary } from './services/taskUtils';

const EDGE_ZONE_PX = 20;
const OPEN_THRESHOLD_PX = 50;
const CLOSE_THRESHOLD_PX = 40;
const DRAWER_TOUCH_ZONE_PX = 320;
const GESTURE_LOCK_THRESHOLD_PX = 12;
const MOBILE_BREAKPOINT_PX = 768;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Fabric[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<TaskPrefill | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  
  // New state for deep-linking/navigation
  const [preSelectedFolderId, setPreSelectedFolderId] = useState<string | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isEdgeSwipeCandidateRef = useRef(false);
  const isHorizontalGestureLockedRef = useRef(false);
  const hasHandledSwipeRef = useRef(false);

  const isCloud = dataService.isCloud();

  // Load session from local storage
  useEffect(() => {
    const savedUser = localStorage.getItem('stitchflow_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const loadAllData = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const [c, f, o, i, t, u] = await Promise.all([
        dataService.getClients(),
        dataService.getFolders(),
        dataService.getOrders(),
        dataService.getInventory(),
        dataService.getTasks(),
        dataService.getUsers().catch(() => [])
      ]);
      
      setClients(c || []);
      setFolders(f || []);
      setOrders(o || []);
      setInventory(i || []);
      setTasks(t || []);
      setUsers(u || []);
      setLastSync(new Date());
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileDrawerOpen]);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileDrawerOpen]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('stitchflow_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('stitchflow_user');
  };

  const handleSaveOrders = async (newOrders: Order[]) => {
    setOrders(newOrders);
    setIsSyncing(true);
    try {
      await dataService.saveOrders(newOrders);
      setLastSync(new Date());
    } catch (e: any) {
      alert("שגיאה בשמירה לשרת: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveFolders = async (newFolders: Folder[]) => {
    setFolders(newFolders);
    setIsSyncing(true);
    try {
      await dataService.saveFolders(newFolders);
      setLastSync(new Date());
    } catch (e: any) {
      alert("שגיאה בשמירה לשרת: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveClients = async (newClients: Client[]) => {
    setClients(newClients);
    setIsSyncing(true);
    try {
      await dataService.saveClients(newClients);
      setLastSync(new Date());
    } catch (e: any) {
      alert("שגיאה בשמירה לשרת: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveInventory = async (newInv: Fabric[]) => {
    setInventory(newInv);
    setIsSyncing(true);
    try {
      await dataService.saveInventory(newInv);
      setLastSync(new Date());
    } catch (e: any) {
      alert("שגיאה בשמירה לשרת: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveTasks = async (newTasks: Task[]) => {
    setTasks(newTasks);
    setIsSyncing(true);
    try {
      await dataService.saveTasks(newTasks);
      setLastSync(new Date());
    } catch (e: any) {
      alert("שגיאה בשמירה לשרת: " + e.message);
      throw e;
    } finally {
      setIsSyncing(false);
    }
  };

  const isAtLeastAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const handleDeleteClient = async (clientId: string) => {
    if (!isAtLeastAdmin) {
      alert("אין לך הרשאה למחיקת לקוחות");
      return;
    }
    setIsSyncing(true);
    try {
      await dataService.deleteClient(clientId);
      setClients(prev => prev.filter(c => c.id !== clientId));
      setFolders(prev => prev.filter(f => f.clientId !== clientId));
      setOrders(prev => prev.filter(o => o.clientId !== clientId));
      setLastSync(new Date());
    } catch (err: any) {
      console.error("Error deleting client:", err);
      alert("שגיאה במחיקה מהשרת: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!isAtLeastAdmin) {
      alert("אין לך הרשאה למחיקת תיקים");
      return;
    }
    setIsSyncing(true);
    try {
      await dataService.deleteFolder(folderId);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      setOrders(prev => prev.filter(o => o.folderId !== folderId));
      setLastSync(new Date());
    } catch (err: any) {
      console.error("Error deleting folder:", err);
      alert("שגיאה במחיקה מהשרת: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!isAtLeastAdmin) {
      alert("אין לך הרשאה למחיקת פריטים");
      return;
    }
    setIsSyncing(true);
    try {
      await dataService.deleteOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setLastSync(new Date());
    } catch (err: any) {
      console.error("Error deleting order:", err);
      alert("שגיאה במחיקה מהשרת: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper for deep navigation to a folder
  const navigateToFolder = (folderId: string, orderId?: string) => {
    setPreSelectedFolderId(folderId);
    if (orderId) setHighlightedOrderId(orderId);
    setActiveTab('folders');
  };

  const handleScanResult = (decodedText: string) => {
    setIsScannerOpen(false);
    // Find order by ID or Display ID
    const foundOrder = orders.find(o => o.id === decodedText || o.displayId === decodedText);
    if (foundOrder) {
      navigateToFolder(foundOrder.folderId, foundOrder.id);
    } else {
      alert("הפריט לא נמצא במערכת.");
    }
  };

  const openTaskFromOrder = (order: Order) => {
    setTaskPrefill({
      title: `מעקב עבור ${order.itemType}`,
      description: order.description || '',
      priority: 'רגילה',
      clientId: order.clientId,
      folderId: order.folderId,
      orderId: order.id,
    });
    setActiveTab('tasks');
  };

  const openTaskFromFolder = (folder: Folder) => {
    setTaskPrefill({
      title: `משימה לתיק ${folder.name}`,
      priority: 'רגילה',
      clientId: folder.clientId,
      folderId: folder.id,
    });
    setActiveTab('tasks');
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard clients={clients} folders={folders} orders={orders} onNavigate={setActiveTab} userRole={currentUser.role} />;
      case 'tasks': return (
        <TasksBoard
          tasks={tasks}
          setTasks={handleSaveTasks}
          users={users}
          currentUser={currentUser}
          clients={clients}
          folders={folders}
          orders={orders}
          initialDraft={taskPrefill}
          onConsumeInitialDraft={() => setTaskPrefill(null)}
        />
      );
      case 'clients': return (
        <ClientsList 
          clients={clients} 
          folders={folders} 
          orders={orders} 
          setClients={handleSaveClients} 
          onDeleteClient={handleDeleteClient} 
          userRole={currentUser.role} 
          onNavigateToFolder={navigateToFolder}
          onMergeSuccess={loadAllData} 
        />
      );
      case 'folders': return (
        <ClientFolders 
          clients={clients} 
          setClients={handleSaveClients} 
          folders={folders} 
          setFolders={handleSaveFolders} 
          orders={orders} 
          setOrders={handleSaveOrders} 
          onDeleteFolder={handleDeleteFolder} 
          onDeleteOrder={handleDeleteOrder} 
          userRole={currentUser.role} 
          initialFolderId={preSelectedFolderId}
          highlightedOrderId={highlightedOrderId}
          onClearInitialFolder={() => {
            setPreSelectedFolderId(null);
            setHighlightedOrderId(null);
          }}
          onCreateTaskFromFolder={openTaskFromFolder}
          onCreateTaskFromOrder={openTaskFromOrder}
        />
      );
      case 'orders': return <OrdersList orders={orders} clients={clients} folders={folders} setOrders={handleSaveOrders} onDeleteOrder={handleDeleteOrder} userRole={currentUser.role} onCreateTaskFromOrder={openTaskFromOrder} />;
      case 'payments':
        if (currentUser.role === 'viewer') {
          return <Dashboard clients={clients} folders={folders} orders={orders} onNavigate={setActiveTab} userRole={currentUser.role} />;
        }
        return <PaymentsManagement folders={folders} orders={orders} onNavigateToFolder={navigateToFolder} />;
      case 'income': return <IncomeSummary folders={folders} orders={orders} />;
      case 'inventory': return <Inventory inventory={inventory} setInventory={handleSaveInventory} />;
      case 'data-mgmt': return <DataManagement onImportSuccess={loadAllData} />;
      case 'users': return <UserManagement />;
      default: return <Dashboard clients={clients} folders={folders} orders={orders} onNavigate={setActiveTab} userRole={currentUser.role} />;
    }
  };

  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.superAdminOnly) return currentUser.role === 'super_admin';
    if (item.adminOnly) return isAtLeastAdmin;
    if (item.staffOnly) return currentUser.role !== 'viewer';
    return true;
  });
  const taskSummary = getTaskSummary(tasks);
  const taskAlertCount = taskSummary.urgentOrOverdue;
  const mobileNavItems = visibleNavItems.slice(0, 5);
  const mobileOverflowNavItems = visibleNavItems.slice(5);
  const hasMobileOverflowNav = mobileOverflowNavItems.length > 0;

  const resetSwipeState = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isEdgeSwipeCandidateRef.current = false;
    isHorizontalGestureLockedRef.current = false;
    hasHandledSwipeRef.current = false;
  };

  const handleMobileTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!hasMobileOverflowNav || typeof window === 'undefined' || window.innerWidth >= MOBILE_BREAKPOINT_PX) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isHorizontalGestureLockedRef.current = false;
    hasHandledSwipeRef.current = false;

    const isFromEdge = touch.clientX >= window.innerWidth - EDGE_ZONE_PX;
    const isInDrawerZone = touch.clientX >= window.innerWidth - DRAWER_TOUCH_ZONE_PX;
    isEdgeSwipeCandidateRef.current = isFromEdge || (isMobileDrawerOpen && isInDrawerZone);
  };

  const handleMobileTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!hasMobileOverflowNav || typeof window === 'undefined' || window.innerWidth >= MOBILE_BREAKPOINT_PX) return;
    if (!isEdgeSwipeCandidateRef.current || hasHandledSwipeRef.current) return;
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    if (!isHorizontalGestureLockedRef.current) {
      if (Math.abs(deltaX) < GESTURE_LOCK_THRESHOLD_PX && Math.abs(deltaY) < GESTURE_LOCK_THRESHOLD_PX) {
        return;
      }
      if (Math.abs(deltaX) <= Math.abs(deltaY)) {
        isEdgeSwipeCandidateRef.current = false;
        return;
      }
      isHorizontalGestureLockedRef.current = true;
    }

    event.preventDefault();

    if (!isMobileDrawerOpen && deltaX <= -OPEN_THRESHOLD_PX) {
      setIsMobileDrawerOpen(true);
      hasHandledSwipeRef.current = true;
      return;
    }
    if (isMobileDrawerOpen && deltaX >= CLOSE_THRESHOLD_PX) {
      setIsMobileDrawerOpen(false);
      hasHandledSwipeRef.current = true;
    }
  };

  const handleMobileTouchEnd = () => {
    resetSwipeState();
  };

  return (
    <div
      className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden font-assistant selection:bg-rose-100"
      onTouchStart={handleMobileTouchStart}
      onTouchMove={handleMobileTouchMove}
      onTouchEnd={handleMobileTouchEnd}
      onTouchCancel={handleMobileTouchEnd}
    >
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-l border-gray-200 flex-col shadow-lg z-30">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-rose-600 font-heebo flex items-center gap-2">
            <div className="w-8 h-8 bg-rose-600 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white text-xs">🧵</span>
            </div>
            StitchFlow
          </h1>
        </div>

        <div className="px-6 py-2 mb-2">
           <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-rose-600 shadow-sm">
                <UserIcon size={16} />
              </div>
              <div className="min-w-0">
                 <p className="text-xs font-bold text-gray-800 truncate">{currentUser.username}</p>
                 <p className="text-[9px] text-rose-500 font-black uppercase">{currentUser.role === 'super_admin' ? 'מנהל על' : currentUser.role === 'admin' ? 'מנהל' : 'צוות'}</p>
              </div>
           </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id
                  ? 'bg-rose-50 text-rose-600 font-semibold border border-rose-100'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
              {item.id === 'tasks' && taskAlertCount > 0 && (
                <span className="mr-auto inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black">
                  {taskAlertCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        
        {/* Connection Status & Logout */}
        <div className="p-4 border-t border-gray-100 space-y-2 mt-auto">
           <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold ${isCloud ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
              {isCloud ? <Cloud size={14} /> : <Smartphone size={14} />}
              <span>{isCloud ? 'מחובר לענן' : 'מצב מקומי'}</span>
           </div>
           <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 transition-colors"
           >
              <LogOut size={14} />
              <span>התנתק מהמערכת</span>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 z-20 shadow-sm shrink-0">
          <div className="flex items-center gap-2">
             <div className="md:hidden w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md">SF</div>
             <h2 className="text-base md:text-lg font-bold text-gray-800 truncate">
              {NAV_ITEMS.find(n => n.id === activeTab)?.label}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogout}
              className="p-2 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all active:scale-95 border border-rose-100 ml-2"
              title="התנתק"
            >
              <LogOut size={20} />
            </button>

            <button 
              onClick={loadAllData}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border active:scale-95 transition-all ${isCloud ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 text-rose-500 animate-spin" />
              ) : isCloud ? (
                <Cloud className="w-3 h-3 text-emerald-500" />
              ) : (
                <CloudOff className="w-3 h-3 text-gray-400" />
              )}
              <span className={`text-[10px] font-bold hidden sm:inline ${isCloud ? 'text-emerald-700' : 'text-gray-500'}`}>
                {isSyncing ? 'מרענן...' : isCloud ? 'סנכרון ענן' : 'מקומי'}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-32 md:pb-8 w-full bg-gray-50/50">
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            {renderContent()}
          </div>
        </main>

        {/* Scanner Component */}
        {isScannerOpen && (
          <QrScanner 
            onScan={handleScanResult} 
            onClose={() => setIsScannerOpen(false)} 
          />
        )}

        {/* Mobile Drawer Handle */}
        {hasMobileOverflowNav && (
          <div
            aria-hidden="true"
            className="md:hidden fixed top-1/2 right-0 -translate-y-1/2 z-30 pointer-events-none"
          >
            <div className="relative">
              <div className={`absolute inset-0 blur-sm rounded-l-full transition-opacity ${isMobileDrawerOpen ? 'opacity-90 bg-rose-500/50' : 'opacity-60 bg-rose-300/50'}`} />
              <div className={`relative w-2 h-16 rounded-l-full transition-all bg-gradient-to-b from-rose-400 via-pink-500 to-orange-300 ${isMobileDrawerOpen ? 'shadow-[0_0_14px_rgba(244,63,94,0.45)]' : 'shadow-[0_0_8px_rgba(251,113,133,0.3)]'}`} />
            </div>
          </div>
        )}

        {/* Mobile Drawer Backdrop */}
        {hasMobileOverflowNav && (
          <div
            className={`md:hidden fixed inset-0 bg-gradient-to-b from-slate-900/60 via-rose-950/35 to-slate-900/60 backdrop-blur-[1px] transition-opacity z-[45] ${isMobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden={!isMobileDrawerOpen}
          />
        )}

        {/* Mobile Drawer */}
        {hasMobileOverflowNav && (
          <aside
            role="dialog"
            aria-modal={isMobileDrawerOpen}
            aria-hidden={!isMobileDrawerOpen}
            aria-label="ניווט נוסף"
            className={`md:hidden fixed top-0 bottom-0 right-0 w-72 max-w-[85vw] bg-gradient-to-b from-rose-50 via-white to-orange-50 border-l border-rose-100 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col overflow-hidden ${isMobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="relative px-4 py-5 border-b border-rose-100 bg-gradient-to-r from-rose-100/80 via-pink-50 to-orange-100/70">
              <div className="absolute -top-8 -left-4 w-24 h-24 rounded-full bg-rose-300/20 blur-2xl" />
              <div className="absolute -bottom-10 right-6 w-24 h-24 rounded-full bg-orange-300/20 blur-2xl" />
              <p className="relative text-sm font-black text-rose-700">ניווט נוסף</p>
              <p className="relative text-[11px] text-rose-500/90 mt-1">עמודים שלא מופיעים בסרגל התחתון</p>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-2">
              {mobileOverflowNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold border border-rose-300 shadow-lg shadow-rose-200/70'
                      : 'text-slate-600 bg-white/80 border border-rose-100/80 hover:bg-rose-50 hover:border-rose-200'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${
                    activeTab === item.id
                      ? 'bg-white/20'
                      : 'bg-gradient-to-br from-rose-100 to-orange-100 text-rose-600'
                  }`}>
                    {item.icon}
                  </span>
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* Mobile Navbar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-gray-100 flex justify-around items-center z-40 h-24 px-1 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-3 h-full transition-all active:bg-gray-50 ${
                activeTab === item.id ? 'text-rose-600' : 'text-gray-400'
              }`}
            >
              <div className={`relative ${activeTab === item.id ? 'scale-125' : 'scale-110'} transition-transform`}>
                {React.cloneElement(item.icon as React.ReactElement<any>, { size: 28 })}
                {item.id === 'tasks' && taskAlertCount > 0 && (
                  <span className="absolute -top-2 -right-3 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black">
                    {taskAlertCount}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-black tracking-tighter ${activeTab === item.id ? 'opacity-100' : 'opacity-80'}`}>
                {item.label.split(' ')[0]}
              </span>
            </button>
          ))}
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="flex flex-col items-center justify-center flex-1 -mt-14"
          >
             <div className="w-16 h-16 bg-gradient-to-br from-slate-900 to-slate-700 rounded-full flex items-center justify-center text-white shadow-2xl border-4 border-white mb-1 active:scale-90 transition-all">
                <QrCode className="w-8 h-8 text-rose-400" />
             </div>
             <span className="text-[11px] font-black text-slate-700 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">סריקת QR</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;
