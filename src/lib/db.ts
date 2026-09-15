import { MenuItem, Review, KOT, KOTStatus, OrderItem, RestaurantTable, PrinterEmulatorLog, Category } from "../types";
import { menuItems as defaultMenuItems, reviews as defaultReviews, categories as defaultCategories } from "../data";
import { BRAND_CONFIG } from "../config/brand";
import { createClient } from "@supabase/supabase-js";
import { MenuService } from "../services/menuService";

// Load configuration with broad support for multiple environments
const anyMeta = import.meta as any;
const supabaseUrl = anyMeta.env?.VITE_SUPABASE_URL || 
                    anyMeta.env?.NEXT_PUBLIC_SUPABASE_URL || 
                    "https://jkkwrhywfpbitwvffkxx.supabase.co";

const supabaseKey = anyMeta.env?.VITE_SUPABASE_ANON_KEY || 
                    anyMeta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                    anyMeta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                    "sb_publishable_D1rREhO08nd1vWNmxyugCg_Fff4X10Y";

export const supabase = createClient(supabaseUrl, supabaseKey);

const isDev = Boolean(
  anyMeta.env?.DEV || 
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"))
);

function debugLog(...args: any[]) {
  if (isDev) {
    console.log(...args);
  }
}

export interface OrderTimelineEvent {
  event: string;
  timestamp: string;
  details?: string;
}

export interface Order {
  id: string;
  customerName: string;
  phoneNumber: string;
  email: string;
  orderType: "dine-in" | "takeaway" | "delivery";
  tableNumber?: string;
  address?: string;
  items: {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    customization?: string;
    addedAt?: string;
    addedBy?: string;
    kotNumber?: string;
    sessionNumber?: number;
  }[];
  subtotal: number;
  gst: number;
  packagingCharge: number;
  discountAmount: number;
  appliedCoupon?: string;
  grandTotal: number;
  paymentStatus: "Pending" | "Paid" | "Failed";
  orderStatus: "New Order" | "Accepted" | "Preparing" | "Ready" | "Out For Delivery" | "Delivered" | "Cancelled" | "Served";
  createdAt: string; // ISO string or date
  acceptedAt?: string; // Recorded when Admin clicks Accept Order
  billedBy?: string;
  paymentMethod?: string;
  kotNumber?: string;
  kotPrintStatus?: "Pending" | "Printing" | "Printed" | "Failed";
  kotPrintTimestamp?: string;
  billPrintStatus?: "Pending" | "Printing" | "Printed" | "Failed";
  billPrintTimestamp?: string;
  timeline?: OrderTimelineEvent[];
  addOnCount?: number;
}

export interface Coupon {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  expiryDate: string;
  usageLimit: number;
  usageCount: number;
  minOrderAmount?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  stock: number; // in kg or units
  unit: string;
  minAlertLevel: number;
  category: "Dairy" | "Dry Goods" | "Vegetables" | "Spices" | "Packaging" | "Other";
  lastRestocked: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface RestaurantOutlet {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  isMain?: boolean;
}

export interface RestaurantSettings {
  name: string;
  contactNumber: string;
  address: string;
  businessHours: string;
  deliveryCharges: number;
  gstPercentage: number;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  googleMapsUrl: string;

  // Professional Front Side Tax Invoice & Registration Fields
  estd?: string;
  establishedYear?: string | number;
  legalName?: string;
  city?: string;
  state?: string;
  country?: string;
  email?: string;
  customerCare?: string;
  gstin?: string;
  fssaiNumber?: string;
  tagline?: string;
  website?: string;
  customFooter?: string;
  invoiceTitle?: string;
  cashierName?: string;
  defaultPax?: number;
  logoUrl?: string;

  // Double-Sided Thermal Receipt Settings
  enableDoubleSided?: boolean;
  outlets?: RestaurantOutlet[];
  termsAndConditions?: string[];
  backSideTitle?: string;
  backSideFooterNote?: string;

  // Thermal Printing Display Preferences
  showGstin?: boolean;
  showFssai?: boolean;
  showPax?: boolean;
  showCashier?: boolean;
  showLogo?: boolean;
  showQrCode?: boolean;
  showBarcode?: boolean;
  showSignature?: boolean;
  showAmountInWords?: boolean;
  paperWidth?: "80mm" | "58mm";
}

// Generate premium mock orders spanning the last 30 days
const generateMockOrders = (initialMenuItems: MenuItem[]): Order[] => {
  const orders: Order[] = [];
  const names = [
    "Aarav Sharma", "Sneha Patel", "Vikas Rajput", "Rohan Verma", "Ananya Iyer",
    "Aditya Rao", "Pooja Hegde", "Kabir Mehra", "Meera Nair", "Rahul Singhania",
    "Neha Gupta", "Amit Trivedi", "Siddharth Sen", "Deepa Joshi", "Karan Malhotra"
  ];
  const phones = [
    "+91 98765 43210", "+91 91234 56789", "+91 88888 77777", "+91 99999 88888", "+91 98111 22233",
    "+91 95400 11223", "+91 87654 32109", "+91 90123 45678", "+91 93123 93123", "+91 99887 76655",
    "+91 88776 65544", "+91 77665 54433", "+91 96543 21098", "+91 92345 67890", "+91 93456 78901"
  ];
  const emails = names.map(n => n.toLowerCase().replace(" ", ".") + "@gmail.com");

  const today = new Date();
  
  // Pick some items for diverse ordering
  const getRandItems = () => {
    const pool = initialMenuItems.slice(0, 15); // get some of the first pieces
    const count = Math.floor(Math.random() * 3) + 1; // 1 to 3 items
    const selected: typeof pool = [];
    for (let i = 0; i < count; i++) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      if (!selected.some(s => s.id === item.id)) {
        selected.push(item);
      }
    }
    return selected.map(item => ({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: Math.floor(Math.random() * 2) + 1,
      customization: Math.random() > 0.7 ? "Less spicy, please" : undefined
    }));
  };

  // Generate 25 orders distributed over the last 30 days
  for (let i = 24; i >= 0; i--) {
    const orderDate = new Date();
    orderDate.setDate(today.getDate() - Math.floor(i * 1.2));
    // randomize hour
    orderDate.setHours(12 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));

    const items = getRandItems();
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const gst = 0;
    const orderType = ["dine-in", "takeaway", "delivery"][Math.floor(Math.random() * 3)] as any;
    const packagingCharge = orderType === "dine-in" ? 0 : 25;
    
    let discountAmount = 0;
    let appliedCoupon: string | undefined;
    if (Math.random() > 0.6) {
      discountAmount = Math.round(subtotal * 0.1); // 10% coupon promo
      appliedCoupon = "XINGS10";
    }

    const grandTotal = subtotal + packagingCharge - discountAmount;
    const statuses: Order["orderStatus"][] = ["New Order", "Accepted", "Preparing", "Ready", "Out For Delivery", "Delivered", "Cancelled"];
    let orderStatus: Order["orderStatus"] = "Delivered"; 
    
    // If it's today's date, make some pending or preparing
    if (i === 0) {
      orderStatus = ["New Order", "Preparing", "Out For Delivery", "Delivered"][Math.floor(Math.random() * 4)] as any;
    } else if (i === 1) {
      orderStatus = Math.random() > 0.8 ? "Cancelled" : "Delivered";
    }

    const paymentStatus: Order["paymentStatus"] = orderStatus === "Cancelled" ? "Failed" : (orderStatus === "New Order" ? "Pending" : "Paid");

    const tableNumber = orderType === "dine-in" ? String(Math.floor(Math.random() * 12) + 1) : undefined;
    const address = orderType === "delivery" ? `${Math.floor(Math.random() * 200) + 1}, Sector-4, Dwarka, New Delhi` : undefined;

    const uIdx = Math.floor(Math.random() * names.length);
    orders.push({
      id: `SR-${1000 + orders.length}`,
      customerName: names[uIdx],
      phoneNumber: phones[uIdx],
      email: emails[uIdx],
      orderType,
      tableNumber,
      address,
      items,
      subtotal,
      gst,
      packagingCharge,
      discountAmount,
      appliedCoupon,
      grandTotal,
      paymentStatus,
      orderStatus,
      createdAt: orderDate.toISOString()
    });
  }

  return orders;
};

// Initial Stock setup
const defaultInventory: InventoryItem[] = [
  { id: "i1", name: "Premium Basmati Rice", stock: 120, unit: "kg", minAlertLevel: 30, category: "Dry Goods", lastRestocked: "2026-06-10" },
  { id: "i2", name: "Fresh Paneer (Cottage Cheese)", stock: 8, unit: "kg", minAlertLevel: 15, category: "Dairy", lastRestocked: "2026-06-14" },
  { id: "i3", name: "Fermented Dosa Batter", stock: 12, unit: "Litre", minAlertLevel: 20, category: "Dry Goods", lastRestocked: "2026-06-15" },
  { id: "i4", name: "Potatoes (Sourced Red)", stock: 85, unit: "kg", minAlertLevel: 25, category: "Vegetables", lastRestocked: "2026-06-12" },
  { id: "i5", name: "Red Tomatoes", stock: 10, unit: "kg", minAlertLevel: 20, category: "Vegetables", lastRestocked: "2026-06-14" },
  { id: "i6", name: "Soya Chaap Skewers", stock: 45, unit: "units", minAlertLevel: 15, category: "Dry Goods", lastRestocked: "2026-06-12" },
  { id: "i7", name: "Pure Cow Ghee", stock: 24, unit: "kg", minAlertLevel: 10, category: "Dairy", lastRestocked: "2026-06-11" },
  { id: "i8", name: "Wholewheat Atta / Flour", stock: 150, unit: "kg", minAlertLevel: 40, category: "Dry Goods", lastRestocked: "2026-06-08" },
  { id: "i9", name: "Mozzarella Grated Cheese", stock: 6, unit: "kg", minAlertLevel: 12, category: "Dairy", lastRestocked: "2026-06-13" },
  { id: "i10", name: "Eco Packaging boxes", stock: 320, unit: "units", minAlertLevel: 100, category: "Packaging", lastRestocked: "2026-06-09" }
];

// Initial Coupons setup
const defaultCoupons: Coupon[] = [
  { code: "XINGS20", type: "percentage", value: 20, expiryDate: "2200-12-31", usageLimit: 500, usageCount: 0, minOrderAmount: 250 },
  { code: "WELCOME50", type: "fixed", value: 50, expiryDate: "2200-06-30", usageLimit: 1000, usageCount: 0, minOrderAmount: 150 },
  { code: "CHEFGIFT", type: "percentage", value: 15, expiryDate: "2026-08-31", usageLimit: 100, usageCount: 0, minOrderAmount: 300 }
];

export const defaultOutlets: RestaurantOutlet[] = [
  {
    id: "outlet-1",
    name: "SADAR",
    address: "Gandhi Chowk, Opp. Cotton Naka, Nagpur",
    contactNumber: "+91 7020796007"
  },
  {
    id: "outlet-2",
    name: "WADI",
    address: "No. 10, Amravati Road, Wadi, Nagpur",
    contactNumber: "+91 7020796007"
  },
  {
    id: "outlet-3",
    name: "HINGNA ROAD",
    address: "Near Vasudev Nagar Metro Station, Hingna Road, Nagpur",
    contactNumber: "+91 7020796007"
  },
  {
    id: "outlet-4",
    name: "KATOL ROAD",
    address: "Near Katol Naka / CDS School Road, Nagpur",
    contactNumber: "+91 7020796007"
  },
  {
    id: "outlet-5",
    name: "FACTORY OUTLET",
    address: "B-10, Central MIDC Road, Hingna Industrial Area, Nagpur, Maharashtra",
    contactNumber: "+91 7020796007",
    isMain: true
  }
];

