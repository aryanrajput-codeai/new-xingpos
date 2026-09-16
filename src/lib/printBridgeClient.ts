import { RESTAURANT_BRANDING } from "../config/branding";

export interface LocalPrinter {
  name: string;
  status: string;
}

export interface PrintJobPayload {
  printerName: string;
  paperWidth: "80mm" | "58mm";
  jobType: "CUSTOMER_BILL" | "KOT" | "TEST_PRINT" | string;
  orderId: string;
  receiptText: string;
}

/**
 * Client service to communicate with XINGS KITCHEN Local Thermal Print Bridge
 * (http://127.0.0.1:9100)
 */
export class PrintBridgeClient {
  private static submittedJobs = new Map<string, number>();

  /**
   * Check if the local print bridge is running and healthy
   */
  public static async checkHealth(baseUrl: string = "http://127.0.0.1:9100"): Promise<{
    connected: boolean;
    service?: string;
    port?: number;
    error?: string;
  }> {
    const cleanUrl = baseUrl.replace(/\/+$/, "");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${cleanUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { connected: false, error: `HTTP ${res.status}` };
      }

      const data = await res.json();
      if (data && data.status === "ok") {
        return { connected: true, service: data.service, port: data.port };
      }
      return { connected: false, error: "Invalid health response" };
    } catch (err: any) {
      return { connected: false, error: err.name === "AbortError" ? "Timeout connecting to print bridge" : err.message };
    }
  }

  /**
   * Fetch list of OS thermal printers from local print bridge
   */
  public static async getPrinters(baseUrl: string = "http://127.0.0.1:9100"): Promise<{
    success: boolean;
    printers: LocalPrinter[];
    error?: string;
  }> {
    const cleanUrl = baseUrl.replace(/\/+$/, "");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${cleanUrl}/printers`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { success: false, printers: [], error: `HTTP ${res.status}` };
      }

      const data = await res.json();
      return {
        success: true,
        printers: Array.isArray(data.printers) ? data.printers : [],
      };
    } catch (err: any) {
      return { success: false, printers: [], error: err.message };
    }
  }

  /**
   * Submit silent thermal print job with duplicate job protection
   */
  public static async sendPrintJob(
    baseUrl: string,
    payload: PrintJobPayload
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    const cleanUrl = (baseUrl || "http://127.0.0.1:9100").replace(/\/+$/, "");
    const jobTypeTag = (payload.jobType || "BILL").toLowerCase();
    const jobId = payload.orderId ? `${payload.orderId}-${jobTypeTag}` : `POS-JOB-${Date.now()}`;

    // Idempotency check: guard against accidental duplicate print requests within 60s
    const now = Date.now();
    const lastSubmitted = this.submittedJobs.get(jobId);
    if (lastSubmitted && now - lastSubmitted < 60000 && !jobId.includes("-REPRINT-")) {
      console.warn(`[PrintBridgeClient] Blocked duplicate print job submission for jobId: ${jobId}`);
      return {
        success: false,
        jobId,
        error: `Duplicate print job detected. Job ${jobId} was already submitted.`,
      };
    }

    // Mark job as in-flight
    this.submittedJobs.set(jobId, now);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${cleanUrl}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data && data.success) {
        return { success: true, jobId: data.jobId || jobId };
      } else {
        // Remove from submitted map on failure so retry is allowed
        this.submittedJobs.delete(jobId);
        return {
          success: false,
          jobId,
          error: data?.error || `Print bridge error (HTTP ${res.status})`,
        };
      }
    } catch (err: any) {
      // Remove from submitted map on network/timeout failure
      this.submittedJobs.delete(jobId);
      return {
        success: false,
        jobId,
        error: err.name === "AbortError" ? "Print job request timed out" : `Network error: ${err.message}`,
      };
    }
  }

  /**
   * Format order into clean deterministic 80mm or 58mm thermal plain-text receipt
   */
  public static formatThermalReceipt(
    order: any,
    paperWidth: "80mm" | "58mm" = "80mm",
    settings: any = {}
  ): string {
    const is80 = paperWidth === "80mm";
    const width = is80 ? 42 : 32;

    const pad = (str: string, length: number, align: "left" | "right" | "center" = "left"): string => {
      const s = String(str || "");
      if (s.length >= length) return s.slice(0, length);
      const remaining = length - s.length;
      if (align === "center") {
        const left = Math.floor(remaining / 2);
        const right = remaining - left;
        return " ".repeat(left) + s + " ".repeat(right);
      } else if (align === "right") {
        return " ".repeat(remaining) + s;
      } else {
        return s + " ".repeat(remaining);
      }
    };

    const separator = "-".repeat(width);
    const doubleSeparator = "=".repeat(width);

    const formatRow = (leftText: string, rightText: string): string => {
      const maxLeft = width - rightText.length - 1;
      const truncatedLeft = leftText.length > maxLeft ? leftText.slice(0, maxLeft) : leftText;
      const spaces = width - truncatedLeft.length - rightText.length;
      return truncatedLeft + " ".repeat(Math.max(1, spaces)) + rightText;
    };

    const lines: string[] = [];

    // Header
    lines.push(pad(settings.name || RESTAURANT_BRANDING.name, width, "center"));
    if (settings.legalName || RESTAURANT_BRANDING.legalName) {
      lines.push(pad(settings.legalName || RESTAURANT_BRANDING.legalName, width, "center"));
    }
    const address = settings.address || RESTAURANT_BRANDING.contact.address || "";
    if (address) {
      lines.push(pad(address, width, "center"));
    }
    const phone = settings.contactNumber || RESTAURANT_BRANDING.contact.phone || "";
    if (phone) {
      lines.push(pad(`Phone: ${phone}`, width, "center"));
    }
    lines.push(separator);
    lines.push(pad(`*** ${settings.invoiceTitle || "TAX INVOICE"} ***`, width, "center"));
    lines.push(separator);

    // Order Info
    const orderId = order.id || order.orderId || "XK-NEW";
    const orderNumOnly = String(orderId).replace(/^(SR|XK)-/, "#");
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString();
    const timeStr = new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    lines.push(formatRow(`Memo#: ${orderNumOnly}`, `${timeStr} ${dateStr}`));
    lines.push(formatRow(`Type: ${(order.orderType || "DINE-IN").toUpperCase()}`, order.tableNumber ? `Table #${order.tableNumber}` : "TAKEOUT"));
    if (order.customerName) {
      lines.push(formatRow("Customer:", String(order.customerName)));
    }
    lines.push(separator);

    // Table Header
    if (is80) {
      lines.push("QTY  ITEM DESCRIPTION             AMT (INR)");
    } else {
      lines.push("QTY ITEM                   AMT");
    }
    lines.push(separator);

    // Items
    const items = order.items || [];
    for (const item of items) {
      const name = String(item.name || "");
      const qty = String(item.quantity || 1);
      const price = Number(item.price || 0);
      const total = (Number(item.quantity || 1) * price).toFixed(2);

      if (is80) {
        const qtyCol = pad(qty, 4, "left");
        const priceCol = pad(total, 10, "right");
        const maxNameLen = 42 - 4 - 10 - 2; // 26 chars
        const truncatedName = name.length > maxNameLen ? name.slice(0, maxNameLen) : name;
        const nameCol = pad(truncatedName, maxNameLen, "left");
        lines.push(`${qtyCol} ${nameCol} ${priceCol}`);
      } else {
        const qtyCol = pad(qty, 3, "left");
        const priceCol = pad(total, 8, "right");
        const maxNameLen = 32 - 3 - 8 - 2; // 19 chars
        const truncatedName = name.length > maxNameLen ? name.slice(0, maxNameLen) : name;
        const nameCol = pad(truncatedName, maxNameLen, "left");
        lines.push(`${qtyCol} ${nameCol} ${priceCol}`);
      }

      if (item.customization) {
        lines.push(`     + ${item.customization}`);
      }
    }

    lines.push(separator);

    // Totals
    const subtotal = Number(order.subtotal || 0).toFixed(2);
    const gst = Number(order.gst || 0).toFixed(2);
    const pkg = Number(order.packagingCharge || 0);
    const discount = Number(order.discountAmount || 0);
    const grandTotal = Number(order.grandTotal || 0).toFixed(2);

    lines.push(formatRow("Subtotal:", `INR ${subtotal}`));
    if (Number(gst) > 0) {
      lines.push(formatRow(`GST (${settings.gstPercentage || 5}%):`, `INR ${gst}`));
    }
    if (pkg > 0) {
      lines.push(formatRow("Packaging:", `INR ${pkg.toFixed(2)}`));
    }
    if (discount > 0) {
      lines.push(formatRow("Discount:", `-INR ${discount.toFixed(2)}`));
    }

    lines.push(doubleSeparator);
    lines.push(formatRow("GRAND TOTAL:", `INR ${grandTotal}`));
    lines.push(doubleSeparator);

    // Payment Info
    const pMode = (order.paymentMethod || order.paymentMode || "CASH").toUpperCase();
    const pStatus = (order.paymentStatus || "PAID").toUpperCase();
    lines.push(formatRow("Payment Mode:", pMode));
    lines.push(formatRow("Payment Status:", pStatus));
    lines.push(separator);

    // Footer
    lines.push(pad(settings.customFooter || RESTAURANT_BRANDING.receipt.footerGreeting, width, "center"));
    lines.push(pad(RESTAURANT_BRANDING.receipt.poweredByNote, width, "center"));
    lines.push("\n\n\n"); // Feed for paper cut

    return lines.join("\n");
  }

  /**
   * Format KOT order into clean deterministic 80mm or 58mm thermal plain-text KOT
   */
  public static formatKOTReceipt(
    kot: any,
    paperWidth: "80mm" | "58mm" = "80mm",
    cashierName: string = "Cashier"
  ): string {
    const is80 = paperWidth === "80mm";
    const width = is80 ? 42 : 32;

    const pad = (str: string, length: number, align: "left" | "right" | "center" = "left"): string => {
      const s = String(str || "");
      if (s.length >= length) return s.slice(0, length);
      const remaining = length - s.length;
      if (align === "center") {
        const left = Math.floor(remaining / 2);
        return " ".repeat(left) + s + " ".repeat(remaining - left);
      } else if (align === "right") {
        return " ".repeat(remaining) + s;
      } else {
        return s + " ".repeat(remaining);
      }
    };

    const separator = "-".repeat(width);
    const doubleSeparator = "=".repeat(width);
    const lines: string[] = [];

    lines.push(pad(RESTAURANT_BRANDING.name.toUpperCase(), width, "center"));
    lines.push(pad("*** KITCHEN ORDER TICKET ***", width, "center"));
    const kotId = kot.id || `KOT-${kot.orderId || Date.now()}`;
    lines.push(pad(`KOT NO: ${kotId}`, width, "center"));
    lines.push(doubleSeparator);

    const timeStr = new Date(kot.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = new Date(kot.createdAt || Date.now()).toLocaleDateString();

    lines.push(`Date: ${dateStr}  Time: ${timeStr}`);
    lines.push(`Table: ${kot.tableNumber || "Takeaway"}`);
    lines.push(`Order Type: ${(kot.orderType || "DINE-IN").toUpperCase()}`);
    lines.push(`Cashier: ${cashierName}`);
    lines.push(separator);

    lines.push(pad("QTY  ITEM PREPARATION LIST", width, "left"));
    lines.push(separator);

    const items = kot.items || [];
    for (const item of items) {
      const qtyStr = pad(String(item.quantity || 1), 4, "left");
      const name = String(item.name || "");
      lines.push(`${qtyStr} ${name}`);
      if (item.customization) {
        lines.push(`     + ${item.customization}`);
      }
    }
    lines.push(separator);

    if (kot.specialInstructions && kot.specialInstructions !== "None" && kot.specialInstructions.trim() !== "") {
      lines.push(`NOTES: ${kot.specialInstructions}`);
      lines.push(separator);
    }

    lines.push(pad("*** KITCHEN COPY ONLY ***", width, "center"));
    lines.push("\n\n\n");

    return lines.join("\n");
  }

  /**
   * Send a silent test receipt to the target printer
   */
  public static async sendTestPrint(
    baseUrl: string,
    printerName: string,
    paperWidth: "80mm" | "58mm" = "80mm",
    settings: any = {}
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    const is80 = paperWidth === "80mm";
    const width = is80 ? 42 : 32;
    const pad = (str: string, len: number) => {
      const s = String(str);
      const rem = len - s.length;
      if (rem <= 0) return s.slice(0, len);
      const l = Math.floor(rem / 2);
      return " ".repeat(l) + s + " ".repeat(rem - l);
    };

    const lines = [
      pad("XINGS KITCHEN", width),
      pad("----------------------------", width),
      pad("PRINTER TEST RECEIPT", width),
      pad("----------------------------", width),
      `Printer : ${printerName}`,
      `Paper   : ${paperWidth}`,
      `Status  : SILENT PRINT SUCCESS`,
      `Date    : ${new Date().toLocaleDateString()}`,
      `Time    : ${new Date().toLocaleTimeString()}`,
      pad("----------------------------", width),
      pad(RESTAURANT_BRANDING.receipt.poweredByNote, width),
      "\n\n\n"
    ];

    const receiptText = lines.join("\n");
    const jobId = `TEST-PRINT-${Date.now()}`;

    return this.sendPrintJob(baseUrl, {
      printerName,
      paperWidth,
      jobType: "TEST_PRINT",
      orderId: jobId,
      receiptText,
    });
  }
}
