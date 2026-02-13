import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { MAX_PRINT_ATTEMPTS, getRetryDelayMs } from './printWorkerConfig.js';

const PRINT_JOB_SELECT = 'id,created_at,created_by,source,order_id,printer_id,zpl,status,attempts,last_error,dispatched_at,printed_at,next_attempt_at,idempotency_key';
const PRINTER_SELECT = 'id,name,public_host,public_port,protocol,enabled,allowed_sources';
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

const mapPrintJob = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    source: row.source,
    orderId: row.order_id ?? null,
    printerId: row.printer_id,
    zpl: row.zpl,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error ?? null,
    dispatchedAt: row.dispatched_at ?? null,
    printedAt: row.printed_at ?? null,
    nextAttemptAt: row.next_attempt_at ?? null,
    idempotencyKey: row.idempotency_key,
  };
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
  };
};

const nowIso = () => new Date().toISOString();

export const createSupabaseAdminClientFromEnv = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const key = serviceKey || anonKey;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-print-service': 'stitchflow-print-queue',
      },
    },
  });
};

export class SupabasePrintQueueStore {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required for SupabasePrintQueueStore');
    }
    this.supabase = supabaseClient;
  }

  static fromEnv() {
    const client = createSupabaseAdminClientFromEnv();
    if (!client) {
      throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY fallback).');
    }
    return new SupabasePrintQueueStore(client);
  }

  async getJobById(id) {
    const { data, error } = await this.supabase
      .from('print_jobs')
      .select(PRINT_JOB_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load print job: ${toMessage(error)}`);
    return mapPrintJob(data);
  }

  async getJobByIdempotencyKey(idempotencyKey) {
    const { data, error } = await this.supabase
      .from('print_jobs')
      .select(PRINT_JOB_SELECT)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) throw new Error(`Failed to load print job by idempotency key: ${toMessage(error)}`);
    return mapPrintJob(data);
  }

  async enqueueJob({ createdBy, source, orderId, printerId, zpl, idempotencyKey }) {
    const existing = await this.getJobByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { job: existing, created: false };
    }

    const insertPayload = {
      id: randomUUID(),
      created_by: createdBy,
      source,
      order_id: orderId ?? null,
      printer_id: printerId,
      zpl,
      status: 'queued',
      attempts: 0,
      idempotency_key: idempotencyKey,
      next_attempt_at: null,
    };

    const { data, error } = await this.supabase
      .from('print_jobs')
      .insert(insertPayload)
      .select(PRINT_JOB_SELECT)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        const conflictJob = await this.getJobByIdempotencyKey(idempotencyKey);
        if (conflictJob) return { job: conflictJob, created: false };
      }
      throw new Error(`Failed to enqueue print job: ${toMessage(error)}`);
    }

    return { job: mapPrintJob(data), created: true };
  }

  async getPrinter(printerId) {
    const { data, error } = await this.supabase
      .from('printers')
      .select(PRINTER_SELECT)
      .eq('id', printerId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load printer config: ${toMessage(error)}`);
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

  async claimNextQueuedJob() {
    const nullRetryCandidate = await this.#findQueuedCandidateWithNullRetry();
    const candidate = nullRetryCandidate || (await this.#findQueuedCandidateByRetryTime());
    if (!candidate) return null;

    const dispatchTime = nowIso();
    const { data, error } = await this.supabase
      .from('print_jobs')
      .update({
        status: 'sending',
        dispatched_at: dispatchTime,
      })
      .eq('id', candidate.id)
      .eq('status', 'queued')
      .select(PRINT_JOB_SELECT);

    if (error) throw new Error(`Failed to claim print job: ${toMessage(error)}`);
    if (!data || data.length === 0) return null;
    return mapPrintJob(data[0]);
  }

  async #findQueuedCandidateWithNullRetry() {
    const { data, error } = await this.supabase
      .from('print_jobs')
      .select(PRINT_JOB_SELECT)
      .eq('status', 'queued')
      .is('next_attempt_at', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) throw new Error(`Failed to read queued print jobs: ${toMessage(error)}`);
    if (!data || data.length === 0) return null;
    return mapPrintJob(data[0]);
  }

  async #findQueuedCandidateByRetryTime() {
    const { data, error } = await this.supabase
      .from('print_jobs')
      .select(PRINT_JOB_SELECT)
      .eq('status', 'queued')
      .lte('next_attempt_at', nowIso())
      .order('next_attempt_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) throw new Error(`Failed to read retry-ready print jobs: ${toMessage(error)}`);
    if (!data || data.length === 0) return null;
    return mapPrintJob(data[0]);
  }

  async markPrinted(jobId) {
    const { error } = await this.supabase
      .from('print_jobs')
      .update({
        status: 'printed',
        printed_at: nowIso(),
        last_error: null,
        next_attempt_at: null,
      })
      .eq('id', jobId);

    if (error) throw new Error(`Failed to mark print job as printed: ${toMessage(error)}`);
  }

  async recordFailure(job, errorText) {
    const nextAttempts = (job.attempts || 0) + 1;
    const failureMessage = String(errorText || 'Print send failed').slice(0, 2000);

    if (nextAttempts >= MAX_PRINT_ATTEMPTS) {
      const { error } = await this.supabase
        .from('print_jobs')
        .update({
          status: 'failed',
          attempts: nextAttempts,
          last_error: failureMessage,
          next_attempt_at: null,
        })
        .eq('id', job.id);

      if (error) throw new Error(`Failed to mark print job as failed: ${toMessage(error)}`);
      return { status: 'failed', attempts: nextAttempts };
    }

    const retryAt = new Date(Date.now() + getRetryDelayMs(nextAttempts)).toISOString();

    const { error } = await this.supabase
      .from('print_jobs')
      .update({
        status: 'queued',
        attempts: nextAttempts,
        last_error: failureMessage,
        next_attempt_at: retryAt,
      })
      .eq('id', job.id);

    if (error) throw new Error(`Failed to schedule print retry: ${toMessage(error)}`);
    return { status: 'queued', attempts: nextAttempts, retryAt };
  }

  async getFailedCountSince(sinceIso) {
    const { count, error } = await this.supabase
      .from('print_jobs')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'failed')
      .gte('created_at', sinceIso);

    if (error) throw new Error(`Failed to count failed print jobs: ${toMessage(error)}`);
    return count || 0;
  }
}

