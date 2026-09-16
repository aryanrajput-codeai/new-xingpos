import express from "express";
import cors from "cors";
import { exec, execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const app = express();
const PORT = process.env.PRINT_BRIDGE_PORT || 9100;
const HOST = "127.0.0.1";
const VERSION = "1.0.0";
const SERVICE_NAME = "XINGS KITCHEN Print Bridge";

// Idempotency cache: track printed job IDs to prevent duplicate physical printing
const printedJobsMap = new Map();

// Allowed CORS origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  process.env.PRINT_BRIDGE_ALLOWED_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, curl) or allowed web origins
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      callback(null, true);
    } else {
      callback(new Error(`CORS origin not allowed: ${origin}`));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "2mb" }));

// Print audit logger with 5MB log rotation
function logPrintJob(orderId, printerName, paperWidth, jobType, success, details = "") {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] JOB: ${orderId} | PRINTER: "${printerName}" | WIDTH: ${paperWidth} | TYPE: ${jobType} | RESULT: ${success ? "SUCCESS" : "FAILED"} | ${details}\n`;
  console.log(logLine.trim());
  
  try {
    const logDir = path.join(os.homedir(), ".xings-kitchen-print-bridge");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, "print-history.log");
    
    // Check log file size for rotation (5MB = 5 * 1024 * 1024 bytes)
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > 5 * 1024 * 1024) {
        const backupFile = path.join(logDir, "print-history.old.log");
        if (fs.existsSync(backupFile)) {
          fs.unlinkSync(backupFile);
        }
        fs.renameSync(logFile, backupFile);
      }
    }

    fs.appendFileSync(logFile, logLine);
  } catch (err) {
    // Non-blocking log failure
  }
}

// 1. Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "ok",
    service: SERVICE_NAME,
    version: VERSION,
    port: PORT,
    host: HOST,
    platform: os.platform(),
    timestamp: new Date().toISOString()
  });
});

// 2. Discover available local OS printers
app.get("/printers", async (req, res) => {
  try {
    const isWin = os.platform() === "win32";
    const printers = [];

    if (isWin) {
      // Windows printer query via PowerShell
      try {
        const { stdout } = await execAsync(
          'powershell -NoProfile -Command "Get-Printer | Select-Object Name, PrinterStatus | ConvertTo-Json"',
          { timeout: 5000 }
        );
        const parsed = JSON.parse(stdout || "[]");
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (item && item.Name) {
            printers.push({
              name: item.Name,
              status: item.PrinterStatus === 3 || item.PrinterStatus === "Normal" ? "available" : "unknown"
            });
          }
        }
      } catch (winErr) {
        // Fallback wmic query if PowerShell fails
        try {
          const { stdout } = await execAsync('wmic printer get Name', { timeout: 5000 });
          const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          for (let i = 1; i < lines.length; i++) {
            if (lines[i]) {
              printers.push({ name: lines[i], status: "available" });
            }
          }
        } catch (_) {}
      }
    } else {
      // macOS / Linux printer query via lpstat
      try {
        const { stdout } = await execAsync("lpstat -p", { timeout: 5000 });
        const lines = stdout.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const match = line.match(/^printer\s+([^\s]+)\s+(is|enabled)/i);
          if (match && match[1]) {
            printers.push({
              name: match[1].replace(/_/g, " "),
              status: line.includes("idle") ? "available" : "unknown"
            });
          }
        }
      } catch (unixErr) {
        try {
          const { stdout } = await execAsync("lpstat -a", { timeout: 5000 });
          const lines = stdout.split(/\r?\n/).filter(Boolean);
          for (const line of lines) {
            const parts = line.split(" ");
            if (parts[0]) {
              printers.push({ name: parts[0].replace(/_/g, " "), status: "available" });
            }
          }
        } catch (_) {}
      }
    }

    res.json({ printers });
  } catch (err) {
    console.error("Error discovering printers:", err);
    res.status(500).json({ error: "Failed to discover local printers", details: err.message });
  }
});

// 3. Submit Silent Thermal Print Job
app.post("/print", async (req, res) => {
  const { printerName, paperWidth, jobType, orderId, printJobId, receiptText } = req.body || {};

  const jobId = printJobId || orderId || `POS-BILL-${Date.now()}`;

  // Input Payload Validation
  if (!printerName || typeof printerName !== "string" || printerName.trim() === "") {
    return res.status(400).json({ success: false, printJobId: jobId, error: "Missing or invalid printerName" });
  }
  if (!receiptText || typeof receiptText !== "string") {
    return res.status(400).json({ success: false, printJobId: jobId, error: "Missing or invalid receiptText" });
  }
  if (paperWidth && paperWidth !== "80mm" && paperWidth !== "58mm") {
    return res.status(400).json({ success: false, printJobId: jobId, error: "Invalid paperWidth. Must be '80mm' or '58mm'" });
  }
  if (jobType && jobType !== "CUSTOMER_BILL" && jobType !== "TEST_PRINT") {
    return res.status(400).json({ success: false, printJobId: jobId, error: "Invalid jobType. Allowed for silent printing: CUSTOMER_BILL, TEST_PRINT" });
  }

  // Idempotency check: Guard against duplicate print requests within 60s
  const now = Date.now();
  const lastPrinted = printedJobsMap.get(jobId);
  if (lastPrinted && now - lastPrinted < 60000 && !jobId.includes("-REPRINT-")) {
    console.warn(`[Server] Duplicate print job blocked for jobId: ${jobId}`);
    return res.json({
      success: true,
      printJobId: jobId,
      message: "Job already submitted previously (idempotency protection)"
    });
  }

  const safeOrderId = String(jobId).replace(/[^a-zA-Z0-9_-]/g, "");
  const safePaperWidth = paperWidth === "58mm" ? "58mm" : "80mm";
  const safeJobType = jobType || "CUSTOMER_BILL";

  // Temporary file path for print queue
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `xings_print_${safeOrderId}_${Date.now()}.txt`);

  try {
    // Write receipt text to temp file safely
    fs.writeFileSync(tempFilePath, receiptText, "utf-8");

    const isWin = os.platform() === "win32";
    
    if (isWin) {
      // Windows raw print execution via PowerShell Out-Printer
      const psCommand = `Get-Content -Raw -Path '${tempFilePath.replace(/'/g, "''")}' | Out-Printer -Name '${printerName.replace(/'/g, "''")}'`;
      await execAsync(`powershell -NoProfile -Command "${psCommand}"`, { timeout: 10000 });
    } else {
      // macOS / Linux raw print execution via lp -d "PrinterName"
      const unixPrinterName = printerName.replace(/ /g, "_");
      await execFileAsync("lp", ["-d", unixPrinterName, tempFilePath], { timeout: 10000 });
    }

    // Mark job as printed
    printedJobsMap.set(jobId, now);

    logPrintJob(safeOrderId, printerName, safePaperWidth, safeJobType, true);

    // Clean up temp file
    try { fs.unlinkSync(tempFilePath); } catch (_) {}

    return res.json({
      success: true,
      printJobId: safeOrderId,
      message: "Print job submitted successfully to local printer queue"
    });
  } catch (err) {
    console.error("Print job execution failed:", err);
    logPrintJob(safeOrderId, printerName, safePaperWidth, safeJobType, false, err.message);

    // Clean up temp file
    try { fs.unlinkSync(tempFilePath); } catch (_) {}

    return res.status(500).json({
      success: false,
      printJobId: safeOrderId,
      error: `Failed to print to "${printerName}": ${err.message}`
    });
  }
});

// Bind server strictly to 127.0.0.1 (Loopback only)
app.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`  ${SERVICE_NAME} v${VERSION}                       `);
  console.log(`  Bound strictly to: http://${HOST}:${PORT}            `);
  console.log(`  Allowed Origins: ${allowedOrigins.join(", ")}        `);
  console.log(`=======================================================`);
});
