// -------------------------------------------------------------
// XINGS KITCHEN POS — CLIENT ROUTER & URL PERSISTENCE ENGINE
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
  | "history"
  | "staff"
  | "inventory"
  | "recipes"
  | "purchases"
  | "suppliers"
  | "wastage"
  | "adjustments"
  | "inventory-reports";

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
  "kitchen": "kitchen",
  "kds": "kitchen",
  "supabase": "supabase",
  "diagnostics": "supabase",
  "revenue": "revenue",
  "reviews": "reviews",
  "staff": "staff",
  "employees": "staff",
  "rbac": "staff",
  "roles": "staff",
  "inventory": "inventory",
  "ingredients": "inventory",
  "raw-materials": "inventory",
  "stock": "inventory",
  "recipes": "recipes",
  "recipe": "recipes",
  "recipe-book": "recipes",
  "costing": "recipes",
  "purchases": "purchases",
  "purchase": "purchases",
  "po": "purchases",
  "procurement": "purchases",
  "stock-in": "purchases",
  "suppliers": "suppliers",
  "supplier": "suppliers",
  "vendors": "suppliers",
  "wastage": "wastage",
  "spoilage": "wastage",
  "loss": "wastage",
  "adjustments": "adjustments",
  "stock-adjustments": "adjustments",
  "reconciliation": "adjustments",
  "inventory-reports": "inventory-reports",
  "stock-reports": "inventory-reports",
  "food-cost": "inventory-reports"
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
 * Parse the current browser location (pathname and hash) into a structured route.
 */
export function parseCurrentRoute(): ParsedRoute {
  if (typeof window === "undefined") {
    return {
      view: "menu",
      adminTab: "analytics",
      reportsSubTab: "overview",
      menuSubTab: "items",
      rawPath: "/"
    };
  }

  let path = window.location.pathname;
  const hash = window.location.hash;

  // If pathname is root/index.html or if hash contains #admin or #/admin, use hash path
  if (hash.startsWith("#admin") || hash.startsWith("#/admin")) {
    path = hash.replace(/^#\/?/, "/");
  }

  // Check if this is an admin route
  const isAdmin = path === "/admin" || path.startsWith("/admin/");

  if (!isAdmin) {
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

  const secondSegment = (segments[1] || "dashboard").toLowerCase();
  const thirdSegment = (segments[2] || "").toLowerCase();

  const adminTab: AdminTab = VALID_ADMIN_TABS[secondSegment] || "analytics";

  let reportsSubTab: ReportsSubTab = "overview";
  if (adminTab === "reports" && thirdSegment && VALID_REPORTS_SUBTABS[thirdSegment]) {
    reportsSubTab = VALID_REPORTS_SUBTABS[thirdSegment];
  }

  let menuSubTab: MenuSubTab = "items";
  if (adminTab === "menu") {
    if (thirdSegment === "categories") {
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
  let targetPath = "/admin";

  switch (tab) {
    case "analytics":
      targetPath = "/admin/dashboard";
      break;
    case "reports":
      if (subTab && VALID_REPORTS_SUBTABS[subTab]) {
        targetPath = `/admin/reports/${subTab}`;
      } else {
        targetPath = "/admin/reports";
      }
      break;
    case "menu":
      if (subTab === "categories") {
        targetPath = "/admin/menu/categories";
      } else {
        targetPath = "/admin/menu/items";
      }
      break;
    case "tables":
      targetPath = "/admin/reservations";
      break;
    case "pos":
      targetPath = "/admin/pos";
      break;
    case "orders":
      targetPath = "/admin/orders";
      break;
    case "history":
      targetPath = "/admin/history";
      break;
    case "customers":
      targetPath = "/admin/customers";
      break;
    case "coupons":
      targetPath = "/admin/coupons";
      break;
    case "printers":
      targetPath = "/admin/printers";
      break;
    case "logs":
      targetPath = "/admin/logs";
      break;
    case "settings":
      targetPath = "/admin/settings";
      break;
    case "kitchen":
      targetPath = "/admin/kitchen";
      break;
    case "supabase":
      targetPath = "/admin/supabase";
      break;
    default:
      targetPath = `/admin/${tab}`;
      break;
  }

  const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";
  if (isFileProtocol) {
    return `#${targetPath}`;
  }
  return targetPath;
}

/**
 * Navigate to a specific URL and update browser history and dispatch route events.
 */
export function navigateTo(
  url: string, 
  options: { replace?: boolean } = {}
): void {
  if (typeof window === "undefined") return;

  const isFileProtocol = window.location.protocol === "file:";
  let targetUrl = url;

  if (isFileProtocol && !targetUrl.startsWith("#")) {
    targetUrl = `#${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
  }

  const currentPath = isFileProtocol 
    ? window.location.hash 
    : window.location.pathname + window.location.hash;

  if (currentPath === targetUrl) return;

  if (options.replace) {
    window.history.replaceState({ url: targetUrl }, "", targetUrl);
  } else {
    window.history.pushState({ url: targetUrl }, "", targetUrl);
  }

  // Dispatch custom event to notify all listening components asynchronously on next frame/tick
  setTimeout(() => {
    window.dispatchEvent(new Event("app_route_change"));
  }, 0);
}