export class InMemoryPrintQueueStore {
  constructor({ now = () => new Date() } = {}) {
    this.now = now;
    this.jobs = [];
    this.printers = new Map();
    this.defaultPrinterId = null;
  }

  setNow(nowFn) {
    this.now = nowFn;
  }

  addPrinter(printer) {
    const mapped = {
      id: printer.id,
      name: printer.name || printer.id,
      publicHost: printer.publicHost,
      publicPort: printer.publicPort,
      protocol: printer.protocol || 'raw9100',
      enabled: printer.enabled !== false,
      allowedSources: printer.allowedSources || ['web'],
    };
    this.printers.set(mapped.id, mapped);
    if (!this.defaultPrinterId && mapped.enabled) {
      this.defaultPrinterId = mapped.id;
    }
  }

  setDefaultPrinterId(printerId) {
    this.defaultPrinterId = printerId || null;
  }

  async getDefaultPrinterId() {
    return this.defaultPrinterId;
  }

  async getPrinter(printerId) {
    return this.printers.get(printerId) || null;
  }

  async getJobById(jobId) {
    const row = this.jobs.find((item) => item.id === jobId);
    return row ? { ...row } : null;
  }

  async getJobByIdempotencyKey(idempotencyKey) {
    const row = this.jobs.find((item) => item.idempotencyKey === idempotencyKey);
    return row ? { ...row } : null;
  }

  async enqueueJob({ createdBy, source, orderId, printerId, zpl, idempotencyKey }) {
    const existing = await this.getJobByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { job: existing, created: false };
    }

    const createdAt = this.now().toISOString();
    const job = {
      id: randomUUID(),
      createdAt,
      createdBy,
      source,
      orderId: orderId ?? null,
      printerId,
      zpl,
      status: 'queued',
      attempts: 0,
      lastError: null,
      dispatchedAt: null,
      printedAt: null,
      nextAttemptAt: null,
      idempotencyKey,
    };

    this.jobs.push(job);
    return { job: { ...job }, created: true };
  }

  async claimNextQueuedJob() {
    const nowMs = this.now().getTime();
    const candidate = this.jobs
      .filter((job) => job.status === 'queued' && (!job.nextAttemptAt || new Date(job.nextAttemptAt).getTime() <= nowMs))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

    if (!candidate) return null;

    candidate.status = 'sending';
    candidate.dispatchedAt = this.now().toISOString();
    return { ...candidate };
  }

  async markPrinted(jobId) {
    const target = this.jobs.find((job) => job.id === jobId);
    if (!target) throw new Error(`Print job not found: ${jobId}`);
    target.status = 'printed';
    target.printedAt = this.now().toISOString();
    target.lastError = null;
    target.nextAttemptAt = null;
  }

  async recordFailure(job, errorText) {
    const target = this.jobs.find((row) => row.id === job.id);
    if (!target) throw new Error(`Print job not found: ${job.id}`);

    const nextAttempts = (target.attempts || 0) + 1;
    target.attempts = nextAttempts;
    target.lastError = String(errorText || 'Print send failed');

    if (nextAttempts >= MAX_PRINT_ATTEMPTS) {
      target.status = 'failed';
      target.nextAttemptAt = null;
      return { status: 'failed', attempts: nextAttempts };
    }

    target.status = 'queued';
    target.nextAttemptAt = new Date(this.now().getTime() + getRetryDelayMs(nextAttempts)).toISOString();
    return { status: 'queued', attempts: nextAttempts, retryAt: target.nextAttemptAt };
  }

  async getFailedCountSince(sinceIso) {
    const sinceMs = new Date(sinceIso).getTime();
    return this.jobs.filter((job) => job.status === 'failed' && new Date(job.createdAt).getTime() >= sinceMs).length;
  }
}
