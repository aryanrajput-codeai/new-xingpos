import crypto from "node:crypto";

function normalizePem(raw?: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let clean = raw.trim();
  // Strip outer quotes if passed from shell or .env
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim();
  }
  // Convert literal \n or \r\n to real newlines
  if (clean.includes("\\n")) {
    clean = clean.replace(/\\n/g, "\n");
  }
  clean = clean.replace(/\r\n/g, "\n");
  return clean.length > 0 ? clean : null;
}

interface KeyConfig {
  cert: string;
  privateKey: string;
}

function resolveKeys(): { keys: KeyConfig | null; error: string | null } {
  const envCert =
    normalizePem(process.env.QZ_CERT) ||
    normalizePem(process.env.QZ_CERTIFICATE) ||
    normalizePem(process.env.QZ_PUBLIC_CERT);

  if (!envCert || !envCert.includes("BEGIN CERTIFICATE")) {
    return {
      keys: null,
      error: "Missing or invalid QZ_CERT environment variable on server.",
    };
  }

  const envKey =
    normalizePem(process.env.QZ_PRIVATE_KEY) ||
    normalizePem(process.env.QZ_KEY) ||
    normalizePem(process.env.QZ_SIGNING_KEY);

  if (
    !envKey ||
    (!envKey.includes("BEGIN PRIVATE KEY") &&
      !envKey.includes("BEGIN RSA PRIVATE KEY"))
  ) {
    return {
      keys: null,
      error: "Missing or invalid QZ_PRIVATE_KEY environment variable on server.",
    };
  }

  // Cryptographically verify that the certificate and private key match
  try {
    const testData = "qz-match-verify-" + Date.now();
    const signer = crypto.createSign("SHA512");
    signer.update(testData);
    signer.end();
    const testSig = signer.sign(envKey, "base64");

    const verifier = crypto.createVerify("SHA512");
    verifier.update(testData);
    verifier.end();
    const matches = verifier.verify(envCert, testSig, "base64");

    if (!matches) {
      return {
        keys: null,
        error: "QZ_CERT and QZ_PRIVATE_KEY do not cryptographically match.",
      };
    }
  } catch (err: any) {
    return {
      keys: null,
      error: `Keypair verification error: ${err?.message || String(err)}`,
    };
  }

  return { keys: { cert: envCert, privateKey: envKey }, error: null };
}

/**
 * Signs the exact request payload using RSA-SHA512 and verifies against QZ_CERT.
 * Does NOT alter, trim, re-hash, or modify the payload in any way.
 */
function signExactRequest(toSign: string, keys: KeyConfig): string {
  const signer = crypto.createSign("SHA512");
  signer.update(toSign);
  signer.end();
  const signature = signer.sign(keys.privateKey, "base64");

  // Validate the generated signature against the certificate
  const verifier = crypto.createVerify("SHA512");
  verifier.update(toSign);
  verifier.end();
  const isValid = verifier.verify(keys.cert, signature, "base64");

  if (!isValid) {
    throw new Error("Self-verification of generated signature against QZ_CERT failed.");
  }

  return signature;
}

/**
 * Extracts the exact request string received from QZ Tray.
 * NEVER trims, hashes, or modifies the payload string.
 */
async function extractRequest(req: any): Promise<string | null> {
  // 1. Pre-parsed body (Vercel Serverless / Express body-parser)
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object") {
      if (typeof req.body.request === "string") return req.body.request;
      if (typeof req.body.toSign === "string") return req.body.toSign;
      if (typeof req.body.data === "string") return req.body.data;
    } else if (typeof req.body === "string") {
      try {
        const parsed = JSON.parse(req.body);
        if (typeof parsed.request === "string") return parsed.request;
        if (typeof parsed.toSign === "string") return parsed.toSign;
        if (typeof parsed.data === "string") return parsed.data;
      } catch {
        return req.body;
      }
    }
  }

  // 2. Query parameters
  if (req.query && typeof req.query === "object") {
    if (typeof req.query.request === "string") return req.query.request;
    if (typeof req.query.toSign === "string") return req.query.toSign;
    if (typeof req.query.data === "string") return req.query.data;
  }

  // 3. Web Standard Request API (req.json / req.text)
  if (typeof req.json === "function") {
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        if (typeof body.request === "string") return body.request;
        if (typeof body.toSign === "string") return body.toSign;
        if (typeof body.data === "string") return body.data;
      }
    } catch {
      try {
        if (typeof req.text === "function") {
          const raw = await req.text();
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed.request === "string") return parsed.request;
            if (typeof parsed.toSign === "string") return parsed.toSign;
            if (typeof parsed.data === "string") return parsed.data;
          } catch {
            return raw;
          }
        }
      } catch {}
    }
  }

  // 4. Stream unconsumed body (IncomingMessage)
  if (typeof req.on === "function" && req.readable !== false) {
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        let acc = "";
        req.on("data", (chunk: any) => {
          acc += chunk;
        });
        req.on("end", () => resolve(acc));
        req.on("error", (err: any) => reject(err));
      });
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed.request === "string") return parsed.request;
          if (typeof parsed.toSign === "string") return parsed.toSign;
          if (typeof parsed.data === "string") return parsed.data;
        } catch {
          return raw;
        }
      }
    } catch {}
  }

  // 5. URL query parameters fallback
  if (req.url) {
    try {
      const url = new URL(req.url, "http://localhost");
      const val =
        url.searchParams.get("request") ||
        url.searchParams.get("toSign") ||
        url.searchParams.get("data");
      if (val !== null) return val;
    } catch {}
  }

  return null;
}

/**
 * Vercel Serverless Function: POST & GET /api/qz/sign
 * Cryptographically signs QZ Tray print requests with RSA-SHA512.
 * Completely self-contained. Compatible with Node.js Serverless runtime (req, res)
 * and Web Standard runtime (Request -> Response).
 */
export default async function handler(req: any, res?: any) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };

  // Web Standard runtime (Request -> Response)
  if (!res && typeof req?.headers?.get === "function") {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const { keys, error: keyError } = resolveKeys();
    if (!keys) {
      return new Response(
        JSON.stringify({
          error: "QZ signing unavailable: Server key configuration error",
          message: keyError,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
          },
        }
      );
    }

    try {
      const toSign = await extractRequest(req);
      if (toSign === null || typeof toSign !== "string" || toSign.length === 0) {
        return new Response(
          JSON.stringify({ error: "Missing or invalid 'request' string to sign" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json; charset=utf-8",
            },
          }
        );
      }

      const signature = signExactRequest(toSign, keys);

      return new Response(JSON.stringify({ signature }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    } catch (err: any) {
      console.error("[/api/qz/sign Web Error]", err?.message || err);
      return new Response(
        JSON.stringify({
          error: "QZ signing request failed",
          message: err?.message || String(err),
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
          },
        }
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

    const { keys, error: keyError } = resolveKeys();
    if (!keys) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: "QZ signing unavailable: Server key configuration error",
          message: keyError,
        })
      );
      return;
    }

    try {
      const toSign = await extractRequest(req);
      if (toSign === null || typeof toSign !== "string" || toSign.length === 0) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Missing or invalid 'request' string to sign" }));
        return;
      }

      const signature = signExactRequest(toSign, keys);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.end(JSON.stringify({ signature }));
    } catch (err: any) {
      console.error("[/api/qz/sign Node Error]", err?.message || err);
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
