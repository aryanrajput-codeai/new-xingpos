/**
 * QR Code Helper & Scanner Parser Engine for The Xings Kitchen POS & Self-Ordering
 */

export function parseTableNumberFromScannedData(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // 1. Try parsing JSON if encoded as structured object
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj.table || obj.tableNumber || obj.t) {
        return String(obj.table || obj.tableNumber || obj.t).trim();
      }
    } catch {
      // Not valid JSON, continue with URL and regex parsing
    }
  }

  // 2. Try parsing as full or partial URL
  try {
    let url: URL | null = null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      url = new URL(trimmed);
    } else if (trimmed.includes("?table=") || trimmed.includes("?t=") || trimmed.includes("&table=")) {
      url = new URL(`https://dummy.local/${trimmed.replace(/^\/+/, "")}`);
    }

    if (url) {
      // Check query parameters in search
      const searchParams = new URLSearchParams(url.search);
      const val = searchParams.get("table") || searchParams.get("t") || searchParams.get("tbl") || searchParams.get("tableNumber");
      if (val) return val.trim();

      // Check query parameters within hash (e.g. #/?table=3 or #/menu?table=3)
      if (url.hash && url.hash.includes("?")) {
        const hashQuery = url.hash.split("?")[1];
        if (hashQuery) {
          const hashParams = new URLSearchParams(hashQuery);
          const hashVal = hashParams.get("table") || hashParams.get("t") || hashParams.get("tbl");
          if (hashVal) return hashVal.trim();
        }
      }

      // Check URL pathname (e.g. /table/3 or /t/3)
      const pathSegments = url.pathname.split("/").filter(Boolean);
      const tableIdx = pathSegments.findIndex(seg => seg.toLowerCase() === "table" || seg.toLowerCase() === "t");
      if (tableIdx !== -1 && pathSegments[tableIdx + 1]) {
        return pathSegments[tableIdx + 1].trim();
      }
    }
  } catch {
    // Continue with regex pattern matching
  }

  // 3. Fallback regex patterns for various table label formats
  // Matches: "Table #3", "Table 3", "Table-3", "Table: 3", "T-3", "T#3", "TBL-3"
  const tableMatch = trimmed.match(/(?:table|tbl|t)\s*(?:#|:|-)?\s*([a-z0-9_-]+)/i);
  if (tableMatch && tableMatch[1]) {
    return tableMatch[1].trim();
  }

  // 4. If the raw string is just a number or short table identifier (e.g. "1", "2A", "T1", "VIP-1")
  if (/^[a-zA-Z0-9_-]{1,8}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Automatically inspects the current window location (search params and hash)
 * to detect if the page was opened from a table QR code scan.
 */
export function detectTableFromCurrentUrl(fallbackToStorage = false): string | null {
  if (typeof window === "undefined") return null;

  try {
    // 1. Check window.location.search
    const searchParams = new URLSearchParams(window.location.search);
    let tableVal = 
      searchParams.get("table") || 
      searchParams.get("t") || 
      searchParams.get("tbl") || 
      searchParams.get("tableNumber") ||
      searchParams.get("tableno");

    // 2. Check window.location.hash for embedded queries (e.g. #/?table=3 or #/admin?table=3)
    if (!tableVal && window.location.hash) {
      const hashStr = window.location.hash;
      const qIndex = hashStr.indexOf("?");
      if (qIndex !== -1) {
        const hashParams = new URLSearchParams(hashStr.substring(qIndex + 1));
        tableVal = hashParams.get("table") || hashParams.get("t") || hashParams.get("tbl");
      }
    }

    if (tableVal) {
      const cleaned = tableVal.trim();
      saveActiveTable(cleaned, true);
      try {
        sessionStorage.setItem("ij_qr_session", "true");
      } catch {
        // ignore
      }
      return cleaned;
    }
  } catch (err) {
    console.warn("[QR Helper] Error inspecting URL for table param:", err);
  }

  if (fallbackToStorage) {
    const active = getActiveTable();
    return active ? active.tableNumber : null;
  }

  return null;
}

export function saveActiveTable(tableNumber: string, isFromQr = true): void {
  if (typeof window === "undefined") return;
  const clean = tableNumber.trim();
  localStorage.setItem("ij_scanned_table", clean);
  localStorage.setItem("ij_is_qr_scanned", isFromQr ? "true" : "false");
  if (isFromQr) {
    try {
      sessionStorage.setItem("ij_qr_session", "true");
    } catch {
      // ignore
    }
  }
  
  // Dispatch notification for all open components
  window.dispatchEvent(
    new CustomEvent("ij_table_scanned", {
      detail: { tableNumber: clean, isFromQr }
    })
  );
  window.dispatchEvent(new Event("storage"));
}

export function clearActiveTable(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("ij_scanned_table");
  localStorage.removeItem("ij_is_qr_scanned");
  try {
    sessionStorage.removeItem("ij_qr_session");
  } catch {
    // ignore
  }

  window.dispatchEvent(new CustomEvent("ij_table_cleared"));
  window.dispatchEvent(new Event("storage"));
}

export function getActiveTable(): { tableNumber: string; isFromQr: boolean } | null {
  if (typeof window === "undefined") return null;
  const table = localStorage.getItem("ij_scanned_table");
  if (!table) return null;
  const isFromQr = localStorage.getItem("ij_is_qr_scanned") === "true";
  return { tableNumber: table, isFromQr };
}

/**
 * Constructs the canonical public customer menu URL for a given dining table.
 * Crucial: Always routes to root customer menu (`/`), never to `/admin/...`!
 * Explicitly includes qr=1 to mark this as an active table QR standee scan.
 */
export function generateTableQrUrl(tableNumber: string): string {
  if (typeof window === "undefined") return `/?table=${encodeURIComponent(tableNumber)}&qr=1`;
  const origin = window.location.origin;
  return `${origin}/?table=${encodeURIComponent(tableNumber.trim())}&qr=1`;
}

export function generateQrCodeImageUrl(tableNumber: string, size = 300): string {
  const qrLink = generateTableQrUrl(tableNumber);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrLink)}&qzone=1`;
}
