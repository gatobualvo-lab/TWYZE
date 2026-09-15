const { app, BrowserWindow, shell, Menu } = require('electron');
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
