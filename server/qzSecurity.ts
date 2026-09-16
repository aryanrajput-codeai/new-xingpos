import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Server-Side QZ Tray Security & Cryptographic Signing Service
 *
 * Security:
 * The private signing key NEVER leaves the server. It is read strictly from
 * environment variables (QZ_PRIVATE_KEY) or secure server-side file.
 * NO private key is embedded or hardcoded in source code.
 */

function normalizePem(raw?: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let clean = raw.trim();
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim();
  }
  if (clean.includes("\\n")) {
    clean = clean.replace(/\\n/g, "\n");
  }
  clean = clean.replace(/\r\n/g, "\n");
  return clean.length > 0 ? clean : null;
}

/**
 * Returns the public X.509 certificate in PEM format.
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

  throw new Error("Missing QZ_CERT environment variable on server");
}

/**
 * Returns the private RSA signing key in PEM format.
 */
export function getQZPrivateKey(): string {
  const envKey =
    normalizePem(process.env.QZ_PRIVATE_KEY) ||
    normalizePem(process.env.QZ_KEY) ||
    normalizePem(process.env.QZ_SIGNING_KEY);

  if (
    envKey &&
    (envKey.includes("BEGIN PRIVATE KEY") || envKey.includes("BEGIN RSA PRIVATE KEY"))
  ) {
    return envKey;
  }

  try {
    const keyPath = path.join(process.cwd(), "qz-key.pem");
    if (fs.existsSync(keyPath)) {
      const fileKey = fs.readFileSync(keyPath, "utf-8").trim();
      if (
        fileKey.includes("BEGIN PRIVATE KEY") ||
        fileKey.includes("BEGIN RSA PRIVATE KEY")
      ) {
        return fileKey;
      }
    }
  } catch (_) {}

  throw new Error("Missing QZ_PRIVATE_KEY environment variable on server");
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
 * Cryptographically signs a QZ Tray payload using RSA-SHA512 (or requested SHA algorithm).
 * @param toSign The stringified payload or hash received from QZ Tray.
 * @param algorithm Optional algorithm (defaults to SHA512).
 * @returns Base64 encoded digital signature.
 */
export function signQZRequest(toSign: string, algorithm: string = "SHA512"): string {
  if (toSign === undefined || toSign === null || typeof toSign !== "string" || toSign.length === 0) {
    throw new Error("Missing or empty request data to sign");
  }

  const cert = getQZCertificate();
  const privateKey = getQZPrivateKey();

  if (!verifyKeypairMatch(cert, privateKey)) {
    throw new Error("QZ_CERT and QZ_PRIVATE_KEY do not cryptographically match");
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
