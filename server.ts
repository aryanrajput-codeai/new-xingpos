import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { menuItems as defaultMenuItems, reviews as defaultReviews } from "./src/data";

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
  { code: "XINGS20", type: "percentage", value: 20, expiryDate: "2200-12-31", usageLimit: 500, usageCount: 0, minOrderAmount: 250 },
  { code: "WELCOME50", type: "fixed", value: 50, expiryDate: "2200-06-30", usageLimit: 1000, usageCount: 0, minOrderAmount: 150 },
  { code: "CHEFGIFT", type: "percentage", value: 15, expiryDate: "2026-08-31", usageLimit: 100, usageCount: 0, minOrderAmount: 300 }
];

const defaultSettings = {
  name: "XINGS KITCHEN",
  contactNumber: "",
  whatsappNumber: "",
  address: "Restaurant Address (Configure in Settings)",
  businessHours: "Mon-Sun: 10:00 AM - 11:00 PM",
  deliveryCharges: 25,
  gstPercentage: 5,
  facebookUrl: "",
  instagramUrl: "",
  twitterUrl: "",
  googleMapsUrl: ""
};

const defaultAuditLogs = [
  { id: "log-1", timestamp: new Date().toISOString(), user: "Admin (owner)", action: "System Initialized", details: "Local database initialized for XINGS KITCHEN. Ready for real orders.", ipAddress: "127.0.0.1" }
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
  const supabaseUrl = process.env.SUPABASE_URL || "https://uhvxkulqovkasewxfais.supabase.co";
  const supabaseKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_935p_1HOmvJr1p9dhFlb2g_zMA957jI";

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

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Production Security & CORS Headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // REST API: SYSTEM HEALTH & PRODUCTION MONITORING
  app.get("/api/health", async (req, res) => {
    try {
      const db = readDb();
      const isDbHealthy = Boolean(db && Array.isArray(db.orders));

      // Supabase connectivity check
      let supabaseStatus: "HEALTHY" | "DEGRADED" | "UNCONFIGURED" = "UNCONFIGURED";
      const supabaseUrl = process.env.SUPABASE_URL || "https://uhvxkulqovkasewxfais.supabase.co";
      const supabaseKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_935p_1HOmvJr1p9dhFlb2g_zMA957jI";

      if (supabaseUrl && supabaseKey) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const sbRes = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: { apikey: supabaseKey },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          supabaseStatus = sbRes.ok || sbRes.status === 404 || sbRes.status === 200 ? "HEALTHY" : "DEGRADED";
        } catch {
          supabaseStatus = "DEGRADED";
        }
      }

      const overallStatus: "HEALTHY" | "DEGRADED" | "FAILED" =
        !isDbHealthy ? "FAILED" : (supabaseStatus === "DEGRADED" ? "DEGRADED" : "HEALTHY");

      const statusCode = overallStatus === "FAILED" ? 503 : 200;
      return res.status(statusCode).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || "production",
        services: {
          api: "HEALTHY",
          localStore: isDbHealthy ? "HEALTHY" : "FAILED",
          supabase: supabaseStatus
        }
      });
    } catch {
      return res.status(503).json({
        status: "FAILED",
        timestamp: new Date().toISOString(),
        error: "Critical failure during health evaluation"
      });
    }
  });

  app.get("/api/health/detailed", (req, res) => {
    try {
      const db = readDb();
      const memUsage = process.memoryUsage();
      return res.json({
        status: "HEALTHY",
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          rssMb: Math.round(memUsage.rss / 1024 / 1024),
          heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024)
        },
        databaseStats: {
          ordersCount: db.orders?.length || 0,
          menuItemsCount: db.menuItems?.length || 0,
          inventoryItemsCount: db.inventory?.length || 0,
          auditLogsCount: db.auditLogs?.length || 0
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to generate detailed diagnostic telemetry" });
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
      ipAddress: getClientIp(req)
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
      ipAddress: getClientIp(req)
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
