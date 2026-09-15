import { MenuItem } from "../types";
import { ESCPOSBuilder } from "./escposBuilder";
import { QZTrayService, buildCustomerBillESCPOS, printCustomerBillDirect } from "./qzTrayService";
import { RestaurantSettings, defaultOutlets, defaultTermsAndConditions } from "./db";
import { BRAND_CONFIG } from "../config/brand";

export interface PrinterItem {
  name: string;
  quantity: number;
  price?: number;
  customization?: string;
  isManual?: boolean;
}

export interface PrinterData {
  id: string;
  tableNumber?: string;
  orderType: string;
  createdAt: string;
  items: PrinterItem[];
  specialInstructions?: string;
  subtotal?: number;
  gst?: number;
  packagingCharge?: number;
  discountAmount?: number;
  appliedCoupon?: string;
  grandTotal?: number;
  paymentStatus?: string;
  phoneNumber?: string;
  customerName?: string;
}

export interface PrintableLine {
  text: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  doubleSize?: boolean;
  doubleHeight?: boolean;
}

export interface KOTFormatOptions {
  isReprint?: boolean;
}

export function formatKotNumberDisplay(kotNo: string | number | undefined): string {
  if (!kotNo) return "001";
  const str = String(kotNo).trim();
  const cleaned = str.replace(/^KOT-?/i, "").trim();
  if (/^\d+$/.test(cleaned)) {
    return cleaned.padStart(3, "0");
  }
  return cleaned || "001";
}

export function formatOrderNumberDisplay(orderId: string | number | undefined): string {
  if (!orderId) return "#1001";
  const str = String(orderId).trim();
  const cleaned = str.replace(/^(SR-|XK-|ORD-|#)/i, "").trim();
  return `#${cleaned}`;
}

export function formatTableNumberDisplay(table: string | number | undefined): string {
  if (!table) return "Takeaway";
  const str = String(table).trim();
  const cleaned = str.replace(/^T-?/i, "").trim();
  if (/^\d+$/.test(cleaned)) {
    return cleaned.padStart(2, "0");
  }
  return str;
}

export function formatKOTExactText(data: any, options: KOTFormatOptions = {}): string {
  const isReprint = Boolean(
    options.isReprint || 
    data.isReprint || 
    (data.printCount && data.printCount > 1) || 
    data.status === "Printed" ||
    (data.showWatermark && (data.showWatermark === "reprint" || data.showWatermark === "duplicate"))
  );

  const kotNum = formatKotNumberDisplay(data.kotNumber || data.id);
  const orderNum = formatOrderNumberDisplay(data.orderId || data.id);
  const tableNum = formatTableNumberDisplay(data.tableNumber);

  const dividerDouble = "========================";
  const dividerSingle = "------------------------";

  const lines: string[] = [];

  // Header
  lines.push(dividerDouble);
  lines.push("     THE XINGS KITCHEN");
  lines.push("          KOT");
  if (isReprint) {
    lines.push("        REPRINT");
  }
  lines.push(dividerDouble);
  lines.push("");

  // KOT & Order number on the first line: "KOT: 001    #1042"
  const kotPart = `KOT: ${kotNum}`;
  lines.push(`${kotPart}    ${orderNum}`);

  // Table number: "TABLE: 05"
  lines.push(`TABLE: ${tableNum}`);
  lines.push("");

  // Item header:
  lines.push(dividerSingle);
  lines.push("ITEM                 QTY");
  lines.push(dividerSingle);

  // Items
  const items = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    const name = String(item.name || "Item").trim();
    const qty = String(item.quantity || 1).trim();

    // 24 characters total width: name left-aligned, qty right-aligned
    const maxNameLen = 24 - qty.length - 1;
    let displayName = name;
    if (displayName.length > maxNameLen) {
      displayName = displayName.substring(0, maxNameLen);
    }
    const spacesCount = Math.max(1, 24 - displayName.length - qty.length);
    lines.push(`${displayName}${" ".repeat(spacesCount)}${qty}`);
  }

  lines.push(dividerSingle);

  // Special instructions / Note
  let notes: string[] = [];
  if (data.specialInstructions && typeof data.specialInstructions === "string") {
    const trimmed = data.specialInstructions.trim();
    if (trimmed && trimmed.toLowerCase() !== "none" && trimmed.toLowerCase() !== "no instructions") {
      const parts = trimmed.split(/[\n,;]+/).map((p: string) => p.trim()).filter(Boolean);
      notes.push(...parts);
    }
  }

  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item.customization && typeof item.customization === "string") {
        const custTrimmed = item.customization.trim();
        if (custTrimmed && custTrimmed.toLowerCase() !== "none" && !notes.includes(custTrimmed)) {
          notes.push(custTrimmed);
        }
      }
    }
  }

  // Deduplicate notes
  notes = Array.from(new Set(notes));

  if (notes.length > 0) {
    lines.push("");
    lines.push("NOTE:");
    for (const note of notes) {
      lines.push(note);
    }
  }

  lines.push("");
  lines.push(dividerDouble);

  return lines.join("\n");
}

/**
 * Modern Browser-based Physical thermal ESC/POS Printing Service
 * Generates all receipts dynamically from an array of printable lines.
 */
export class PhysicalThermalPrinter {
  private static usbDevice: any = null;
  private static serialPort: any = null;

  public static isUSBConnected(): boolean {
    return !!this.usbDevice;
  }

  public static isSerialConnected(): boolean {
    return !!this.serialPort;
  }

  /**
   * Helper to encode standard text to raw Uint8Array (Windows-1252 / ASCII compatible)
   */
  private static encodeASCII(text: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(text);
  }

