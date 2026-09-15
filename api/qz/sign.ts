import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Embedded public X.509 certificate for XingsPOS.
 * CN=XingsPOS, O=Xings Chinese Fast Food, C=IN (Valid through 2036)
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

/**
 * Embedded RSA-2048 private key matching DEFAULT_CERT.
 */
const DEFAULT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+kopVcuHotc8P
RmjHSLYJD7Ooh9iEa+P21Q53X9CSx6zBc+Xoest631gmouCVc3dGxiX0XoaIzkfm
3zPBCpFjEmkwbF+qLIzJH/IkiQJYSA/3WknKvI7wp83LNW+qxUB3ZWO9ixf+0gKU
vkLaxhJbxxCopNf9gyRq9F8nlSJyx2vHnNoIieP4TuUx3eWVKkcMMqeaJQbWqFG+
YjHgbllaFYFMgDk45AAz0G6D8dU1RrM2S+1bM/FOYt43h4X+n41XIdn83r6AnqP9
AR12am2eg9jrCE82dooA9qICvHcDYOiflMMbmL1ediU4v4Aoaj/2IRbDttckb8+f
BZi/4hNHAgMBAAECggEAEVyjDbXcWanL+3BGtiEsXxb3HzDWdk9TWCGA9+SFdASM
+0g7zI+jX3EJmZDX38XCkB1tR8jKKPHiIGklUJOjOzYU2ecwWqiZtZkbeQiia2M6
pnurTV/FsKxuVfJrAfvb1lopBBOv/p8owl8IaDYIu3kfThNL5OTAZJ4ZgoRWZxkW
CAUt3lIGgToob1w3GHawgVHFovmHY3NudUo9gZHgeXtqcPAAnhHncCTIQ4GnDsDK
E6W31OzlH9SmgzVJc52F2AvgOr01dDEsEPH9CRKD20q9B6hJCJVNBcL0GlQPVRAZ
/RGv3DuHqPtjnQBcqT9PNHpivhoB4hZ+50ZEk62hAQKBgQD8+XP4Jvzvn4vW1mozu
CPJ0JhevjhsS6rxwbjeYaOZh1S4+IGCHS7bDYWawB8h72/clFwMdpBYdm151X8kN
fb1/BWI0Hbc1FG2l/FBCi9ho1DhOtNu0uu3j8daZRta/gp2GB7kXoeEWPbeeLL8L
kqwo3R5F8nX8p125WWBnWPucQKBgQDA2gcDzakaZU+BM1lZZREUuoh+KkfbgFmQF
4AozHP+kH/mU4wVSj+2uhAnrPzlGzK6xdj57xHYGQ3uZLpu5NRR1CvcuUOg5fwxy
q0pIDdKgM3+j2SGe5/ZK8iGgM869T2QCPXxzsIp2ZNRI1n27kpqr+elp33ct87fv
PK0fjXpNwKBgDMLgsMH2vHfF7B6A2P8O/x1AsnbSDdR7WRq2orE2OYZ0JaiTj+a
8+FvkQ3wxldqoP+5T/mT0vyGqQB0e/sqiHKKMy4wIkvc68AUWLHvBDCHa8KGxDMQ
jE+1y1wKGsL5j9LUeydJi77A1M9/O153WMrbsJzel/PjGLLtBtZok8mBAoGBAK66
W7S0d0w1Ek2rKn72NP2k69nzkNttdLg6sqFEbKvuXBNhCwCXHxb9iXmJIDCr7dCP
RUFdu7shKCAgH1It/biOFZeMO5viBBdQ3Ibwa2gTP5AudxPpmjB3nN1Qg3GVlMuV
ctA9Vmn4eaL/9pjl2YLEEYtjL4P0/Xh1hyjFWS8NAoGBANl2DP4bgB+GOMwW4IQn
KxdqODpV76aOpnIWEK84rzsZv4hrm1BwaW0uszq3BWJILaZYcth4FyWidEm42Bl5
vY1+928DLJMu202ELv5LsVgY7mpsq1QO0BbAs/UyVdkHQ0DaMbk/+2wi8rzcDaOp
8K4zVBY6XOrMIZ3PwiX3TYs4
-----END PRIVATE KEY-----`;

function normalizePem(raw?: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let clean = raw.trim();
  // Strip outer quotes if passed as string literals in environment variables
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  // Convert literal \n or \r\n to actual newlines
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

function resolvePrivateKey(): string {
  const envKey =
    normalizePem(process.env.QZ_PRIVATE_KEY) ||
    normalizePem(process.env.QZ_KEY) ||
    normalizePem(process.env.QZ_SIGNING_KEY);

  if (envKey && (envKey.includes("BEGIN PRIVATE KEY") || envKey.includes("BEGIN RSA PRIVATE KEY"))) {
    return envKey;
  }
  return DEFAULT_PRIVATE_KEY.trim();
}

/**
 * Validates whether a keypair can successfully sign and verify SHA512.
 */
function testKeypair(cert: string, key: string): boolean {
  try {
    const testData = "qz-check-" + Date.now();
    const s = crypto.createSign("SHA512");
    s.update(testData);
    s.end();
    const sig = s.sign(key, "base64");
    const v = crypto.createVerify("SHA512");
    v.update(testData);
    v.end();
    return v.verify(cert, sig, "base64");
  } catch {
    return false;
  }
}

/**
 * Signs the exact payload using RSA with SHA512 (or requested SHA algorithm).
 * Performs self-verification to guarantee valid signature output.
 */
function performSigning(toSign: string, requestedAlgo: string = "SHA512"): string {
  let cert = resolveCertificate();
  let privateKey = resolvePrivateKey();

  // If the active cert and private key do not match, fall back to embedded certified pair
  if (!testKeypair(cert, privateKey)) {
    console.warn("[QZ Security] Provided environment keypair failed verification; falling back to certified default keypair");
    cert = DEFAULT_CERT.trim();
    privateKey = DEFAULT_PRIVATE_KEY.trim();
  }

  const validAlgo = ["SHA1", "SHA256", "SHA512"].includes(requestedAlgo.toUpperCase())
    ? requestedAlgo.toUpperCase()
    : "SHA512";

  const signer = crypto.createSign(validAlgo);
  signer.update(toSign);
  signer.end();
  const signature = signer.sign(privateKey, "base64");

  // Validate the generated signature against the certificate
  const verifier = crypto.createVerify(validAlgo);
  verifier.update(toSign);
  verifier.end();
  const valid = verifier.verify(cert, signature, "base64");

  if (!valid) {
    console.error("[QZ Security] Internal signature self-check failed for algorithm:", validAlgo);
    throw new Error("Cryptographic signature verification failed");
  }

  return signature;
}

/**
 * Extracts the exact `toSign` string from various request encodings.
 * Crucially preserves exact characters without accidental trimming.
 */
async function extractPayload(req: any): Promise<{ toSign: string | null; algorithm: string }> {
  let toSign: string | null = null;
  let algorithm = "SHA512";

  // 1. Query parameters
  if (req.query && typeof req.query === "object") {
    if (typeof req.query.request === "string") toSign = req.query.request;
    else if (typeof req.query.toSign === "string") toSign = req.query.toSign;
    else if (typeof req.query.data === "string") toSign = req.query.data;
    if (typeof req.query.algorithm === "string") algorithm = req.query.algorithm;
  }

  // 2. URL search params (if req.url exists)
  if (!toSign && req.url) {
    try {
      const url = new URL(req.url, "http://localhost");
      toSign = url.searchParams.get("request") || url.searchParams.get("toSign") || url.searchParams.get("data");
      if (url.searchParams.get("algorithm")) {
        algorithm = url.searchParams.get("algorithm")!;
      }
    } catch (_) {}
  }

  // 3. Web Standard Request (.json() / .text())
  if (!toSign && typeof req.json === "function") {
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        if (typeof body.request === "string") toSign = body.request;
        else if (typeof body.toSign === "string") toSign = body.toSign;
        else if (typeof body.data === "string") toSign = body.data;
        if (typeof body.algorithm === "string") algorithm = body.algorithm;
      }
    } catch (_) {
      try {
        if (typeof req.text === "function") {
          const raw = await req.text();
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              toSign = parsed.request || parsed.toSign || parsed.data || null;
              if (parsed.algorithm) algorithm = parsed.algorithm;
            } catch {
              toSign = raw;
            }
          }
        }
      } catch (_) {}
    }
  }

  // 4. Pre-parsed body (Vercel Serverless / Express body-parser)
  if (!toSign && req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object") {
      toSign =
        typeof req.body.request === "string"
          ? req.body.request
          : typeof req.body.toSign === "string"
          ? req.body.toSign
          : typeof req.body.data === "string"
          ? req.body.data
          : null;
      if (typeof req.body.algorithm === "string") {
        algorithm = req.body.algorithm;
      }
    } else if (typeof req.body === "string") {
      try {
        const parsed = JSON.parse(req.body);
        toSign = parsed.request || parsed.toSign || parsed.data || null;
        if (parsed.algorithm) algorithm = parsed.algorithm;
      } catch {
        toSign = req.body;
      }
    }
  }

  // 5. Unconsumed IncomingMessage stream
  if (!toSign && typeof req.on === "function" && req.readable !== false) {
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        let acc = "";
        req.on("data", (chunk: any) => {
          acc += chunk;
          if (acc.length > 2e6) reject(new Error("Payload too large"));
        });
        req.on("end", () => resolve(acc));
        req.on("error", (err: any) => reject(err));
      });
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          toSign = parsed.request || parsed.toSign || parsed.data || null;
          if (parsed.algorithm) algorithm = parsed.algorithm;
        } catch {
          toSign = raw;
        }
      }
    } catch (_) {}
  }

  return { toSign, algorithm };
}

/**
 * Vercel Serverless Function: POST & GET /api/qz/sign
 * Cryptographically signs QZ Tray print requests with RSA-SHA512.
 * Compatible with Node.js Serverless runtime (req, res) and Web Standard (Request -> Response).
 */
export default async function handler(req: any, res?: any) {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };

  // If invoked in Web Standard environment (req: Request, res is undefined)
  if (!res && typeof req?.headers?.get === "function") {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const { toSign, algorithm } = await extractPayload(req);
      if (!toSign || typeof toSign !== "string" || toSign.length === 0) {
        return new Response(
          JSON.stringify({ error: "Missing or invalid 'request' string to sign" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
        );
      }

      const signature = performSigning(toSign, algorithm);

      return new Response(
        JSON.stringify({ signature }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    } catch (err: any) {
      console.error("[Vercel /api/qz/sign Web Error]", err?.message || err);
      return new Response(
        JSON.stringify({ error: "QZ signing request failed", message: err?.message || String(err) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
      );
    }
  }

  // Node.js Serverless Function (Vercel Node)
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

    if (req.method === "OPTIONS") {
      res.statusCode = 200;
      if (typeof res.end === "function") res.end();
      return;
    }

    try {
      const { toSign, algorithm } = await extractPayload(req);

      if (!toSign || typeof toSign !== "string" || toSign.length === 0) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Missing or invalid 'request' data to sign" }));
        return;
      }

      const signature = performSigning(toSign, algorithm);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.end(JSON.stringify({ signature }));
    } catch (err: any) {
      console.error("[Vercel /api/qz/sign Node Error]", err?.message || err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: "QZ signing request failed",
          message: err?.message || "Server cryptographic signing failed",
        })
      );
    }
  }
}
