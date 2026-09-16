const http = require('http');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 9100;
const HOST = '127.0.0.1';

// Idempotency cache for duplicate job protection (60s retention)
const submittedJobs = new Map();

function cleanOldJobs() {
  const now = Date.now();
  for (const [jobId, time] of submittedJobs.entries()) {
    if (now - time > 60000) {
      submittedJobs.delete(jobId);
    }
  }
}
setInterval(cleanOldJobs, 30000);

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  // Endpoint: GET /health
  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'XINGS KITCHEN macOS Print Bridge',
      port: PORT,
      platform: process.platform,
      time: new Date().toISOString()
    }));
    return;
  }

  // Endpoint: GET /printers
  if (req.method === 'GET' && url.pathname === '/printers') {
    let printers = [];
    try {
      const stdout = execSync('lpstat -e', { encoding: 'utf8', timeout: 3000 });
      const printerNames = stdout.split('\n').map(s => s.trim()).filter(Boolean);
      printers = printerNames.map(name => ({ name, status: 'READY' }));
    } catch (err) {
      console.warn('[MacPrintBridge] lpstat failed or no printers:', err.message);
    }

    if (printers.length === 0) {
      printers.push({ name: 'Default System Printer', status: 'READY' });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, printers }));
    return;
  }

  // Endpoint: POST /print
  if (req.method === 'POST' && url.pathname === '/print') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { printerName, paperWidth, jobType, orderId, receiptText } = payload;

        if (!receiptText) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing receiptText in payload' }));
          return;
        }

        const uniqueJobType = (jobType || payload.type || 'PRINT').toLowerCase();
        const rawOrderId = orderId || `MAC-PRINT-${Date.now()}`;
        const jobId = payload.jobId || `${rawOrderId}-${uniqueJobType}`;
        const now = Date.now();

        // Idempotency check: guard against duplicate print jobs within 60s
        const lastSubmitted = submittedJobs.get(jobId);
        if (lastSubmitted && now - lastSubmitted < 60000 && !String(jobId).includes('-REPRINT-')) {
          console.warn(`[MacPrintBridge] Blocked duplicate print job for ${jobId}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            jobId,
            error: `Duplicate print job detected for ${jobId}`
          }));
          return;
        }

        submittedJobs.set(jobId, now);

        // Write receipt text to a temporary file
        const tmpFile = path.join(os.tmpdir(), `receipt-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`);
        fs.writeFileSync(tmpFile, receiptText, 'utf8');

        // Formulate CUPS lp command
        let cmd = `lp "${tmpFile}"`;
        if (printerName && printerName !== 'Default System Printer') {
          // Sanitize printer name for shell safety
          const sanitizedPrinter = printerName.replace(/["'\\]/g, '');
          cmd = `lp -d "${sanitizedPrinter}" "${tmpFile}"`;
        }

        exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
          // Clean up temp file
          try {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
          } catch (e) {}

          if (error) {
            console.error('[MacPrintBridge] Print command error:', error.message);
            submittedJobs.delete(jobId);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              jobId,
              error: `macOS CUPS error: ${error.message}`
            }));
            return;
          }

          console.log(`[MacPrintBridge] Print job ${jobId} sent successfully:`, stdout.trim());
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            jobId,
            message: 'Print job sent to macOS CUPS spooler'
          }));
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Invalid JSON payload: ${err.message}` }));
      }
    });
    return;
  }

  // 404 Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

function startServer() {
  server.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`  XINGS KITCHEN macOS Local Thermal Print Bridge`);
    console.log(`  Running on http://${HOST}:${PORT}`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[MacPrintBridge] Port ${PORT} is already in use (another Print Bridge instance is running).`);
    } else {
      console.error('[MacPrintBridge] Server error:', err);
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, server };
