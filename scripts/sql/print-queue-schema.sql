-- Print queue schema for server-side Zebra GX430t printing.
-- Apply in Supabase SQL editor with a service-role account.

create extension if not exists pgcrypto;

create table if not exists public.printers (
  id text primary key,
  name text not null,
  public_host text not null,
  public_port integer not null check (public_port between 1 and 65535),
  protocol text not null default 'raw9100',
  enabled boolean not null default true,
  allowed_sources text[] not null default array['web']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text not null,
  source text not null,
  order_id text,
  printer_id text not null references public.printers(id),
  zpl text not null,
  status text not null check (status in ('queued', 'sending', 'printed', 'failed')) default 'queued',
  attempts integer not null default 0,
  last_error text,
  dispatched_at timestamptz,
  printed_at timestamptz,
  next_attempt_at timestamptz,
  idempotency_key text not null unique
);

create index if not exists print_jobs_status_idx on public.print_jobs(status);
create index if not exists print_jobs_retry_idx on public.print_jobs(status, next_attempt_at, created_at);
create index if not exists print_jobs_created_idx on public.print_jobs(created_at desc);
create index if not exists print_jobs_printer_idx on public.print_jobs(printer_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists printers_set_updated_at on public.printers;
create trigger printers_set_updated_at
before update on public.printers
for each row
execute function public.set_updated_at();

-- Optional seed printer (adjust host/port before use).
insert into public.printers (id, name, public_host, public_port, protocol, enabled, allowed_sources)
values ('default-zebra', 'Zebra GX430t', 'example.your-public-host.com', 49100, 'raw9100', false, array['web'])
on conflict (id) do nothing;
