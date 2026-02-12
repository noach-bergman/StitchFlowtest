<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1RyVHGe8xvyedBfH8VY0qrqtJt_ccPoVy

## Run Locally

**Prerequisites:** Node.js (recommended LTS 20+)

1. Install dependencies:
   `npm install`
2. Configure environment variables in `.env.local` (copy from `.env.example`):
   - `API_KEY` (or `GEMINI_API_KEY`) for Gemini
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` for cloud mode (optional)
   - QZ Tray bridge (optional):
     - `VITE_QZ_USE_BRIDGE=true`
     - `VITE_QZ_PRINTER_NAME=<exact printer name>`
     - `VITE_QZ_TRAY_WS_URL=ws://localhost:8182` (optional)
     - Signed mode:
       - `VITE_QZ_CERT_URL=http://127.0.0.1:9123/qz/cert`
       - `VITE_QZ_SIGN_URL=http://127.0.0.1:9123/qz/sign`
       - `VITE_QZ_SIGN_ALGORITHM=SHA512`
   - BLE printing (recommended for NIIMBOT B1):
     - `VITE_PRINT_PROVIDER=auto` (`BLE -> QZ -> Browser`)
     - `VITE_BLE_AGENT_URL=http://127.0.0.1:9131`
     - `VITE_BLE_AGENT_TOKEN=<same token used by NIIMBOT_BLE_AGENT_TOKEN>`
3. (Optional, signed mode) create local QZ certificate/key:
   `mkdir -p qz && openssl req -x509 -newkey rsa:2048 -keyout qz/private-key.pem -out qz/certificate.pem -sha512 -days 3650 -nodes -subj "/CN=localhost/O=StitchFlow/OU=Local QZ Signer"`
4. Start local QZ signer (optional but recommended for QZ fallback):
   `npm run qz:signer`
5. Start BLE agent:
   `NIIMBOT_BLE_AGENT_TOKEN=<same token> npm run niimbot:ble-agent`
6. First-time pairing (once):
   `NIIMBOT_BLE_AGENT_TOKEN=<same token> npm run niimbot:ble-pair`
7. In another terminal, run app:
   `npm run dev`

## Build and Preview (Production-like)

1. Build:
   `npm run build`
2. Preview:
   `npm run preview`

## NIIMBOT BLE Agent (macOS, B1)

Direct BLE printing (without opening NIIMBOT desktop app).

### Endpoints

- `GET /health` (requires `Authorization: Bearer <token>`)
- `POST /pair` (requires bearer token)
- `POST /print-label` (requires bearer token)

`/print-label` request body:

```json
{
  "labelId": "order-id",
  "displayId": "1234",
  "clientName": "Client Name",
  "itemType": "Dress",
  "widthMm": 50,
  "heightMm": 30,
  "copies": 1
}
```

Standard response body:

```json
{
  "ok": true,
  "code": "PRINT_SENT",
  "message": "Label sent via BLE printer.",
  "jobId": "..."
}
```

Possible `code` values:
- `PRINT_SENT`
- `PAIR_REQUIRED`
- `DEVICE_NOT_FOUND`
- `BLE_UNAVAILABLE`
- `PRINT_FAILED`

### Pairing cache

Pairing metadata is stored at:
`~/.stitchflow/niimbot-ble.json`

### macOS permissions

Allow Bluetooth access for the terminal/runtime app running the BLE agent.

If Bluetooth is disabled/unavailable, API returns `BLE_UNAVAILABLE`.

### Start on login (launchd example)

Use `scripts/com.stitchflow.niimbot-ble-agent.plist.example` as template and adjust:
- Node path
- Repository path
- Token and port

Then load with `launchctl` as your user agent.

## Legacy app automation agent (optional)

The previous NIIMBOT app automation flow is still available via:
- `npm run niimbot:agent`

Use only if you intentionally want app-based printing.