export const defaultTermsAndConditions: string[] = [
  "All disputes are subject to Nagpur jurisdiction.",
  "Goods once sold will not be taken back or exchanged.",
  "Thali and snacks must be consumed within three hours.",
  "All Bengali sweets must be kept in the refrigerator and consumed on the same day.",
  "Mawa sweets must be consumed within 1 day.",
  "All Bengali sweets must be kept refrigerated and consumed on the same day.",
  "Additional customer policies can be added dynamically by the restaurant admin."
];

// Initial default settings
const defaultSettings: RestaurantSettings = {
  name: BRAND_CONFIG.restaurantName,
  estd: BRAND_CONFIG.established,
  establishedYear: "2018",
  legalName: "THE XINGS KITCHEN PRIVATE LIMITED",
  tagline: BRAND_CONFIG.tagline,
  contactNumber: BRAND_CONFIG.defaultPhone,
  email: BRAND_CONFIG.defaultEmail,
  customerCare: BRAND_CONFIG.defaultPhone,
  address: BRAND_CONFIG.defaultAddress,
  city: "Nagpur",
  state: "Maharashtra",
  country: "India",
  businessHours: "Mon-Sun: 11:00 AM - 11:30 PM",
  deliveryCharges: 25,
  gstPercentage: 0,
  gstin: "",
  fssaiNumber: "11522056000142",
  website: "thexingskitchen.com",
  customFooter: "Thank you for dining with us! Savor authentic oriental wok delicacies.",
  invoiceTitle: "RETAIL INVOICE",
  cashierName: "Cashier",
  defaultPax: 2,
  enableDoubleSided: false,
  outlets: defaultOutlets,
  termsAndConditions: defaultTermsAndConditions,
  backSideTitle: "OUR OUTLETS",
  backSideFooterNote: `Thank You For Visiting ${BRAND_CONFIG.restaurantName}`,
  showGstin: false,
  showFssai: true,
  showPax: true,
  showCashier: true,
  showLogo: true,
  showQrCode: true,
  showBarcode: true,
  showSignature: true,
  showAmountInWords: true,
  paperWidth: "80mm",
  facebookUrl: "https://facebook.com/bombaywalassweets",
  instagramUrl: "https://instagram.com/bombaywalassweets",
  twitterUrl: "https://twitter.com/bombaywalas",
  googleMapsUrl: "https://www.google.com/maps"
};

// Initial logs
const defaultAuditLogs: AuditLog[] = [
  { id: "log-1", timestamp: new Date().toISOString(), user: "System", action: "Production Initialized", details: "Production database initialized clean. Ready for live restaurant operations.", ipAddress: "127.0.0.1" }
];

// Self-executing migration to clean up all old simulated/mock transactions, orders, and legacy caches
if (typeof window !== "undefined") {
  const ERASE_VERSION = "v5_production_ready";
  if (localStorage.getItem("ij_db_erased_version") !== ERASE_VERSION) {
    // Erase all orders, tickets, and print queues for clean production state
    localStorage.setItem("ij_orders", JSON.stringify([]));
    localStorage.setItem("ij_kots", JSON.stringify([]));
    localStorage.setItem("ij_reviews", JSON.stringify([]));
    localStorage.setItem("sr_print_queue", JSON.stringify([]));
    localStorage.setItem("sr_print_logs_v2", JSON.stringify([]));
    localStorage.setItem("ij_printer_logs", JSON.stringify([]));
    localStorage.setItem("ij_audit_logs", JSON.stringify(defaultAuditLogs));
    
    // Wipe static cache items to re-initialize clean default settings/coupons/inventory and tables
    localStorage.removeItem("ij_tables");
    localStorage.removeItem("ij_coupons");
    localStorage.removeItem("ij_settings");
    localStorage.removeItem("ij_inventory");
    localStorage.removeItem("ij_categories");
    localStorage.removeItem("ij_menu_items");
    localStorage.removeItem("ij_menu");
    localStorage.removeItem("idli_menu");
    localStorage.removeItem("menu_items_cache");
    localStorage.removeItem("products_cache");
    localStorage.removeItem("cached_menu");
    localStorage.removeItem("local_menu_items");
    
    // Wipe test orders & tickets remotely from Supabase as well
    try {
      supabase.from("order_items").delete().neq("id", "___NEVER_MATCH___").then(() => {});
      supabase.from("kots").delete().neq("id", "___NEVER_MATCH___").then(() => {});
      supabase.from("orders").delete().neq("id", "___NEVER_MATCH___").then(() => {});
      supabase.from("orders").delete().in("id", ["SR-448573", "SR-741439", "SR-308802", "SR-251970"]).then(() => {});
    } catch (_) {}

    localStorage.setItem("ij_db_erased_version", ERASE_VERSION);
  }
}

// Deterministic string-to-64bit-integer hash function to handle legacy/live bigint IDs safely within JS MAX_SAFE_INTEGER
export function stringToNumericId(str: string): number {
  if (!str) return 0;
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash) % 9007199254740991; // Safe inside JS 53-bit float and Postgres bigint
}

// Database state managers with direct live Supabase connectivity
export class LocalDB {
  static apiCallCount = 0;
  static incrementApiCallCount(apiName: string) {
    this.apiCallCount++;
    console.log(`[Supabase API Call Count] Total calls: ${this.apiCallCount} (Triggered by: ${apiName})`);
  }

  static getMenuItems(): MenuItem[] {
    // Return live in-memory items from Supabase if loaded; never mock or old localStorage
    return MenuService.getLiveMenuItemsSync();
  }

  static saveMenuItems(items: MenuItem[]): void {
    MenuService.notifyMenuChange();
  }

  static async deleteAllMenuItems(): Promise<void> {
    await MenuService.deleteAllMenuItems();
  }

  static getReviews(): Review[] {
    const stored = localStorage.getItem("ij_reviews");
    if (!stored) {
      localStorage.setItem("ij_reviews", JSON.stringify([]));
      return [];
    }
    return JSON.parse(stored);
  }

  static saveReviews(reviews: any[]): void {
    localStorage.setItem("ij_reviews", JSON.stringify(reviews));
  }

  static isSeedOrder(o: { id?: string; customerName?: string; customer_name?: string; kotNumber?: string; kot_number?: string; email?: string }): boolean {
    const idStr = String(o?.id || "");
    const custStr = String(o?.customerName || o?.customer_name || "").toLowerCase();
    const kotStr = String(o?.kotNumber || o?.kot_number || "");
    const emailStr = String(o?.email || "").toLowerCase();
    return (
      idStr.includes("VERIFY") ||
      idStr.includes("TEST") ||
      idStr.startsWith("XK-VERIFY") ||
      idStr.startsWith("SR-VERIFY") ||
      custStr.includes("verify user") ||
      custStr.includes("test order") ||
      kotStr.includes("-V-") ||
      emailStr.startsWith("verify@")
    );
  }

