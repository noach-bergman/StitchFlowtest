import { createSupabaseAdminClientFromEnv } from './printQueueStore.js';

const PRINTER_SELECT = 'id,name,public_host,public_port,protocol,enabled,allowed_sources,created_at,updated_at';
const APP_SETTING_SELECT = 'key,value,updated_at';

const toMessage = (error) => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const mapPrinter = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    publicHost: row.public_host,
    publicPort: row.public_port,
    protocol: row.protocol,
    enabled: Boolean(row.enabled),
    allowedSources: Array.isArray(row.allowed_sources) ? row.allowed_sources : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export class SupabasePrintersStore {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required for SupabasePrintersStore');
    }
    this.supabase = supabaseClient;
  }

  static fromEnv() {
    const client = createSupabaseAdminClientFromEnv();
    if (!client) {
      throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY fallback).');
    }
    return new SupabasePrintersStore(client);
  }

  async listPrinters() {
    const { data, error } = await this.supabase
      .from('printers')
      .select(PRINTER_SELECT)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to list printers: ${toMessage(error)}`);
    return (data || []).map(mapPrinter);
  }

  async getPrinter(printerId) {
    const { data, error } = await this.supabase
      .from('printers')
      .select(PRINTER_SELECT)
      .eq('id', printerId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load printer: ${toMessage(error)}`);
    return mapPrinter(data);
  }

  async upsertPrinter(printer) {
    const payload = {
      id: printer.id,
      name: printer.name,
      public_host: printer.publicHost,
      public_port: printer.publicPort,
      protocol: printer.protocol,
      enabled: printer.enabled,
      allowed_sources: printer.allowedSources,
    };

    const { data, error } = await this.supabase
      .from('printers')
      .upsert(payload, { onConflict: 'id' })
      .select(PRINTER_SELECT)
      .maybeSingle();

    if (error) throw new Error(`Failed to upsert printer: ${toMessage(error)}`);
    return mapPrinter(data);
  }

  async updatePrinter(printerId, fields) {
    const payload = {};
    if (fields.name !== undefined) payload.name = fields.name;
    if (fields.publicHost !== undefined) payload.public_host = fields.publicHost;
    if (fields.publicPort !== undefined) payload.public_port = fields.publicPort;
    if (fields.protocol !== undefined) payload.protocol = fields.protocol;
    if (fields.enabled !== undefined) payload.enabled = fields.enabled;
    if (fields.allowedSources !== undefined) payload.allowed_sources = fields.allowedSources;

    const { data, error } = await this.supabase
      .from('printers')
      .update(payload)
      .eq('id', printerId)
      .select(PRINTER_SELECT)
      .maybeSingle();

    if (error) throw new Error(`Failed to update printer: ${toMessage(error)}`);
    return mapPrinter(data);
  }

  async getDefaultPrinterId() {
    const { data, error } = await this.supabase
      .from('app_settings')
      .select(APP_SETTING_SELECT)
      .eq('key', 'default_printer_id')
      .maybeSingle();

    if (error) throw new Error(`Failed to load default printer id: ${toMessage(error)}`);
    const value = data?.value;
    if (typeof value !== 'string' || !value.trim()) return null;
    return value.trim();
  }

  async setDefaultPrinterId(printerId) {
    const { error } = await this.supabase
      .from('app_settings')
      .upsert({
        key: 'default_printer_id',
        value: printerId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) throw new Error(`Failed to set default printer: ${toMessage(error)}`);
  }
}

export class InMemoryPrintersStore {
  constructor() {
    this.printers = new Map();
    this.defaultPrinterId = null;
  }

  async listPrinters() {
    return Array.from(this.printers.values());
  }

  async getPrinter(printerId) {
    return this.printers.get(printerId) || null;
  }

  async upsertPrinter(printer) {
    const next = {
      ...printer,
      createdAt: printer.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.printers.set(next.id, next);
    return next;
  }

  async updatePrinter(printerId, fields) {
    const existing = this.printers.get(printerId);
    if (!existing) return null;
    const next = {
      ...existing,
      ...fields,
      updatedAt: new Date().toISOString(),
    };
    this.printers.set(printerId, next);
    return next;
  }

  async getDefaultPrinterId() {
    return this.defaultPrinterId;
  }

  async setDefaultPrinterId(printerId) {
    this.defaultPrinterId = printerId;
  }
}
