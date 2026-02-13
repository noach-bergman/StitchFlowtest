# StitchFlow

StitchFlow is a tailoring studio management app.

## Label Printing (Local Network Only)

QR label printing uses regular browser print (`window.print`) from the device itself.

### Flow

1. User clicks `הדפס` from the QR label modal.
2. The app opens the native print dialog on that device.
3. User selects the locally configured Zebra printer and confirms print.

Printing is available only when the device is on the same home network as the printer.
Recommended local printer setup:

- Printer IP: `192.168.12.46`
- Port: `9100`

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
```

## Local Development

1. Install dependencies:
`npm install`

2. Start app:
`npm run dev`

3. Run quality checks:
- `npm run typecheck`
- `npm run build`
- `npm run test`
