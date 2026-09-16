const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

// Handle getting list of installed OS printers
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers;
  } catch (err) {
    console.error('[Electron Main] Error getting OS printers:', err);
    return [];
  }
});

// Handle silent thermal printing via native webContents.print
ipcMain.handle('silent-print', async (event, options = {}) => {
  const { htmlContent, deviceName, copies = 1, paperWidth = '80mm' } = options;

  return new Promise((resolve) => {
    try {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const widthPx = paperWidth === '58mm' ? '210px' : '290px';
      const wrappedHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { margin: 0; size: auto; }
              body {
                margin: 0;
                padding: 0;
                width: ${widthPx};
                font-family: 'Courier New', Courier, monospace;
                background: #ffffff;
                color: #000000;
                -webkit-print-color-adjust: exact;
              }
              * { box-sizing: border-box; }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `;

      printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(wrappedHtml));

      printWin.webContents.on('did-finish-load', () => {
        const printOptions = {
          silent: true,
          deviceName: deviceName || '',
          copies: copies || 1,
          printBackground: true,
          margins: { marginType: 'none' }
        };

        printWin.webContents.print(printOptions, (success, failureReason) => {
          try {
            printWin.close();
          } catch (_) {}

          if (success) {
            resolve({ success: true });
          } else {
            console.warn('[Electron Silent Print] Printing failed:', failureReason);
            resolve({ success: false, error: failureReason || 'Silent print failed in OS printing subsystem' });
          }
        });
      });
    } catch (err) {
      console.error('[Electron Silent Print] Exception:', err);
      resolve({ success: false, error: err.message || 'Error executing silent print' });
    }
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'XINGS KITCHEN',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const startUrl = process.env.ELECTRON_START_URL;

  if (startUrl) {
    mainWindow.loadURL(startUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // On macOS, auto-start embedded Local Print Bridge for silent thermal printing
  if (process.platform === 'darwin') {
    try {
      const { startServer } = require('../mac-print-bridge/server.cjs');
      startServer();
    } catch (err) {
      console.warn('[Electron Main] Embedded macOS Print Bridge notice:', err.message);
    }
  }

  createWindow();

  // Non-blocking auto-updater check
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater] New update available:', info.version);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Update downloaded:', info.version);
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AutoUpdater] Check notice (non-blocking):', err.message);
    });

    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('[AutoUpdater] Update check notice:', err.message);
      });
    }, 5000);
  } catch (err) {
    console.warn('[AutoUpdater] Module notice:', err.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

