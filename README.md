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
   - Optional one-click USB label printing via QZ Tray:
     - `VITE_QZ_USE_BRIDGE=true`
     - `VITE_QZ_PRINTER_NAME=<exact printer name>`
     - `VITE_QZ_TRAY_WS_URL=ws://localhost:8182` (optional)
     - Signed mode (recommended to reduce recurring QZ prompts):
       - `VITE_QZ_CERT_URL=http://127.0.0.1:9123/qz/cert`
       - `VITE_QZ_SIGN_URL=http://127.0.0.1:9123/qz/sign`
       - `VITE_QZ_SIGN_ALGORITHM=SHA512`
   - Optional Local NIIMBOT Agent (macOS stage 1):
     - `VITE_PRINT_PROVIDER=auto` (tries `QZ -> Agent -> Browser`)
     - `VITE_LOCAL_AGENT_URL=http://127.0.0.1:9130`
     - `VITE_LOCAL_AGENT_TOKEN=<same token used by NIIMBOT_AGENT_TOKEN>`
3. (Optional, signed mode) create local signing certificate/key:
   `mkdir -p qz && openssl req -x509 -newkey rsa:2048 -keyout qz/private-key.pem -out qz/certificate.pem -sha512 -days 3650 -nodes -subj "/CN=localhost/O=StitchFlow/OU=Local QZ Signer"`
4. Start the local QZ signer:
   `npm run qz:signer`
5. (Optional for NIIMBOT app automation on macOS) Start Local Agent:
   `NIIMBOT_AGENT_TOKEN=<same token> npm run niimbot:agent`
6. In a second (or third) terminal, run the app:
   `npm run dev`

## Build and Preview (Production-like)

1. Build:
   `npm run build`
2. Preview:
   `npm run preview`

## NIIMBOT Local Agent (macOS)

This is for printers that are not exposed as native macOS printer drivers but can print via the vendor app.

### Endpoints

- `GET /health` (requires `Authorization: Bearer <token>`)
- `POST /print-label` (requires bearer token)

Request body:

```json
{
  "dataUrl": "data:image/png;base64,...",
  "widthMm": 50,
  "heightMm": 30,
  "copies": 1,
  "jobName": "StitchFlow #1234",
  "labelId": "order-id"
}
```

Response body:

```json
{
  "ok": true,
  "code": "PRINT_SENT",
  "message": "Print command sent via NIIMBOT app.",
  "jobId": "..."
}
```

Possible `code` values:
- `PRINT_SENT`
- `APP_NOT_FOUND`
- `AUTOMATION_DENIED`
- `PRINT_FAILED`

### macOS permissions required

The local agent uses AppleScript and System Events. You must allow:
- Accessibility permission for Terminal (or whichever app runs the agent)
- Automation permission to control `System Events` / `NIIMBOT`

If permissions are blocked, API returns `AUTOMATION_DENIED`.

### NIIMBOT automation sequence

The default script (`scripts/niimbot-print.applescript`) performs:
1. `Cmd+N` (new label)
2. `Cmd+O` then `Cmd+Shift+G` and inject generated PNG path
3. `Cmd+P` + `Enter`

If your NIIMBOT build uses different shortcuts/UI flow, duplicate and adjust the script, then run agent with:
`NIIMBOT_PRINT_SCRIPT=/absolute/path/to/custom.applescript`

### Start on login (launchd example)

Use `scripts/com.stitchflow.niimbot-agent.plist.example` as a template and adjust:
- Node path
- Repository path
- Token and port

Then load with `launchctl` as your user agent.
