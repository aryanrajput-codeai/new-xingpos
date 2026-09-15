// -------------------------------------------------------------
// THE XINGS KITCHEN POS — CLIENT ROUTER & URL PERSISTENCE ENGINE
// -------------------------------------------------------------

export type AdminTab = 
  | "analytics" 
  | "reports" 
  | "orders" 
  | "menu" 
  | "customers" 
  | "revenue" 
  | "coupons" 
  | "reviews" 
  | "logs" 
  | "settings" 
  | "kitchen" 
  | "tables" 
  | "supabase" 
  | "pos" 
  | "printers" 
  | "features"
  | "history";

export type ReportsSubTab = 
  | "overview" 
  | "daily" 
  | "monthly" 
  | "yearly" 
  | "items" 
  | "categories" 
  | "ledger";

export type MenuSubTab = "items" | "categories";

export interface ParsedRoute {
  view: "menu" | "admin";
  adminTab: AdminTab;
  reportsSubTab: ReportsSubTab;
  menuSubTab: MenuSubTab;
  rawPath: string;
}

const VALID_ADMIN_TABS: Record<string, AdminTab> = {
  "dashboard": "analytics",
  "analytics": "analytics",
  "overview": "analytics",
  "reports": "reports",
  "sales-reports": "reports",
  "pos": "pos",
  "billing": "pos",
  "pos-billing": "pos",
  "pos-desk": "pos",
  "orders": "orders",
  "order-management": "orders",
  "history": "history",
  "order-history": "history",
  "menu": "menu",
  "catalog": "menu",
  "customers": "customers",
  "guests": "customers",
  "coupons": "coupons",
  "promos": "coupons",
  "tables": "tables",
  "reservations": "tables",
  "printers": "printers",
  "logs": "logs",
  "audit-logs": "logs",
  "settings": "settings",
  "features": "features",
  "feature-flags": "features",
  "toggles": "features",
  "kitchen": "kitchen",
  "kds": "kitchen",
  "supabase": "supabase",
  "diagnostics": "supabase",
  "revenue": "revenue",
  "reviews": "reviews"
};

const VALID_REPORTS_SUBTABS: Record<string, ReportsSubTab> = {
  "overview": "overview",
  "daily": "daily",
  "monthly": "monthly",
  "yearly": "yearly",
  "items": "items",
  "categories": "categories",
  "ledger": "ledger"
};

/**
 * Checks if the current browser location corresponds to a table QR scan.
 * The customer landing page / food menu is strictly displayed when a table QR code is scanned!
 */
export function isQrScanRequest(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const hasTableParam = 
      searchParams.has("table") || 
      searchParams.has("t") || 
      searchParams.has("tbl") || 
      searchParams.has("tableNumber") ||
      searchParams.has("tableno") ||
      searchParams.has("qr");

    if (hasTableParam) {
      sessionStorage.setItem("ij_qr_session", "true");
      return true;
    }

    const hash = window.location.hash || "";
    if (
      hash.includes("table=") || 
      hash.includes("qr=") || 
      hash.includes("t=") ||
      hash.startsWith("#/table")
    ) {
      sessionStorage.setItem("ij_qr_session", "true");
      return true;
    }

    const path = window.location.pathname.toLowerCase();
    if (path.startsWith("/table/")) {
      sessionStorage.setItem("ij_qr_session", "true");
      return true;
    }

    // When opened from a standard direct link without QR parameters, clear any stale QR flag
    sessionStorage.removeItem("ij_qr_session");
  } catch {
    // ignore
  }

  return false;
}

/**
 * Parse the current browser location (pathname and hash) into a structured route.
 */
