import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Embedded public X.509 certificate for XingsPOS.
 * CN=XingsPOS, O=Xings Chinese Fast Food, C=IN (Valid through 2036)
 * Matches DEFAULT_PRIVATE_KEY for seamless, instant cryptographic signing.
 */
const DEFAULT_CERT = `-----BEGIN CERTIFICATE-----
MIIDZTCCAk2gAwIBAgIUFVRlyCf1k/A1GJQg9voq5iLsHLUwDQYJKoZIhvcNAQEL
BQAwQjERMA8GA1UEAwwIWGluZ3NQT1MxIDAeBgNVBAoMF1hpbmdzIENoaW5lc2Ug
RmFzdCBGb29kMQswCQYDVQQGEwJJTjAeFw0yNjA5MTUxNDMzNTVaFw0zNjA5MTIx
NDMzNTVaMEIxETAPBgNVBAMMCFhpbmdzUE9TMSAwHgYDVQQKDBdYaW5ncyBDaGlu
ZXNlIEZhc3QgRm9vZDELMAkGA1UEBhMCSU4wggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQC+kopVcuHotc8PRmjHSLYJD7Ooh9iEa+P21Q53X9CSx6zBc+Xo
est631gmouCVc3dGxiX0XoaIzkfm3zPBCpFjEmkwbF+qLIzJH/IkiQJYSA/3WknK
vI7wp83LNW+qxUB3ZWO9ixf+0gKUvkLaxhJbxxCopNf9gyRq9F8nlSJyx2vHnNoI
ieP4TuUx3eWVKkcMMqeaJQbWqFG+YjHgbllaFYFMgDk45AAz0G6D8dU1RrM2S+1b
M/FOYt43h4X+n41XIdn83r6AnqP9AR12am2eg9jrCE82dooA9qICvHcDYOiflMMb
mL1ediU4v4Aoaj/2IRbDttckb8+fBZi/4hNHAgMBAAGjUzBRMB0GA1UdDgQWBBQO
yPMCB9aLeFYEgnq5xH28OlPm1zAfBgNVHSMEGDAWgBQOyPMCB9aLeFYEgnq5xH28
OlPm1zAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQADTaNn3HeT
Ug1zvJ4KtqQPkw8LApfzzcEEuVQjTK68qtB/kNOjQ/AanUX8oBKoX/gejLCsuKVQ
OagqWCxy5TuSVE168L36jDPtldg0x7N5Oqv+6u+zDunHtdrVBAKP157U4NOgkaEj
rCGFfkB7xZWFsqxmzFW1bez/VUtK5GNRHVfwitKi3AYXSOFimBGhKEg3kOG0Hgsb
OgNZXWF1YPSuu7FI1uWYA9TuqOAoNcsRhGApwV6Lh+rLs1trtqu2bcUMaJN5jG4V
enN63I5E/bPD7uZjZhESVXQcg8KKCSc/+lK9YJpzGNbw3+qoFwIAPhR07pmvUtNU
+oBaF0fkmqLq
-----END CERTIFICATE-----`;

function normalizePem(raw?: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let clean = raw.trim();
  // Strip outer quotes if passed from shell or .env
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  // Convert literal \n or \r\n to real newlines
  if (clean.includes("\\n")) {
    clean = clean.replace(/\\n/g, "\n");
  }
  clean = clean.replace(/\r\n/g, "\n");
  return clean.length > 0 ? clean : null;
}

function resolveCertificate(): string {
  const envCert =
    normalizePem(process.env.QZ_CERT) ||
    normalizePem(process.env.QZ_CERTIFICATE) ||
    normalizePem(process.env.QZ_PUBLIC_CERT);

  if (envCert && envCert.includes("BEGIN CERTIFICATE")) {
    return envCert;
  }

  return DEFAULT_CERT.trim();
}

/**
 * Vercel Serverless Function: GET /api/qz/cert
 * Returns the public X.509 PEM certificate for QZ Tray silent printing.
 * Compatible with Node.js Serverless runtime (req, res) and Web Standard (Request -> Response).
 */
export default async function handler(req: any, res?: any) {
  const cert = resolveCertificate();

  // If invoked in Web Standard environment (req: Request, res is undefined)
  if (!res && typeof req?.headers?.get === "function") {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    return new Response(cert, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Node.js Serverless Function (Vercel Node)
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.statusCode = 200;
      if (typeof res.end === "function") res.end();
      return;
    }

    try {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      if (typeof res.send === "function") {
        res.send(cert);
      } else if (typeof res.end === "function") {
        res.end(cert);
      }
    } catch (err: any) {
      console.error("[Vercel /api/qz/cert Error]", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Failed to retrieve QZ certificate");
    }
  }
}
