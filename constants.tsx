
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Scissors, 
  Layers, 
  MessageSquare, 
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
  { id: 'clients', label: 'ניהול לקוחות', icon: <Users className="w-5 h-5" /> },
  { id: 'folders', label: 'תיקי לקוחות', icon: <FolderOpen className="w-5 h-5" /> },
  { id: 'orders', label: 'מעקב הזמנות', icon: <Scissors className="w-5 h-5" /> },
  { id: 'inventory', label: 'ניהול מלאי', icon: <Package className="w-5 h-5" /> },
  { id: 'income', label: 'סיכום הכנסות', icon: <Wallet className="w-5 h-5" />, adminOnly: true },
  { id: 'data-mgmt', label: 'ניהול ענן ונתונים', icon: <Cloud className="w-5 h-5" />, superAdminOnly: true },
  { id: 'users', label: 'ניהול צוות', icon: <ShieldCheck className="w-5 h-5" />, superAdminOnly: true },
  { id: 'ai-assistant', label: 'עוזר עיצוב AI', icon: <MessageSquare className="w-5 h-5" /> },
];

export const STATUS_COLORS: Record<string, string> = {
  'חדש': 'bg-blue-100 text-blue-700 border-blue-200',
  'מדידות': 'bg-violet-100 text-violet-700 border-violet-200',
  'בתפירה': 'bg-amber-100 text-amber-700 border-amber-200',
  'מדידה_שנייה': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'מוכן': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'נמסר': 'bg-slate-100 text-slate-500 border-slate-200',
};

export const STATUS_ICONS: Record<string, React.ReactNode> = {
  'חדש': <Clock className="w-4 h-4" />,
  'בתפירה': <Scissors className="w-4 h-4" />,
  'מוכן': <CheckCircle2 className="w-4 h-4" />,
  'דחוף': <AlertCircle className="w-4 h-4 text-red-500" />,
};
