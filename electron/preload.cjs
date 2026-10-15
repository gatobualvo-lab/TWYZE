const { contextBridge, ipcRenderer } = require('electron');

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
  // Direct printing: prints a trusted HTML document, optionally without the
  // dialog and to a named printer. See ipcMain handlers in main.cjs.
  printHtml: (html, options) => ipcRenderer.invoke('trackwyze:print-html', html, options),
  listPrinters: () => ipcRenderer.invoke('trackwyze:list-printers'),
});
