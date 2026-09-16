# XINGS KITCHEN - Production Windows Thermal Print Bridge Setup & Administration Guide
**Version**: 1.0.0  
**Publisher**: Webrajya  
**Target OS**: Windows 10 / 11 (64-bit), macOS 10.15+, Linux  

---

## 1. Executive Summary & Architecture

The **XINGS KITCHEN Print Bridge** (`xings-kitchen-print-bridge`) is a standalone background application and Windows service wrapper that enables **one-click silent customer bill printing** directly to 80mm and 58mm thermal printers from the Web POS without requiring Chrome Print Preview or Windows print dialogs.

```
Windows Startup / Boot
        ↓
XINGS KITCHEN Print Bridge Auto-Start (127.0.0.1:9100)
        ↓
Web POS Checkout / One-Click Print Bill
        ↓
POST http://127.0.0.1:9100/print (Payload Validation & Idempotency Check)
        ↓
Windows Printer System Spooler
        ↓
Selected Thermal Printer (80mm / 58mm)
```

> [!SECURITY GUARANTEE]
> - Binds **strictly to `127.0.0.1`** (loopback interface).
> - Restricted CORS: Accepts requests only from localhost or configured application origins.
> - Zero arbitrary shell command execution; zero arbitrary file access exposed to the browser.
> - Zero QZ Tray dependencies.

---

## 2. One-Time Windows Installation Guide (For Restaurant Staff)

**Installer Location**: `releases/XINGS-KITCHEN-Print-Bridge-Setup.exe`

### Installation Steps
1. Download or copy `XINGS-KITCHEN-Print-Bridge-Setup.exe` to the restaurant POS PC.
2. Double-click `XINGS-KINGS-Print-Bridge-Setup.exe` to launch setup.
3. Choose installation directory (Default: `%LocalAppData%\XingsKitchenPrintBridge`).
4. Click **Install**.
5. The installer automatically:
   - Installs executable files and Node runtime.
   - Registers Windows Startup Auto-Start entry (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
   - Registers Windows Control Panel Uninstaller.
   - Starts the print bridge service automatically on port `9100`.

> [!NOTE]
> Restaurant staff do **NOT** need to install Node.js, npm, Bun, Git, or Python. Everything is bundled inside the installer executable.

---

## 3. Daily POS Operation Workflow

```
Windows Starts
    ↓
Print Bridge automatically starts in background
    ↓
Open XINGS KITCHEN Web POS
    ↓
POS Print Station status displays: ● Connected
    ↓
Staff clicks "PRINT BILL" or completes POS checkout
    ↓
Bill prints silently directly on thermal printer
```

---

## 4. API Specification & Health Monitoring

### Health Endpoint (`GET /health`)
```bash
curl http://127.0.0.1:9100/health
```
**Response**:
```json
{
  "ok": true,
  "status": "ok",
  "service": "XINGS KITCHEN Print Bridge",
  "version": "1.0.0",
  "port": 9100,
  "host": "127.0.0.1",
  "platform": "win32",
  "timestamp": "2026-09-16T18:48:00.000Z"
}
```

### Printer Discovery Endpoint (`GET /printers`)
```bash
curl http://127.0.0.1:9100/printers
```
**Response**:
```json
{
  "printers": [
    { "name": "POS-80", "status": "available" },
    { "name": "EPSON TM-T82", "status": "available" }
  ]
}
```

### Submit Silent Print Job (`POST /print`)
```bash
curl -X POST http://127.0.0.1:9100/print \
  -H "Content-Type: application/json" \
  -d '{
    "printJobId": "POS-BILL-10023",
    "printerName": "EPSON TM-T82",
    "paperWidth": "80mm",
    "jobType": "CUSTOMER_BILL",
    "orderId": "XK-10023",
    "receiptText": "XINGS KITCHEN\n------------------\nMemo#: #10023..."
  }'
```

---

## 5. Thermal Receipt Formatting (80mm vs 58mm)

- **80mm Standard Format**: Printable width 42 characters per line. Includes Header, Memo#, Date/Time, Order Type, Table#, Item Qty/Name/Price, Subtotal, Tax, Discount, Grand Total, Payment Info, and Footer.
- **58mm Compact Format**: Printable width 32 characters per line. Compact typography and item truncation to prevent awkward wrapping on narrow paper rolls.

---

## 6. Duplicate Print Protection & Idempotency

- Every print job carries a unique identifier: `POS-BILL-{orderId}`.
- If a print job with the exact same ID is submitted again within 60 seconds (due to React re-renders, component mounting, or accidental double-clicking), the server detects it and prevents duplicate physical bills from printing.
- For intentional reprints from order management, the print client generates a unique reprint key: `POS-BILL-{orderId}-REPRINT-001`.

---

## 7. Troubleshooting & Log Inspection

- **Logs Location**: `%UserProfile%\.xings-kitchen-print-bridge\print-history.log`
- **Log Rotation**: Logs automatically rotate to `print-history.old.log` when file size exceeds 5MB.
- **Port Conflict**: Set environment variable `PRINT_BRIDGE_PORT=9105` before launching if port 9100 is occupied by another application.

---

## 8. Uninstallation Guide

To uninstall the Print Bridge from Windows:
1. Open **Windows Settings** → **Apps** → **Installed Apps** (or Control Panel → Programs and Features).
2. Locate **XINGS KITCHEN Print Bridge v1.0.0**.
3. Click **Uninstall**.
4. The uninstaller removes application files and cleans up Windows Startup registry entries without removing printer drivers or unrelated files.

---

## 9. Branding Confirmation

All thermal bills silently output:
- **Header**: `XINGS KITCHEN`
- **Footer**: `Powered by Webrajya`
