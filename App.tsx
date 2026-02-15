
import React, { useState, useEffect, useRef } from 'react';
import { Cloud, CloudOff, RefreshCw, Smartphone, LogOut, User as UserIcon, QrCode, Lock, AlertCircle } from 'lucide-react';
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
import { showUiAlert } from './services/uiAlert';
import {
  applyDailyTaskHousekeeping,
  getLocalDayKey,
  getTaskSummary,
  getStoredTaskHousekeepingDay,
  setStoredTaskHousekeepingDay
} from './services/taskUtils';

const EDGE_ZONE_PX = 20;
const OPEN_THRESHOLD_PX = 50;
const CLOSE_THRESHOLD_PX = 40;
const DRAWER_TOUCH_ZONE_PX = 320;
const GESTURE_LOCK_THRESHOLD_PX = 12;
const MOBILE_BREAKPOINT_PX = 768;
const INCOME_UNLOCK_SESSION_KEY = 'stitchflow_income_unlock_until';
const INCOME_UNLOCK_TTL_MS = 3 * 60 * 1000;

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
  const [isIncomeGateOpen, setIsIncomeGateOpen] = useState(false);
  const [incomeGatePassword, setIncomeGatePassword] = useState('');
  const [incomeGateError, setIncomeGateError] = useState('');
  const [pendingIncomeGateTarget, setPendingIncomeGateTarget] = useState<'income' | 'dashboard_weekly' | null>(null);
  
  // New state for deep-linking/navigation
  const [preSelectedFolderId, setPreSelectedFolderId] = useState<string | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isEdgeSwipeCandidateRef = useRef(false);
  const isHorizontalGestureLockedRef = useRef(false);
  const hasHandledSwipeRef = useRef(false);

  const isCloud = dataService.isCloud();

  const isTasksSchemaMismatchError = (error: any): boolean => {
    const message = [
      error?.message,
      error?.details,
      error?.hint
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!message.includes('tasks')) return false;

    const schemaSignals = message.includes('schema cache') || message.includes('could not find') || message.includes('column');
    const taskColumns = message.includes('kind') || message.includes('ordersnapshot') || message.includes('folderchecklist');

    return schemaSignals && taskColumns;
  };

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
      const rawTasks = t || [];
      const now = Date.now();
      const todayKey = getLocalDayKey(now);
      const lastHousekeepingDay = getStoredTaskHousekeepingDay();
      const shouldCleanupCompleted = lastHousekeepingDay !== todayKey;
      const housekeeping = applyDailyTaskHousekeeping(rawTasks, now, shouldCleanupCompleted);
      
      setClients(c || []);
      setFolders(f || []);
      setOrders(o || []);
      setInventory(i || []);
      setTasks(housekeeping.tasks);
      setUsers(u || []);

      if (housekeeping.changed) {
        try {
          await dataService.saveTasks(housekeeping.tasks);
        } catch (saveErr) {
          console.error('Failed to persist daily task housekeeping', saveErr);
        }
      }

      if (shouldCleanupCompleted) {
        setStoredTaskHousekeepingDay(todayKey);
      }

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
    sessionStorage.removeItem(INCOME_UNLOCK_SESSION_KEY);
    setIsIncomeGateOpen(false);
    setIncomeGatePassword('');
    setIncomeGateError('');
    setPendingIncomeGateTarget(null);
  };

  const handleSaveOrders = async (newOrders: Order[]) => {
    setOrders(newOrders);
    setIsSyncing(true);
    try {
      await dataService.saveOrders(newOrders);
      setLastSync(new Date());
    } catch (e: any) {
      showUiAlert("שגיאה בשמירה לשרת: " + e.message);
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
      showUiAlert("שגיאה בשמירה לשרת: " + e.message);
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
      showUiAlert("שגיאה בשמירה לשרת: " + e.message);
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
      showUiAlert("שגיאה בשמירה לשרת: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveTasks = async (newTasks: Task[]) => {
    const previousTasks = tasks;
    setTasks(newTasks);
    setIsSyncing(true);
    try {
      await dataService.saveTasks(newTasks);
      setLastSync(new Date());
    } catch (e: any) {
      setTasks(previousTasks);
      if (isTasksSchemaMismatchError(e)) {
        showUiAlert("סכמת מסד הנתונים לא מעודכנת למשימות.\nיש להריץ את מיגרציית tasks ב-Data Management או ב-Supabase SQL Editor, ואז לרענן את האפליקציה.");
      } else {
        showUiAlert("שגיאה בשמירה לשרת: " + e.message);
      }
      throw e;
    } finally {
      setIsSyncing(false);
    }
  };

  const isAtLeastAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const handleDeleteClient = async (clientId: string) => {
    if (!isAtLeastAdmin) {
      showUiAlert("אין לך הרשאה למחיקת לקוחות");
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
      showUiAlert("שגיאה במחיקה מהשרת: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!isAtLeastAdmin) {
      showUiAlert("אין לך הרשאה למחיקת תיקים");
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
      showUiAlert("שגיאה במחיקה מהשרת: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!isAtLeastAdmin) {
      showUiAlert("אין לך הרשאה למחיקת פריטים");
      return;
    }
    setIsSyncing(true);
    try {
      await dataService.deleteOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setLastSync(new Date());
    } catch (err: any) {
      console.error("Error deleting order:", err);
      showUiAlert("שגיאה במחיקה מהשרת: " + err.message);
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
      showUiAlert("הפריט לא נמצא במערכת.");
    }
  };

  const openTaskFromOrder = (order: Order) => {
    setTaskPrefill({
      kind: 'order',
      title: `מעקב עבור ${order.itemType}`,
      description: order.description || '',
      clientId: order.clientId,
      folderId: order.folderId,
      orderId: order.id,
    });
    setActiveTab('tasks');
  };

  const openTaskFromFolder = (folder: Folder) => {
    setTaskPrefill({
      kind: 'folder',
      title: `משימה לתיק ${folder.name}`,
      clientId: folder.clientId,
      folderId: folder.id,
    });
    setActiveTab('tasks');
  };

  const isIncomeUnlocked = (): boolean => {
    const rawValue = sessionStorage.getItem(INCOME_UNLOCK_SESSION_KEY);
    if (!rawValue) return false;

    const unlockUntil = Number(rawValue);
    if (!Number.isFinite(unlockUntil) || unlockUntil <= Date.now()) {
      sessionStorage.removeItem(INCOME_UNLOCK_SESSION_KEY);
      return false;
    }

    return true;
  };

  const openIncomeGate = (target: 'income' | 'dashboard_weekly') => {
    setPendingIncomeGateTarget(target);
    setIncomeGatePassword('');
    setIncomeGateError('');
    setIsIncomeGateOpen(true);
  };

  const closeIncomeGate = () => {
    setIsIncomeGateOpen(false);
    setIncomeGatePassword('');
    setIncomeGateError('');
    setPendingIncomeGateTarget(null);
  };

  const submitIncomeGatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) return;

    const candidatePassword = incomeGatePassword.trim();
    if (!candidatePassword) {
      setIncomeGateError('יש להזין סיסמה');
      return;
    }

    setIncomeGateError('');
    try {
      const verifiedUser = await dataService.login(currentUser.username, candidatePassword);
      if (!verifiedUser) {
        setIncomeGateError('הסיסמה שגויה');
        return;
      }

      sessionStorage.setItem(INCOME_UNLOCK_SESSION_KEY, String(Date.now() + INCOME_UNLOCK_TTL_MS));
      if (pendingIncomeGateTarget === 'income') {
        setActiveTab('income');
      }
      closeIncomeGate();
    } catch (error) {
      setIncomeGateError('אירעה שגיאה באימות הסיסמה');
    }
  };

  const handleNavigate = (tabId: string) => {
    if (tabId !== 'income') {
      setActiveTab(tabId);
      return;
    }

    if (!isAtLeastAdmin) {
      return;
    }

    if (isIncomeUnlocked()) {
      setActiveTab('income');
      return;
    }

    openIncomeGate('income');
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const isWeeklyRevenueVisible = isIncomeUnlocked();

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            clients={clients}
            folders={folders}
            orders={orders}
            onNavigate={handleNavigate}
            userRole={currentUser.role}
            isWeeklyRevenueVisible={isWeeklyRevenueVisible}
            onRequestWeeklyRevenueReveal={() => openIncomeGate('dashboard_weekly')}
          />
        );
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
          return (
            <Dashboard
              clients={clients}
              folders={folders}
              orders={orders}
              onNavigate={handleNavigate}
              userRole={currentUser.role}
              isWeeklyRevenueVisible={isWeeklyRevenueVisible}
              onRequestWeeklyRevenueReveal={() => openIncomeGate('dashboard_weekly')}
            />
          );
        }
        return <PaymentsManagement folders={folders} orders={orders} onNavigateToFolder={navigateToFolder} />;
      case 'income':
        if (!isAtLeastAdmin || !isIncomeUnlocked()) {
          return (
            <Dashboard
              clients={clients}
              folders={folders}
              orders={orders}
              onNavigate={handleNavigate}
              userRole={currentUser.role}
              isWeeklyRevenueVisible={isWeeklyRevenueVisible}
              onRequestWeeklyRevenueReveal={() => openIncomeGate('dashboard_weekly')}
            />
          );
        }
        return <IncomeSummary folders={folders} orders={orders} />;
      case 'inventory': return <Inventory inventory={inventory} setInventory={handleSaveInventory} />;
      case 'data-mgmt': return <DataManagement onImportSuccess={loadAllData} />;
      case 'users': return <UserManagement />;
      default:
        return (
          <Dashboard
            clients={clients}
            folders={folders}
            orders={orders}
            onNavigate={handleNavigate}
            userRole={currentUser.role}
            isWeeklyRevenueVisible={isWeeklyRevenueVisible}
            onRequestWeeklyRevenueReveal={() => openIncomeGate('dashboard_weekly')}
          />
        );
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
  const isDashboardActive = activeTab === 'dashboard';
  const incomeGateDescription = pendingIncomeGateTarget === 'dashboard_weekly'
    ? 'כדי לחשוף את ערך העבודה השבועי בלוח הבקרה יש להזין את סיסמת המשתמש שלך.'
    : 'כדי לצפות בדף ההכנסות יש להזין את סיסמת המשתמש שלך.';

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
      className="malki-theme flex flex-col md:flex-row h-screen bg-[#fff4f8] overflow-hidden font-assistant selection:bg-rose-200"
      onTouchStart={handleMobileTouchStart}
      onTouchMove={handleMobileTouchMove}
      onTouchEnd={handleMobileTouchEnd}
      onTouchCancel={handleMobileTouchEnd}
    >
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white/95 border-l border-rose-200 flex-col shadow-xl z-30 backdrop-blur">
        <div className="p-6">
          <h1 className="flex items-center">
            <img
              src="/brand/malki-style-logo.jpeg"
              alt="Malki Style"
              className="h-12 w-auto rounded-xl border border-rose-100 shadow-sm object-cover"
            />
          </h1>
        </div>

        <div className="px-6 py-2 mb-2">
           <div className="bg-[#fff0f7] rounded-xl p-3 border border-rose-200 flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-rose-600 shadow-sm">
                <UserIcon size={16} />
              </div>
              <div className="min-w-0">
                 <p className="text-xs font-bold text-[#2B2B2B] truncate">{currentUser.username}</p>
                 <p className="text-[9px] text-rose-500 font-black uppercase">{currentUser.role === 'super_admin' ? 'מנהל על' : currentUser.role === 'admin' ? 'מנהל' : 'צוות'}</p>
              </div>
           </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id
                  ? 'bg-[#ffeaf4] text-rose-700 font-semibold border border-rose-300 shadow-sm'
                  : 'text-[#7a7a7a] border border-transparent hover:bg-[#fff1f8] hover:border-rose-200'
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
        <div className="p-4 border-t border-rose-100 space-y-2 mt-auto">
           <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold ${isCloud ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-[#fff0f7] text-[#7a7a7a] border border-rose-200'}`}>
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
        <header className="h-16 bg-white/95 border-b border-rose-200 flex items-center justify-between px-4 md:px-8 z-20 shadow-sm shrink-0 backdrop-blur">
          <div className="flex items-center gap-2">
             <div className="md:hidden w-9 h-9 rounded-lg overflow-hidden border border-rose-100 shadow-sm bg-white shrink-0">
              <img src="/icons/malki-style-logo-192.png" alt="Malki Style" className="w-full h-full object-cover" />
             </div>
             <h2 className="text-base md:text-lg font-bold text-[#2B2B2B] truncate">
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border active:scale-95 transition-all ${isCloud ? 'bg-emerald-50 border-emerald-100' : 'bg-[#fff0f7] border-rose-200'}`}
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 text-rose-500 animate-spin" />
              ) : isCloud ? (
                <Cloud className="w-3 h-3 text-emerald-500" />
              ) : (
                <CloudOff className="w-3 h-3 text-[#7A7A7A]" />
              )}
              <span className={`text-[10px] font-bold hidden sm:inline ${isCloud ? 'text-emerald-700' : 'text-[#7A7A7A]'}`}>
                {isSyncing ? 'מרענן...' : isCloud ? 'סנכרון ענן' : 'מקומי'}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-32 md:pb-8 w-full bg-transparent">
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

        {isIncomeGateOpen && (
          <div className="fixed inset-0 z-[70] bg-[#60254366] backdrop-blur-sm flex items-center justify-center p-4" onClick={closeIncomeGate}>
            <form
              onSubmit={submitIncomeGatePassword}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 space-y-5 text-right"
              dir="rtl"
            >
              <div className="flex items-center gap-3 justify-end">
                <h3 className="text-xl font-black text-[#2B2B2B] font-heebo">אימות סיסמה</h3>
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Lock size={18} />
                </div>
              </div>
              <p className="text-sm text-[#7A7A7A] font-bold">{incomeGateDescription}</p>
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-[#7A7A7A] uppercase tracking-widest">סיסמה</label>
                <input
                  type="password"
                  value={incomeGatePassword}
                  onChange={(event) => setIncomeGatePassword(event.target.value)}
                  autoFocus
                  className="w-full bg-[#fff3f9] border border-rose-100 rounded-2xl py-4 px-4 outline-none focus:ring-4 focus:ring-[#e5488640] font-bold text-gray-700"
                  placeholder="הזן סיסמה"
                />
              </div>
              {incomeGateError && (
                <div className="flex items-center gap-2 justify-end bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl px-4 py-3 text-sm font-bold">
                  <span>{incomeGateError}</span>
                  <AlertCircle size={16} />
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={closeIncomeGate} className="flex-1 py-3 rounded-2xl bg-gray-100 text-[#7A7A7A] font-black hover:bg-gray-200 transition-colors">
                  ביטול
                </button>
                <button type="submit" className="flex-1 py-3 rounded-2xl bg-rose-600 text-white font-black hover:bg-rose-700 transition-colors">
                  כניסה
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mobile Drawer Handle */}
        {hasMobileOverflowNav && (
          <div
            aria-hidden="true"
            className="md:hidden fixed top-1/2 right-0 -translate-y-1/2 z-30 pointer-events-none"
          >
            <div className="relative">
              <div className={`absolute inset-0 blur-sm rounded-l-full transition-opacity ${isMobileDrawerOpen ? 'opacity-90 bg-rose-500/50' : 'opacity-60 bg-rose-300/50'}`} />
              <div className={`relative w-2 h-16 rounded-l-full transition-all bg-gradient-to-b from-rose-300 via-pink-500 to-rose-400 ${isMobileDrawerOpen ? 'shadow-[0_0_14px_rgba(244,63,94,0.45)]' : 'shadow-[0_0_8px_rgba(251,113,133,0.3)]'}`} />
            </div>
          </div>
        )}

        {/* Mobile Drawer Backdrop */}
        {hasMobileOverflowNav && (
          <div
            className={`md:hidden fixed inset-0 bg-gradient-to-b from-[#8a3560]/60 via-rose-950/35 to-[#662346]/60 backdrop-blur-[1px] transition-opacity z-[45] ${isMobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
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
            className={`md:hidden fixed top-0 bottom-0 right-0 w-72 max-w-[85vw] bg-[#fff6fa] border-l border-[#e5488650] shadow-[0_16px_36px_rgba(229,72,134,0.2)] z-50 transform transition-transform duration-300 ease-out flex flex-col overflow-hidden ${isMobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="relative px-4 py-5 border-b border-[#e5488640] bg-gradient-to-r from-[#ffe8f3] via-[#fff3f9] to-[#ffe8f3]">
              <div className="absolute -top-8 -left-4 w-24 h-24 rounded-full bg-rose-300/20 blur-2xl" />
              <div className="absolute -bottom-10 right-6 w-24 h-24 rounded-full bg-rose-300/20 blur-2xl" />
              <p className="relative text-sm font-black text-[#8b2f5d]">ניווט נוסף</p>
              <p className="relative text-[11px] text-[#b75987] mt-1">עמודים שלא מופיעים בסרגל התחתון</p>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-2">
              {mobileOverflowNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    handleNavigate(item.id);
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                    activeTab === item.id
                      ? 'bg-[#ffe8f3] text-[#E54886] font-semibold border border-[#e5488670] shadow-[0_8px_16px_rgba(229,72,134,0.16)]'
                      : 'text-[#7a7a7a] bg-white border border-[#e5488638] hover:bg-[#fff1f8] hover:border-[#e5488660]'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${
                    activeTab === item.id
                      ? 'bg-[#f8d7e8] text-[#E54886]'
                      : 'bg-[#fff1f8] text-rose-600'
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
        <nav
          className={`md:hidden fixed flex justify-around items-center z-40 h-24 px-1 pb-safe backdrop-blur-2xl transition-all duration-200 ${
            isDashboardActive
              ? 'bottom-2 left-2 right-2 rounded-[1.9rem] bg-[#fff4f9]/97 border border-[#e5488668] shadow-[0_10px_30px_rgba(229,72,134,0.24)]'
              : 'bottom-2 left-2 right-2 rounded-[1.9rem] bg-[#fff4f9]/97 border border-[#e5488658] shadow-[0_10px_26px_rgba(229,72,134,0.2)]'
          }`}
        >
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-3 h-full transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e5488630] ${
                isDashboardActive
                  ? `${activeTab === item.id ? 'text-[#E54886]' : 'text-[#7A7A7A]'}`
                  : `${activeTab === item.id ? 'text-[#E54886]' : 'text-[#7A7A7A]'}`
              }`}
            >
              <div className={`relative transition-all duration-200 ${activeTab === item.id ? 'scale-[1.14]' : 'scale-100'}`}>
                {React.cloneElement(item.icon as React.ReactElement<any>, { size: 28 })}
                {item.id === 'tasks' && taskAlertCount > 0 && (
                  <span className={`absolute -top-2 -right-3 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-white text-[9px] font-black ${isDashboardActive ? 'bg-[#E54886]' : 'bg-rose-600'}`}>
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
            className={`flex flex-col items-center justify-center flex-1 ${isDashboardActive ? '-mt-9' : '-mt-14'}`}
          >
             <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white border-4 border-white mb-1 active:scale-90 transition-all duration-200 ${
                isDashboardActive
                  ? 'bg-white border-[#e548867f] shadow-[0_12px_24px_rgba(229,72,134,0.29)]'
                  : 'bg-white border-[#e5488675] shadow-[0_12px_24px_rgba(229,72,134,0.25)]'
              }`}
             >
                <QrCode className={`w-8 h-8 ${isDashboardActive ? 'text-[#E54886]' : 'text-[#E54886]'}`} />
             </div>
             <span className={`text-[11px] font-black px-3 py-1 rounded-full shadow-sm border ${isDashboardActive ? 'text-[#7A7A7A] bg-[#fff5fa] border-[#e5488668]' : 'text-[#7A7A7A] bg-[#fff5fa] border-[#e5488658]'}`}>סריקת QR</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;
