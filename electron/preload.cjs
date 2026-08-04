const { contextBridge } = require('electron');

// Expose a minimal, safe API to the renderer. Supabase runs over HTTPS
// and does not need Node; we keep nodeIntegration off intentionally.
contextBridge.exposeInMainWorld('trackwyze', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    app: process.env.npm_package_version || null,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});
