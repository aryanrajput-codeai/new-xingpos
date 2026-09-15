import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { menuItems as defaultMenuItems, reviews as defaultReviews } from "./src/data";

import { getQZCertificate, signQZRequest } from "./server/qzSecurity";

interface Order {
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
  }[];
  subtotal: number;
  gst: number;
  packagingCharge: number;
  discountAmount: number;
  appliedCoupon?: string;
  grandTotal: number;
  paymentStatus: "Pending" | "Paid" | "Failed";
  orderStatus: "New Order" | "Accepted" | "Preparing" | "Ready" | "Out For Delivery" | "Delivered" | "Cancelled";
  createdAt: string;
  paymentMethod?: string;
  totalAmount?: number;
}

const STORE_PATH = path.join(process.cwd(), "db-store.json");

// JWT Validation Check
function isAuthorizedAdmin(req: express.Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  if (!token) return false;
  
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    if (payload.sub === "idli_junction_admin_id") {
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}

const defaultInventory = [
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

const defaultCoupons = [
  { code: "IDLI20", type: "percentage", value: 20, expiryDate: "2200-12-31", usageLimit: 500, usageCount: 0, minOrderAmount: 250 },
  { code: "WELCOME50", type: "fixed", value: 50, expiryDate: "2200-06-30", usageLimit: 1000, usageCount: 0, minOrderAmount: 150 },
  { code: "CHEFGIFT", type: "percentage", value: 15, expiryDate: "2026-08-31", usageLimit: 100, usageCount: 0, minOrderAmount: 300 }
];

const defaultSettings = {
  name: "IDLI JUNCTION",
  contactNumber: "+91 92095 21933",
  whatsappNumber: "+919209521933",
  address: "Shop No. G-3, Shivpuja Apartment, Plot No. 50, Beside Trimurti Nagar Bus Stop, Mankapur Ring Road, Subhash Nagar, Trimurti Nagar, Nagpur, Maharashtra 440022",
  businessHours: "Mon-Thu: 7:00 AM - 10:30 PM | Fri-Sat: 7:00 AM - 10:00 PM | Sun: 7:00 AM - 10:30 PM",
  deliveryCharges: 25,
  gstPercentage: 0,
  facebookUrl: "https://facebook.com",
  instagramUrl: "https://instagram.com/idli.junction",
  twitterUrl: "https://twitter.com",
  googleMapsUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3501.0772718136367!2d77.1082!3d28.6322!2m3!1f0!2f0!3f0!3m2!1i1248!2i786!4m2!3m1!1s0x0%3A0x0!2zMjgmdW5pcXVl!5e0!3m2!1sen!2sin!4v1680000000000!5m2!1sen!2sin"
};

const defaultAuditLogs = [
  { id: "log-1", timestamp: new Date().toISOString(), user: "Admin (owner)", action: "System Initialized", details: "Local database initialized clean. Ready for real orders.", ipAddress: "127.0.0.1" }
];

function readDb() {
  if (!fs.existsSync(STORE_PATH)) {
    const freshDb = {
      orders: [],
      menuItems: defaultMenuItems,
      inventory: defaultInventory,
      coupons: defaultCoupons,
      reviews: defaultReviews,
      settings: defaultSettings,
      auditLogs: defaultAuditLogs
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(freshDb, null, 2), "utf-8");
    return freshDb;
  }
  try {
    const data = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Database file parse failure, resetting store...", err);
    const freshDb = {
      orders: [],
      menuItems: defaultMenuItems,
      inventory: defaultInventory,
      coupons: defaultCoupons,
      reviews: defaultReviews,
      settings: defaultSettings,
      auditLogs: defaultAuditLogs
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(freshDb, null, 2), "utf-8");
    return freshDb;
  }
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Database file write failure:", err);
  }
}

// Supabase cloud synchronization engine
async function syncOrderToSupabase(order: any, isUpdate = false) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jkkwrhywfpbitwvffkxx.supabase.co";
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_D1rREhO08nd1vWNmxyugCg_Fff4X10Y";

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[Supabase] Configuration is absent. Skipping cloud ledger write.");
    return;
  }

  // Map the application's React/Node schema into standard PostgreSQL lower snake_case schema columns
  const payload = {
    id: order.id,
    customer_name: order.customerName,
    phone_number: order.phoneNumber,
    email: order.email,
    order_type: order.orderType,
    table_number: order.tableNumber || null,
    address: order.address || null,
    items: order.items, // PostgREST handles objects/arrays for JSONB columns automatically
    subtotal: Number(order.subtotal || 0),
    gst: Number(order.gst || 0),
    packaging_charge: Number(order.packagingCharge || 0),
    discount_amount: Number(order.discountAmount || 0),
    applied_coupon: order.appliedCoupon || null,
    grand_total: Number(order.grandTotal || 0),
    payment_status: order.paymentStatus || "Pending",
    order_status: order.orderStatus || "New Order",
    created_at: order.createdAt || new Date().toISOString(),
    payment_method: order.paymentMethod || "Cash on Delivery"
  };

  const url = isUpdate 
    ? `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`
    : `${supabaseUrl}/rest/v1/orders`;

  const method = isUpdate ? "PATCH" : "POST";

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": isUpdate ? "return=minimal" : "return=representation"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Supabase PostgREST Error] HTTP ${response.status}: ${errorText}`);
      
      // Post a system warning in application's local audit logs
      try {
        const db = readDb();
        db.auditLogs.unshift({
          id: `log-sb-err-${Date.now()}`,
          timestamp: new Date().toISOString(),
          user: "System (Supabase)",
          action: "Supabase Sync Failure",
          details: `PostgREST API returned Status ${response.status}: ${errorText.substring(0, 150)}. Check if 'orders' table exists in dashboard with exact column schemas.`,
          ipAddress: "127.0.0.1"
        });
        writeDb(db);
      } catch (logErr) {
        console.error("Failed to update error logs in local memory store:", logErr);
      }
    } else {
      console.log(`[Supabase Integration] Successfully database synced Order ${order.id} via ${method}`);
      // Post a system success marker inside the application audit logs
      try {
        const db = readDb();
        db.auditLogs.unshift({
          id: `log-sb-ok-${Date.now()}`,
          timestamp: new Date().toISOString(),
          user: "System (Supabase)",
          action: "Supabase Sync Success",
          details: `Order reference ${order.id} successfully synchronized to Supabase PostgreSQL cloud via ${method}.`,
          ipAddress: "127.0.0.1"
        });
        writeDb(db);
      } catch (logErr) {
        console.error("Failed to commit success logs in local memory store:", logErr);
      }
    }
  } catch (err: any) {
    console.error("[Supabase Transport Network Error]", err);
    try {
      const db = readDb();
      db.auditLogs.unshift({
        id: `log-sb-conn-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: "System (Supabase)",
        action: "Supabase Connection Error",
        details: `Failed to open TCP transport link: ${err.message || err.toString()}`,
        ipAddress: "127.0.0.1"
      });
      writeDb(db);
    } catch (logErr) {
      console.error("Failed to register transport error log:", logErr);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS Headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // REST API: QZ TRAY DIGITAL CERTIFICATE & SIGNING
  app.get("/api/qz/cert", (req, res) => {
    try {
      const cert = getQZCertificate();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(cert);
    } catch (err: any) {
      console.error("[QZ Server Cert Error]", err);
      res.status(500).send("Certificate error");
    }
  });

  app.post("/api/qz/sign", (req, res) => {
    try {
      const toSign = req.body?.request || req.body?.toSign || req.body?.data;
      const algorithm = (req.body?.algorithm as string) || "SHA512";
      if (!toSign || typeof toSign !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'request' payload string" });
      }
      const signature = signQZRequest(toSign, algorithm);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.json({ signature });
    } catch (err: any) {
      console.error("[QZ Signing Error]", err?.message || err);
      res.status(500).json({ error: "QZ signing request failed", message: err?.message || String(err) });
    }
  });

  app.get("/api/qz/sign", (req, res) => {
    try {
      const toSign = (req.query.request as string) || (req.query.toSign as string) || "";
      const algorithm = (req.query.algorithm as string) || "SHA512";
      if (!toSign) {
        return res.status(400).send("Missing request query parameter");
      }
      const signature = signQZRequest(toSign, algorithm);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.send(signature);
    } catch (err: any) {
      console.error("[QZ Signing Error GET]", err?.message || err);
      res.status(500).send(err?.message || "Signing failed");
    }
  });

  // REST API: ORDERS SECTION
  app.get("/api/orders", (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      return res.status(401).json({ error: "Unauthorized access to order logs. System authentication required." });
    }
    const db = readDb();
    res.json(db.orders);
  });

  app.post("/api/orders", (req, res) => {
    try {
      const db = readDb();
      const orderData = req.body;

      // 1. Inputs validation
      if (!orderData.customerName || typeof orderData.customerName !== "string" || !orderData.customerName.trim()) {
        return res.status(400).json({ error: "Customer name is blank or missing. Please state valid checkout identity." });
      }
      if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        return res.status(400).json({ error: "Shopping cart selection is empty. Order rejected." });
      }

      // 1b. Table QR Validation for Dine-In
      if (orderData.orderType === "dine-in") {
        if (!orderData.tableNumber) {
          return res.status(400).json({ error: "Missing Table Number: Dine-In checkout requires a scanned table QR source." });
        }
        const validTables = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
        if (!validTables.includes(orderData.tableNumber)) {
          return res.status(400).json({ error: `Invalid QR Code Source: Table number #${orderData.tableNumber} is not registered in our dining area.` });
        }
      }

      // 2. Duplicate Check
      const now = Date.now();
      const isDuplicate = db.orders.find((o: any) => {
        const orderTime = new Date(o.createdAt).getTime();
        const isRecent = (now - orderTime) < 30000; // 30 seconds debounce window
        const isSameCustomer = o.customerName === orderData.customerName.trim() && 
                               o.phoneNumber === orderData.phoneNumber;
        const isSameTotal = Math.abs(o.grandTotal - orderData.grandTotal) < 1;
        return isRecent && isSameCustomer && isSameTotal;
      });

      if (isDuplicate) {
        return res.status(200).json({ status: "success", order: isDuplicate, duplicate: true });
      }

      // 3. Serialized Unique Order ID Sequence
      const ordersCount = db.orders.length;
      const orderId = `SR-${1000 + ordersCount + Math.floor(Math.random() * 900 + 100)}`;

      const newOrder: Order = {
        ...orderData,
        id: orderId,
        createdAt: new Date().toISOString(),
        orderStatus: orderData.orderStatus || "New Order",
        paymentStatus: orderData.paymentStatus || "Pending",
        paymentMethod: orderData.paymentMethod || "Cash on Delivery",
        totalAmount: orderData.grandTotal
      };

      db.orders.unshift(newOrder); // New order on top
      writeDb(db);

      // Trigger asynchronous Supabase synchronization in the background to ensure blazing fast checkout
      syncOrderToSupabase(newOrder, false).catch(e => {
        console.error("Critical: Supabase background sync failed to invoke", e);
      });

      res.status(201).json({ status: "success", order: newOrder });
    } catch (err) {
      console.error("Failed to store client order:", err);
      res.status(500).json({ error: "Internal Database error. Failed to commit order ledger." });
    }
  });

  app.put("/api/orders/:id/status", (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      return res.status(401).json({ error: "Unauthorized access." });
    }
    const { id } = req.params;
    const { orderStatus, paymentStatus } = req.body;

    if (!orderStatus) {
      return res.status(400).json({ error: "Order status is required" });
    }

    const db = readDb();
    const idx = db.orders.findIndex((o: any) => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Order record not found" });
    }

    db.orders[idx].orderStatus = orderStatus;
    if (paymentStatus) {
      db.orders[idx].paymentStatus = paymentStatus;
    } else {
      // Auto assign payment states on standard progression
      if (orderStatus === "Cancelled") {
        db.orders[idx].paymentStatus = "Failed";
      } else if (orderStatus === "Delivered" || orderStatus === "Ready") {
        db.orders[idx].paymentStatus = "Paid";
      }
    }

    // Record Audit Logs
    db.auditLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: "Admin",
      action: "Order Modified",
      details: `Order ID: ${id} status altered to: ${orderStatus}`,
      ipAddress: "127.0.0.1"
    });

    writeDb(db);

    // Trigger asynchronous Supabase update status sync in the background
    syncOrderToSupabase(db.orders[idx], true).catch(e => {
      console.error("Critical: Supabase background update status sync failed to invoke", e);
    });

    res.json({ success: true, order: db.orders[idx] });
  });

  // REST API: MENU ITEMS SECTION
  app.get("/api/menu-items", (req, res) => {
    const db = readDb();
    res.json(db.menuItems);
  });

  app.post("/api/menu-items", (req, res) => {
    if (!isAuthorizedAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    const db = readDb();
    const newItem = req.body;
    db.menuItems.push(newItem);
    writeDb(db);
    res.json({ success: true, item: newItem });
  });

  app.put("/api/menu-items", (req, res) => {
    if (!isAuthorizedAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    const db = readDb();
    db.menuItems = req.body;
    writeDb(db);
    res.json({ success: true });
  });

  // REST API: INVENTORY SECTION
  app.get("/api/inventory", (req, res) => {
    if (!isAuthorizedAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    const db = readDb();
    res.json(db.inventory);
  });

  app.put("/api/inventory", (req, res) => {
    if (!isAuthorizedAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    const db = readDb();
    db.inventory = req.body;
    writeDb(db);
    res.json({ success: true });
  });

  // REST API: COUPONS SECTION
  app.get("/api/coupons", (req, res) => {
    const db = readDb();
    res.json(db.coupons);
  });

  app.put("/api/coupons", (req, res) => {
    if (!isAuthorizedAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    const db = readDb();
    db.coupons = req.body;
    writeDb(db);
    res.json({ success: true });
  });

  // REST API: REVIEWS SECTION
  app.get("/api/reviews", (req, res) => {
    const db = readDb();
    res.json(db.reviews);
  });

  app.post("/api/reviews", (req, res) => {
    const db = readDb();
    const newReview = req.body;
    db.reviews.unshift(newReview);
    writeDb(db);
    res.json({ success: true, review: newReview });
  });

  app.put("/api/reviews", (req, res) => {
    if (!isAuthorizedAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    const db = readDb();
    db.reviews = req.body;
    writeDb(db);
    res.json({ success: true });
  });

  // REST API: SETTINGS SECTION
  app.get("/api/settings", (req, res) => {
    const db = readDb();
    res.json(db.settings);
  });

  app.post("/api/settings", (req, res) => {
    if (!isAuthorizedAdmin(req)) return res.status(451).json({ error: "Unauthorized" });
    const db = readDb();
    db.settings = req.body;
    writeDb(db);
    res.json({ success: true });
  });

  // REST API: AUDIT LOGS SECTION
  app.get("/api/audit-logs", (req, res) => {
    if (!isAuthorizedAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    const db = readDb();
    res.json(db.auditLogs);
  });

  app.post("/api/audit-logs", (req, res) => {
    const db = readDb();
    const { action, details, user } = req.body;
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: user || "System",
      action,
      details,
      ipAddress: "127.0.0.1"
    };
    db.auditLogs.unshift(newLog);
    writeDb(db);
    res.json({ success: true, log: newLog });
  });

  // Vite Integration Entrypoints
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Database Server Engine] Initiated cleanly on port ${PORT}`);
  });
}

startServer();
