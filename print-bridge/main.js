import { app, Tray, Menu, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import "./server.js"; // Import and start the Express Print Bridge Server on 127.0.0.1:9100

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray = null;

// Configure auto-start at Windows login
function configureAutoStart() {
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
      path: process.execPath,
      args: ["--hidden"]
    });
  } catch (err) {
    console.error("Auto-start configuration warning:", err.message);
  }
}

app.whenReady().then(() => {
  configureAutoStart();

  // Create System Tray Icon for quiet background status
  try {
    const iconPath = path.join(__dirname, "icon.png");
    tray = new Tray(iconPath);
  } catch (_) {
    // If icon file is missing, tray operates quietly
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: "XINGS KITCHEN Print Bridge v1.0.0", enabled: false },
    { label: "Status: Connected (127.0.0.1:9100)", enabled: false },
    { type: "separator" },
    { 
      label: "About XINGS KITCHEN Print Bridge", 
      click: () => {
        dialog.showMessageBox({
          type: "info",
          title: "XINGS KITCHEN Print Bridge",
          message: "XINGS KITCHEN Print Bridge v1.0.0\nPowered by Webrajya\n\nStatus: Active & Listening on 127.0.0.1:9100\nSilent Thermal Bill Printing Engine for 80mm / 58mm Printers."
        });
      }
    },
    { type: "separator" },
    { label: "Exit Print Bridge", click: () => app.quit() }
  ]);

  if (tray) {
    tray.setToolTip("XINGS KITCHEN Print Bridge v1.0.0 (127.0.0.1:9100)");
    tray.setContextMenu(contextMenu);
  }

  console.log("XINGS KITCHEN Print Bridge Background Application Initialized.");
});

// Prevent app exit when all windows are closed (runs as background tray service)
app.on("window-all-closed", (e) => {
  e.preventDefault();
});
