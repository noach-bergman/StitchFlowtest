
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, Order, Folder, Fabric, Task, User } from '../types';
import { normalizePaidAmount } from './paymentUtils';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const FALLBACK_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const FALLBACK_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || '216306233';

const supabase: SupabaseClient | null = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

const fetchAllFromTable = async (table: string): Promise<any[]> => {
  if (!supabase) return [];
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;
  try {
    while (hasMore) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + step - 1);
      if (error) throw error;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += step;
        if (data.length < step) hasMore = false;
      } else { hasMore = false; }
    }
  } catch (e: any) { console.error(e.message); throw e; }
  return allData;
};

const normalizeFolderForRead = (folder: any): Folder => {
  const paidAmount = normalizePaidAmount(folder as Folder);
  return {
    ...folder,
    paidAmount,
    isPaid: typeof folder?.isPaid === 'boolean' ? folder.isPaid : paidAmount > 0,
  };
};

const normalizeFolderForSave = (folder: Folder): Folder => {
  const paidAmount = normalizePaidAmount(folder);
  return {
    ...folder,
    paidAmount,
    isPaid: paidAmount > 0,
  };
};

export const dataService = {
  isCloud() { return !!supabase && SUPABASE_URL !== ''; },

  async login(username: string, password: string): Promise<User | null> {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single();
      if (!error && data) return data;
    }
    if (username === FALLBACK_ADMIN_USERNAME && password === FALLBACK_ADMIN_PASSWORD) {
      return { id: 'admin-static', username: FALLBACK_ADMIN_USERNAME, role: 'super_admin', permissions: ['all'] };
    }
    return null;
  },

  async getUsers(): Promise<User[]> {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*').order('username');
      if (!error) return data || [];
    }
    return [];
  },

  async saveUser(user: User): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('users').upsert(user, { onConflict: 'id' });
      if (error) throw error;
    }
  },

  async deleteUser(id: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    }
  },

  async testConnection(): Promise<{success: boolean, message: string}> {
    if (!supabase) return { success: false, message: "הגדרות ענן חסרות." };
    try {
      const { error } = await supabase.from('clients').select('id').limit(1);
      if (error) return { success: false, message: error.message };
      return { success: true, message: "חיבור ענן פעיל!" };
    } catch (err: any) { return { success: false, message: err.message }; }
  },

  async getClients(): Promise<Client[]> {
    if (this.isCloud()) { try { return await fetchAllFromTable('clients'); } catch (e) {} }
    const data = localStorage.getItem('stitchflow_clients');
    return data ? JSON.parse(data) : [];
  },

  async saveClients(clients: Client[]): Promise<void> {
    localStorage.setItem('stitchflow_clients', JSON.stringify(clients));
    if (supabase) {
      const { error } = await supabase.from('clients').upsert(clients, { onConflict: 'id' });
      if (error) throw error;
    }
  },

  async deleteClient(id: string): Promise<void> {
    if (supabase) {
      await supabase.from('orders').delete().eq('clientId', id);
      await supabase.from('folders').delete().eq('clientId', id);
      await supabase.from('clients').delete().eq('id', id);
    }
    const clients = JSON.parse(localStorage.getItem('stitchflow_clients') || '[]');
    localStorage.setItem('stitchflow_clients', JSON.stringify(clients.filter((c: any) => c.id !== id)));
  },

  async getFolders(): Promise<Folder[]> {
    if (this.isCloud()) {
      try {
        const folders = await fetchAllFromTable('folders');
        return (folders || []).map(normalizeFolderForRead);
      } catch (e) {}
    }
    const data = localStorage.getItem('stitchflow_folders');
    const parsed = data ? JSON.parse(data) : [];
    return (parsed || []).map(normalizeFolderForRead);
  },

  async saveFolders(folders: Folder[]): Promise<void> {
    const normalizedFolders = folders.map(normalizeFolderForSave);
    localStorage.setItem('stitchflow_folders', JSON.stringify(normalizedFolders));
    if (supabase) {
      const { error } = await supabase.from('folders').upsert(normalizedFolders, { onConflict: 'id' });
      if (error) throw error;
    }
  },

  async deleteFolder(id: string): Promise<void> {
    if (supabase) {
      await supabase.from('orders').delete().eq('folderId', id);
      await supabase.from('folders').delete().eq('id', id);
    }
    const folders = JSON.parse(localStorage.getItem('stitchflow_folders') || '[]');
    localStorage.setItem('stitchflow_folders', JSON.stringify(folders.filter((f: any) => f.id !== id)));
  },

  async getOrders(): Promise<Order[]> {
    if (this.isCloud()) { try { return await fetchAllFromTable('orders'); } catch (e) {} }
    const data = localStorage.getItem('stitchflow_orders');
    return data ? JSON.parse(data) : [];
  },

  async saveOrders(orders: Order[]): Promise<void> {
    localStorage.setItem('stitchflow_orders', JSON.stringify(orders));
    if (supabase) {
      const { error } = await supabase.from('orders').upsert(orders, { onConflict: 'id' });
      if (error) throw error;
    }
  },

  async deleteOrder(id: string): Promise<void> {
    if (supabase) await supabase.from('orders').delete().eq('id', id);
    const orders = JSON.parse(localStorage.getItem('stitchflow_orders') || '[]');
    localStorage.setItem('stitchflow_orders', JSON.stringify(orders.filter((o: any) => o.id !== id)));
  },

  async getTasks(): Promise<Task[]> {
    if (this.isCloud()) { try { return await fetchAllFromTable('tasks'); } catch (e) {} }
    const data = localStorage.getItem('stitchflow_tasks');
    return data ? JSON.parse(data) : [];
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    localStorage.setItem('stitchflow_tasks', JSON.stringify(tasks));
    if (supabase) {
      const { error } = await supabase.from('tasks').upsert(tasks, { onConflict: 'id' });
      if (error) throw error;
    }
  },

  async deleteTask(id: string): Promise<void> {
    if (supabase) await supabase.from('tasks').delete().eq('id', id);
    const tasks = JSON.parse(localStorage.getItem('stitchflow_tasks') || '[]');
    localStorage.setItem('stitchflow_tasks', JSON.stringify(tasks.filter((task: any) => task.id !== id)));
  },

  async mergeClients(sourceId: string, targetId: string, mergedClient: Client): Promise<void> {
    // 1. Update in Cloud if connected
    if (supabase) {
      // Update ALL orders for this client
      const { error: orderErr } = await supabase.from('orders').update({ clientId: targetId, clientName: mergedClient.name }).eq('clientId', sourceId);
      if (orderErr) console.error("Merge error (orders):", orderErr);

      // Update ALL folders for this client
      const { error: folderErr } = await supabase.from('folders').update({ clientId: targetId, clientName: mergedClient.name }).eq('clientId', sourceId);
      if (folderErr) console.error("Merge error (folders):", folderErr);

      // Update the target client profile
      const { error: clientUpsertErr } = await supabase.from('clients').upsert(mergedClient, { onConflict: 'id' });
      if (clientUpsertErr) console.error("Merge error (upsert):", clientUpsertErr);

      // Delete the duplicate source client
      const { error: deleteErr } = await supabase.from('clients').delete().eq('id', sourceId);
      if (deleteErr) console.error("Merge error (delete):", deleteErr);
    }
    
    // 2. Update LocalStorage (always do this as backup or primary)
    const clients = JSON.parse(localStorage.getItem('stitchflow_clients') || '[]');
    const folders = JSON.parse(localStorage.getItem('stitchflow_folders') || '[]');
    const orders = JSON.parse(localStorage.getItem('stitchflow_orders') || '[]');

    const updatedClients = clients.filter((c: any) => c.id !== sourceId).map((c: any) => c.id === targetId ? mergedClient : c);
    const updatedFolders = folders.map((f: any) => f.clientId === sourceId ? { ...f, clientId: targetId, clientName: mergedClient.name } : f);
    const updatedOrders = orders.map((o: any) => o.clientId === sourceId ? { ...o, clientId: targetId, clientName: mergedClient.name } : o);

    localStorage.setItem('stitchflow_clients', JSON.stringify(updatedClients));
    localStorage.setItem('stitchflow_folders', JSON.stringify(updatedFolders));
    localStorage.setItem('stitchflow_orders', JSON.stringify(updatedOrders));
  },

  async cloudUpsert(table: string, data: any[]): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from(table).upsert(data, { onConflict: 'id' });
      if (error) throw error;
    }
  },

  async getInventory(): Promise<Fabric[]> {
    if (supabase) {
      const { data, error } = await supabase.from('inventory').select('*');
      if (!error) return data || [];
    }
    const data = localStorage.getItem('stitchflow_inventory');
    return data ? JSON.parse(data) : [];
  },

  async saveInventory(inventory: Fabric[]): Promise<void> {
    localStorage.setItem('stitchflow_inventory', JSON.stringify(inventory));
    if (supabase) {
      const { error } = await supabase.from('inventory').upsert(inventory, { onConflict: 'id' });
      if (error) throw error;
    }
  }
};
