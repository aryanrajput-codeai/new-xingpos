const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

// Helper to identify physical USB-connected printers from OS metadata
function isUsbPrinter(printer) {
  if (!printer) return false;

  const options = printer.options || {};

  // macOS (CUPS) device-uri check
  const deviceUri = String(
    options['device-uri'] ||
    options['device_uri'] ||
    printer.deviceUri ||
    ''
  ).toLowerCase();

  if (deviceUri.startsWith('usb://') || deviceUri.startsWith('usb:')) {
    return true;
  }

  // Windows PortName / port check
  const portName = String(
    options['PortName'] ||
    options['portName'] ||
    options['Port'] ||
    options['port'] ||
    printer.portName ||
    ''
  ).toUpperCase();

  if (portName.startsWith('USB') || portName.includes('USB00') || portName.startsWith('DOT4')) {
    return true;
  }

  // General port / URI fallback on printer object
  const directPort = String(printer.portName || printer.port || '').toUpperCase();
  if (directPort.startsWith('USB') || directPort.includes('USB00') || directPort.startsWith('DOT4')) {
    return true;
  }

  return false;
}

// Helper to deduplicate logical printer entries sharing the exact same physical USB device URI / serial
function deduplicateUsbPrinters(printers) {
  const seen = new Set();
  const result = [];

  for (const p of printers) {
    const options = p.options || {};
    // Key by hardware device-uri or portName or name
    const deviceKey = String(
      options['device-uri'] ||
      options['device_uri'] ||
      options['PortName'] ||
      options['portName'] ||
      p.name
    ).toLowerCase();

    if (!seen.has(deviceKey)) {
      seen.add(deviceKey);
      result.push(p);
    }
  }

  return result;
}

