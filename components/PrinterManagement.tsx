import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Edit2, Plus, Power, Printer, RefreshCw, Star, X } from 'lucide-react';
import { PrintJobStatus, Printer as PrinterType } from '../types';
import {
  createPrinter,
  listPrinters,
  sendPrinterTest,
  setDefaultPrinter,
  updatePrinter,
  waitForPrinterTestCompletion,
} from '../services/printersService';

type FormState = {
  id: string;
  name: string;
  publicHost: string;
  publicPort: string;
  allowedSources: string;
  enabled: boolean;
};

type TestState = {
  loading?: boolean;
  jobId?: string;
  status?: PrintJobStatus;
  error?: string;
};

const newFormState = (): FormState => ({
  id: '',
  name: '',
  publicHost: '',
  publicPort: '49100',
  allowedSources: 'web',
  enabled: true,
});

const statusLabel = (status?: PrintJobStatus) => {
  if (!status) return '';
  if (status === 'queued') return 'בתור';
  if (status === 'sending') return 'נשלח';
  if (status === 'printed') return 'הודפס';
  return 'נכשל';
};

const PrinterManagement: React.FC = () => {
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [defaultPrinterId, setDefaultPrinterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(newFormState());

  const [testStates, setTestStates] = useState<Record<string, TestState>>({});

  const loadPrinters = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await listPrinters();
      setPrinters(data.printers || []);
      setDefaultPrinterId(data.defaultPrinterId || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בטעינת מדפסות';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  const openCreateModal = () => {
    setEditingPrinterId(null);
    setForm(newFormState());
    setIsModalOpen(true);
  };

  const openEditModal = (printer: PrinterType) => {
    setEditingPrinterId(printer.id);
    setForm({
      id: printer.id,
      name: printer.name,
      publicHost: printer.publicHost,
      publicPort: String(printer.publicPort),
      allowedSources: (printer.allowedSources || []).join(', '),
      enabled: printer.enabled,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingPrinterId(null);
    setForm(newFormState());
  };

  const parseAllowedSources = (value: string) =>
    Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => !!item)
      )
    );

  const submitModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        id: form.id.trim(),
        name: form.name.trim(),
        publicHost: form.publicHost.trim(),
        publicPort: Number(form.publicPort),
        protocol: 'raw9100' as const,
        enabled: form.enabled,
        allowedSources: parseAllowedSources(form.allowedSources),
      };

      if (editingPrinterId) {
        await updatePrinter(editingPrinterId, {
          name: payload.name,
          publicHost: payload.publicHost,
          publicPort: payload.publicPort,
          protocol: payload.protocol,
          enabled: payload.enabled,
          allowedSources: payload.allowedSources,
        });
      } else {
        await createPrinter(payload);
      }

      closeModal();
      await loadPrinters();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בשמירת מדפסת';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEnabled = async (printer: PrinterType) => {
    setError('');
    try {
      await updatePrinter(printer.id, { enabled: !printer.enabled });
      await loadPrinters();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בעדכון מצב מדפסת';
      setError(message);
    }
  };

  const handleSetDefault = async (printer: PrinterType) => {
    setError('');
    try {
      const result = await setDefaultPrinter(printer.id);
      setDefaultPrinterId(result.defaultPrinterId);
      await loadPrinters();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בהגדרת ברירת מחדל';
      setError(message);
    }
  };

  const handleTestPrint = async (printer: PrinterType) => {
    setTestStates((prev) => ({
      ...prev,
      [printer.id]: { loading: true, error: '', status: 'queued' },
    }));

    try {
      const started = await sendPrinterTest(printer.id);
      setTestStates((prev) => ({
        ...prev,
        [printer.id]: { ...prev[printer.id], loading: true, jobId: started.jobId, status: started.status, error: '' },
      }));

      const completed = await waitForPrinterTestCompletion(started.jobId);
      setTestStates((prev) => ({
        ...prev,
        [printer.id]: {
          ...prev[printer.id],
          loading: false,
          status: completed.status,
          error: completed.status === 'failed' ? completed.lastError || 'בדיקת הדפסה נכשלה' : '',
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בבדיקת הדפסה';
      setTestStates((prev) => ({
        ...prev,
        [printer.id]: { ...prev[printer.id], loading: false, status: 'failed', error: message },
      }));
    }
  };

  return (
    <div className="space-y-6 pb-24 text-right">
      <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm flex items-center justify-between">
        <button
          onClick={openCreateModal}
          className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center gap-2"
        >
          <Plus size={16} /> מדפסת חדשה
        </button>
        <div>
          <h2 className="text-2xl font-black text-gray-800">ניהול מדפסות</h2>
          <p className="text-xs font-bold text-gray-400">הגדרת מדפסות Zebra וברירת מחדל גלובלית</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-4 border border-gray-100 shadow-sm flex items-center justify-between">
        <button
          onClick={loadPrinters}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-black text-xs flex items-center gap-2 active:scale-95 transition-all disabled:opacity-60"
        >
          {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          רענון
        </button>
        <p className="text-xs font-black text-slate-500">
          ברירת מחדל: {defaultPrinterId || 'לא הוגדרה'}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-black flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {printers.map((printer) => {
          const test = testStates[printer.id] || {};
          const isDefault = defaultPrinterId === printer.id;

          return (
            <div key={printer.id} className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(printer)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                    title="עריכה"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleToggleEnabled(printer)}
                    className={`p-2 rounded-xl border transition-all ${printer.enabled ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-amber-200 text-amber-600 hover:bg-amber-50'}`}
                    title={printer.enabled ? 'השבתה' : 'הפעלה'}
                  >
                    <Power size={16} />
                  </button>
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isDefault && <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black">ברירת מחדל</span>}
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${printer.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {printer.enabled ? 'פעילה' : 'מושבתת'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-gray-800 mt-2">{printer.name}</h3>
                  <p className="text-xs text-gray-400 font-bold">{printer.id}</p>
                </div>
              </div>

              <div className="text-xs font-bold text-gray-600 space-y-1">
                <p><span className="text-gray-400">Host:</span> {printer.publicHost}</p>
                <p><span className="text-gray-400">Port:</span> {printer.publicPort}</p>
                <p><span className="text-gray-400">Sources:</span> {(printer.allowedSources || []).join(', ') || 'web'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSetDefault(printer)}
                  disabled={!printer.enabled || isDefault}
                  className="py-2 rounded-xl bg-indigo-50 text-indigo-600 font-black text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Star size={14} /> ברירת מחדל
                </button>
                <button
                  onClick={() => handleTestPrint(printer)}
                  disabled={!printer.enabled || test.loading}
                  className="py-2 rounded-xl bg-slate-900 text-white font-black text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {test.loading ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={14} />} Test Print
                </button>
              </div>

              {(test.jobId || test.status || test.error) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  {test.jobId && <p className="font-bold text-slate-500">Job: {test.jobId}</p>}
                  {test.status && (
                    <p className={`font-black flex items-center gap-1 ${test.status === 'printed' ? 'text-emerald-600' : test.status === 'failed' ? 'text-rose-600' : 'text-slate-700'}`}>
                      {test.status === 'printed' ? <CheckCircle2 size={12} /> : <RefreshCw size={12} className={test.loading ? 'animate-spin' : ''} />}
                      סטטוס: {statusLabel(test.status)}
                    </p>
                  )}
                  {test.error && <p className="font-black text-rose-600">{test.error}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {printers.length === 0 && !isLoading && (
        <div className="bg-white rounded-[2rem] p-12 border border-dashed border-gray-200 text-center text-gray-400 font-black">
          אין מדפסות. אפשר להוסיף מדפסת חדשה.
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-white/10 transition-all">
                <X size={20} />
              </button>
              <h3 className="text-xl font-black">{editingPrinterId ? 'עריכת מדפסת' : 'מדפסת חדשה'}</h3>
            </div>

            <form onSubmit={submitModal} className="p-6 space-y-4 text-right">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-gray-400 uppercase">Printer ID</label>
                <input
                  value={form.id}
                  onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                  disabled={!!editingPrinterId}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50"
                  placeholder="default-zebra"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-gray-400 uppercase">שם מדפסת</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-rose-200"
                  placeholder="Zebra GX430t - Front Desk"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-gray-400 uppercase">Host</label>
                  <input
                    value={form.publicHost}
                    onChange={(e) => setForm((prev) => ({ ...prev, publicHost: e.target.value }))}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-rose-200"
                    placeholder="printer.example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-gray-400 uppercase">Port</label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={form.publicPort}
                    onChange={(e) => setForm((prev) => ({ ...prev, publicPort: e.target.value }))}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-rose-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-gray-400 uppercase">Sources</label>
                <input
                  value={form.allowedSources}
                  onChange={(e) => setForm((prev) => ({ ...prev, allowedSources: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-rose-200"
                  placeholder="web"
                />
              </div>

              <label className="flex items-center justify-end gap-2 text-sm font-black text-slate-700">
                <span>פעילה</span>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4"
                />
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-black"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-black disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : null}
                  {editingPrinterId ? 'שמור שינויים' : 'צור מדפסת'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrinterManagement;
