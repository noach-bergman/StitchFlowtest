
import React from 'react';
import { 
  LayoutDashboard, 
  ListTodo,
  Users, 
  Scissors, 
  Layers, 
  FolderOpen,
  Calendar,
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Cloud,
  ShieldCheck,
  Package
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'לוח בקרה', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'tasks', label: 'משימות צוות', icon: <ListTodo className="w-5 h-5" /> },
  { id: 'clients', label: 'ניהול לקוחות', icon: <Users className="w-5 h-5" /> },
  { id: 'folders', label: 'תיקי לקוחות', icon: <FolderOpen className="w-5 h-5" /> },
  { id: 'orders', label: 'מעקב הזמנות', icon: <Scissors className="w-5 h-5" /> },
  { id: 'payments', label: 'ניהול תשלומים', icon: <Wallet className="w-5 h-5" />, staffOnly: true },
  { id: 'inventory', label: 'ניהול מלאי', icon: <Package className="w-5 h-5" /> },
  { id: 'income', label: 'סיכום הכנסות', icon: <Wallet className="w-5 h-5" />, adminOnly: true },
  { id: 'data-mgmt', label: 'ניהול ענן ונתונים', icon: <Cloud className="w-5 h-5" />, superAdminOnly: true },
  { id: 'users', label: 'ניהול צוות', icon: <ShieldCheck className="w-5 h-5" />, superAdminOnly: true },
];

export const STATUS_COLORS: Record<string, string> = {
  'חדש': 'bg-rose-50 text-rose-700 border-rose-200',
  'מדידות': 'bg-[#fff1f7] text-[#b03d72] border-[#f2b7d2]',
  'בתפירה': 'bg-amber-100 text-amber-700 border-amber-200',
  'מדידה_שנייה': 'bg-[#ffe8f2] text-[#a93a6b] border-[#f0aeca]',
  'מוכן': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'נמסר': 'bg-[#fff3f8] text-[#8e5d75] border-[#f1c1d8]',
};

export const STATUS_ICONS: Record<string, React.ReactNode> = {
  'חדש': <Clock className="w-4 h-4" />,
  'בתפירה': <Scissors className="w-4 h-4" />,
  'מוכן': <CheckCircle2 className="w-4 h-4" />,
  'דחוף': <AlertCircle className="w-4 h-4 text-red-500" />,
};