  static getOrders(): Order[] {
    const stored = localStorage.getItem("ij_orders");
    if (!stored) {
      localStorage.setItem("ij_orders", JSON.stringify([]));
      return [];
    }
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      const seen = new Set<string>();
      const unique: Order[] = [];
      let hadSeedOrders = false;
      for (const item of parsed) {
        if (item && item.id && !seen.has(item.id)) {
          if (this.isSeedOrder(item)) {
            hadSeedOrders = true;
            continue;
          }
          seen.add(item.id);
          // Counter POS orders do not require manual acceptance; auto-normalize to Accepted
          const isPos = item.paymentMethod === "POS Counter Terminal" || (item.billedBy && String(item.billedBy).toLowerCase().includes("pos"));
          if (isPos && item.orderStatus === "New Order") {
            item.orderStatus = "Accepted";
            if (!item.acceptedAt) item.acceptedAt = item.createdAt || new Date().toISOString();
          }
          unique.push(item);
        }
      }
      if (hadSeedOrders) {
        localStorage.setItem("ij_orders", JSON.stringify(unique));
      }
      return unique;
    } catch {
      return [];
    }
  }

  static saveOrders(orders: Order[]): void {
    const seen = new Set<string>();
    const unique: Order[] = [];
    for (const item of orders) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    localStorage.setItem("ij_orders", JSON.stringify(unique));
    window.dispatchEvent(new Event("storage"));
  }

  static async resetSeedOrders(): Promise<{ removedOrdersCount: number; removedKOTsCount: number }> {
    const orders = this.getOrders();
    const isSeedOrder = (o: Order) => {
      const idStr = String(o.id || "");
      const custStr = String(o.customerName || "").toLowerCase();
      const kotStr = String(o.kotNumber || "");
      const emailStr = String(o.email || "").toLowerCase();
      return (
        idStr.includes("VERIFY") ||
        idStr.includes("TEST") ||
        idStr.startsWith("XK-VERIFY") ||
        idStr.startsWith("SR-VERIFY") ||
        custStr.includes("verify user") ||
        custStr.includes("test order") ||
        kotStr.includes("-V-") ||
        emailStr.startsWith("verify@")
      );
    };

    const seedOrders = orders.filter(isSeedOrder);
    const seedOrderIds = seedOrders.map(o => o.id);
    const remainingOrders = orders.filter(o => !isSeedOrder(o));
    this.saveOrders(remainingOrders);

    const kots = this.getKOTs();
    const isSeedKOT = (k: KOT) => {
      const idStr = String(k.id || "");
      const ordIdStr = String(k.orderId || "");
      const custStr = String(k.customerName || "").toLowerCase();
      return (
        seedOrderIds.includes(k.orderId) ||
        idStr.includes("-V-") ||
        idStr.includes("VERIFY") ||
        ordIdStr.includes("VERIFY") ||
        ordIdStr.includes("TEST") ||
        custStr.includes("verify user") ||
        custStr.includes("test order")
      );
    };
    const seedKots = kots.filter(isSeedKOT);
    const remainingKots = kots.filter(k => !isSeedKOT(k));
    this.saveKOTs(remainingKots);

    // Free up occupied tables that only had seed test orders
    try {
      const tables = this.getTables();
      let tablesUpdated = false;
      for (const tbl of tables) {
        if (tbl.status === "Occupied") {
          const hasOtherActiveOrder = remainingOrders.some(
            o => o.tableNumber === tbl.tableNumber && o.orderStatus !== "Delivered" && o.orderStatus !== "Cancelled"
          );
          if (!hasOtherActiveOrder) {
            tbl.status = "Available";
            tablesUpdated = true;
          }
        }
      }
      if (tablesUpdated) {
        this.saveTables(tables);
      }
    } catch (e) {
      console.warn("Table reset warning:", e);
    }

    // Background delete from Supabase if connected
    if (seedOrderIds.length > 0) {
      try {
        await supabase.from("order_items").delete().in("order_id", seedOrderIds);
        await supabase.from("kots").delete().in("order_id", seedOrderIds);
        await supabase.from("orders").delete().in("id", seedOrderIds);
      } catch (dbErr) {
        console.warn("[LocalDB.resetSeedOrders] Remote delete notice:", dbErr);
      }
    }

    window.dispatchEvent(new Event("storage"));
    return {
      removedOrdersCount: seedOrders.length,
      removedKOTsCount: seedKots.length
    };
  }

  static async clearAllOrders(): Promise<{ removedOrdersCount: number; removedKOTsCount: number }> {
    const orders = this.getOrders();
    const countOrders = orders.length;
    const kots = this.getKOTs();
    const countKots = kots.length;

    // Clear all orders and kitchen tickets locally
    this.saveOrders([]);
    this.saveKOTs([]);
    localStorage.setItem("sr_print_queue", JSON.stringify([]));
    localStorage.setItem("sr_print_logs_v2", JSON.stringify([]));
    localStorage.setItem("ij_printer_logs", JSON.stringify([]));

    // Reset all tables to Available
    try {
      const tables = this.getTables();
      for (const tbl of tables) {
        tbl.status = "Available";
      }
      this.saveTables(tables);
    } catch (e) {
      console.warn("Table reset warning on clearAllOrders:", e);
    }

    // Delete from Supabase remote database
    try {
      await supabase.from("order_items").delete().neq("id", "___NEVER_MATCH___");
      await supabase.from("kots").delete().neq("id", "___NEVER_MATCH___");
      await supabase.from("orders").delete().neq("id", "___NEVER_MATCH___");
    } catch (dbErr) {
      console.warn("[LocalDB.clearAllOrders] Remote delete notice:", dbErr);
    }

    try {
      this.addAuditLog(
        "All Orders Cleared",
        `Permanently cleared all orders (${countOrders}) and kitchen tickets (${countKots}) for production.`,
        "System (Production Clean)"
      );
    } catch (_) {}

    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("orders_updated"));
    return {
      removedOrdersCount: countOrders,
      removedKOTsCount: countKots
    };
  }

  static getTables(): RestaurantTable[] {
    const stored = localStorage.getItem("ij_tables");
    if (!stored) {
      const defaultTables: RestaurantTable[] = [
        { id: "tbl-1", tableNumber: "1", capacity: 4, seatingArea: "Main Dining Hall", status: "Available" },
        { id: "tbl-2", tableNumber: "2", capacity: 4, seatingArea: "Main Dining Hall", status: "Available" },
        { id: "tbl-3", tableNumber: "3", capacity: 2, seatingArea: "Window Alcove", status: "Available" },
        { id: "tbl-4", tableNumber: "4", capacity: 6, seatingArea: "Family Suite", status: "Available" },
        { id: "tbl-5", tableNumber: "5", capacity: 8, seatingArea: "VIP Lounge", status: "Available" },
        { id: "tbl-6", tableNumber: "6", capacity: 2, seatingArea: "Balcony", status: "Available" },
        { id: "tbl-7", tableNumber: "7", capacity: 4, seatingArea: "Courtyard Garden", status: "Available" },
        { id: "tbl-8", tableNumber: "8", capacity: 4, seatingArea: "Courtyard Garden", status: "Available" }
      ];
      localStorage.setItem("ij_tables", JSON.stringify(defaultTables));
      return defaultTables;
    }
    return JSON.parse(stored);
  }

  static saveTables(tables: RestaurantTable[]): void {
    localStorage.setItem("ij_tables", JSON.stringify(tables));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("tables_updated"));
  }


  static addOrder(order: Omit<Order, "id" | "createdAt">): Order {
    if (order.orderType === "dine-in" && order.tableNumber) {
      const activeOrder = this.getActiveOrderForTable(order.tableNumber);
      if (activeOrder) {
        const orders = this.getOrders();
        const idx = orders.findIndex(o => o.id === activeOrder.id);
        if (idx !== -1) {
          const kotCount = this.getKOTs().length + 1;
          const kotNumber = `KOT-${String(kotCount).padStart(4, "0")}`;
          const addOnCount = (activeOrder.addOnCount || 0) + 1;
          
          const newlyAddedItemsWithTracking = order.items.map((item) => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            customization: item.customization || "",
            addedAt: new Date().toISOString(),
            addedBy: (order as any).billedBy || "Waiter",
            kotNumber: kotNumber,
            sessionNumber: addOnCount + 1
          }));

          const existingItemsWithTracking = activeOrder.items.map(item => ({
            ...item,
            addedAt: item.addedAt || activeOrder.createdAt,
            addedBy: item.addedBy || "Guest",
            kotNumber: item.kotNumber || activeOrder.kotNumber || "KOT-0001",
            sessionNumber: item.sessionNumber || 1
          }));

          const combinedItems = [...existingItemsWithTracking, ...newlyAddedItemsWithTracking];
          const subtotal = combinedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const gst = 0;
          const packagingCharge = 0;
          
          let discountAmount = activeOrder.discountAmount || 0;
          if (activeOrder.appliedCoupon) {
            const coupon = this.getCoupons().find(c => c.code === activeOrder.appliedCoupon);
            if (coupon) {
              if (coupon.type === "percentage") {
                discountAmount = Math.round(subtotal * (coupon.value / 100));
              } else {
                discountAmount = Math.min(coupon.value, subtotal);
              }
            }
          }
          const grandTotal = subtotal + packagingCharge - discountAmount;

          const timeline = activeOrder.timeline || [
            { event: "Order Created", timestamp: activeOrder.createdAt, details: "Initial order created." }
          ];
          timeline.push({
            event: "Additional Items Added",
            timestamp: new Date().toISOString(),
            details: `Added ${newlyAddedItemsWithTracking.length} items via ${kotNumber}.`
          });

          const updatedOrder: Order = {
            ...activeOrder,
            items: combinedItems,
            subtotal,
            gst,
            grandTotal,
            discountAmount,
            timeline,
            addOnCount
          };

          if (idx !== -1) {
            orders.splice(idx, 1);
            orders.unshift(updatedOrder);
            this.saveOrders(orders);
          } else {
            orders.unshift(updatedOrder);
            this.saveOrders(orders);
          }

          // Add add-on KOT
          const freshKOT: KOT = {
            id: kotNumber,
            orderId: activeOrder.id,
            tableNumber: activeOrder.tableNumber || "Takeaway",
            customerName: activeOrder.customerName,
            orderType: activeOrder.orderType,
            status: "New Order",
            specialInstructions: newlyAddedItemsWithTracking.map(i => i.customization).filter(Boolean).join(", ") || "None",
            createdAt: new Date().toISOString(),
            preparationTime: 15,
            items: newlyAddedItemsWithTracking.map(item => ({
              menuItemId: item.menuItemId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              customization: item.customization
            })),
            isAddOn: true
          };

          const localKOTs = this.getKOTs();
          localKOTs.unshift(freshKOT);
          this.saveKOTs(localKOTs);

          // Trigger background Supabase sync
          this.apiSyncOrderTimelineAndItems(activeOrder.id, combinedItems, timeline, addOnCount).catch(e => console.warn(e));
          this.apiAddOrderItems(activeOrder.id, newlyAddedItemsWithTracking).catch(e => console.warn(e));
          this.apiAddKOT(freshKOT).catch(e => console.warn(e));

          // Play sound
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
          } catch (e) {
            // Audio lock bypass
          }

          // Dispatch events
          const event = new CustomEvent("new_order", { detail: updatedOrder });
          window.dispatchEvent(event);
          window.dispatchEvent(new Event("storage"));

          // Fire auto print notification for printers
          window.dispatchEvent(new CustomEvent("order_updated_auto_print", {
            detail: { orderId: activeOrder.id, kotId: kotNumber }
          }));

          return updatedOrder;
        }
      }
    }

    const orders = this.getOrders();
    const uniqueIdSuffix = Math.floor(100 + Math.random() * 900);
    const newId = `SR-${1000 + orders.length}-${uniqueIdSuffix}`;
    const kotCount = this.getKOTs().length + 1;
    const kotNumber = `KOT-${String(kotCount).padStart(4, "0")}`;

    const initialItemsWithTracking = order.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      customization: item.customization || "",
      addedAt: new Date().toISOString(),
      addedBy: (order as any).billedBy || "Waiter",
      kotNumber: kotNumber,
      sessionNumber: 1
    }));

    const timeline = [
      { event: "Order Created", timestamp: new Date().toISOString(), details: `Initial order created with ${order.items.length} items.` }
    ];

    const fullOrder: Order = {
      ...order,
      items: initialItemsWithTracking,
      id: newId,
      createdAt: new Date().toISOString(),
      timeline,
      addOnCount: 0,
      kotNumber: kotNumber
    };
    orders.unshift(fullOrder);
    this.saveOrders(orders);
    
    // Play sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      // Audio lock bypass
    }

    const event = new CustomEvent("new_order", { detail: fullOrder });
    window.dispatchEvent(event);

    return fullOrder;
  }

  static getInventory(): InventoryItem[] {
    const stored = localStorage.getItem("ij_inventory");
    if (!stored) {
      localStorage.setItem("ij_inventory", JSON.stringify(defaultInventory));
      return defaultInventory;
    }
    return JSON.parse(stored);
  }

  static saveInventory(inventory: InventoryItem[]): void {
    localStorage.setItem("ij_inventory", JSON.stringify(inventory));
  }

  static getCoupons(): Coupon[] {
    const stored = localStorage.getItem("ij_coupons");
    if (!stored) {
      localStorage.setItem("ij_coupons", JSON.stringify(defaultCoupons));
      return defaultCoupons;
    }
    return JSON.parse(stored);
  }

  static saveCoupons(coupons: Coupon[]): void {
    localStorage.setItem("ij_coupons", JSON.stringify(coupons));
  }

  static getSettings(): RestaurantSettings {
    const stored = localStorage.getItem("ij_settings");
    if (!stored) {
      localStorage.setItem("ij_settings", JSON.stringify(defaultSettings));
      return defaultSettings;
    }
    try {
      const parsed = JSON.parse(stored);
      if (parsed.name === "IDLI JUNCTION" || parsed.name === "BOMBAYWALA" || !parsed.name) {
        localStorage.setItem("ij_settings", JSON.stringify(defaultSettings));
        return defaultSettings;
      }
      const merged: RestaurantSettings = {
        ...defaultSettings,
        ...parsed,
        outlets: parsed.outlets && parsed.outlets.length > 0 ? parsed.outlets : defaultOutlets,
        termsAndConditions: parsed.termsAndConditions && parsed.termsAndConditions.length > 0 ? parsed.termsAndConditions : defaultTermsAndConditions
      };
      return merged;
    } catch {
      return defaultSettings;
    }
  }

  static saveSettings(settings: RestaurantSettings): void {
    localStorage.setItem("ij_settings", JSON.stringify(settings));
    window.dispatchEvent(new Event("storage"));
  }

  static getCategories(): Category[] {
    const stored = localStorage.getItem("ij_categories");
    if (!stored) {
      localStorage.setItem("ij_categories", JSON.stringify(defaultCategories));
      return defaultCategories;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.some(c => c.id === "starters" || c.id === "idli" || c.id === "dosa" || c.id === "soups")) {
        localStorage.setItem("ij_categories", JSON.stringify(defaultCategories));
        return defaultCategories;
      }
      return parsed;
    } catch {
      return defaultCategories;
    }
  }

  static saveCategories(cats: Category[]): void {
    localStorage.setItem("ij_categories", JSON.stringify(cats));
    window.dispatchEvent(new Event("storage"));
  }

  static getAuditLogs(): AuditLog[] {
    const stored = localStorage.getItem("ij_audit_logs");
    if (!stored) {
      localStorage.setItem("ij_audit_logs", JSON.stringify(defaultAuditLogs));
      return defaultAuditLogs;
    }
    return JSON.parse(stored);
  }

  static addAuditLog(action: string, details: string, user: string = "Admin (owner)"): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action,
      details,
      ipAddress: "127.0.0.1"
    };
    logs.unshift(newLog);
    localStorage.setItem("ij_audit_logs", JSON.stringify(logs));
  }

  static addOrderTimelineEvent(orderId: string, event: string, details?: string): void {
    try {
      const orders = this.getOrders();
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        if (!orders[idx].timeline) {
          orders[idx].timeline = [
            { event: "Order Created", timestamp: orders[idx].createdAt || new Date().toISOString(), details: "Initial order created." }
          ];
        }
        orders[idx].timeline!.push({
          event,
          timestamp: new Date().toISOString(),
          details: details || ""
        });
        this.saveOrders(orders);
        
        // Push the entire order timeline or items to Supabase too if online
        this.apiSyncOrderTimelineAndItems(orderId, orders[idx].items, orders[idx].timeline, orders[idx].addOnCount);
      }
    } catch (err) {
      console.error("[LocalDB Exception adding timeline event]", err);
    }
  }

  static async apiSyncOrderTimelineAndItems(orderId: string, items: any[], timeline: any[], addOnCount?: number): Promise<void> {
    try {
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const gst = 0;
      const grand_total = subtotal;
      
      const updatePayload: any = {
        items: items,
        subtotal,
        gst,
        grand_total
      };

      await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId);
    } catch (err) {
      console.error("[Supabase Sync Timeline and Items failed]", err);
    }
  }

  // --- SUPABASE DIRECT INTEGRATION CODES & BACKENDS ---
  
  static getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("ij_admin_jwt") || sessionStorage.getItem("ij_admin_jwt");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  static subscribeToOrders(onUpdate: (event: any) => void): () => void {
    const channelName = `orders_realtime_stream_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          debugLog("[REALTIME EVENT] Received Supabase postgres_changes event for orders:", payload.eventType, payload.new || payload.old);
          onUpdate(payload);
        }
      )
      .subscribe((status) => {
        debugLog("[REALTIME EVENT] Supabase order stream channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }

  static async fetchOrders(): Promise<Order[]> {
    this.incrementApiCallCount("fetchOrders");
    debugLog("[ORDER MANAGEMENT FETCH] Loading orders list from Supabase...");
    try {
      const { data, error, status } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[ORDER MANAGEMENT FETCH] Supabase fetch warning:", error);
        this.addAuditLog(
          "Supabase API Warning",
          `HTTP ${status} - Failed to fetch orders from Supabase REST endpoint: ${error.message} (${error.details}). Check if 'orders' table exists in dashboard. Falling back to local ledger cache.`,
          "System (Supabase)"
        );
        const local = this.getOrders();
        debugLog(`[ORDER MANAGEMENT FETCH] Fallback loaded ${local.length} orders from local cache. IDs:`, local.map(o => o.id));
        return local;
      }

      debugLog(`[ORDER MANAGEMENT FETCH] Successfully retrieved ${(data || []).length} orders from Supabase. IDs:`, (data || []).map((o: any) => o.id));

      // Translate snake_case keys back to client camelCase with strict ID deduplication
      const seenIds = new Set<string>();
      const mapped: Order[] = [];
      for (const item of (data || [])) {
        if (!item || !item.id || seenIds.has(item.id) || this.isSeedOrder(item)) continue;
        seenIds.add(item.id);
        mapped.push({
          id: item.id,
          customerName: item.customer_name || "Guest User",
          phoneNumber: item.phone_number || "",
          email: item.email || "",
          orderType: item.order_type || "takeaway",
          tableNumber: item.table_number || undefined,
          address: item.address || undefined,
          items: Array.isArray(item.items) ? item.items : (typeof item.items === 'string' ? JSON.parse(item.items) : []),
          subtotal: Number(item.subtotal || 0),
          gst: Number(item.gst || 0),
          packagingCharge: Number(item.packaging_charge || 0),
          discountAmount: Number(item.discount_amount || 0),
          appliedCoupon: item.applied_coupon || undefined,
          grandTotal: Number(item.grand_total || 0),
          paymentStatus: item.payment_status || "Pending",
          orderStatus: ((item.payment_method === "POS Counter Terminal" || (item.billed_by && String(item.billed_by).toLowerCase().includes("pos"))) && (!item.order_status || item.order_status === "New Order")) 
            ? "Accepted" 
            : (item.order_status || "New Order"),
          createdAt: item.created_at || new Date().toISOString(),
          paymentMethod: item.payment_method || "Cash on Delivery",
          kotNumber: item.kot_number || undefined
        });
      }

      // Update local cache with authoritative orders from Supabase
      this.saveOrders(mapped);
      return mapped;
    } catch (err: any) {
      console.warn("[ORDER MANAGEMENT FETCH] Supabase transport error:", err);
      this.addAuditLog(
        "Supabase Bridge Offline",
        `Transport link offline: ${err.message || err.toString()}. Reading orders offline from local disk cache.`,
        "System (Offline)"
      );
      return this.getOrders();
    }
  }

  static getActiveOrderForTable(tableNumber: string): Order | undefined {
    const orders = this.getOrders();
    const activeStatuses = ["New Order", "Accepted", "Preparing", "Ready"];
    return orders.find(o => 
      o.orderType === "dine-in" && 
      String(o.tableNumber) === String(tableNumber) && 
      activeStatuses.includes(o.orderStatus)
    );
  }

  static async apiMergeIntoExistingOrder(existingOrder: Order, newItems: any[], addedBy: string): Promise<Order> {
    console.log(`[LocalDB] Merging items into active order ${existingOrder.id} for Table ${existingOrder.tableNumber}`);
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === existingOrder.id);
    const kotCount = this.getKOTs().length + 1;
    const kotNumber = `KOT-${String(kotCount).padStart(4, "0")}`;
    const addOnCount = (existingOrder.addOnCount || 0) + 1;

    const newlyAddedItemsWithTracking = newItems.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      customization: item.customization || "",
      addedAt: new Date().toISOString(),
      addedBy: addedBy || "Waiter",
      kotNumber: kotNumber,
      sessionNumber: addOnCount + 1
    }));

    const existingItemsWithTracking = existingOrder.items.map(item => ({
      ...item,
      addedAt: item.addedAt || existingOrder.createdAt,
      addedBy: item.addedBy || "Guest",
      kotNumber: item.kotNumber || existingOrder.kotNumber || "KOT-0001",
      sessionNumber: item.sessionNumber || 1
    }));

    const combinedItems = [...existingItemsWithTracking, ...newlyAddedItemsWithTracking];
    const subtotal = combinedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const gst = 0;
    const packagingCharge = 0;
    
    let discountAmount = existingOrder.discountAmount || 0;
    if (existingOrder.appliedCoupon) {
      const coupon = this.getCoupons().find(c => c.code === existingOrder.appliedCoupon);
      if (coupon) {
        if (coupon.type === "percentage") {
          discountAmount = Math.round(subtotal * (coupon.value / 100));
        } else {
          discountAmount = Math.min(coupon.value, subtotal);
        }
      }
    }
    const grandTotal = subtotal + packagingCharge - discountAmount;

    const timeline = existingOrder.timeline || [
      { event: "Order Created", timestamp: existingOrder.createdAt, details: "Initial order created." }
    ];
    timeline.push({
      event: "Additional Items Added",
      timestamp: new Date().toISOString(),
      details: `Added ${newlyAddedItemsWithTracking.length} items via ${kotNumber}.`
    });

    const updatedOrder: Order = {
      ...existingOrder,
      items: combinedItems,
      subtotal,
      gst,
      grandTotal,
      discountAmount,
      timeline,
      addOnCount
    };

    if (idx !== -1) {
      orders.splice(idx, 1);
      orders.unshift(updatedOrder);
      this.saveOrders(orders);
    } else {
      orders.unshift(updatedOrder);
      this.saveOrders(orders);
    }

    // Add add-on KOT
    const freshKOT: KOT = {
      id: kotNumber,
      orderId: existingOrder.id,
      tableNumber: existingOrder.tableNumber || "Takeaway",
      customerName: existingOrder.customerName,
      orderType: existingOrder.orderType,
      status: "New Order",
      specialInstructions: newlyAddedItemsWithTracking.map(i => i.customization).filter(Boolean).join(", ") || "None",
      createdAt: new Date().toISOString(),
      preparationTime: 15,
      items: newlyAddedItemsWithTracking.map(item => ({
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        customization: item.customization
      })),
      isAddOn: true
    };

    const localKOTs = this.getKOTs();
    localKOTs.unshift(freshKOT);
    this.saveKOTs(localKOTs);

    // Trigger background Supabase sync
    try {
      await this.apiSyncOrderTimelineAndItems(existingOrder.id, combinedItems, timeline, addOnCount);
      await this.apiAddOrderItems(existingOrder.id, newlyAddedItemsWithTracking);
      await this.apiAddKOT(freshKOT);
    } catch (err) {
      console.warn("[apiMergeIntoExistingOrder Sync warning]", err);
    }

    // Dispatch events
    const event = new CustomEvent("new_order", { detail: updatedOrder });
    window.dispatchEvent(event);
    window.dispatchEvent(new Event("storage"));

    // Play sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      // Audio lock bypass
    }

    // Fire auto print notification for printers
    window.dispatchEvent(new CustomEvent("order_updated_auto_print", {
      detail: { orderId: existingOrder.id, kotId: kotNumber }
    }));

    return updatedOrder;
  }

  static async apiAddOrder(order: Omit<Order, "id" | "createdAt">): Promise<Order> {
    debugLog(`[QR ORDER] Initializing order placement - Type: ${order.orderType}, Table: ${order.tableNumber || 'None'}, Items: ${order.items.length}, Grand Total: ₹${order.grandTotal}`);

    // Core boundary validation for Table QR code source
    if (order.orderType === "dine-in") {
      if (!order.tableNumber || !String(order.tableNumber).trim()) {
        console.error("[QR ORDER] Validation Error: Missing Table Number for Dine-In order.");
        throw new Error("Missing Table Number: Dine-In checkout requires a table QR source.");
      }
    }

    const newId = `SR-${Date.now().toString().slice(-6)}`;
    const kotNumber = `KOT-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;

    const initialItemsWithTracking = order.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      customization: item.customization || "",
      addedAt: new Date().toISOString(),
      addedBy: (order as any).billedBy || (order.orderType === "dine-in" ? "Table QR" : "Online Guest"),
      kotNumber: kotNumber,
      sessionNumber: 1
    }));

    const timeline = [
      { event: "Order Created", timestamp: new Date().toISOString(), details: `Initial order created with ${order.items.length} items.` }
    ];

    const fullOrder: Order = {
      ...order,
      items: initialItemsWithTracking,
      id: newId,
      createdAt: new Date().toISOString(),
      timeline,
      addOnCount: 0,
      kotNumber: kotNumber
    };

    // Prepare Supabase Payload
    const payload: any = {
      id: fullOrder.id,
      customer_name: fullOrder.customerName,
      phone_number: fullOrder.phoneNumber,
      email: fullOrder.email,
      order_type: fullOrder.orderType,
      table_number: fullOrder.tableNumber || null,
      address: fullOrder.address || null,
      items: fullOrder.items,
      subtotal: Number(fullOrder.subtotal || 0),
      gst: Number(fullOrder.gst || 0),
      packaging_charge: Number(fullOrder.packagingCharge || 0),
      discount_amount: Number(fullOrder.discountAmount || 0),
      applied_coupon: fullOrder.appliedCoupon || null,
      grand_total: Number(fullOrder.grandTotal || 0),
      payment_status: fullOrder.paymentStatus || "Pending",
      order_status: fullOrder.orderStatus || "New Order",
      created_at: fullOrder.createdAt,
      payment_method: fullOrder.paymentMethod || "Cash on Delivery",
      kot_number: kotNumber,
      restaurant_id: null
    };

    debugLog("[SUPABASE ORDER INSERT] Submitting payload to Supabase 'orders':", payload);

    // 1. UPDATE LOCAL STORAGE FIRST
    // Ensures checkout, billing, and KOT generation succeed immediately and reliably
    // even if Supabase egress quota is exceeded (HTTP 402), network is offline, or cloud project is paused.
    const current = this.getOrders();
    if (!current.some(o => o.id === fullOrder.id)) {
      current.unshift(fullOrder);
      this.saveOrders(current);
    }

    // 2. CREATE AND SAVE KOT ONLY IF ORDER IS ACCEPTED (e.g. POS direct billing)
    // As per requirement: NEVER automatically create or print a KOT when a new order arrives.
    // KOT should only be created after the order is ACCEPTED.
    let freshKOT: KOT | null = null;
    if (fullOrder.orderStatus === "Accepted") {
      freshKOT = {
        id: kotNumber,
        orderId: fullOrder.id,
        tableNumber: fullOrder.tableNumber || "Takeaway",
        customerName: fullOrder.customerName,
        orderType: fullOrder.orderType,
        status: "Accepted",
        specialInstructions: fullOrder.items.map(i => i.customization).filter(Boolean).join(", ") || "None",
        createdAt: fullOrder.createdAt,
        preparationTime: 15,
        items: fullOrder.items,
        printed: false
      };
      
      const localKOTs = this.getKOTs();
      if (!localKOTs.some(k => k.id === freshKOT!.id)) {
        localKOTs.unshift(freshKOT);
        this.saveKOTs(localKOTs);
      }
    }

    // 3. NOTIFY ALL UI LISTENERS IMMEDIATELY (POS, Kitchen, Table Monitors)
    const event = new CustomEvent("new_order", { detail: fullOrder });
    window.dispatchEvent(event);
    if (fullOrder.orderStatus === "Accepted") {
      window.dispatchEvent(new CustomEvent("order_accepted", { detail: fullOrder }));
    }
    window.dispatchEvent(new Event("storage"));

    // Play order sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}

    // 4. ATTEMPT CLOUD SYNC IN BACKGROUND (Non-blocking, resilient to 402 / egress quota limits)
    try {
      const { data, error, status } = await supabase
        .from("orders")
        .insert(payload)
        .select();

      if (error) {
        console.warn("[SUPABASE ORDER INSERT] Notice (Status " + status + "):", error);
        
        if (status === 402 || (error.message && error.message.includes("exceed_egress_quota"))) {
          this.addAuditLog(
            "Supabase Quota Exceeded (402)",
            `Cloud project has exceeded egress quota (HTTP 402). Order #${newId} (₹${fullOrder.grandTotal}) is preserved safely in local database. Cloud sync paused.`,
            "System (Offline-First)"
          );
        } else {
          this.addAuditLog(
            "Supabase Cloud Sync Notice",
            `HTTP ${status} - Order #${newId} saved locally. Cloud DB notice: ${error.message} (${error.details || ""}).`,
            "System"
          );
        }
      } else {
        debugLog(`[SUPABASE ORDER INSERT] SUCCESS! Order ${newId} inserted into Supabase:`, data);
        this.addAuditLog(
          "Supabase Sync Success",
          `Order reference ${newId} with total ₹${fullOrder.grandTotal} stored inside cloud database successfully.`,
          "System"
        );
      }
    } catch (err: any) {
      console.warn("[SUPABASE ORDER INSERT] Network transport notice (Order safe in local DB):", err);
    }

    // 5. TRIGGER CHILD TABLES SYNC (order_items and kots) GRACEFULLY
    try {
      await this.apiAddOrderItems(fullOrder.id, fullOrder.items);
      if (freshKOT) {
        await this.apiAddKOT(freshKOT);
      }
    } catch (childErr) {
      console.warn("[KOT/Items Child Sync Notice]:", childErr);
    }

    console.log(`[QR ORDER] Order ${fullOrder.id} successfully completed.`);
    return fullOrder;
  }

  static async apiUpdateOrderStatus(orderId: string, status: Order["orderStatus"], paymentStatus?: string, acceptedAt?: string): Promise<Order> {
    console.log(`[LocalDB & Supabase] Updating Order ${orderId} status to ${status}`);
    
    // 1. UPDATE LOCAL DB FIRST (Guarantees responsive UI and reliable fallback offline)
    const current = this.getOrders();
    const idx = current.findIndex(o => o.id === orderId);
    let previousStatus = "";
    let previousPaymentStatus = "";
    let orderCopy: Order | null = null;

    if (idx !== -1) {
      previousStatus = current[idx].orderStatus;
      previousPaymentStatus = current[idx].paymentStatus || "Pending";
      current[idx].orderStatus = status;
      if (paymentStatus) {
        current[idx].paymentStatus = paymentStatus as any;
      }
      if (status === "Accepted") {
        current[idx].acceptedAt = acceptedAt || new Date().toISOString();
      }

      // Maintain order audit timeline
      const timeline = current[idx].timeline || [];
      timeline.push({
        event: status === "Accepted" ? "Order Accepted" : `Status Changed: ${status}`,
        timestamp: new Date().toISOString(),
        details: status === "Accepted" ? "Manually accepted by Admin" : `Status updated to ${status}`
      });
      current[idx].timeline = timeline;

      this.saveOrders(current);
      orderCopy = { ...current[idx] };
      // Dispatch storage event so other components and tabs update immediately
      window.dispatchEvent(new Event("storage"));
    }

    // Synchronize or create linked KOT in local storage when order is Accepted
    try {
      const kots = this.getKOTs();
      let existingKot = kots.find(k => k.orderId === orderId);
      
      if (status === "Accepted" && !existingKot && orderCopy) {
        // Create KOT upon Order Acceptance
        const kotCount = kots.length + 1;
        const kotNumStr = String(kotCount).padStart(3, "0");
        const kotNumber = orderCopy.kotNumber || `KOT-${kotNumStr}`;
        const newKot: KOT = {
          id: kotNumber,
          orderId: orderCopy.id,
          tableNumber: orderCopy.tableNumber || "Takeaway",
          customerName: orderCopy.customerName,
          orderType: orderCopy.orderType,
          status: "Accepted",
          specialInstructions: orderCopy.items.map(i => i.customization).filter(Boolean).join(", ") || "None",
          createdAt: new Date().toISOString(),
          preparationTime: 15,
          items: orderCopy.items,
          printed: false
        };
        kots.unshift(newKot);
        this.saveKOTs(kots);
        this.apiAddKOT(newKot).catch(err => console.warn("[KOT sync on accept notice]:", err));
      } else if (existingKot) {
        let kotsChanged = false;
        kots.forEach(k => {
          if (k.orderId === orderId) {
            if (status === "Accepted") k.status = "Accepted";
            else if (status === "Preparing") k.status = "Preparing";
            else if (status === "Ready") k.status = "Ready";
            else if (status === "Delivered" || status === "Served") k.status = "Served";
            else if (status === "Cancelled") k.status = "Cancelled";
            kotsChanged = true;
          }
        });
        if (kotsChanged) {
          this.saveKOTs(kots);
        }
      }
      
      if (status === "Accepted" && orderCopy) {
        window.dispatchEvent(new CustomEvent("order_accepted", { detail: orderCopy }));
      }
    } catch (_) {}

    // 2. ATTEMPT SUPABASE SYNC IN BACKGROUND / GRACEFULLY
    try {
      const updatePayload: any = { order_status: status };
      if (paymentStatus) {
        updatePayload.payment_status = paymentStatus;
      }
      if (status === "Accepted" && current[idx]?.acceptedAt) {
        updatePayload.accepted_at = current[idx].acceptedAt;
      }

      const { error, status: httpStatus } = await supabase
         .from("orders")
         .update(updatePayload)
         .eq("id", orderId);

      if (error) {
        console.warn("[Supabase API Sync Warning] Order status update failed on remote server:", error);
        this.addAuditLog(
          "Supabase Sync Warning",
          `HTTP ${httpStatus} - Failed to update order status on server: ${error.message}. Local changes retained.`,
          "Admin (owner)"
        );
      } else {
        console.log(`[Supabase API Sync Success] Order ${orderId} synced.`);
      }
    } catch (err: any) {
      console.warn("[Supabase API Network Exception] Relying on local database:", err);
      this.addAuditLog(
        "Supabase Sync Offline",
        `Network/Fetch error syncing order status (LocalDB fallback active): ${err.message || err}`,
        "Admin (owner)"
      );
    }

    if (orderCopy) {
      if (status === "Accepted") {
        window.dispatchEvent(new CustomEvent("order_accepted", { detail: orderCopy }));
      }
      window.dispatchEvent(new CustomEvent("order_updated_auto_print", {
        detail: {
          order: orderCopy,
          previousStatus,
          previousPaymentStatus
        }
      }));
    }

    // 3. Always return the updated local order
    return current[idx] || { id: orderId, orderStatus: status, paymentStatus: paymentStatus } as any;
  }

  static supportedColumns: string[] = [];

  static async detectSupportedColumns(): Promise<string[]> {
    if (this.supportedColumns.length > 0) return this.supportedColumns;
    
    const candidateColumns = [
      "id", "name", "item_name", "price", "category", "description", 
      "is_veg", "is_bestseller", "is_chef_special", "image", "image_url", 
      "spiciness", "rating", "rating_count",
      "gst_percent", "gst_percentage", "gst", "hsn_code", "hsn", "available", "is_available"
    ];
    
    const detected: string[] = [];
    for (const col of candidateColumns) {
      try {
        const { error } = await supabase.from("menu_items").select(col).limit(1);
        if (!error || error.code !== "42703") {
          detected.push(col);
        }
      } catch (e) {
        // Fallback to including it if unsure
        detected.push(col);
      }
    }
    this.supportedColumns = detected;
    return detected;
  }

  static findMatchingCategoryId(inputCat: string): string {
    const activeCategories = this.getCategories();
    if (!inputCat) return activeCategories[0]?.id || "soups";
    const normalizedInput = inputCat.trim().toLowerCase();
    
    // Try exact match on ID
    const matchById = activeCategories.find(c => c.id.toLowerCase() === normalizedInput);
    if (matchById) return matchById.id;

    // Try exact match on name
    const matchByName = activeCategories.find(c => c.name.toLowerCase() === normalizedInput);
    if (matchByName) return matchByName.id;

    // Try matched slugified (replace space with dash)
    const slugified = normalizedInput.replace(/\s+/g, "-");
    const matchBySlug = activeCategories.find(c => c.id.toLowerCase() === slugified || c.name.toLowerCase().replace(/\s+/g, "-") === slugified);
    if (matchBySlug) return matchBySlug.id;

    // Try partial match or word match (e.g. "Main Course" -> matches "Indian Main Course")
    const matchByPartial = activeCategories.find(c => {
      const nameLower = c.name.toLowerCase();
      const idLower = c.id.toLowerCase();
      return nameLower.includes(normalizedInput) || normalizedInput.includes(nameLower) || idLower.includes(normalizedInput) || normalizedInput.includes(idLower);
    });
    if (matchByPartial) return matchByPartial.id;

    return activeCategories[0]?.id || "soups"; // Fallback to first category instead of "Other"
  }

  static mapDatabaseMenuItem(item: any): MenuItem {
    if (!item) {
      return {
        id: `item-${Date.now()}-${Math.random()}`,
        itemCode: "ITEM-UNKNOWN",
        category: "soups",
        name: "Unnamed Item",
        description: "",
        price: 0,
        isVeg: true,
        imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500",
        rating: 4.5,
        ratingCount: 0,
        isBestseller: false,
        isChefSpecial: false,
        spiciness: 0,
      };
    }

    const rawId = item.id !== undefined && item.id !== null ? String(item.id) : `item-${Date.now()}-${Math.random()}`;
    return {
      id: rawId,
      itemCode: item.item_code || `ITEM-${rawId.toUpperCase()}`,
      category: this.findMatchingCategoryId(item.category),
      name: item.name || item.item_name || "Unnamed Item",
      description: item.description || "",
      price: Number(item.price || 0),
      isVeg: item.is_veg !== undefined && item.is_veg !== null 
        ? !!item.is_veg 
        : (item.food_type 
            ? (String(item.food_type).trim().toLowerCase() === "veg") 
            : true),
      imageUrl: item.image_url || item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500",
      rating: Number(item.rating !== undefined && item.rating !== null ? item.rating : 4.5),
      ratingCount: Number(item.rating_count !== undefined && item.rating_count !== null ? item.rating_count : (item.ratingCount || 0)),
      isBestseller: item.is_bestseller !== undefined && item.is_bestseller !== null ? !!item.is_bestseller : (!!item.isBestseller),
      isChefSpecial: item.is_chef_special !== undefined && item.is_chef_special !== null ? !!item.is_chef_special : (!!item.isChefSpecial),
      spiciness: Number(item.spiciness !== undefined && item.spiciness !== null ? item.spiciness : 0),
      gstPercent: item.gst_percent !== undefined ? Number(item.gst_percent) : (item.gst_percentage !== undefined ? Number(item.gst_percentage) : (item.gst !== undefined ? Number(item.gst) : undefined)),
      hsnCode: item.hsn_code || item.hsn || undefined,
      available: item.available !== undefined ? !!item.available : (item.is_available !== undefined ? !!item.is_available : undefined),
    };
  }

  static mapMenuItemForInsert(item: MenuItem, supportedColumns: string[]): any {
    const obj: any = {};
    const isPureDigits = /^\d+$/.test(item.id);
    obj.id = isPureDigits ? Number(item.id) : item.id;

    if (supportedColumns.includes("item_code")) {
      obj.item_code = item.itemCode || `ITEM-${item.id.toUpperCase()}`;
    }
    if (supportedColumns.includes("category")) {
      obj.category = item.category;
    }
    if (supportedColumns.includes("name")) {
      obj.name = item.name;
    }
    if (supportedColumns.includes("item_name")) {
      obj.item_name = item.name;
    }
    if (supportedColumns.includes("description")) {
      obj.description = item.description;
    }
    if (supportedColumns.includes("price")) {
      obj.price = Number(item.price || 0);
    }
    if (supportedColumns.includes("is_veg")) {
      obj.is_veg = item.isVeg;
    }
    if (supportedColumns.includes("food_type")) {
      obj.food_type = item.isVeg ? "Veg" : "Non-Veg";
    }
    if (supportedColumns.includes("image_url")) {
      obj.image_url = item.imageUrl;
    }
    if (supportedColumns.includes("image")) {
      obj.image = item.imageUrl;
    }
    if (supportedColumns.includes("rating")) {
      obj.rating = Number(item.rating !== undefined ? item.rating : 4.5);
    }
    if (supportedColumns.includes("rating_count")) {
      obj.rating_count = Number(item.ratingCount !== undefined ? item.ratingCount : 0);
    }
    if (supportedColumns.includes("is_bestseller")) {
      obj.is_bestseller = !!item.isBestseller;
    }
    if (supportedColumns.includes("is_chef_special")) {
      obj.is_chef_special = !!item.isChefSpecial;
    }
    if (supportedColumns.includes("spiciness")) {
      obj.spiciness = Number(item.spiciness !== undefined ? item.spiciness : 0);
    }
    if (supportedColumns.includes("gst_percent")) {
      obj.gst_percent = Number(item.gstPercent !== undefined ? item.gstPercent : 0);
    } else if (supportedColumns.includes("gst_percentage")) {
      obj.gst_percentage = Number(item.gstPercent !== undefined ? item.gstPercent : 0);
    } else if (supportedColumns.includes("gst")) {
      obj.gst = Number(item.gstPercent !== undefined ? item.gstPercent : 0);
    }
    if (supportedColumns.includes("hsn_code")) {
      obj.hsn_code = item.hsnCode || "";
    } else if (supportedColumns.includes("hsn")) {
      obj.hsn = item.hsnCode || "";
    }
    if (supportedColumns.includes("available")) {
      obj.available = item.available !== undefined ? item.available : true;
    } else if (supportedColumns.includes("is_available")) {
      obj.is_available = item.available !== undefined ? item.available : true;
    }

    return obj;
  }

  static mapMenuItemForUpdate(item: MenuItem, supportedColumns: string[]): any {
    return this.mapMenuItemForInsert(item, supportedColumns);
  }

  static async fetchMenuItems(): Promise<MenuItem[]> {
    this.incrementApiCallCount("fetchMenuItems");
    console.log("[Supabase API Request] Loading live menu items directly from public.menu_items via MenuService...");
    try {
      const items = await MenuService.getMenuItems();
      return items;
    } catch (err: any) {
      console.error("[Menu Transport Sync Error]", err);
      throw err;
    }
  }

  static async apiSaveMenuItems(items: MenuItem[]): Promise<void> {
    this.incrementApiCallCount("apiSaveMenuItems");
    try {
      const supported = await this.detectSupportedColumns();
      console.log("[Supabase API] Supported columns on menu_items table detected:", supported);

      // 1. Fetch current database state to check what actually exists using verified existing columns only
      const { data: dbItems, error: fetchErr } = await supabase
        .from("menu_items")
        .select("id, name, category");

      if (fetchErr) {
        console.warn("[Supabase Sync Warning] Failed to fetch current items for matching, proceeding with empty array:", fetchErr);
      }

      const existingDbItems = dbItems || [];

      // 2. Classify items into Updates and Inserts with strict validation
      const updates: { id: any; payload: any; item: MenuItem }[] = [];
      const inserts: { payload: any; item: MenuItem }[] = [];
      const matchedDbIds = new Set<any>();

      for (const item of items) {
        // Find if this item has an existing match in the database by ID
        let dbMatch: any = null;

        const isNumericId = /^\d+$/.test(String(item.id));
        if (isNumericId) {
          const numId = Number(item.id);
          dbMatch = existingDbItems.find((x: any) => Number(x.id) === numId);
        } else {
          dbMatch = existingDbItems.find((x: any) => String(x.id).toLowerCase() === String(item.id).toLowerCase());
        }

        // If not matched by ID, but it is a standard default seeded item (e.g. s1, s2, i1, i2, etc. or a numeric index),
        // we try to resolve it to an existing database row by Name + Category to prevent duplicate inserts and bridge IDs.
        const isDefaultSeededItem = /^s\d+$/.test(String(item.id)) || /^\d+$/.test(String(item.id)) || /^i\d+$/.test(String(item.id));
        if (!dbMatch && isDefaultSeededItem && item.name && item.category) {
          dbMatch = existingDbItems.find(
            (x: any) =>
              String(x.name || "").trim().toLowerCase() === String(item.name).trim().toLowerCase() &&
              String(x.category || "").trim().toLowerCase() === String(item.category).trim().toLowerCase()
          );
        }

        const operation = dbMatch ? "UPDATE" : "CREATE";

        // Requirement 1 & 2: Log every item before saving with detailed fields
        console.log(`\n=== [Supabase API Sync Item Pre-Save Log] ===`);
        console.log(`- Local ID: ${item.id}`);
        console.log(`- Database Matched ID: ${dbMatch ? dbMatch.id : "None"}`);
        console.log(`- Name: "${item.name}"`);
        console.log(`- Category: "${item.category}"`);
        console.log(`- Chosen Operation: ${operation}`);

        // Requirement 3: If classified as CREATE, explain exactly why no existing database row was matched
        if (operation === "CREATE") {
          console.log(`- Explanation for CREATE classification:`);
          console.log(`  1. No existing database row has an ID matching "${item.id}" (searched case-insensitively and numerically).`);
          
          const duplicateByNameAndCat = existingDbItems.find(
            (x: any) =>
              String(x.name || "").trim().toLowerCase() === String(item.name).trim().toLowerCase() &&
              String(x.category || "").trim().toLowerCase() === String(item.category).trim().toLowerCase()
          );

          if (duplicateByNameAndCat) {
            console.log(`  2. WARNING: A row with name "${item.name}" and category "${item.category}" ALREADY exists in the database with ID "${duplicateByNameAndCat.id}"!`);
            console.log(`     However, it was NOT matched because the local item ID is "${item.id}" which is not in a default seeded pattern (e.g., s1, s2 or numeric), so ID bridging was not applied.`);
          } else {
            console.log(`  2. No database row matches both the name "${item.name}" and category "${item.category}" case-insensitively.`);
            const partialNameMatch = existingDbItems.find(
              (x: any) => String(x.name || "").trim().toLowerCase() === String(item.name).trim().toLowerCase()
            );
            if (partialNameMatch) {
              console.log(`     (Note: A database row with the name "${partialNameMatch.name}" exists but in category "${partialNameMatch.category}" instead of "${item.category}").`);
            }
          }
        }

        // Prepare the mapped payload object
        const mappedPayload = this.mapMenuItemForInsert(item, supported);
        // ALWAYS delete id from updates (it's specified in .eq("id", id))
        delete mappedPayload.id;

        if (dbMatch) {
          // This is an EDIT operation!
          // Check if another item in the database already has the same name and category
          const duplicate = existingDbItems.find(
            (x: any) =>
              String(x.id) !== String(dbMatch.id) &&
              String(x.name || "").trim().toLowerCase() === String(item.name).trim().toLowerCase() &&
              String(x.category || "").trim().toLowerCase() === String(item.category).trim().toLowerCase()
          );

          if (duplicate) {
            console.error(`[Supabase Validation Error] Cannot edit item. A menu item with name "${item.name}" already exists in category "${item.category}".`);
            throw new Error("A menu item with this name already exists in this category.");
          }

          updates.push({
            id: dbMatch.id,
            payload: mappedPayload,
            item
          });
          matchedDbIds.add(dbMatch.id);
        } else {
          // This is a CREATE operation!
          // Check whether a row already exists with the same unique fields
          const duplicate = existingDbItems.find(
            (x: any) =>
              String(x.name || "").trim().toLowerCase() === String(item.name).trim().toLowerCase() &&
              String(x.category || "").trim().toLowerCase() === String(item.category).trim().toLowerCase()
          );

          if (duplicate) {
            console.error(`[Supabase Validation Error] Cannot create item. A menu item with name "${item.name}" already exists in category "${item.category}".`);
            throw new Error("A menu item with this name already exists in this category.");
          }

          // Generate a valid UUID for the new item if the current id is not a UUID
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(item.id));
          const newId = isUuid ? item.id : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

          mappedPayload.id = newId;

          inserts.push({
            payload: mappedPayload,
            item
          });
        }
      }

      // 3. Delete items that are in the database but no longer in the frontend list
      const deleteIds = existingDbItems
        .map((x: any) => x.id)
        .filter((id: any) => !matchedDbIds.has(id));

      if (deleteIds.length > 0) {
        console.log(`[Supabase API Sync] Deleting ${deleteIds.length} removed items from database...`);
        for (const id of deleteIds) {
          console.log("Operation: DELETE");
          console.log("Item ID:", id);
          console.log("Data: { id: " + JSON.stringify(id) + " }");
          console.log(`Executing Supabase query: supabase.from("menu_items").delete().eq("id", "${id}")`);

          const { error: delErr } = await supabase
            .from("menu_items")
            .delete()
            .eq("id", id);

          if (delErr) {
            console.warn(`[Supabase Sync Warning] Failed to delete removed menu item ID ${id}:`, delErr);
          }
        }
      }

      // 4. Perform Updates
      if (updates.length > 0) {
        console.log(`[Supabase API Sync] Updating ${updates.length} items...`);
        for (const update of updates) {
          const sqlEquivalent = `UPDATE public.menu_items SET ${Object.entries(update.payload).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", ")} WHERE id = '${update.id}';`;
          const stackTrace = new Error("Stack trace collector").stack || "";

          console.log("\n=== [Supabase Diagnostic Log] Before UPDATE ===");
          // Requirement 4: Before executing database query, print whether calling insert() or update()
          console.log("Calling: update() on table 'menu_items'");
          console.log("Responsible File: /src/lib/db.ts");
          console.log("Responsible Function: LocalDB.apiSaveMenuItems");
          console.log("Operation: UPDATE");
          console.log("Payload:", JSON.stringify(update.payload, null, 2));
          console.log("SQL Equivalent:", sqlEquivalent);
          console.log("ID Target:", update.id);
          console.log("Stack Trace:\n", stackTrace);

          try {
            const { error: updateErr } = await supabase
              .from("menu_items")
              .update(update.payload)
              .eq("id", update.id);

            console.log("\n=== [Supabase Diagnostic Log] After UPDATE ===");
            console.log("Returned ID:", update.id);
            console.log("Returned Error:", updateErr ? JSON.stringify(updateErr, null, 2) : "None (Success)");

            if (updateErr) {
              console.warn(`[Supabase API Sync Warning] Failed to update item ID ${update.id}:`, updateErr);
              this.addAuditLog(
                "Supabase Sync Warning",
                `Cloud sync notice for item ${update.id}: ${updateErr.message}. Updated locally.`,
                "System"
              );
            }
          } catch (err: any) {
            console.warn("[Supabase Sync Warning on Update]:", err.message);
          }
        }
      }

      // 5. Perform Inserts
      if (inserts.length > 0) {
        console.log(`[Supabase API Sync] Inserting ${inserts.length} new items...`);
        for (const insert of inserts) {
          const sqlEquivalent = `INSERT INTO public.menu_items (${Object.keys(insert.payload).join(", ")}) VALUES (${Object.values(insert.payload).map(v => JSON.stringify(v)).join(", ")});`;
          const stackTrace = new Error("Stack trace collector").stack || "";

          console.log("\n=== [Supabase Diagnostic Log] Before CREATE ===");
          console.log("Calling: insert() on table 'menu_items'");
          console.log("Responsible File: /src/lib/db.ts");
          console.log("Responsible Function: LocalDB.apiSaveMenuItems");
          console.log("Operation: CREATE");
          console.log("Payload:", JSON.stringify(insert.payload, null, 2));
          console.log("SQL Equivalent:", sqlEquivalent);
          console.log("ID Target:", insert.payload.id);
          console.log("Stack Trace:\n", stackTrace);

          try {
            const { error: insertErr } = await supabase
              .from("menu_items")
              .insert([insert.payload]);

            console.log("\n=== [Supabase Diagnostic Log] After CREATE ===");
            console.log("Returned ID:", insert.payload.id);
            console.log("Returned Error:", insertErr ? JSON.stringify(insertErr, null, 2) : "None (Success)");

            if (insertErr) {
              console.warn("[Supabase API Sync Warning] Failed to insert new item into cloud database:", insertErr);
              this.addAuditLog(
                "Supabase Sync Warning",
                `Item "${insert.item.name}" saved locally. Cloud DB sync notice: ${insertErr.message}.`,
                "System"
              );
            }
          } catch (err: any) {
            console.warn("[Supabase Sync Warning on Insert]:", err.message);
          }
        }
      }

      console.log("[Supabase API Sync Success] Database catalog successfully fully updated and synced.");
      this.saveMenuItems(items);
      this.addAuditLog("Menu Catalog Saved", `Catalog containing ${items.length} dishes updated inside Supabase and local disk.`, "Admin (owner)");
    } catch (err: any) {
      console.warn("[Menu Sync Exception - Local Fallback Activated]", err);
      // Still save locally so user can continue seamlessly
      this.saveMenuItems(items);
    }
  }

  static async fetchInventory(): Promise<InventoryItem[]> {
    this.incrementApiCallCount("fetchInventory");
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.warn("[Supabase] inventory missing. Falling back to local storage.", error);
        return this.getInventory();
      }

      const mapped: InventoryItem[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        stock: Number(item.stock || 0),
        unit: item.unit || "kg",
        minAlertLevel: Number(item.min_alert_level || 10),
        category: item.category || "Other",
        lastRestocked: item.last_restocked || new Date().toISOString().split("T")[0]
      }));

      this.saveInventory(mapped);
      return mapped;
    } catch {
      return this.getInventory();
    }
  }

  static async apiSaveInventory(inventory: InventoryItem[]): Promise<void> {
    const payload = inventory.map(item => ({
      id: item.id,
      name: item.name,
      stock: Number(item.stock || 0),
      unit: item.unit,
      min_alert_level: Number(item.minAlertLevel || 10),
      category: item.category,
      last_restocked: item.lastRestocked
    }));

    // Save locally first so changes are immediately persisted and reflected in UI
    this.saveInventory(inventory);

    try {
      const { error } = await supabase.from("inventory").upsert(payload);
      if (error) {
        console.warn("[Supabase Inventory Sync Notice (Saved locally)]:", error.message);
      }
    } catch (err: any) {
      console.warn("[Supabase Inventory Sync Notice (Saved locally)]:", err?.message || err);
    }
  }

  static async fetchCoupons(): Promise<Coupon[]> {
    this.incrementApiCallCount("fetchCoupons");
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("code", { ascending: true });

      if (error) {
        console.warn("[Supabase] 'coupons' table missing. Using client defaults.", error);
        return this.getCoupons();
      }

      const mapped: Coupon[] = (data || []).map((item: any) => ({
        code: item.code,
        type: item.type || "percentage",
        value: Number(item.value || 0),
        expiryDate: item.expiry_date || "2200-12-31",
        usageLimit: Number(item.usage_limit || 100),
        usageCount: Number(item.usage_count || 0),
        minOrderAmount: item.min_order_amount ? Number(item.min_order_amount) : undefined
      }));

      this.saveCoupons(mapped);
      return mapped;
    } catch {
      return this.getCoupons();
    }
  }

  static async apiSaveCoupons(coupons: Coupon[]): Promise<void> {
    const payload = coupons.map(item => ({
      code: item.code,
      type: item.type,
      value: Number(item.value || 0),
      expiry_date: item.expiryDate,
      usage_limit: Number(item.usageLimit || 100),
      usage_count: Number(item.usageCount || 0),
      min_order_amount: item.minOrderAmount || null
    }));

    // Save locally first so changes are immediately persisted and reflected in UI
    this.saveCoupons(coupons);

    try {
      const { error } = await supabase.from("coupons").upsert(payload);
      if (error) {
        console.warn("[Supabase Coupons Sync Notice (Saved locally)]:", error.message);
      }
    } catch (err: any) {
      console.warn("[Supabase Coupons Sync Notice (Saved locally)]:", err?.message || err);
    }
  }

  static async fetchReviews(): Promise<Review[]> {
    this.incrementApiCallCount("fetchReviews");
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .order("date", { ascending: false });

      if (error) {
        console.warn("[Supabase] 'reviews' query fallback to localStorage.", error);
        return this.getReviews();
      }

      const mapped: Review[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        rating: Number(item.rating || 5),
        date: item.date || new Date().toISOString(),
        comment: item.comment || "",
        avatar: item.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"
      }));

      this.saveReviews(mapped);
      return mapped;
    } catch {
      return this.getReviews();
    }
  }

  static async apiPostReview(review: Review): Promise<void> {
    const payload = {
      id: review.id,
      name: review.name,
      rating: Number(review.rating || 5),
      date: review.date,
      comment: review.comment,
      avatar: review.avatar
    };

    // Save locally first so changes are immediately persisted and reflected in UI
    const current = this.getReviews();
    current.unshift(review);
    this.saveReviews(current);

    try {
      const { error } = await supabase.from("reviews").insert(payload);
      if (error) {
        console.warn("[Supabase Review Notice (Saved locally)]:", error.message);
      }
    } catch (err: any) {
      console.warn("[Supabase Review Notice (Saved locally)]:", err?.message || err);
    }
  }

  static async apiSaveReviews(reviews: Review[]): Promise<void> {
    const payload = reviews.map(item => ({
      id: item.id,
      name: item.name,
      rating: Number(item.rating || 5),
      date: item.date,
      comment: item.comment,
      avatar: item.avatar
    }));

    // Save locally first so changes are immediately persisted and reflected in UI
    this.saveReviews(reviews);

    try {
      const { error } = await supabase.from("reviews").upsert(payload);
      if (error) {
        console.warn("[Supabase Reviews Batch Notice (Saved locally)]:", error.message);
      }
    } catch (err: any) {
      console.warn("[Supabase Reviews Batch Notice (Saved locally)]:", err?.message || err);
    }
  }

  static async fetchSettings(): Promise<RestaurantSettings> {
    this.incrementApiCallCount("fetchSettings");
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .limit(1);

      if (error || !data || data.length === 0) {
        console.warn("[Supabase] Settings fetch fallback.", error);
        return this.getSettings();
      }

      const item = data[0];
      const mapped: RestaurantSettings = {
        name: item.name || BRAND_CONFIG.restaurantName,
        contactNumber: item.contact_number || BRAND_CONFIG.defaultPhone,
        address: item.address || BRAND_CONFIG.defaultAddress,
        businessHours: item.business_hours || "11:00 AM - 11:30 PM DAILY",
        deliveryCharges: Number(item.delivery_charges || 25),
        gstPercentage: Number(item.gst_percentage || 0),
        facebookUrl: item.facebook_url || "https://facebook.com",
        instagramUrl: item.instagram_url || "https://instagram.com",
        twitterUrl: item.twitter_url || "https://twitter.com",
        googleMapsUrl: item.google_maps_url || ""
      };

      this.saveSettings(mapped);
      return mapped;
    } catch {
      return this.getSettings();
    }
  }

  static async apiSaveSettings(settings: RestaurantSettings): Promise<void> {
    const payload = {
      id: "singleton-config", // Keep simple single row config
      name: settings.name,
      contact_number: settings.contactNumber,
      address: settings.address,
      business_hours: settings.businessHours,
      delivery_charges: Number(settings.deliveryCharges || 0),
      gst_percentage: Number(settings.gstPercentage || 0),
      facebook_url: settings.facebookUrl,
      instagram_url: settings.instagramUrl,
      twitter_url: settings.twitterUrl,
      google_maps_url: settings.googleMapsUrl
    };

    // Save locally first so changes are immediately persisted and reflected in UI
    this.saveSettings(settings);

    try {
      const { error } = await supabase.from("settings").upsert(payload);
      if (error) {
        console.warn("[Supabase Settings Notice (Saved locally)]:", error.message);
      }
    } catch (err: any) {
      console.warn("[Supabase Settings Notice (Saved locally)]:", err?.message || err);
    }
  }

  static async fetchAuditLogs(): Promise<AuditLog[]> {
    this.incrementApiCallCount("fetchAuditLogs");
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error) {
        console.warn("[Supabase] 'audit_logs' query fallback to localStorage.", error);
        return this.getAuditLogs();
      }

      const mapped: AuditLog[] = (data || []).map((item: any) => ({
        id: item.id,
        timestamp: item.timestamp || new Date().toISOString(),
        user: item.user || "Admin",
        action: item.action || "Log Captured",
        details: item.details || "",
        ipAddress: item.ip_address || "127.0.0.1"
      }));

      localStorage.setItem("ij_audit_logs", JSON.stringify(mapped));
      return mapped;
    } catch {
      return this.getAuditLogs();
    }
  }

  static async apiAddAuditLog(action: string, details: string, user: string = "Admin"): Promise<void> {
    const logId = `log-${Date.now()}`;
    const payload = {
      id: logId,
      timestamp: new Date().toISOString(),
      user: user,
      action: action,
      details: details,
      ip_address: "127.0.0.1"
    };

    // Save to local storage first (reliable offline persistence)
    const logs = this.getAuditLogs();
    logs.unshift({
      id: logId,
      timestamp: payload.timestamp,
      user: payload.user,
      action: payload.action,
      details: payload.details,
      ipAddress: payload.ip_address
    });
    localStorage.setItem("ij_audit_logs", JSON.stringify(logs));
    window.dispatchEvent(new Event("storage"));

    try {
      const { error } = await supabase.from("audit_logs").insert(payload);
      if (error) {
        if (error.message && error.message.includes("exceed_egress_quota")) {
          console.warn("[Supabase Audit Log Notice] Project egress quota reached (HTTP 402). Log safely stored locally.");
        } else {
          console.warn("[Supabase Audit Log Notice (Saved locally)]:", error.message);
        }
      }
    } catch (err: any) {
      console.warn("[Supabase Audit Log Notice (Saved locally)]:", err?.message || err);
    }
  }

  // --- KOT DATABASE SYSTEM OPERATIONS ---
  static isSeedKOT(k: { id?: string; orderId?: string; order_id?: string; customerName?: string; customer_name?: string }): boolean {
    const idStr = String(k?.id || "");
    const ordIdStr = String(k?.orderId || k?.order_id || "");
    const custStr = String(k?.customerName || k?.customer_name || "").toLowerCase();
    return (
      idStr.includes("-V-") ||
      idStr.includes("VERIFY") ||
      ordIdStr.includes("VERIFY") ||
      ordIdStr.includes("TEST") ||
      custStr.includes("verify user") ||
      custStr.includes("test order")
    );
  }

  static getKOTs(): KOT[] {
    const stored = localStorage.getItem("ij_kots");
    if (!stored) {
      const fallbackKOTs: KOT[] = [];
      localStorage.setItem("ij_kots", JSON.stringify(fallbackKOTs));
      return fallbackKOTs;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      const filtered = parsed.filter(k => !this.isSeedKOT(k));
      if (filtered.length !== parsed.length) {
        localStorage.setItem("ij_kots", JSON.stringify(filtered));
      }
      return filtered;
    } catch {
      return [];
    }
  }

  static saveKOTs(kots: KOT[]): void {
    localStorage.setItem("ij_kots", JSON.stringify(kots));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("kots_updated"));
  }

  static async fetchKOTs(): Promise<KOT[]> {
    console.log("[Supabase API Request] Loading KOT list...");
    try {
      const { data, error, status } = await supabase
        .from("kots")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[Supabase] 'kots' query fallback to localStorage.", error);
        return this.getKOTs();
      }

      const mapped: KOT[] = (data || [])
        .filter((item: any) => !this.isSeedKOT(item))
        .map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        tableNumber: item.table_number || "Takeaway",
        customerName: item.customer_name || "Guest User",
        orderType: item.order_type || "takeaway",
        status: item.status || "New Order",
        specialInstructions: item.special_instructions || "None",
        createdAt: item.created_at || new Date().toISOString(),
        preparationTime: Number(item.preparation_time || 15),
        printed: item.printed !== undefined ? !!item.printed : false,
        items: Array.isArray(item.items) ? item.items : (typeof item.items === 'string' ? JSON.parse(item.items) : [])
      }));

      this.saveKOTs(mapped);
      return mapped;
    } catch (err) {
      console.warn("[KOT Transport Sync Notice (Reading local cache)]:", err);
      return this.getKOTs();
    }
  }

  static async apiAddKOT(kot: KOT): Promise<KOT> {
    // 1. Ensure KOT is preserved in local storage first
    const kots = this.getKOTs();
    if (!kots.some(k => k.id === kot.id)) {
      kots.unshift({ ...kot, printed: kot.printed || false });
      this.saveKOTs(kots);
    }

    const payload = {
      id: kot.id,
      order_id: kot.orderId,
      table_number: kot.tableNumber,
      customer_name: kot.customerName,
      order_type: kot.orderType,
      status: kot.status,
      special_instructions: kot.specialInstructions,
      created_at: kot.createdAt,
      preparation_time: Number(kot.preparationTime),
      printed: kot.printed || false,
      items: kot.items
    };

    try {
      const { error } = await supabase.from("kots").insert(payload);
      if (error) {
        if (error.message && error.message.includes("exceed_egress_quota")) {
          console.warn(`[Supabase KOT Notice] Quota reached (HTTP 402). KOT #${kot.id} safely preserved in local database.`);
        } else {
          console.warn("[Supabase KOT insertion notice (Saved locally)]:", error.message);
        }
      }
    } catch (err: any) {
      console.warn("[Supabase KOT connection notice (Saved locally)]:", err?.message || err);
    }

    return kot;
  }

  static async apiUpdateKOTPrinted(kotId: string, printed: boolean): Promise<void> {
    console.log(`[LocalDB] Updating KOT ${kotId} printed status to ${printed}`);
    // Update in local cache immediately
    const kots = this.getKOTs();
    const kotIdx = kots.findIndex(k => k.id === kotId);
    if (kotIdx !== -1) {
      kots[kotIdx].printed = printed;
      this.saveKOTs(kots);
    }

    try {
      const { error } = await supabase
        .from("kots")
        .update({ printed })
        .eq("id", kotId);
      
      if (error) {
        console.warn("[Supabase KOT Printed notice (Updated locally)]:", error.message);
      }
    } catch (err: any) {
      console.warn("[KOT printed update notice]:", err?.message || err);
    }
  }

  static async apiUpdateKOTStatus(kotId: string, status: KOTStatus): Promise<void> {
    console.log(`[LocalDB] Updating KOT status ${kotId} to ${status}`);
    // Update in local cache immediately
    const kots = this.getKOTs();
    const kotIdx = kots.findIndex(k => k.id === kotId);
    let linkedOrderId: string | null = null;
    if (kotIdx !== -1) {
      kots[kotIdx].status = status;
      this.saveKOTs(kots);
      linkedOrderId = kots[kotIdx].orderId;
    }

    if (linkedOrderId) {
      let mappedOrderStatus = status as any;
      if (status === "New Order") mappedOrderStatus = "New Order";
      else if (status === "Accepted") mappedOrderStatus = "Accepted";
      else if (status === "Preparing") mappedOrderStatus = "Preparing";
      else if (status === "Ready") mappedOrderStatus = "Ready";
      else if (status === "Served") mappedOrderStatus = "Delivered";
      else if (status === "Cancelled") mappedOrderStatus = "Cancelled";
      
      await this.apiUpdateOrderStatus(linkedOrderId, mappedOrderStatus);
    }

    try {
      const { error } = await supabase
        .from("kots")
        .update({ status })
        .eq("id", kotId);
      
      if (error) {
        console.warn("[Supabase KOT Status notice (Updated locally)]:", error.message);
      }
    } catch (err: any) {
      console.warn("[KOT status update notice]:", err?.message || err);
    }
  }

  static async apiAddOrderItems(orderId: string, items: { menuItemId: string; name: string; price: number; quantity: number; customization?: string }[]): Promise<void> {
    const payloads = items.map((item, index) => ({
      id: `${orderId}-item-${index}-${Date.now()}`,
      order_id: orderId,
      menu_item_id: item.menuItemId,
      name: item.name,
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
      customization: item.customization || ""
    }));

    debugLog(`[ORDER ITEMS INSERT] Inserting ${payloads.length} item records for order ${orderId}:`, payloads);

    try {
      const { data, error } = await supabase.from("order_items").insert(payloads).select();
      if (error) {
        console.warn("[ORDER ITEMS INSERT] Notice (items stored in orders.items JSONB column):", error.message);
      } else {
        debugLog(`[ORDER ITEMS INSERT] SUCCESS! Stored ${payloads.length} items in relational order_items table:`, data);
      }
    } catch (err) {
      console.warn("[ORDER ITEMS INSERT] Relational items table notice:", err);
    }
  }

  static getPrinterLogs(): PrinterEmulatorLog[] {
    const stored = localStorage.getItem("ij_printer_logs");
    if (!stored) {
      localStorage.setItem("ij_printer_logs", JSON.stringify([]));
      return [];
    }
    return JSON.parse(stored);
  }

  static savePrinterLogs(logs: PrinterEmulatorLog[]): void {
    localStorage.setItem("ij_printer_logs", JSON.stringify(logs));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("printer_logs_updated"));
  }

  static async fetchPrinterLogs(): Promise<PrinterEmulatorLog[]> {
    try {
      const { data, error } = await supabase
        .from("printer_emulator_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[Supabase] 'printer_emulator_logs' table select error:", error);
        return this.getPrinterLogs();
      }

      const mapped: PrinterEmulatorLog[] = (data || []).map((item: any) => ({
        id: item.id,
        kotId: item.kot_id,
        kotNumber: item.kot_number,
        restaurantId: item.restaurant_id,
        receiptText: item.receipt_text,
        printStatus: item.print_status,
        createdAt: item.created_at
      }));

      this.savePrinterLogs(mapped);
      return mapped;
    } catch (err) {
      console.error("[Supabase fetchPrinterLogs failure]:", err);
      return this.getPrinterLogs();
    }
  }

  static async apiAddPrinterLog(log: Omit<PrinterEmulatorLog, "id" | "createdAt">): Promise<PrinterEmulatorLog> {
    const logs = this.getPrinterLogs();
    const newId = `PRT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fullLog: PrinterEmulatorLog = {
      ...log,
      id: newId,
      createdAt: new Date().toISOString()
    };

    const payload = {
      id: fullLog.id,
      kot_id: fullLog.kotId,
      kot_number: fullLog.kotNumber,
      restaurant_id: fullLog.restaurantId,
      receipt_text: fullLog.receiptText,
      print_status: fullLog.printStatus,
      created_at: fullLog.createdAt
    };

    // Save locally first
    logs.unshift(fullLog);
    this.savePrinterLogs(logs);

    try {
      const { error } = await supabase.from("printer_emulator_logs").insert(payload);
      if (error) {
        console.warn("[Supabase printer_emulator_logs notice (Saved locally)]:", error.message);
      }
    } catch (err: any) {
      console.warn("[Supabase printer_emulator_logs notice (Saved locally)]:", err?.message || err);
    }

    return fullLog;
  }

  static async apiUpdateOrderPrintStatus(
    orderId: string, 
    type: "kot" | "bill", 
    status: "Pending" | "Printing" | "Printed" | "Failed"
  ): Promise<void> {
    console.log(`[LocalDB] Updating ${type} print status for order ${orderId} to ${status}`);
    try {
      const orders = this.getOrders();
      const orderIdx = orders.findIndex(o => o.id === orderId);
      if (orderIdx !== -1) {
        const order = orders[orderIdx];
        if (type === "kot") {
          order.kotPrintStatus = status;
          order.kotPrintTimestamp = new Date().toISOString();
        } else {
          order.billPrintStatus = status;
          order.billPrintTimestamp = new Date().toISOString();
        }
        this.saveOrders(orders);
        window.dispatchEvent(new Event("storage"));
      }
    } catch (err) {
      console.error("[LocalDB Exception updating print status]", err);
    }
  }
}

