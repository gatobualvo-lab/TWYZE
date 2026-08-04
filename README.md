# Trackwyze

Track Smart. Profit Wise.

Trackwyze ships as both a web app and a native Windows desktop app. Both builds share the same React/Vite codebase, Supabase backend, auth flow, and UI — nothing was redesigned for desktop.

## Requirements

- Node.js 18+
- npm 9+
- Windows 10/11 when producing the `.exe` installer
- A `.env` file (copy `.env.example`) with:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Only `VITE_*` variables are bundled into the desktop app. Service-role keys and other admin secrets are **never** shipped — they live only in Supabase Edge Functions and server environments.

## Install

```bash
npm install
```

## Web app (unchanged)

```bash
npm run dev      # dev server
npm run build    # production web build -> dist/
npm run preview
```

## Desktop app (Windows)

### Run the desktop app in development

Starts Vite and Electron together; hot reload works:

```bash
npm run electron:dev
```

### Build the production desktop bundle (no installer)

```bash
npm run electron:build:dir
```

Output: `release/win-unpacked/Trackwyze.exe` (runnable, not installable).

### Build the Windows installer (.exe)

```bash
npm run electron:build
```

Artifacts land in the `release/` folder:

- **Installer:** `release/Trackwyze-Setup-1.0.0-x64.exe` (NSIS, per-user, lets the user pick install directory, creates Start Menu + Desktop shortcuts)
- **Portable:** `release/Trackwyze-1.0.0-x64.exe` (single-file portable)
- **Unpacked:** `release/win-unpacked/Trackwyze.exe`

Version the installer filename follows the `version` field in `package.json`.

## App icon

Replace `electron/icons/icon.png` with a square PNG (512x512 recommended). electron-builder will convert it to a Windows `.ico` automatically during packaging.

## How routing, auth, and Supabase work in the desktop build

- The production renderer is served via `electron-serve` under the `app://` protocol, so React Router's `BrowserRouter` keeps working — no code had to change.
- Authentication uses the same `@supabase/supabase-js` client reading `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` that the web app uses.
- Supabase sessions persist inside Electron's Chromium storage, so logging in once keeps the user signed in across restarts.
- `nodeIntegration` is off and `contextIsolation` is on. A tiny preload exposes only `window.trackwyze.isDesktop` and platform info — no Node APIs reach the renderer.
- External links open in the user's default browser.

## Scripts reference

| Script | Purpose |
| --- | --- |
| `npm run dev` | Web dev server |
| `npm run build` | Web production build |
| `npm run electron:dev` | Desktop app in dev mode |
| `npm run electron:build:dir` | Desktop production build, unpacked |
| `npm run electron:build` | Desktop production build + Windows installer |

## Environment variables

Put them in `.env` (loaded by Vite at build time). Everything the desktop app needs is pulled at build time from the `VITE_*` keys. Do not add secrets prefixed with `VITE_` — those become visible in the bundle.