  /**
   * Automatically wrap long text into chunks of at most 'limit' characters, splitting at words where possible.
   */
  public static wrapText(text: string, limit: number): string[] {
    if (!text) return [""];
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if (!word) continue;

      if (word.length > limit) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = "";
        }
        let remaining = word;
        while (remaining.length > limit) {
          lines.push(remaining.substring(0, limit));
          remaining = remaining.substring(limit);
        }
        currentLine = remaining;
      } else {
        if (currentLine.length + word.length + (currentLine ? 1 : 0) <= limit) {
          currentLine += (currentLine ? " " : "") + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines.length > 0 ? lines : [""];
  }

  /**
   * Generate PrintableLine array for Kitchen Order Ticket (KOT)
   */
  public static generateKOTLines(data: PrinterData, width: "58mm" | "80mm" = "80mm", cashierName: string = "Cashier"): PrintableLine[] {
    const isReprint = Boolean((data as any).isReprint || (data as any).printCount > 1 || (data as any).status === "Printed");
    const rawText = formatKOTExactText(data, { isReprint });
    const textLines = rawText.split("\n");
    return textLines.map(line => ({
      text: line,
      align: "left",
      bold: true
    }));
  }

  /**
   * Generate PrintableLine array for Customer Bill (Simple & Short Format)
   */
  public static generateBillLines(data: any, settings: any, width: "58mm" | "80mm" = "80mm"): PrintableLine[] {
    const is80 = width === "80mm";
    const lineCharWidth = is80 ? 48 : 32;
    const divider = "-".repeat(lineCharWidth);

    const lines: PrintableLine[] = [];

    // Title
    lines.push({ text: (settings.name || BRAND_CONFIG.restaurantName).toUpperCase(), align: "left", bold: true, doubleHeight: true });
    lines.push({ text: divider, align: "center" });

    // Metadata (Order No, Date/Time, Customer, Order Type)
    const orderNumOnly = (data.id || "XK-1024").replace("SR-", "#").replace("XK-", "#");
    const createdAtDate = new Date(data.createdAt || Date.now());
    const dateStr = createdAtDate.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateTimeStr = `${dateStr} ${timeStr}`;

    lines.push({ text: `Order No.    ${orderNumOnly}`, align: "left", bold: true });
    lines.push({ text: `Date/Time    ${dateTimeStr}`, align: "left" });
    lines.push({ text: `Customer     ${data.customerName || "Walk-in Guest"}`, align: "left" });
    lines.push({ text: `Order Type   ${(data.orderType || "takeaway").toUpperCase()}${data.tableNumber ? ` (#${data.tableNumber})` : ""}`, align: "left", bold: true });
    lines.push({ text: divider, align: "center" });

    // Table Header
    lines.push({ text: is80 ? "ITEM                        QTY      AMOUNT" : "ITEM            QTY    AMOUNT", align: "left", bold: true });
    lines.push({ text: divider, align: "center" });

    // Items List
    for (const item of (data.items || [])) {
      const price = Number(item.price) || 0;
      const qty = Number(item.quantity) || 1;
      const itemTotal = Math.round(price * qty);
      lines.push({ text: `${item.name}`, align: "left", bold: true });
      lines.push({ text: `             x ${qty}     Rs. ${itemTotal}`, align: "right" });
    }
    lines.push({ text: divider, align: "center" });

    // Financial Summary
    const subtotal = data.subtotal || 0;
    const discountAmount = data.discountAmount || 0;
    const packagingCharge = data.packagingCharge || 0;
    const deliveryCharge = data.orderType === "delivery" ? (settings.deliveryCharges || 0) : 0;
    const grandTotal = data.grandTotal || (subtotal - discountAmount + packagingCharge + deliveryCharge);
    const finalGrandTotal = Math.round(grandTotal);

    lines.push({ text: `Subtotal: Rs. ${Math.round(subtotal)}`, align: "right", bold: true });
    if (packagingCharge > 0) {
      lines.push({ text: `Packaging: Rs. ${Math.round(packagingCharge)}`, align: "right" });
    }
    if (discountAmount > 0) {
      lines.push({ text: `Discount: -Rs. ${Math.round(discountAmount)}`, align: "right" });
    }
    lines.push({ text: divider, align: "center" });

    lines.push({ text: `TOTAL: Rs. ${finalGrandTotal}`, align: "left", bold: true, doubleSize: true });
    lines.push({ text: "", align: "center" });

    const paymentMode = (data.paymentMethod || data.paymentMode || "CASH / UPI / CARD").toUpperCase();
    lines.push({ text: `Payment: ${paymentMode}`, align: "left" });
    lines.push({ text: "", align: "center" });

    lines.push({ text: "THANK YOU!", align: "center", bold: true });
    lines.push({ text: "VISIT AGAIN", align: "center", bold: true });

    return lines;
  }

  /**
   * Generate PrintableLine array for Back Side (Outlets & Terms)
   */
  public static generateBackSideLines(settings: any, width: "58mm" | "80mm" = "80mm"): PrintableLine[] {
    const is80 = width === "80mm";
    const lineCharWidth = is80 ? 48 : 32;
    const divider = "-".repeat(lineCharWidth);
    const doubleDivider = "=".repeat(lineCharWidth);

    const lines: PrintableLine[] = [];

    // Header
    lines.push({ text: `  ${(settings.name || BRAND_CONFIG.restaurantName).toUpperCase()}  `, align: "center", bold: true, doubleSize: true });
    lines.push({ text: (settings.backSideTitle || "OUR BRANCH OUTLETS & POLICIES").toUpperCase(), align: "center", bold: true });
    lines.push({ text: doubleDivider, align: "center" });

    // Outlets
    lines.push({ text: "=== OUR OUTLET LOCATIONS ===", align: "center", bold: true });
    const outlets = (settings.outlets && settings.outlets.length > 0) ? settings.outlets : defaultOutlets;
    outlets.forEach((o: any, i: number) => {
      lines.push({ text: `${i + 1}. ${o.name}`, align: "left", bold: true });
      lines.push({ text: `   ${o.address}`, align: "left" });
      lines.push({ text: `   Ph: ${o.contactNumber}`, align: "left" });
    });
    lines.push({ text: divider, align: "center" });

    // Terms
    lines.push({ text: "=== TERMS & CONDITIONS ===", align: "center", bold: true });
    const terms = (settings.termsAndConditions && settings.termsAndConditions.length > 0) ? settings.termsAndConditions : defaultTermsAndConditions;
    terms.forEach((t: string, i: number) => {
      lines.push({ text: `${i + 1}. ${t}`, align: "left" });
    });
    lines.push({ text: doubleDivider, align: "center" });

    // Footer
    lines.push({ text: settings.backSideFooterNote || "Thank You For Your Patronage! Visit Again.", align: "center", bold: true });
    if (settings.website) {
      lines.push({ text: `Web: ${settings.website}`, align: "center" });
    }
    lines.push({ text: divider, align: "center" });

    return lines;
  }

  /**
   * Generate combined PrintableLine array for Double-Sided Bill
   */
  public static generateDoubleSidedLines(data: any, settings: any, width: "58mm" | "80mm" = "80mm"): PrintableLine[] {
    const frontLines = this.generateBillLines(data, settings, width);
    const backLines = this.generateBackSideLines(settings, width);
    return [...frontLines, ...backLines];
  }

  /**
   * Build ESC/POS physical printer bytes sequence from a flat array of PrintableLine objects
   */
  public static linesToEscPosBytes(lines: PrintableLine[]): Uint8Array {
    const esc = 0x1b;
    const gs = 0x1d;

    const commands = {
      init: [esc, 0x40],
      alignLeft: [esc, 0x61, 0x00],
      alignCenter: [esc, 0x61, 0x01],
      alignRight: [esc, 0x61, 0x02],
      boldOn: [esc, 0x45, 0x01],
      boldOff: [esc, 0x45, 0x00],
      doubleSizeOn: [esc, 0x21, 0x30],
      doubleHeightOn: [esc, 0x21, 0x10],
      fontNormal: [esc, 0x21, 0x00],
      lineFeed: [0x0a],
      paperCut: [gs, 0x56, 0x42, 0x00], // Immediate partial paper cut
    };

    const byteArrays: Uint8Array[] = [];
    const pushBytes = (arr: number[]) => { byteArrays.push(new Uint8Array(arr)); };
    const pushText = (text: string) => { byteArrays.push(this.encodeASCII(text)); };

    // Initialize printer once
    pushBytes(commands.init);

    // Write all lines with appropriate styling
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Alignment style
      if (line.align === "center") {
        pushBytes(commands.alignCenter);
      } else if (line.align === "right") {
        pushBytes(commands.alignRight);
      } else {
        pushBytes(commands.alignLeft);
      }

      // Bold style
      if (line.bold) {
        pushBytes(commands.boldOn);
      } else {
        pushBytes(commands.boldOff);
      }

      // Sizing style
      if (line.doubleSize) {
        pushBytes(commands.doubleSizeOn);
      } else if (line.doubleHeight) {
        pushBytes(commands.doubleHeightOn);
      } else {
        pushBytes(commands.fontNormal);
      }

      // Print line content
      pushText(line.text + "\n");
    }

    // Feed exactly 3 lines immediately after the footer text
    pushBytes(commands.lineFeed);
    pushBytes(commands.lineFeed);
    pushBytes(commands.lineFeed);

    // Then trigger the ESC/POS paper cut command
    pushBytes(commands.paperCut);

    // Flatten to a single byte buffer
    const totalLength = byteArrays.reduce((acc, val) => acc + val.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of byteArrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /**
   * Generates a deterministic barcode using pure CSS/HTML representation
   */
  public static generateBarcodeHTML(text: string, color: string = "#000"): string {
    const normalized = text.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    let html = `<div style="display: flex; align-items: center; justify-content: center; height: 28px; overflow: hidden; margin: 4px auto; background: #ffffff; padding: 2px; width: 85%; border-radius: 2px; border: 1px solid #ddd;">`;
    
    // Start guards
    html += `<div style="width: 2px; height: 100%; background: #000; margin-right: 1px;"></div>`;
    html += `<div style="width: 1px; height: 100%; background: #000; margin-right: 2px;"></div>`;
    
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      for (let bit = 0; bit < 6; bit++) {
        const isBar = (charCode >> bit) & 1;
        const thickness = isBar ? (bit % 2 === 0 ? 2.5 : 2) : 1;
        const barColor = bit % 2 === 0 ? "#000000" : "transparent";
        html += `<div style="width: ${thickness}px; height: 100%; background: ${barColor};"></div>`;
      }
    }
    
    // End guards
    html += `<div style="width: 1px; height: 100%; background: #000; margin-left: 2px;"></div>`;
    html += `<div style="width: 2px; height: 100%; background: #000; margin-left: 1px;"></div>`;
    html += `</div>`;
    html += `<div style="text-align: center; font-size: 7px; letter-spacing: 2px; font-family: monospace; margin-top: 1px; color: ${color}; font-weight: bold;">*${normalized}*</div>`;
    return html;
  }

  /**
   * Helper to convert numbers to Indian Rupee Words format (e.g., Rupees One Hundred Fifty Only)
   */
  public static numberToWordsINR(amount: number): string {
    if (isNaN(amount) || amount === 0) return "Rupees Zero Only";
    
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
      "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const numToWords = (n: number): string => {
      let str = "";
      if (n >= 10000000) {
        str += numToWords(Math.floor(n / 10000000)) + " Crore ";
        n %= 10000000;
      }
      if (n >= 100000) {
        str += numToWords(Math.floor(n / 100000)) + " Lakh ";
        n %= 100000;
      }
      if (n >= 1000) {
        str += numToWords(Math.floor(n / 1000)) + " Thousand ";
        n %= 1000;
      }
      if (n >= 100) {
        str += numToWords(Math.floor(n / 100)) + " Hundred ";
        n %= 100;
      }
      if (n > 0) {
        if (n < 20) {
          str += units[n] + " ";
        } else {
          str += tens[Math.floor(n / 10)] + " " + units[n % 10] + " ";
        }
      }
      return str.trim();
    };

    const integerPart = Math.floor(Math.abs(amount));
    const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);

    let result = "Rupees " + numToWords(integerPart);
    if (decimalPart > 0) {
      result += " and " + numToWords(decimalPart) + " Paise";
    }
    result += " Only";
    return result.replace(/\s+/g, " ").trim();
  }

  /**
   * Generates the Customer Bill in simple and short format matching the requested layout
   */
  public static generateFrontSideHTML(
    data: any,
    settings: any,
    options: any = {},
    copyLabel: string = "",
    watermarkText: string = ""
  ): string {
    const opts = {
      paperWidth: options.paperWidth || settings.paperWidth || "80mm",
      darkPrintMode: options.darkPrintMode ?? false,
      marginControl: options.marginControl ?? 12,
      characterDensity: options.characterDensity || "normal",
      fontScaling: options.fontScaling || 100,
      showWatermark: options.showWatermark || "none",
    };

    const is80 = opts.paperWidth === "80mm";
    const paperWidthPixels = is80 ? "290px" : "220px";
    const items = data.items || [];
    const fontSizeBase = is80 ? 12 : 10.5;
    const finalFontSize = fontSizeBase * (opts.fontScaling / 100);
    const lineSpacing = opts.characterDensity === "compact" ? "1.2" : opts.characterDensity === "spacious" ? "1.5" : "1.35";
    const paddingVal = `${opts.marginControl}px`;

    const isDark = opts.darkPrintMode;
    const bg = isDark ? "#121212" : "#ffffff";
    const textCol = isDark ? "#f3f4f6" : "#000000";

    const invoiceNo = data.id || "XK-1024";
    const orderNumOnly = invoiceNo.replace("SR-", "#").replace("XK-", "#");

    const subtotal = data.subtotal || 0;
    const discountAmount = data.discountAmount || 0;
    const packagingCharge = data.packagingCharge || 0;
    const deliveryCharge = data.orderType === "delivery" ? (settings.deliveryCharges || 0) : 0;
    const grandTotal = data.grandTotal || (subtotal - discountAmount + packagingCharge + deliveryCharge);
    const finalGrandTotal = Math.round(grandTotal);

    const createdAtDate = new Date(data.createdAt || Date.now());
    const dateStr = createdAtDate.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateTimeStr = `${dateStr} ${timeStr}`;

    const paymentMode = (data.paymentMethod || data.paymentMode || "CASH / UPI / CARD").toUpperCase();

    return `
      <div style="position: relative; width: ${paperWidthPixels}; background: ${bg}; color: ${textCol}; padding: ${paddingVal}; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: ${finalFontSize}px; font-weight: bold; line-height: ${lineSpacing}; text-align: left; overflow: hidden; margin: 0 auto; border: 1px solid ${isDark ? "#292524" : "#000000"};">
        
        ${watermarkText ? `
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-family: sans-serif; font-size: 24px; font-weight: 900; color: ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}; text-transform: uppercase; white-space: nowrap; pointer-events: none; z-index: 10; letter-spacing: 2px;">
            ${watermarkText}
          </div>
        ` : ""}

        <!-- Restaurant Title -->
        <div style="text-align: left; font-size: ${finalFontSize * 1.3}px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px;">
          ${settings.name || BRAND_CONFIG.restaurantName}${copyLabel}
        </div>

        <div style="border-bottom: 1.5px solid ${textCol}; margin: 4px 0 8px 0;"></div>

        <!-- Order Meta Information -->
        <div style="font-size: ${finalFontSize * 0.95}px; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span><span style="font-weight: normal; color: ${isDark ? '#a8a29e' : '#444444'};">Order No.</span>&nbsp;&nbsp;<b>${orderNumOnly}</b></span>
            <span><span style="font-weight: normal; color: ${isDark ? '#a8a29e' : '#444444'};">Date/Time</span>&nbsp;&nbsp;<b>${dateTimeStr}</b></span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px;">
            <span><span style="font-weight: normal; color: ${isDark ? '#a8a29e' : '#444444'};">Customer</span>&nbsp;&nbsp;<b>${data.customerName || "Walk-in Guest"}</b></span>
            <span><span style="font-weight: normal; color: ${isDark ? '#a8a29e' : '#444444'};">Order Type</span>&nbsp;&nbsp;<b>${(data.orderType || "takeaway").toUpperCase()}${data.tableNumber ? ` (#${data.tableNumber})` : ""}</b></span>
          </div>
        </div>

        <div style="border-bottom: 1.5px solid ${textCol}; margin: 8px 0 6px 0;"></div>

        <!-- Items Table Header -->
        <div style="display: flex; justify-content: space-between; font-size: ${finalFontSize * 0.95}px; font-weight: 900; padding: 2px 0;">
          <span style="flex: 1; text-align: left;">ITEM</span>
          <span style="width: 45px; text-align: center;">QTY</span>
          <span style="width: 75px; text-align: right;">AMOUNT</span>
        </div>

        <div style="border-bottom: 1px solid ${textCol}; margin: 4px 0 6px 0;"></div>

        <!-- Items Rows -->
        <div style="margin-bottom: 6px;">
          ${items.map((item: any) => {
            const originalPrice = Number(item.price) || 0;
            const qty = Number(item.quantity) || 1;
            const itemTotal = Math.round(originalPrice * qty);
            return `
              <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: ${finalFontSize * 0.95}px; padding: 2.5px 0;">
                <span style="flex: 1; text-align: left; padding-right: 6px; word-break: break-word;">${item.name}</span>
                <span style="width: 45px; text-align: center; font-family: monospace;">${qty}</span>
                <span style="width: 75px; text-align: right; font-family: monospace; font-weight: bold;">₹${itemTotal}</span>
              </div>
            `;
          }).join("")}
        </div>

        <div style="border-bottom: 1.5px solid ${textCol}; margin: 6px 0;"></div>

        <!-- Financial Summary -->
        <div style="font-size: ${finalFontSize * 0.95}px; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; padding: 1px 0;">
            <span>Subtotal</span>
            <span style="font-family: monospace; font-weight: bold;">₹${Math.round(subtotal)}</span>
          </div>

          ${packagingCharge > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>Packaging</span>
              <span style="font-family: monospace; font-weight: bold;">₹${Math.round(packagingCharge)}</span>
            </div>
          ` : ""}

          ${discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0; color: ${isDark ? '#34d399' : '#059669'};">
              <span>Discount</span>
              <span style="font-family: monospace; font-weight: bold;">-₹${Math.round(discountAmount)}</span>
            </div>
          ` : ""}
        </div>

        <div style="border-bottom: 1.5px solid ${textCol}; margin: 6px 0;"></div>

        <!-- TOTAL -->
        <div style="display: flex; justify-content: space-between; font-size: ${finalFontSize * 1.35}px; font-weight: 950; padding: 3px 0;">
          <span>TOTAL</span>
          <span style="font-family: monospace;">₹${finalGrandTotal}</span>
        </div>

        <!-- Payment Info -->
        <div style="margin-top: 14px; font-size: ${finalFontSize * 0.95}px;">
          <span>Payment:&nbsp;&nbsp;<b>${paymentMode}</b></span>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 24px; margin-bottom: 10px; font-size: ${finalFontSize * 1.05}px; font-weight: 900; line-height: 1.5; letter-spacing: 0.5px;">
          <div>THANK YOU!</div>
          <div>VISIT AGAIN</div>
        </div>

      </div>
    `;
  }

  /**
   * Generates the BACK SIDE (Outlet Locations & Terms and Conditions) in 80mm thermal format
   */
  public static generateBackSideHTML(
    settings: any,
    options: any = {}
  ): string {
    const opts = {
      paperWidth: options.paperWidth || settings.paperWidth || "80mm",
      darkPrintMode: options.darkPrintMode ?? false,
      marginControl: options.marginControl ?? 8,
      characterDensity: options.characterDensity || "normal",
      fontScaling: options.fontScaling || 100,
      backSideTitle: options.backSideTitle || settings.backSideTitle || "OUR OUTLETS & POLICIES",
      backSideFooterNote: options.backSideFooterNote || settings.backSideFooterNote || `Thank You For Visiting ${BRAND_CONFIG.restaurantName}`,
    };

    const is80 = opts.paperWidth === "80mm";
    const paperWidthPixels = is80 ? "290px" : "210px";
    const isDark = opts.darkPrintMode;
    const bg = isDark ? "#121212" : "#ffffff";
    const textCol = isDark ? "#f3f4f6" : "#000000";
    const fontSizeBase = is80 ? 12.0 : 10.0;
    const finalFontSize = fontSizeBase * (opts.fontScaling / 100);
    const paddingVal = `${opts.marginControl}px`;

    const outlets = (settings.outlets && settings.outlets.length > 0) ? settings.outlets : defaultOutlets;
    const terms = (settings.termsAndConditions && settings.termsAndConditions.length > 0) ? settings.termsAndConditions : defaultTermsAndConditions;
    const estdVal = settings.estd || BRAND_CONFIG.established;
    const cityVal = settings.city || BRAND_CONFIG.city;

    return `
      <div style="position: relative; width: ${paperWidthPixels}; background: ${bg}; color: ${textCol}; padding: ${paddingVal}; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: ${finalFontSize}px; font-weight: bold; line-height: 1.25; text-align: left; overflow: hidden; margin: 0 auto; border: 1px solid ${isDark ? "#292524" : "#000000"};">
        
        <!-- Back Side Header -->
        <div style="text-align: center;">
          <div style="font-size: ${finalFontSize * 0.85}px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
            ${estdVal}
          </div>
          <div style="font-size: ${finalFontSize * 1.5}px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.2px; margin-top: 1px;">
            ${settings.name || BRAND_CONFIG.restaurantName}
          </div>
          <div style="font-size: ${finalFontSize * 0.9}px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-top: 1px;">
            ${cityVal}
          </div>
          <div style="font-size: ${finalFontSize * 0.88}px; font-weight: 900; border-top: 1.5px solid ${textCol}; border-bottom: 1.5px solid ${textCol}; padding: 3px 0; margin: 5px 0; letter-spacing: 0.8px; text-transform: uppercase; background: ${isDark ? "#1e1e1e" : "#f4f4f5"};">
            *** ${opts.backSideTitle} ***
          </div>
        </div>

        <!-- Dynamic Outlets List -->
        <div style="margin-top: 5px;">
          <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 6px;">
            ${outlets.map((outlet: any, idx: number) => `
              <div style="border-bottom: 1px dotted ${isDark ? "#444" : "#000000"}; padding-bottom: 3px;">
                <div style="font-size: ${finalFontSize * 0.95}px; font-weight: 900;">${idx + 1}. ${outlet.name.toUpperCase()}</div>
                <div style="font-size: ${finalFontSize * 0.82}px; font-weight: 600; color: ${isDark ? "#d1d5db" : "#333333"}; margin-top: 1px; line-height: 1.25;">${outlet.address}</div>
                <div style="font-size: ${finalFontSize * 0.82}px; font-weight: 800; color: ${isDark ? "#e5e7eb" : "#000000"}; margin-top: 1px;">Phone: ${outlet.contactNumber}</div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Separator -->
        <div style="border-bottom: 1.5px dashed ${textCol}; margin: 7px 0;"></div>

        <!-- Customizable Terms & Conditions -->
        <div>
          <div style="font-size: ${finalFontSize * 0.88}px; font-weight: 900; text-align: center; text-transform: uppercase; background: ${isDark ? "#262626" : "#f4f4f5"}; padding: 2px 4px; border: 1px solid ${textCol}; letter-spacing: 0.5px;">
            TERMS & CONDITIONS
          </div>

          <div style="margin-top: 5px; font-size: ${finalFontSize * 0.8}px; line-height: 1.3; font-weight: 600;">
            ${terms.map((term: string, idx: number) => `
              <div style="margin-bottom: 3px; display: flex; gap: 4px;">
                <span style="font-weight: 900; flex-shrink: 0;">${idx + 1}.</span>
                <span>${term}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Contact Information Section -->
        <div style="border-top: 1.5px dashed ${textCol}; margin-top: 7px; padding-top: 4px; font-size: ${finalFontSize * 0.8}px; font-weight: 700; text-align: center;">
          <div>Customer Care: ${settings.customerCare || settings.contactNumber || BRAND_CONFIG.defaultPhone}</div>
          <div style="margin-top: 1px;">Website: ${settings.website || BRAND_CONFIG.defaultWebsite}</div>
          <div style="margin-top: 1px;">Email: ${settings.email || BRAND_CONFIG.defaultEmail}</div>
        </div>

        <!-- Back Side Footer -->
        <div style="border-top: 1.5px solid ${textCol}; margin-top: 6px; padding-top: 5px; text-align: center;">
          <div style="font-size: ${finalFontSize * 0.92}px; font-weight: 900; letter-spacing: 0.5px;">
            ${opts.backSideFooterNote}
          </div>
        </div>

      </div>
    `;
  }

  /**
   * Generates a premium restaurant POS thermal receipt in HTML/CSS
   */
  public static generatePremiumReceiptHTML(
    type: "bill" | "kot" | "customer-copy" | "kitchen-copy" | "duplicate-copy" | "front-side" | "back-side" | "double-sided",
    data: any,
    settings: any,
    options: any = {}
  ): string {
    const opts = {
      paperWidth: options.paperWidth || settings?.paperWidth || "80mm",
      autoScale: options.autoScale ?? true,
      autoWidthDetection: options.autoWidthDetection ?? true,
      autoCut: options.autoCut ?? true,
      darkPrintMode: options.darkPrintMode ?? false,
      marginControl: options.marginControl ?? 8,
      characterDensity: options.characterDensity || "normal",
      fontScaling: options.fontScaling || 100,
      multipleCopies: options.multipleCopies || 1,
      logoUrl: options.logoUrl || settings?.logoUrl || "",
      customFooter: options.customFooter || settings?.customFooter || "Taste That Brings You Back.",
      showWatermark: options.showWatermark || "none",
      showQrCode: options.showQrCode ?? settings?.showQrCode ?? true,
      showBarcode: options.showBarcode ?? settings?.showBarcode ?? true,
      printCount: options.printCount ?? 1,
      showSignature: options.showSignature ?? settings?.showSignature ?? true,
      enableDoubleSided: options.enableDoubleSided ?? settings?.enableDoubleSided ?? false,
    };

    const is80 = opts.paperWidth === "80mm";
    const paperWidthPixels = is80 ? "290px" : "210px";
    
    const isVeg = (name: string): boolean => {
      const lower = name.toLowerCase();
      if (lower.includes("chicken") || lower.includes("egg") || lower.includes("mutton") || lower.includes("fish") || lower.includes("non-veg") || lower.includes("nonveg") || lower.includes("meat") || lower.includes("kabab")) {
        return false;
      }
      return true;
    };

    const items = data.items || [];
    
    let watermarkText = "";
    if (opts.showWatermark !== "none" && opts.showWatermark) {
      watermarkText = opts.showWatermark.toUpperCase() + " COPY";
    } else if (type === "customer-copy") {
      watermarkText = "CUSTOMER COPY";
    } else if (type === "kitchen-copy") {
      watermarkText = "KITCHEN COPY";
    } else if (type === "duplicate-copy") {
      watermarkText = "DUPLICATE COPY";
    }

    const fontSizeBase = is80 ? 13.0 : 11.0;
    const finalFontSize = fontSizeBase * (opts.fontScaling / 100);
    const lineSpacing = opts.characterDensity === "compact" ? "1.1" : opts.characterDensity === "spacious" ? "1.4" : "1.25";
    const paddingVal = `${opts.marginControl}px`;

    const isDark = opts.darkPrintMode;
    const bg = isDark ? "#121212" : "#ffffff";
    const textCol = isDark ? "#f3f4f6" : "#000000";

    // Standalone Back Side Check - Deprecated, redirect to simple bill
    if (type === "back-side") {
      return this.generateFrontSideHTML(data, settings, opts, "", watermarkText);
    }

    let fullOutputHtml = "";

    for (let copy = 0; copy < opts.multipleCopies; copy++) {
      const isCopyLabelNeeded = copy > 0 || opts.multipleCopies > 1;
      const currentCopyLabel = isCopyLabelNeeded ? ` (COPY ${copy + 1} OF ${opts.multipleCopies})` : "";
      
      let bodyHtml = "";

      if (type === "kot" || type === "kitchen-copy") {
        const isReprint = Boolean(
          (data as any).isReprint || 
          opts.printCount > 1 || 
          opts.showWatermark === "duplicate" || 
          opts.showWatermark === "reprint" ||
          data.status === "Printed"
        );
        const rawKOTText = formatKOTExactText(data, { isReprint });

        bodyHtml = `
          <div style="position: relative; width: ${paperWidthPixels}; background: ${isDark ? "#121212" : "#ffffff"}; color: ${isDark ? "#ffffff" : "#000000"}; padding: 10px; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: ${Math.max(14, finalFontSize)}px; font-weight: bold; line-height: 1.35; text-align: left; overflow: hidden; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; border: 1px solid ${isDark ? "#333333" : "#000000"};">
            <pre style="font-family: inherit; font-size: inherit; font-weight: inherit; line-height: inherit; color: inherit; margin: 0; white-space: pre-wrap; word-break: break-word;">${rawKOTText}</pre>
          </div>
        `;
      } else {
        // Simple & Short customer bill generation (single-sided)
        bodyHtml = this.generateFrontSideHTML(data, settings, opts, currentCopyLabel, watermarkText);
      }

      fullOutputHtml += bodyHtml;

      if (copy < opts.multipleCopies - 1) {
        fullOutputHtml += `<div class="page-break" style="page-break-after: always; break-after: page; height: 1px;"></div>`;
      }
    }

    return fullOutputHtml;
  }

  /**
   * Triggers preview HTML generation without opening browser print dialogs
   */
  public static printPremiumHTML(
    type: "bill" | "kot" | "customer-copy" | "kitchen-copy" | "duplicate-copy" | "front-side" | "back-side" | "double-sided",
    data: any,
    settings: any,
    options: any = {}
  ): string {
    // Return HTML string for display/preview only. Never invoke window.print() or iframe.contentWindow?.print()
    return this.generatePremiumReceiptHTML(type, data, settings, {
      ...options,
      darkPrintMode: false
    });
  }

  /**
   * Fallback print lines function kept for full backward-compatibility with custom text drivers
   */
  public static printLinesSystemFallback(lines: PrintableLine[], width: "58mm" | "80mm" = "80mm"): void {
    const is80 = width === "80mm";
    const paperWidthPixels = is80 ? "280px" : "180px";

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const linesHtml = lines.map((line) => {
      const alignment = line.align || "center";
      const fontWeight = line.bold ? "bold" : "normal";
      
      let fontSize = "13px";
      if (line.doubleSize) {
        fontSize = "18px";
      } else if (line.doubleHeight) {
        fontSize = "15px";
      }

      return `
        <div style="
          white-space: pre-wrap;
          word-break: break-all;
          font-family: 'Courier New', Courier, monospace;
          text-align: ${alignment};
          font-weight: ${fontWeight};
          font-size: ${fontSize};
          line-height: 1.3;
          margin: 0;
          padding: 0;
        ">${line.text}</div>
      `;
    }).join("");

    doc.open();
    doc.write(`
      <html>
        <head>
          <style>
            @page {
              size: ${is80 ? "80mm" : "58mm"} auto;
              margin: 0 !important;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: ${paperWidthPixels};
              margin: 0 auto !important;
              padding: 10px 10px 10px 10px !important;
              color: #000;
              background: #fff;
              box-sizing: border-box;
              text-align: center;
            }
          </style>
        </head>
        <body>
          ${linesHtml}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      // NOTE: Strictly no browser/iframe print popups or dialogs.
      console.warn("[PhysicalThermalPrinter] System fallback iframe print bypassed to prevent browser print dialogs.");
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 500);
    }, 100);
  }

  /**
   * Public interface wrapper to construct ESC/POS bytes for KOT
   */
  public static buildEscPosBytes(data: PrinterData, width: "58mm" | "80mm" = "80mm", cashierName: string = "Cashier"): Uint8Array {
    const lines = this.generateKOTLines(data, width, cashierName);
    return this.linesToEscPosBytes(lines);
  }

  /**
   * Public interface wrapper to construct ESC/POS bytes for Customer Bill
   */
  public static buildBillEscPosBytes(data: any, settings: any, width: "58mm" | "80mm" = "80mm"): Uint8Array {
    const lines = this.generateBillLines(data, settings, width);
    return this.linesToEscPosBytes(lines);
  }

  /**
   * Public KOT raw ESC/POS direct printing entrypoint
   */
  public static async printSystemFallback(data: PrinterData, width: "58mm" | "80mm" = "80mm", cashierName: string = "Cashier"): Promise<boolean> {
    return this.printKOT(data, width, "qz", cashierName);
  }

  /**
   * Public Bill raw ESC/POS direct printing entrypoint
   */
  public static async printBillSystemFallback(data: any, settings: any, width: "58mm" | "80mm" = "80mm"): Promise<boolean> {
    return this.printBill(data, settings, width, "qz");
  }

  /**
   * WebUSB & WebSerial Direct Connection Managers
   */
  public static async connectUSB(): Promise<boolean> {
    if (!("usb" in navigator)) {
      throw new Error("WebUSB API is not supported in this browser environment.");
    }
    try {
      const device = await (navigator as any).usb.requestDevice({
        filters: [{ classCode: 0x07 }]
      });
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);
      this.usbDevice = device;
      return true;
    } catch (err: any) {
      console.error("WebUSB connection failed:", err);
      return false;
    }
  }

  public static async connectSerial(): Promise<boolean> {
    if (!("serial" in navigator)) {
      throw new Error("WebSerial API is not supported in this browser environment.");
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      this.serialPort = port;
      return true;
    } catch (err) {
      console.error("WebSerial connection failed:", err);
      return false;
    }
  }

  /**
   * Print KOT - Silently via QZ Tray ESC/POS
   */
  public static async printKOT(
    kot: PrinterData,
    width: "58mm" | "80mm" = "80mm",
    mode: "usb" | "serial" | "qz" = "qz",
    cashierName: string = "Cashier"
  ): Promise<boolean> {
    const pSettings = getWRPrinterSettings();
    if (mode === "usb") {
      const bytes = this.buildEscPosBytes(kot, width, cashierName);
      if (!this.usbDevice) {
        const connected = await this.connectUSB();
        if (!connected) return false;
      }
      try {
        await this.usbDevice!.transferOut(1, bytes);
        return true;
      } catch (err) {
        console.error("WebUSB raw print transfer failed:", err);
        return false;
      }
    } else if (mode === "serial") {
      const bytes = this.buildEscPosBytes(kot, width, cashierName);
      if (!this.serialPort) {
        const connected = await this.connectSerial();
        if (!connected) return false;
      }
      try {
        const writer = this.serialPort.writable.getWriter();
        await writer.write(bytes);
        writer.releaseLock();
        return true;
      } catch (err) {
        console.error("WebSerial raw print write failed:", err);
        return false;
      }
    } else {
      // Default: High-reliability QZ Tray raw ESC/POS direct printing
      const hex = buildKOTESCPOS(kot, pSettings);
      await QZTrayService.printRaw(pSettings.printerName, hex, pSettings.copies);
      return true;
    }
  }

  /**
   * Print Customer Bill - Silently via QZ Tray ESC/POS
   */
  public static async printBill(
    order: any,
    settings: any,
    width: "58mm" | "80mm" = "80mm",
    mode: "usb" | "serial" | "qz" = "qz"
  ): Promise<boolean> {
    const pSettings = getWRPrinterSettings();
    if (mode === "usb") {
      const bytes = this.buildBillEscPosBytes(order, settings, width);
      if (!this.usbDevice) {
        const connected = await this.connectUSB();
        if (!connected) return false;
      }
      try {
        await this.usbDevice!.transferOut(1, bytes);
        return true;
      } catch (err) {
        console.error("WebUSB raw print transfer failed:", err);
        return false;
      }
    } else if (mode === "serial") {
      const bytes = this.buildBillEscPosBytes(order, settings, width);
      if (!this.serialPort) {
        const connected = await this.connectSerial();
        if (!connected) return false;
      }
      try {
        const writer = this.serialPort.writable.getWriter();
        await writer.write(bytes);
        writer.releaseLock();
        return true;
      } catch (err) {
        console.error("WebSerial raw print write failed:", err);
        return false;
      }
    } else {
      // Default: High-reliability QZ Tray raw ESC/POS direct printing
      const hex = buildBillESCPOS(order, settings, pSettings);
      await QZTrayService.printRaw(pSettings.printerName, hex, pSettings.copies);
      return true;
    }
  }

  /**
   * Print KOT and Bill sequentially with separate cuts and 1000ms delay
   */
  public static async printKOTAndBillSequentially(
    kot: any,
    order: any,
    settings: any,
    width: "58mm" | "80mm" = "80mm",
    mode: "usb" | "serial" | "qz" = "qz",
    cashierName: string = "Cashier"
  ): Promise<{ kotSuccess: boolean; billSuccess: boolean }> {
    console.log("=== START SEQUENTIAL THERMAL PRINT WORKFLOW ===");
    
    console.log("Step 1: Printing Customer Bill automatically...");
    const billSuccess = await this.printBill(order, settings, width, mode);
    if (!billSuccess) {
      console.error("Customer Bill printing failed.");
      return { kotSuccess: false, billSuccess: false };
    }
    console.log("Customer Bill printed successfully, separate paper cut command sent.");

    console.log("Step 2: Waiting 1200ms...");
    await new Promise((resolve) => setTimeout(resolve, 1200));

    console.log("Step 3: Printing KOT...");
    const kotSuccess = await this.printKOT(kot, width, mode, cashierName);
    if (!kotSuccess) {
      console.error("KOT printing failed! Aborting sequence as per POS rules.");
      return { kotSuccess: false, billSuccess: true };
    }
    
    console.log("KOT printed successfully, separate paper cut command sent.");
    return { kotSuccess: true, billSuccess: true };
  }
}

