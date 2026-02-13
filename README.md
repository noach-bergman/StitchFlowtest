# StitchFlow

StitchFlow is a tailoring studio management app.

## Label Printing (Server-Side Zebra)

QR label printing supports a cloud print queue for Zebra GX430t using raw ZPL over TCP (`9100`).

### Flow

1. User clicks `הדפס` from the QR label modal.
2. Frontend calls `POST /api/print-jobs` with `printerId`, `orderId`, `label`, `idempotencyKey`.
3. API validates signature + rate limit, generates ZPL, and stores a queued job in Supabase.
4. Worker polls every 2s, claims queued jobs, and sends ZPL to printer `public_host:public_port`.
5. Frontend polls `GET /api/print-jobs/:jobId` until `printed` or `failed`.

## Security Notes

- `POST /api/print-jobs` and `GET /api/print-jobs/:jobId` require request signature headers:
  - `x-print-ts`
  - `x-print-signature` (HMAC-SHA256 over `${timestamp}.${rawBody}`)
- API includes in-memory rate limiting per client IP.
- Use router/firewall allowlist so the forwarded printer port accepts traffic only from worker egress IP.
- `VITE_PRINT_API_SHARED_SECRET` is embedded in frontend bundles if used. For strict security, sign requests from a trusted backend instead of browser.

## Database Setup

Run SQL from:

- `scripts/sql/print-queue-schema.sql`

This creates:

- `printers`
- `print_jobs`

Seeded printer ID: `default-zebra` (disabled by default; update host/port and enable after setup).

## Worker

Run the print worker:

```bash
npm run print:worker
```

Worker behavior:

- Poll interval: `PRINT_WORKER_POLL_INTERVAL_MS` (default `2000`)
- Retry backoff: `2s, 5s, 15s, 30s, 60s`
- Max attempts: `5`
- Alert log when failed jobs exceed threshold in a 10-minute window

## Receipt Flow

Receipt generation remains browser-based:

- `הדפס` (regular browser print window)
- `שתף תמונה` (native share / clipboard fallback)

## Environment Variables

```env
API_KEY=your_gemini_api_key
# GEMINI_API_KEY=your_gemini_api_key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

PRINT_API_SHARED_SECRET=replace_with_strong_random_secret
PRINT_WORKER_POLL_INTERVAL_MS=2000
PRINT_SOCKET_TIMEOUT_MS=7000
PRINT_FAILED_ALERT_THRESHOLD=10
PRINT_FAILED_ALERT_WINDOW_MINUTES=10

# Frontend print config
# VITE_PRINT_API_BASE_URL=https://your-app-domain.com
VITE_PRINT_SOURCE=web
VITE_PRINT_DEFAULT_PRINTER_ID=default-zebra
VITE_PRINT_API_SHARED_SECRET=replace_with_same_shared_secret_if_needed
# VITE_PRINT_STATUS_POLL_MS=2000
# VITE_PRINT_STATUS_MAX_ATTEMPTS=30
```

## Local Development

1. Install dependencies:
`npm install`

2. Start app:
`npm run dev`

3. Run worker (separate terminal):
`npm run print:worker`

4. Run quality checks:
- `npm run typecheck`
- `npm run build`
- `npm run test`