// Handle getting list of USB-connected physical printers
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    
    // Filter to USB printers only based on OS metadata (device-uri / PortName)
    const usbPrinters = printers.filter(isUsbPrinter);

    // Deduplicate logical entries pointing to the same physical USB device
    const deduplicated = deduplicateUsbPrinters(usbPrinters);

    return deduplicated;
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
      if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
        console.warn('[Electron Silent Print] Aborted: htmlContent is empty');
        return resolve({ success: false, error: 'Empty receipt content provided for printing' });
      }

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

      printWin.webContents.on('did-finish-load', async () => {
        try {
          // Verify body contains rendered DOM content
          const bodyLen = await printWin.webContents.executeJavaScript('document.body.innerHTML.length');
          if (!bodyLen || bodyLen < 20) {
            console.warn('[Electron Silent Print] Document body is empty or too short:', bodyLen);
            try { printWin.close(); } catch (_) {}
            return resolve({ success: false, error: 'Receipt DOM document rendered empty' });
          }

          // Short 100ms layout frame delay to guarantee Chromium layout paint before printing
          setTimeout(() => {
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
          }, 100);
        } catch (evalErr) {
          console.error('[Electron Silent Print] Error verifying print DOM:', evalErr);
          try { printWin.close(); } catch (_) {}
          resolve({ success: false, error: 'Error inspecting print window DOM' });
        }
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

  // Diagnostic event logging for Electron renderer lifecycle
  mainWindow.webContents.on('did-start-loading', () => {
    console.log(`[Electron Renderer Diagnostic] EVENT: did-start-loading | URL: ${mainWindow.webContents.getURL()}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`[Electron Renderer Diagnostic] EVENT: did-finish-load | URL: ${mainWindow.webContents.getURL()}`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.warn(`[Electron Renderer Diagnostic] EVENT: did-fail-load | Code: ${errorCode} | Desc: ${errorDescription} | URL: ${validatedURL}`);
    if (errorCode === -6 || errorCode === -105 || errorCode === -102) {
      const startUrl = process.env.ELECTRON_START_URL;
      if (startUrl) {
        mainWindow.loadURL(startUrl);
      } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      }
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`[Electron Renderer Diagnostic] CRASH EVENT: render-process-gone | Reason: ${details.reason} | ExitCode: ${details.exitCode}`);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn(`[Electron Renderer Diagnostic] WARNING: Renderer unresponsive | URL: ${mainWindow.webContents.getURL()}`);
  });

  mainWindow.webContents.on('responsive', () => {
    console.log(`[Electron Renderer Diagnostic] EVENT: Renderer responsive again | URL: ${mainWindow.webContents.getURL()}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for Software Updater
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const { autoUpdater } = require('electron-updater');

    const feedConfig = {
      provider: 'github',
      owner: 'aryanrajput-codeai',
      repo: 'new-xingpos',
      private: true
    };
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (token) {
      feedConfig.token = token;
    }
    autoUpdater.setFeedURL(feedConfig);

    console.log('[Electron Main] Starting update check...');
    console.log(`[Electron Main] App Version: v${app.getVersion()}, Provider: ${feedConfig.provider}, Owner: ${feedConfig.owner}, Repo: ${feedConfig.repo}`);

    const result = await autoUpdater.checkForUpdates();
    console.log('[Electron Main] Update check result:', result?.updateInfo?.version || 'No update info (Up to date)');
    return { success: true, versionInfo: result?.updateInfo };
  } catch (err) {
    const errCode = err ? (err.code || err.statusCode || err.status || '') : '';
    const errStr = err ? (err.message || String(err)) : '';
    console.warn(`[Electron Main] Update check notice (${errCode}):`, errStr);

    // If channel file missing on release or 404 returned when current app version is latest (v1.1.1),
    // treat app as up to date cleanly.
    if (errCode === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' || errCode === 404 || errStr.includes('404')) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-state-changed', {
          status: 'UP_TO_DATE',
          version: app.getVersion()
        });
      }
      return { success: true, versionInfo: { version: app.getVersion() } };
    }

    return { success: false, error: errStr };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    const { autoUpdater } = require('electron-updater');
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    console.error('[Electron Main] downloadUpdate error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('quit-and-install', () => {
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (err) {
    console.error('[Electron Main] quitAndInstall error:', err);
    return { success: false, error: err.message };
  }
});

function setupAutoUpdater() {
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = console;

    const feedConfig = {
      provider: 'github',
      owner: 'aryanrajput-codeai',
      repo: 'new-xingpos',
      private: true
    };
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (token) {
      feedConfig.token = token;
    }
    autoUpdater.setFeedURL(feedConfig);

    console.log(`[AutoUpdater Setup] App Version: v${app.getVersion()}, Provider: ${feedConfig.provider}, Owner: ${feedConfig.owner}, Repo: ${feedConfig.repo}`);

    const sendToWindow = (channel, ...args) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, ...args);
      }
    };

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater Event] Status: CHECKING');
      sendToWindow('update-state-changed', { status: 'CHECKING' });
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater Event] Status: AVAILABLE, New Version:', info.version);
      sendToWindow('update-state-changed', {
        status: 'AVAILABLE',
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[AutoUpdater Event] Status: UP_TO_DATE, Current Version:', info?.version || app.getVersion());
      sendToWindow('update-state-changed', {
        status: 'UP_TO_DATE',
        version: info?.version || app.getVersion()
      });
    });

    autoUpdater.on('error', (err) => {
      const errCode = err ? (err.code || err.statusCode || err.status || '') : '';
      const errorMsg = err ? (err.message || String(err)) : 'Unable to check for updates.';
      console.warn(`[AutoUpdater Event] Error notice (${errCode}):`, errorMsg);

      if (errCode === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' || errCode === 404 || errorMsg.includes('404')) {
        sendToWindow('update-state-changed', {
          status: 'UP_TO_DATE',
          version: app.getVersion()
        });
      } else {
        sendToWindow('update-state-changed', {
          status: 'ERROR',
          error: errorMsg
        });
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      sendToWindow('update-progress', {
        percent: Math.round(progressObj.percent || 0),
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0,
        bytesPerSecond: progressObj.bytesPerSecond || 0
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      sendToWindow('update-state-changed', {
        status: 'DOWNLOADED',
        version: info.version
      });
    });

    // Single background update check 15 seconds after app startup
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[AutoUpdater] Initial background check notice:', err.message);
      });
    }, 15000);
  } catch (err) {
    console.warn('[AutoUpdater] Setup notice:', err.message);
  }
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
  setupAutoUpdater();

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