// --- MASTER PRINTER CONFIGURATION STORAGE AND ESC/POS BUILDERS ---

export interface WRPrinterSettings {
  printerName: string;
  paperWidth: "58mm" | "80mm";
  autoPrintBill: boolean;
  autoPrintKOT: boolean;
  autoCut: boolean;
  cutType: "full" | "partial";
  feedBeforeCutBill: number;
  feedBeforeCutKOT: number;
  copies: number;
  useQZTray: boolean;
}

export function getWRPrinterSettings(): WRPrinterSettings {
  const stored = localStorage.getItem("wr_printer_settings");
  if (!stored) {
    const defaults: WRPrinterSettings = {
      printerName: "EPSON TM-T82X",
      paperWidth: "80mm",
      autoPrintBill: true,
      autoPrintKOT: true,
      autoCut: true,
      cutType: "full",
      feedBeforeCutBill: 5,
      feedBeforeCutKOT: 3,
      copies: 1,
      useQZTray: true,
    };
    localStorage.setItem("wr_printer_settings", JSON.stringify(defaults));
    return defaults;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    const defaults: WRPrinterSettings = {
      printerName: "EPSON TM-T82X",
      paperWidth: "80mm",
      autoPrintBill: true,
      autoPrintKOT: true,
      autoCut: true,
      cutType: "full",
      feedBeforeCutBill: 5,
      feedBeforeCutKOT: 3,
      copies: 1,
      useQZTray: true,
    };
    return defaults;
  }
}

