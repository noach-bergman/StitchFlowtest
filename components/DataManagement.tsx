
import React, { useState } from 'react';
import { FileJson, CheckCircle, AlertTriangle, RefreshCw, Database, Info, ShieldAlert, Wifi, Upload, ShieldCheck, Lock, ExternalLink, Copy, Code } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Client, Folder, Order } from '../types';

interface DataManagementProps {
  onImportSuccess: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onImportSuccess }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [report, setReport] = useState<{ clients: number, folders: number, orders: number, orphaned: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<{loading: boolean, success?: boolean, message?: string} | null>(null);
  const [importProgress, setImportProgress] = useState<string>('');

  const sqlSetupCode = `-- קוד להקמת טבלאות ב-Supabase SQL Editor
-- WARNING: The policies below are permissive (anonymous full access) for quick setup only.
-- Do not use these policies in production without proper auth/RLS restrictions.
CREATE TABLE clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, measurements JSONB DEFAULT '{}', notes TEXT, "createdAt" BIGINT NOT NULL);
CREATE TABLE folders (id TEXT PRIMARY KEY, name TEXT NOT NULL, "clientId" TEXT REFERENCES clients(id) ON DELETE CASCADE, "clientName" TEXT, "createdAt" BIGINT NOT NULL, deadline TEXT, status TEXT DEFAULT 'פעיל', "paidAmount" NUMERIC DEFAULT 0, "isPaid" BOOLEAN DEFAULT false, "isDelivered" BOOLEAN DEFAULT false, "isArchived" BOOLEAN DEFAULT false);
CREATE TABLE orders (id TEXT PRIMARY KEY, "displayId" TEXT, "folderId" TEXT REFERENCES folders(id) ON DELETE CASCADE, "clientId" TEXT REFERENCES clients(id) ON DELETE CASCADE, "clientName" TEXT, "itemType" TEXT, description TEXT, status TEXT DEFAULT 'חדש', deadline TEXT, price NUMERIC DEFAULT 0, deposit NUMERIC DEFAULT 0, "fabricNotes" TEXT, "createdAt" BIGINT NOT NULL, "updatedAt" BIGINT NOT NULL, "readyAt" BIGINT);
CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', kind TEXT NOT NULL DEFAULT 'general', status TEXT DEFAULT 'חדש', priority TEXT DEFAULT 'רגילה', "dueAt" BIGINT, "assigneeUserId" TEXT, "createdByUserId" TEXT NOT NULL, "clientId" TEXT, "folderId" TEXT, "orderId" TEXT, "orderSnapshot" JSONB, "folderChecklist" JSONB, "createdAt" BIGINT NOT NULL, "updatedAt" BIGINT NOT NULL, "completedAt" BIGINT, CONSTRAINT tasks_kind_check CHECK (kind IN ('general', 'order', 'folder')));
CREATE TABLE inventory (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, type TEXT, quantity NUMERIC DEFAULT 0, "unitPrice" NUMERIC DEFAULT 0, image TEXT);
CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, permissions JSONB DEFAULT '[]', "createdAt" BIGINT);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY; ALTER TABLE folders ENABLE ROW LEVEL SECURITY; ALTER TABLE orders ENABLE ROW LEVEL SECURITY; ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE inventory ENABLE ROW LEVEL SECURITY; ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full" ON folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_full" ON users FOR ALL USING (true) WITH CHECK (true);`;

  const tasksMigrationCode = `BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS "orderSnapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "folderChecklist" jsonb;

ALTER TABLE public.tasks
  ALTER COLUMN kind SET DEFAULT 'general';

UPDATE public.tasks
SET kind = CASE
  WHEN "orderId" IS NOT NULL THEN 'order'
  WHEN "folderId" IS NOT NULL THEN 'folder'
  ELSE 'general'
END
WHERE kind IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN kind SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_kind_check'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_kind_check
      CHECK (kind IN ('general', 'order', 'folder'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSetupCode);
    alert("קוד ה-SQL הועתק! הדביקי אותו ב-SQL Editor ב-Supabase.");
  };

  const copyTasksMigrationSql = () => {
    navigator.clipboard.writeText(tasksMigrationCode);
    alert("קוד מיגרציית tasks הועתק! הדביקי אותו ב-SQL Editor ב-Supabase.");
  };

  const checkCloud = async () => {
    setConnStatus({ loading: true });
    const res = await dataService.testConnection();
    setConnStatus({ loading: false, success: res.success, message: res.message });
  };

  const saveToCloudInChunks = async (table: string, items: any[]) => {
    const CHUNK_SIZE = 150;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      setImportProgress(`מסנכרן ${table} לענן: ${Math.min(i + CHUNK_SIZE, items.length)} מתוך ${items.length}...`);
      const chunk = items.slice(i, i + CHUNK_SIZE);
      await dataService.cloudUpsert(table, chunk);
    }
  };

  const processFile = async (file: File) => {
    setError(null);
    setReport(null);
    setIsImporting(true);
    setImportProgress('טוען קובץ...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        await processDjangoJson(JSON.parse(content));
      } catch (err: any) {
        console.error("Import error:", err);
        setError("שגיאה בעיבוד הקובץ. ודאי שמדובר בפורמט JSON תקין.");
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const processDjangoJson = async (djangoData: any[]) => {
    const clients: Client[] = [];
    const folders: Folder[] = [];
    const orders: Order[] = [];
    const FALLBACK_DATE = new Date('2024-06-01').getTime();

    djangoData.forEach((item: any) => {
      if (item.model === "repairs.customer") {
        clients.push({
          id: item.pk.toString(),
          name: item.fields.name || "לקוח ללא שם",
          phone: item.fields.phone || "",
          email: item.fields.email || "",
          measurements: {},
          notes: item.fields.address || "",
          createdAt: item.fields.created_at ? new Date(item.fields.created_at).getTime() : Date.now()
        });
      }
    });

    const clientMap = new Map(clients.map(c => [c.id, c]));

    djangoData.forEach((item: any) => {
      if (item.model === "repairs.sewingcase" || item.model === "repairs.folder") {
        const clientId = (item.fields.customer || item.fields.client || item.fields.customer_id)?.toString();
        const client = clientMap.get(clientId || "");
        
        // לוגיקה חכמה לבדיקת מצב ארכיון מהמקור
        const isOriginalArchived = item.fields.is_archived === true || 
                                    item.fields.archived === true || 
                                    item.fields.status === 'archived';

        folders.push({
          id: item.pk.toString(),
          name: item.fields.name || client?.name || "תיק ללא שם",
          clientId: clientId || "unknown",
          clientName: client?.name || "לקוח לא ידוע",
          createdAt: item.fields.creation_date ? new Date(item.fields.creation_date).getTime() : FALLBACK_DATE,
          deadline: item.fields.completion_date || 'ללא יעד', 
          status: 'סגור',
          paidAmount: 0,
          isPaid: true,
          isDelivered: true,
          isArchived: isOriginalArchived // שימוש בנתון המקורי מהקובץ
        });
      }
    });

    const folderMap = new Map(folders.map(f => [f.id, f]));
    let orphanedCount = 0;

    djangoData.forEach((item: any) => {
      if (item.model === "repairs.repair" || item.model === "repairs.item") {
        const folderId = (item.fields.sewing_case || item.fields.folder || item.fields.garment || item.fields.case_id)?.toString();
        const folder = folderMap.get(folderId || "");
        if (!folder) orphanedCount++;
        const price = parseFloat(item.fields.price) || 0;
        const timestamp = item.fields.repair_date ? new Date(item.fields.repair_date).getTime() : (folder?.createdAt || FALLBACK_DATE);
        orders.push({
          id: item.pk.toString(),
          displayId: item.fields.garment_id || item.pk.toString(),
          folderId: folderId || "orphaned",
          clientId: folder?.clientId || "unknown",
          clientName: folder?.clientName || "לא ידוע",
          itemType: item.fields.item_description || item.fields.name || "תיקון כללי",
          description: item.fields.repair_description || item.fields.notes || "",
          status: 'מוכן',
          deadline: folder?.deadline || 'ללא יעד',
          price: price,
          deposit: parseFloat(item.fields.deposit) || 0,
          fabricNotes: "",
          createdAt: timestamp,
          updatedAt: timestamp,
          readyAt: timestamp
        });
      }
    });

    const totalsByFolder = new Map<string, number>();
    orders.forEach((order) => {
      totalsByFolder.set(order.folderId, (totalsByFolder.get(order.folderId) || 0) + (order.price || 0));
    });

    const normalizedFolders = folders.map((folder) => ({
      ...folder,
      paidAmount: folder.isPaid ? (totalsByFolder.get(folder.id) || 0) : 0,
    }));

    await performSaves(clients, normalizedFolders, orders, orphanedCount);
  };

  const performSaves = async (clients: Client[], folders: Folder[], orders: Order[], orphaned: number) => {
    setImportProgress('מעדכן בסיס נתונים...');
    localStorage.setItem('stitchflow_clients', JSON.stringify(clients));
    localStorage.setItem('stitchflow_folders', JSON.stringify(folders));
    localStorage.setItem('stitchflow_orders', JSON.stringify(orders));

    if (dataService.isCloud()) {
      try {
        await saveToCloudInChunks('clients', clients);
        await saveToCloudInChunks('folders', folders);
        await saveToCloudInChunks('orders', orders);
      } catch (err: any) {
        console.error("Cloud error:", err);
        if (err.message.includes("cache")) {
          setError(`שגיאת טבלאות חסרות: הטבלאות לא קיימות בפרויקט Supabase החדש. השתמשי בכפתור למטה להעתקת קוד ההקמה.`);
        } else {
          setError(`שגיאה בסנכרון לענן: ${err.message}`);
        }
      }
    }
    setReport({ clients: clients.length, folders: folders.length, orders: orders.length, orphaned });
    onImportSuccess();
    setIsImporting(false);
    setImportProgress('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 text-right">
      {/* Cloud Diagnostics */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-rose-100">
        <div className="flex items-center justify-between mb-6">
           <button onClick={checkCloud} disabled={connStatus?.loading} className="flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-sm bg-[#6f2f54] text-white active:scale-95 transition-all shadow-lg">
             {connStatus?.loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Wifi className="w-4 h-4" />} בדיקת אבטחה וחיבור
           </button>
           <div className="text-right">
              <h3 className="text-xl font-black text-[#2B2B2B] font-heebo">אבחון ענן</h3>
              <p className="text-xs text-[#7A7A7A] font-bold">ודאי שהמערכת מוגנת מפני פריצות</p>
           </div>
        </div>
        
        {connStatus?.message && (
          <div className={`p-5 rounded-2xl flex items-center gap-3 font-bold text-sm ${connStatus.success ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
            {connStatus.success ? <ShieldCheck /> : <AlertTriangle className="animate-pulse" />}
            {connStatus.message}
          </div>
        )}

        {/* Security & Setup Section */}
        <div className="mt-8 pt-8 border-t border-gray-50 space-y-4">
           <h4 className="font-black text-[#2B2B2B] mb-2 flex items-center gap-2 justify-end">
              צעדים להקמת פרויקט חדש <Lock size={16} className="text-rose-500" />
           </h4>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={copySql}
                className="p-5 bg-[#fff1f8] border border-rose-200 rounded-2xl text-right hover:bg-white hover:border-rose-200 transition-all group flex justify-between items-center"
              >
                 <Copy className="text-gray-300 group-hover:text-rose-500 transition-colors" size={20} />
                 <div>
                    <p className="font-black text-xs mb-1">העתקת קוד הקמת טבלאות</p>
                    <p className="text-[10px] text-[#7A7A7A] font-bold">להדבקה ב-SQL Editor של Supabase</p>
                 </div>
              </button>

              <div className="p-5 bg-[#fff1f8] border border-rose-200 rounded-2xl">
                 <p className="font-black text-xs mb-1">עדכון מפתחות ב-Vercel</p>
                 <p className="text-[10px] text-[#7A7A7A] font-bold">ודאי שעדכנת את ה-URL וה-Anon Key בהגדרות ה-Environment Variables.</p>
              </div>

              <button 
                onClick={copyTasksMigrationSql}
                className="p-5 bg-amber-50 border border-amber-100 rounded-2xl text-right hover:bg-white hover:border-amber-300 transition-all group flex justify-between items-center md:col-span-2"
              >
                 <Code className="text-amber-400 group-hover:text-amber-600 transition-colors" size={20} />
                 <div>
                    <p className="font-black text-xs mb-1">העתקת מיגרציית tasks לפרויקט קיים</p>
                    <p className="text-[10px] text-[#7A7A7A] font-bold">לשדרוג טבלת tasks קיימת עם kind/orderSnapshot/folderChecklist.</p>
                 </div>
              </button>
           </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-rose-100">
        <div className="flex items-center gap-3 mb-6 justify-end">
           <div className="text-right">
              <h3 className="text-2xl font-black text-[#2B2B2B]">ייבוא היסטוריה (2024-2026)</h3>
              <p className="text-sm text-[#7A7A7A] font-bold">המערכת תשחזר את מצב הארכיון המקורי של כל תיק</p>
           </div>
           <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm">
              <Database size={24} />
           </div>
        </div>

        <label className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-rose-100 rounded-[2.5rem] hover:border-rose-200 hover:bg-rose-50/30 transition-all cursor-pointer group relative">
          {!isImporting ? (
            <>
              <div className="w-20 h-20 bg-[#fff3f9] rounded-[2rem] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                <Upload className="w-10 h-10 text-gray-300 group-hover:text-rose-500" />
              </div>
              <span className="font-black text-gray-700 text-lg">לחצי לבחירת קובץ JSON</span>
              <p className="text-xs text-[#7A7A7A] mt-2 font-bold">העלי שוב את הקובץ לסנכרון חכם</p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 text-rose-600 font-black">
              <RefreshCw className="animate-spin w-12 h-12 mb-2" />
              <p className="text-xl italic font-playfair">{importProgress}</p>
              <div className="w-48 h-2 bg-rose-100 rounded-full overflow-hidden mt-4">
                 <div className="h-full bg-rose-500 animate-[progress_2s_infinite_linear]"></div>
              </div>
            </div>
          )}
          <input type="file" className="hidden" accept=".json" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }} disabled={isImporting} />
        </label>

        {error && (
          <div className="mt-6 p-6 bg-rose-50 text-rose-600 rounded-[2rem] text-sm border border-rose-100 font-bold flex flex-col gap-4">
            <div className="flex items-center gap-3">
               <ShieldAlert className="shrink-0" />
               {error}
            </div>
            {error.includes("טבלאות") && (
              <button onClick={copySql} className="bg-white text-rose-600 px-6 py-2 rounded-xl text-xs font-black self-start hover:bg-rose-100 transition-colors flex items-center gap-2">
                 <Copy size={12} /> העתיקי קוד SQL עכשיו
              </button>
            )}
          </div>
        )}
        
        {report && (
          <div className="mt-6 p-8 bg-emerald-50 text-emerald-800 rounded-[2.5rem] border border-emerald-100 animate-in zoom-in">
             <div className="flex items-center justify-center gap-3 mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
                <h4 className="text-2xl font-black">הייבוא הושלם בהצלחה!</h4>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                   <p className="text-[10px] font-black text-emerald-600 mb-1">לקוחות</p>
                   <p className="text-2xl font-black">{report.clients}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                   <p className="text-[10px] font-black text-emerald-600 mb-1">תיקים</p>
                   <p className="text-2xl font-black">{report.folders}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                   <p className="text-[10px] font-black text-emerald-600 mb-1">תיקונים</p>
                   <p className="text-2xl font-black">{report.orders}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center text-rose-500">
                   <p className="text-[10px] font-black mb-1">יתומים</p>
                   <p className="text-2xl font-black">{report.orphaned}</p>
                </div>
             </div>
             <p className="text-sm font-bold text-center mt-6 text-emerald-700">המערכת זיהתה וסינכרנה את מצבי הארכיון המקוריים של כל תיק.</p>
          </div>
        )}
      </div>

      <div className="bg-[#6f2f54] p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
         <h4 className="text-xl font-black mb-4 flex items-center gap-2 justify-end">
            מידע חשוב <Info className="text-rose-500" />
         </h4>
         <p className="text-xs font-bold text-rose-100/90 leading-relaxed">
            הייבוא כעת מכבד את הסטטוס המקורי של התיקים. תיק שהיה בארכיון במערכת הישנה יישאר שם, ותיק שהיה פעיל יופיע ברשימת התיקים הפעילים שלך.
         </p>
      </div>
    </div>
  );
};

export default DataManagement;