export function parseCurrentRoute(): ParsedRoute {
  if (typeof window === "undefined") {
    return {
      view: "admin",
      adminTab: "analytics",
      reportsSubTab: "overview",
      menuSubTab: "items",
      rawPath: "/admin"
    };
  }

  let path = window.location.pathname;
  const hash = window.location.hash;

  // If pathname is root but hash contains #admin or #/admin, use hash path
  if (hash.startsWith("#admin") || hash.startsWith("#/admin")) {
    path = hash.replace(/^#\/?/, "/");
  }

  const isExplicitAdmin = 
    path === "/admin" || 
    path.startsWith("/admin/") || 
    path === "/login" || 
    path.startsWith("/login") ||
    path === "/pos" || 
    path.startsWith("/pos");

  if (isExplicitAdmin) {
    try {
      sessionStorage.removeItem("ij_qr_session");
    } catch {
      // ignore
    }
  }

  const isQr = isQrScanRequest();

  // Route to customer menu ONLY if this is a QR scan request and NOT an explicit /admin or /pos or /login path
  if (isQr && !isExplicitAdmin) {
    return {
      view: "menu",
      adminTab: "analytics",
      reportsSubTab: "overview",
      menuSubTab: "items",
      rawPath: path
    };
  }

  // Split path segments: e.g. /admin/reports/monthly -> ["admin", "reports", "monthly"]
  const cleanPath = path.replace(/\/+$/, ""); // trim trailing slash
  const segments = cleanPath.split("/").filter(Boolean); // ["admin", ...]

  const firstSegment = (segments[0] || "").toLowerCase();
  const secondSegment = (segments[1] || "").toLowerCase();
  const thirdSegment = (segments[2] || "").toLowerCase();

  let adminTab: AdminTab = "analytics";
  if (firstSegment === "admin") {
    adminTab = VALID_ADMIN_TABS[secondSegment || "dashboard"] || "analytics";
  } else if (firstSegment === "pos" || firstSegment === "billing") {
    adminTab = "pos";
  } else if (firstSegment === "login") {
    adminTab = "analytics";
  } else if (VALID_ADMIN_TABS[firstSegment]) {
    adminTab = VALID_ADMIN_TABS[firstSegment];
  }

  let reportsSubTab: ReportsSubTab = "overview";
  if (adminTab === "reports" && thirdSegment && VALID_REPORTS_SUBTABS[thirdSegment]) {
    reportsSubTab = VALID_REPORTS_SUBTABS[thirdSegment];
  }

  let menuSubTab: MenuSubTab = "items";
  if (adminTab === "menu") {
    if (thirdSegment === "categories" || secondSegment === "categories") {
      menuSubTab = "categories";
    } else {
      menuSubTab = "items";
    }
  }

  return {
    view: "admin",
    adminTab,
    reportsSubTab,
    menuSubTab,
    rawPath: path
  };
}

/**
 * Constructs the canonical URL for a given admin tab and sub-tab.
 */
export function buildAdminUrl(
  tab: AdminTab, 
  subTab?: ReportsSubTab | MenuSubTab | string
): string {
  let basePath = "/admin";

  switch (tab) {
    case "analytics":
      return "/admin/dashboard";
    case "reports":
      if (subTab && VALID_REPORTS_SUBTABS[subTab]) {
        return `/admin/reports/${subTab}`;
      }
      return "/admin/reports";
    case "menu":
      if (subTab === "categories") {
        return "/admin/menu/categories";
      }
      return "/admin/menu";
    case "tables":
      return "/admin/reservations";
    case "pos":
      return "/admin/pos";
    case "orders":
      return "/admin/orders";
    case "history":
      return "/admin/history";
    case "customers":
      return "/admin/customers";
    case "coupons":
      return "/admin/coupons";
    case "printers":
      return "/admin/printers";
    case "logs":
      return "/admin/logs";
    case "settings":
      return "/admin/settings";
    case "kitchen":
      return "/admin/kitchen";
    case "supabase":
      return "/admin/supabase";
    default:
      return `${basePath}/${tab}`;
  }
}

/**
 * Navigate to a specific URL and update browser history and dispatch route events.
 */
export function navigateTo(
  url: string, 
  options: { replace?: boolean } = {}
): void {
  if (typeof window === "undefined") return;

  const currentPath = window.location.pathname + window.location.hash;
  if (currentPath === url) return;

  if (options.replace) {
    window.history.replaceState({ url }, "", url);
  } else {
    window.history.pushState({ url }, "", url);
  }

  // Dispatch custom event to notify all listening components
  window.dispatchEvent(new Event("app_route_change"));
}
