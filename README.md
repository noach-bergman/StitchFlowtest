# StitchFlow

StitchFlow is a tailoring studio management app.

## Label Printing

QR label printing is now browser-native only:
- `הדפס`: opens a regular browser print dialog from a dedicated print window.
- `שתף`: shares label image when supported (`navigator.share`), with clipboard-image fallback.

No NIIMBOT automation, bridge, cloud print queue, or QZ integration is used.

## Receipt Flow

Receipt generation remains available, including:
- `הדפס` (regular browser print window)
- `שתף תמונה` (native share / clipboard fallback)

## Environment Variables

```env
API_KEY=your_gemini_api_key
# GEMINI_API_KEY=your_gemini_api_key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional Vite aliases
# VITE_API_KEY=your_gemini_api_key
# VITE_GEMINI_API_KEY=your_gemini_api_key
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
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
