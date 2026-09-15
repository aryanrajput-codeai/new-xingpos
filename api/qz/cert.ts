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

function resolveCertificate(): { cert: string | null; error: string | null } {
  const envCert =
    normalizePem(process.env.QZ_CERT) ||
    normalizePem(process.env.QZ_CERTIFICATE) ||
    normalizePem(process.env.QZ_PUBLIC_CERT);

  if (!envCert || !envCert.includes("BEGIN CERTIFICATE")) {
    return {
      cert: null,
      error: "Missing or invalid QZ_CERT environment variable on server.",
    };
  }

  return { cert: envCert, error: null };
}

/**
 * Vercel Serverless Function: GET /api/qz/cert
 * Returns the public X.509 PEM certificate for QZ Tray silent printing.
 * Completely self-contained. Compatible with Node.js Serverless runtime (req, res)
 * and Web Standard runtime (Request -> Response).
 */
export default async function handler(req: any, res?: any) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };

  // Web Standard runtime (Request -> Response)
  if (!res && typeof req?.headers?.get === "function") {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const { cert, error } = resolveCertificate();
    if (!cert) {
      return new Response(error, {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return new Response(cert, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Node.js Serverless Function (Vercel Node)
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

    if (req.method === "OPTIONS") {
      res.statusCode = 200;
      if (typeof res.end === "function") res.end();
      return;
    }

    const { cert, error } = resolveCertificate();
    if (!cert) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(error);
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (typeof res.send === "function") {
      res.send(cert);
    } else {
      res.end(cert);
    }
  }
}
