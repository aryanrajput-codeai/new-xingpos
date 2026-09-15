import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Server-Side QZ Tray Security & Cryptographic Signing Service
 *
 * Architecture:
 * Browser POS -> QZ Security Certificate -> Server-Side Signature Endpoint -> Private Key (Server Only) -> Signature -> QZ Tray -> Epson TM-T82X
 *
 * Security:
 * The private signing key NEVER leaves the server. It is never exposed to the client, browser, or Vite frontend.
 */

// Embedded fallback X.509 certificate and RSA-2048 private key for XingsPOS
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
  // Handle literal escaped newlines from environment variables
  if (clean.includes("\\n")) {
    clean = clean.replace(/\\n/g, "\n");
  }
  return clean.length > 0 ? clean : null;
}

/**
 * Returns the public X.509 certificate in PEM format.
 * Priority:
 * 1. Environment variables: QZ_CERT, QZ_CERTIFICATE, QZ_PUBLIC_CERT
 * 2. File: qz-cert.pem (if present on server)
 * 3. Default embedded valid certificate
 */
export function getQZCertificate(): string {
  const envCert =
    normalizePem(process.env.QZ_CERT) ||
    normalizePem(process.env.QZ_CERTIFICATE) ||
    normalizePem(process.env.QZ_PUBLIC_CERT);

  if (envCert && envCert.includes("BEGIN CERTIFICATE")) {
    return envCert;
  }

  try {
    const certPath = path.join(process.cwd(), "qz-cert.pem");
    if (fs.existsSync(certPath)) {
      const fileCert = fs.readFileSync(certPath, "utf-8").trim();
      if (fileCert.includes("BEGIN CERTIFICATE")) {
        return fileCert;
      }
    }
  } catch (_) {}

  return DEFAULT_CERT.trim();
}

/**
 * Returns the private RSA signing key in PEM format.
 * Priority:
 * 1. Environment variables: QZ_PRIVATE_KEY, QZ_KEY, QZ_SIGNING_KEY
 * 2. File: qz-key.pem (if present on server)
 * 3. Default embedded valid private key
 */
export function getQZPrivateKey(): string {
  const envKey =
    normalizePem(process.env.QZ_PRIVATE_KEY) ||
    normalizePem(process.env.QZ_KEY) ||
    normalizePem(process.env.QZ_SIGNING_KEY);

  if (envKey && (envKey.includes("BEGIN PRIVATE KEY") || envKey.includes("BEGIN RSA PRIVATE KEY"))) {
    return envKey;
  }

  try {
    const keyPath = path.join(process.cwd(), "qz-key.pem");
    if (fs.existsSync(keyPath)) {
      const fileKey = fs.readFileSync(keyPath, "utf-8").trim();
      if (fileKey.includes("BEGIN PRIVATE KEY") || fileKey.includes("BEGIN RSA PRIVATE KEY")) {
        return fileKey;
      }
    }
  } catch (_) {}

  return DEFAULT_PRIVATE_KEY.trim();
}

/**
 * Cryptographically signs a QZ Tray payload using RSA-SHA512 (or requested SHA algorithm).
 * @param toSign The stringified payload or hash received from QZ Tray.
 * @param algorithm Optional algorithm (defaults to SHA512).
 * @returns Base64 encoded digital signature.
 */
export function signQZRequest(toSign: string, algorithm: string = "SHA512"): string {
  if (toSign === undefined || toSign === null || typeof toSign !== "string" || toSign.length === 0) {
    throw new Error("Missing or empty request data to sign");
  }

  let cert = getQZCertificate();
  let privateKey = getQZPrivateKey();

  if (!verifyKeypairMatch(cert, privateKey)) {
    console.warn("[QZ Security] Provided keypair failed verification; falling back to embedded default certified keypair");
    cert = DEFAULT_CERT.trim();
    privateKey = DEFAULT_PRIVATE_KEY.trim();
  }

  const validAlgo = ["SHA1", "SHA256", "SHA512"].includes(algorithm.toUpperCase())
    ? algorithm.toUpperCase()
    : "SHA512";

  const signer = crypto.createSign(validAlgo);
  signer.update(toSign);
  signer.end();
  const signature = signer.sign(privateKey, "base64");

  return signature;
}

function verifyKeypairMatch(cert: string, key: string): boolean {
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
 * Verifies a signature against the active certificate.
 */
export function verifyQZSignature(toSign: string, signature: string, algorithm: string = "SHA512"): boolean {
  try {
    const cert = getQZCertificate();
    const validAlgo = ["SHA1", "SHA256", "SHA512"].includes(algorithm.toUpperCase())
      ? algorithm.toUpperCase()
      : "SHA512";
    const verifier = crypto.createVerify(validAlgo);
    verifier.update(toSign);
    verifier.end();
    return verifier.verify(cert, signature, "base64");
  } catch {
    return false;
  }
}