export function saveWRPrinterSettings(settings: WRPrinterSettings) {
  localStorage.setItem("wr_printer_settings", JSON.stringify(settings));
}

export function buildBillESCPOS(data: any, settings: any, printerSettings: WRPrinterSettings): string {
  const width = printerSettings.paperWidth || "80mm";
  return buildCustomerBillESCPOS(data, settings, width, printerSettings);
}

export function buildKOTESCPOS(data: any, printerSettings: WRPrinterSettings): string {
  const builder = new ESCPOSBuilder();
  const rawText = formatKOTExactText(data, { 
    isReprint: Boolean(data.isReprint || (data.printCount && data.printCount > 1) || data.status === "Printed") 
  });
  
  builder.init();
  builder.bold(true);
  builder.alignLeft();
  builder.writeText(rawText + "\n");
  
  const feedLines = printerSettings.feedBeforeCutKOT ?? 2;
  builder.feed(feedLines);
  
  if (printerSettings.autoCut) {
    if (printerSettings.cutType === "partial") {
      builder.cutPartial();
    } else {
      builder.cutFull();
    }
  }
  
  return builder.compileHex();
}

export function buildBackSideESCPOS(settings: any, printerSettings: WRPrinterSettings): string {
  const builder = new ESCPOSBuilder();
  const width = printerSettings.paperWidth || "80mm";

  builder.alignCenter().bold(true);
  builder.writeText((settings.estd || BRAND_CONFIG.established) + "\n");
  builder.doubleSize(true);
  builder.writeText((settings.name || BRAND_CONFIG.restaurantName) + "\n");
  builder.doubleSize(false);
  builder.writeText((settings.city || BRAND_CONFIG.city) + "\n");
  builder.writeText("*** " + (settings.backSideTitle || "OUR OUTLETS & POLICIES") + " ***\n");
  builder.divider(width, true);

  // Outlets
  builder.alignLeft();
  const outlets = (settings.outlets && settings.outlets.length > 0) ? settings.outlets : defaultOutlets;
  outlets.forEach((o: any, i: number) => {
    builder.bold(true).writeText(`${i + 1}. ${o.name.toUpperCase()}\n`).bold(false);
    builder.writeText(`   ${o.address}\n`);
    builder.writeText(`   Phone: ${o.contactNumber}\n`);
  });

  builder.divider(width, false);

  // Terms & Conditions
  builder.alignCenter().bold(true);
  builder.writeText("TERMS & CONDITIONS\n");
  builder.bold(false).alignLeft();
  const terms = (settings.termsAndConditions && settings.termsAndConditions.length > 0) ? settings.termsAndConditions : defaultTermsAndConditions;
  terms.forEach((t: string, i: number) => {
    builder.writeText(`${i + 1}. ${t}\n`);
  });

  builder.divider(width, true);

  // Contact info
  builder.alignCenter();
  builder.writeText(`Customer Care: ${settings.customerCare || settings.contactNumber || BRAND_CONFIG.defaultPhone}\n`);
  builder.writeText(`Website: ${settings.website || BRAND_CONFIG.defaultWebsite}\n`);
  builder.writeText(`Email: ${settings.email || BRAND_CONFIG.defaultEmail}\n`);
  builder.divider(width, false);

  // Back side footer
  builder.bold(true);
  builder.writeText((settings.backSideFooterNote || `Thank You For Visiting ${BRAND_CONFIG.restaurantName}`) + "\n");
  builder.bold(false);

  const feedLines = printerSettings.feedBeforeCutBill ?? 4;
  builder.feed(feedLines);

  if (printerSettings.autoCut) {
    if (printerSettings.cutType === "partial") {
      builder.cutPartial();
    } else {
      builder.cutFull();
    }
  }

  return builder.compileHex();
}

export function buildDoubleSidedESCPOS(data: any, settings: any, printerSettings: WRPrinterSettings): string {
  const frontHex = buildBillESCPOS(data, settings, { ...printerSettings, autoCut: false });
  const backHex = buildBackSideESCPOS(settings, printerSettings);
  return frontHex + backHex;
}

export { printCustomerBillDirect, buildCustomerBillESCPOS };

