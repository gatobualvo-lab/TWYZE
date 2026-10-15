const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;
const DEV_URL = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';

let loadURL;
if (!isDev) {
  const serve = require('electron-serve');
  // Serves built files via app:// so react-router BrowserRouter keeps working.
  loadURL = serve({ directory: path.join(__dirname, '..', 'dist') });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Trackwyze',
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    const allowed = isDev
      ? target.origin === new URL(DEV_URL).origin
      : target.protocol === 'app:';
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    // window.open('', '_blank') (print/PDF preview: a blank window the
    // renderer fills via document.write()) arrives here with an empty URL —
    // Electron normalizes it to 'about:blank'. Denying it and shelling out
    // to the OS browser goes nowhere useful, since there's no URL to open;
    // it just silently no-ops. Let those become a real Electron child
    // window instead. Genuine links (WhatsApp share, etc.) keep going to
    // the OS browser as before.
    if (url === 'about:blank' || url === '') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await loadURL(win);
  }
}

// --- Direct printing -------------------------------------------------------
// Only the app's own pages may use these (not any page that happens to load
// in a window). The HTML is printed from a hidden window with JavaScript
// disabled, so even unexpected markup can't run code.
function assertTrustedSender(event) {
  const url = (event.senderFrame && event.senderFrame.url) || '';
  const ok = isDev ? url.startsWith(new URL(DEV_URL).origin) : url.startsWith('app://');
  if (!ok) throw new Error('Untrusted sender');
}

ipcMain.handle('trackwyze:list-printers', async (event) => {
  assertTrustedSender(event);
  const printers = await event.sender.getPrintersAsync();
  return printers.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault }));
});

ipcMain.handle('trackwyze:print-html', async (event, html, options) => {
  assertTrustedSender(event);
  if (typeof html !== 'string' || html.length === 0 || html.length > 5000000) {
    return { success: false, reason: 'invalid document' };
  }
  const silent = !!(options && options.silent);
  const deviceName = options && typeof options.deviceName === 'string' ? options.deviceName : '';
  const win = new BrowserWindow({
    show: false,
    webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return await new Promise((resolve) => {
      win.webContents.print({ silent, printBackground: true, deviceName }, (success, reason) => {
        resolve({ success, reason: success ? undefined : reason });
      });
    });
  } catch (err) {
    return { success: false, reason: err && err.message ? err.message : 'print failed' };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.trackwyze.app');
  }
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
