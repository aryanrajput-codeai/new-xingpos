import { MenuItem, Shift, ShiftFinancials } from "../types";
import { ESCPOSBuilder } from "./escposBuilder";
import { 
  RestaurantSettings, 
  BillFormatSettings, 
  KOTFormatSettings, 
  defaultBillFormatSettings, 
  defaultKOTFormatSettings 
} from "./db";
import { RESTAURANT_BRANDING } from "../config/branding";
import { PrintBridgeClient } from "./printBridgeClient";

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      appName: string;
      getPrinters: () => Promise<Array<{ name: string; displayName?: string; isDefault?: boolean }>>;
      silentPrint: (options: { htmlContent: string; deviceName?: string; copies?: number; paperWidth?: string }) => Promise<{ success: boolean; error?: string }>;
    };
  }
}


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
    const is80 = width === "80mm";
    const lineCharWidth = is80 ? 48 : 32;
    const divider = "-".repeat(lineCharWidth);
    const doubleDivider = "=".repeat(lineCharWidth);

    const lines: PrintableLine[] = [];

    // 1. Centered Title
    lines.push({ text: ((data as any)?.restaurantName || RESTAURANT_BRANDING.name).toUpperCase(), align: "center", bold: true, doubleSize: true });
    if ((data as any).isAddOn) {
      lines.push({ text: "ADD-ON KOT (ADD-ON KITCHEN ORDER TICKET)", align: "center", bold: true });
    } else {
      lines.push({ text: "KITCHEN ORDER TICKET (KOT)", align: "center", bold: true });
    }
    lines.push({ text: `KOT NO: ${data.id}`, align: "center", bold: true, doubleHeight: true });
    lines.push({ text: doubleDivider, align: "center" });

    // 2. Metadata (centered)
    lines.push({ text: `Date: ${new Date(data.createdAt).toLocaleDateString()}  Time: ${new Date(data.createdAt).toLocaleTimeString()}`, align: "center" });
    lines.push({ text: `Table Number: ${data.tableNumber || "Takeaway"}`, align: "center" });
    lines.push({ text: `Order Type: ${data.orderType.toUpperCase()}`, align: "center" });
    lines.push({ text: `Cashier: ${cashierName}`, align: "center" });
    lines.push({ text: doubleDivider, align: "center" });

    // 3. Header
    lines.push({ text: "ITEMS PREPARATION LIST", align: "center", bold: true });
    lines.push({ text: divider, align: "center" });

    // 4. Items List centered
    for (const item of data.items) {
      lines.push({ text: `${item.quantity} x ${item.name}`, align: "center", bold: true });
    }
    lines.push({ text: divider, align: "center" });

    // 5. Special Instructions
    if (data.specialInstructions && data.specialInstructions !== "None" && data.specialInstructions.trim() !== "") {
      lines.push({ text: "SPECIAL INSTRUCTIONS:", align: "center", bold: true });
      const wrappedNotes = this.wrapText(data.specialInstructions, lineCharWidth);
      for (const noteLine of wrappedNotes) {
        lines.push({ text: noteLine, align: "center" });
      }
      lines.push({ text: divider, align: "center" });
    }

    // 6. Footer (Requirement 13)
    lines.push({ text: "Kitchen Copy Only", align: "center" });
    lines.push({ text: divider, align: "center" });
    lines.push({ text: "Thank You! Visit Again.", align: "center", bold: true });
    lines.push({ text: divider, align: "center" });

    return lines;
  }

  /**
   * Generate PrintableLine array for Customer Bill
   */
  public static generateBillLines(data: any, settings: any, width: "58mm" | "80mm" = "80mm"): PrintableLine[] {
    const is80 = width === "80mm";
    const lineCharWidth = is80 ? 48 : 32;
    const divider = "-".repeat(lineCharWidth);
    const doubleDivider = "=".repeat(lineCharWidth);

    const lines: PrintableLine[] = [];

    // 1. Centered Title & Short Location
    lines.push({ text: `  ${(settings.name || RESTAURANT_BRANDING.name).toUpperCase()}  `, align: "center", bold: true, doubleSize: true });
    if (settings.tagline || RESTAURANT_BRANDING.tagline) {
      lines.push({ text: (settings.tagline || RESTAURANT_BRANDING.tagline).slice(0, lineCharWidth), align: "center" });
    }
    if (settings.address || RESTAURANT_BRANDING.contact.address) {
      lines.push({ text: (settings.address || RESTAURANT_BRANDING.contact.address).slice(0, lineCharWidth), align: "center" });
    }
    const phoneVal = settings.contactNumber || RESTAURANT_BRANDING.contact.phone;
    if (phoneVal) {
      lines.push({ text: `Ph: ${phoneVal}`, align: "center" });
    }
    if (settings.gstin && settings.showGstin !== false) {
      lines.push({ text: `GSTIN: ${settings.gstin}`, align: "center" });
    }
    if (settings.fssaiNumber && settings.showFssai !== false) {
      lines.push({ text: `FSSAI: ${settings.fssaiNumber}`, align: "center" });
    }
    lines.push({ text: doubleDivider, align: "center" });

    // 2. Metadata (Clean & Large)
    lines.push({ text: `BILL NO: ${data.id}`, align: "center", bold: true, doubleHeight: true });
    const createdAtDate = new Date(data.createdAt || Date.now());
    lines.push({ text: `DATE: ${createdAtDate.toLocaleDateString()}  TIME: ${createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, align: "center" });
    if (data.customerName) {
      lines.push({ text: `CUSTOMER: ${data.customerName}`, align: "center" });
    }
    lines.push({ text: `TYPE: ${(data.orderType || "dine-in").toUpperCase()} ${data.tableNumber ? `(TABLE #${data.tableNumber})` : ""}`, align: "center", bold: true });
    lines.push({ text: doubleDivider, align: "center" });

    // 3. Items List
    for (const item of (data.items || [])) {
      const priceStr = ((item.price || 0) * item.quantity).toFixed(2);
      lines.push({ text: `${item.quantity} x ${item.name}`, align: "left", bold: true, doubleHeight: true });
      lines.push({ text: `       Rs. ${priceStr}`, align: "right", bold: true });
      if (item.customization) {
        lines.push({ text: `  + ${item.customization}`, align: "left" });
      }
    }
    lines.push({ text: divider, align: "center" });

    // 4. Financial Summary
    lines.push({ text: `Subtotal: Rs. ${(data.subtotal || 0).toFixed(2)}`, align: "right", bold: true });
    if (data.discountAmount > 0) {
      lines.push({ text: `Discount: -Rs. ${data.discountAmount.toFixed(2)}`, align: "right" });
    }
    if (data.packagingCharge > 0) {
      lines.push({ text: `Packaging Charge: Rs. ${data.packagingCharge.toFixed(2)}`, align: "right" });
    }
    if (data.gst > 0) {
      const gstPct = Number(settings.gstPercentage) || 5;
      const halfGstPct = (gstPct / 2).toFixed(1).replace(".0", "");
      const halfGst = data.gst / 2;
      lines.push({ text: `CGST (${halfGstPct}%): Rs. ${halfGst.toFixed(2)}`, align: "right" });
      lines.push({ text: `SGST (${halfGstPct}%): Rs. ${halfGst.toFixed(2)}`, align: "right" });
    }
    lines.push({ text: divider, align: "center" });
    
    lines.push({ text: `GRAND TOTAL: Rs. ${(data.grandTotal || 0).toFixed(2)}`, align: "center", bold: true, doubleSize: true });
    lines.push({ text: doubleDivider, align: "center" });

    // 5. Clean Footer
    lines.push({ text: `Thank You! Visit ${settings.name || RESTAURANT_BRANDING.name} Again.`, align: "center", bold: true, doubleHeight: true });
    if (settings.customFooter) {
      lines.push({ text: settings.customFooter.slice(0, lineCharWidth), align: "center" });
    }
    if (settings.website || RESTAURANT_BRANDING.contact.website) {
      lines.push({ text: `Web: ${settings.website || RESTAURANT_BRANDING.contact.website}`, align: "center" });
    }
    lines.push({ text: "Powered by Webrajya", align: "center" });
    lines.push({ text: divider, align: "center" });

    return lines;
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
   * Generates the Customer Bill Receipt HTML in thermal format
   */
  public static generateFrontSideHTML(
    data: any,
    settings: any,
    options: any = {}
  ): string {
    const opts = {
      paperWidth: options.paperWidth || settings.paperWidth || "80mm",
      darkPrintMode: options.darkPrintMode ?? false,
      logoUrl: options.logoUrl || settings.logoUrl || "",
      customFooter: options.customFooter || settings.customFooter || "Taste That Brings You Back. Visit Again Soon.",
      showQrCode: options.showQrCode ?? settings.showQrCode ?? true,
      showBarcode: options.showBarcode ?? settings.showBarcode ?? true,
      showSignature: options.showSignature ?? settings.showSignature ?? true,
      showLogo: options.showLogo ?? settings.showLogo ?? true,
      showGstin: options.showGstin ?? settings.showGstin ?? true,
      showFssai: options.showFssai ?? settings.showFssai ?? true,
      showPax: options.showPax ?? settings.showPax ?? true,
      showCashier: options.showCashier ?? settings.showCashier ?? true,
      showAmountInWords: options.showAmountInWords ?? settings.showAmountInWords ?? true,
      invoiceTitle: options.invoiceTitle || settings.invoiceTitle || "TAX INVOICE",
      cashierName: options.cashierName || data.cashierName || settings.cashierName || "Cashier",
      pax: data.pax || settings.defaultPax || 2,
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
    const finalFontSize = is80 ? 12.5 : 10.5;
    const lineSpacing = "1.22";
    const paddingVal = "8px";

    const isDark = opts.darkPrintMode;
    const bg = isDark ? "#121212" : "#ffffff";
    const textCol = isDark ? "#f3f4f6" : "#000000";
    const borderCol = isDark ? "#2d2d2d" : "#000000";
    
    let logoHtml = "";
    if (opts.logoUrl && opts.logoUrl.trim().length > 0) {
      logoHtml = `<div style="text-align: center; margin-bottom: 6px;"><img src="${opts.logoUrl}" alt="${settings.name || 'Logo'}" style="max-height: 48px; max-width: 140px; object-fit: contain;" /></div>`;
    } else {
      logoHtml = `
        <div style="text-align: center; margin-bottom: 4px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${textCol}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
            <path d="M12 2l3 6 6 1-4.5 4.5L17.5 20 12 17l-5.5 3 1-6.5L3 9l6-1z" />
          </svg>
        </div>
      `;
    }

    const invoiceNo = data.id || "XK-1001";
    const billNo = data.id || "XK-1001";
    const orderNumOnly = invoiceNo.replace(/^(SR|XK)-/, "#");
    
    const subtotal = data.subtotal || 0;
    const discountAmount = data.discountAmount || 0;
    const coupon = data.appliedCoupon || "";
    const packagingCharge = data.packagingCharge || 0;
    const gst = data.gst || 0;
    const deliveryCharge = data.orderType === "delivery" ? (settings.deliveryCharges || 0) : 0;
    const grandTotal = data.grandTotal || (subtotal - discountAmount + packagingCharge + gst + deliveryCharge);
    const roundOff = (Math.round(grandTotal) - grandTotal).toFixed(2);
    const finalGrandTotal = Math.round(grandTotal);
    const totalQty = items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0);
    const totalItemsCount = items.length;

    const createdAtDate = new Date(data.createdAt || Date.now());
    const gstinVal = settings.gstin || "";
    const fssaiVal = settings.fssaiNumber || "";
    const contactVal = settings.contactNumber || RESTAURANT_BRANDING.contact.phone || "";
    const addressVal = settings.address || RESTAURANT_BRANDING.contact.address || "Restaurant Address (Configure in Settings)";
    const legalNameVal = settings.legalName || RESTAURANT_BRANDING.legalName || "";
    const estdVal = settings.estd || RESTAURANT_BRANDING.estd || "";
    const gstPct = Number(settings.gstPercentage) || 5;
    const halfGstPct = (gstPct / 2).toFixed(1).replace(".0", "");

    const paymentMode = (data.paymentMethod || data.paymentMode || "CASH").toUpperCase();
    const paymentStatus = (data.paymentStatus || "PAID").toUpperCase();

    return `
      <div style="position: relative; width: ${paperWidthPixels}; background: ${bg}; color: ${textCol}; padding: ${paddingVal}; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: ${finalFontSize}px; font-weight: bold; line-height: ${lineSpacing}; text-align: left; overflow: hidden; margin: 0 auto; border: 1px solid ${isDark ? "#292524" : "#000000"};">

        <!-- Restaurant Header -->
        ${opts.showLogo ? logoHtml : ""}
        <div style="text-align: center;">
          ${estdVal ? `
            <div style="font-size: ${finalFontSize * 0.85}px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
              ${estdVal}
            </div>
          ` : ""}
          <div style="font-size: ${finalFontSize * 1.5}px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.2px; margin-top: 1px;">
            ${settings.name || RESTAURANT_BRANDING.name}
          </div>
          ${legalNameVal ? `
            <div style="font-size: ${finalFontSize * 0.95}px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 1px;">
              ${legalNameVal}
            </div>
          ` : ""}
          <div style="font-size: ${finalFontSize * 0.8}px; font-weight: 600; margin-top: 2px; line-height: 1.25;">
            ${addressVal}
          </div>
          ${contactVal ? `
            <div style="font-size: ${finalFontSize * 0.82}px; font-weight: 700; margin-top: 2px;">
              Phone: ${contactVal}
            </div>
          ` : ""}
          
          ${opts.showFssai && fssaiVal ? `
            <div style="font-size: ${finalFontSize * 0.8}px; font-weight: 700; margin-top: 1px;">
              FSSAI No: ${fssaiVal}
            </div>
          ` : ""}

          ${opts.showGstin && gstinVal ? `
            <div style="font-size: ${finalFontSize * 0.78}px; font-weight: 700; margin-top: 1px;">
              GSTIN: ${gstinVal}
            </div>
          ` : ""}

          <!-- Document Invoice Title -->
          <div style="margin-top: 4px; display: inline-block; border: 1.5px solid ${textCol}; padding: 2px 12px; font-size: ${finalFontSize * 0.92}px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; background: ${isDark ? "#1e1e1e" : "#f4f4f5"};">
            *** ${opts.invoiceTitle} ***
          </div>
        </div>

        <div style="border-bottom: 1.5px dashed ${textCol}; margin: 6px 0;"></div>

        <!-- Order Information Section -->
        <div style="font-size: ${finalFontSize * 0.9}px; font-weight: 700; line-height: 1.35;">
          <div style="display: flex; justify-content: space-between;">
            <span><b>Memo#:</b> ${billNo}</span>
            <span><b>${createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></span>
            <span><b>${createdAtDate.toLocaleDateString()}</b></span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            ${opts.showCashier ? `<span><b>User:</b> ${opts.cashierName}</span>` : `<span><b>Order:</b> ${orderNumOnly}</span>`}
            ${opts.showPax ? `<span><b>Pax#:</b> ${opts.pax}</span>` : `<span></span>`}
            <span><b>${data.tableNumber ? `Table #${data.tableNumber}` : (data.orderType || "DINE-IN").toUpperCase()}</b></span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span><b>Order#:</b> ${orderNumOnly}</span>
            ${data.customerName ? `<span><b>Cust:</b> ${data.customerName}</span>` : `<span></span>`}
          </div>
        </div>

        <div style="border-bottom: 1.5px dashed ${textCol}; margin: 6px 0;"></div>

        <!-- Professional Items Table (Sr | Product | Qty | Rate | Amount) -->
        <table style="width: 100%; border-collapse: collapse; text-align: left; table-layout: fixed;">
          <thead>
            <tr style="border-bottom: 1.5px solid ${textCol}; font-weight: 900; font-size: ${finalFontSize * 0.9}px; text-transform: uppercase;">
              <th style="padding: 3px 0; width: 9%; text-align: left;">Sr</th>
              <th style="padding: 3px 0; width: 45%;">Product</th>
              <th style="padding: 3px 0; width: 14%; text-align: right;">Qty</th>
              <th style="padding: 3px 0; width: 16%; text-align: right;">Rate</th>
              <th style="padding: 3px 0; width: 16%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any, idx: number) => {
              const itemVeg = isVeg(item.name);
              const icon = itemVeg 
                ? `<span style="border: 1px solid #22c55e; display: inline-flex; justify-content: center; align-items: center; width: 7px; height: 7px; font-size: 5px; color: #22c55e; font-weight: bold; margin-right: 2px; vertical-align: middle; line-height: 1;">□</span>`
                : `<span style="border: 1px solid #ef4444; display: inline-flex; justify-content: center; align-items: center; width: 7px; height: 7px; font-size: 5px; color: #ef4444; font-weight: bold; margin-right: 2px; vertical-align: middle; line-height: 1;">▲</span>`;

              const isManual = item.isManual || item.menuItemId === 'manual' || item.name.toUpperCase() === item.name || item.name.toLowerCase().includes("manual");
              const originalPrice = Number(item.price) || 0;
              const qty = Number(item.quantity) || 1;
              const itemTotal = originalPrice * qty;
              const isFree = originalPrice === 0;
              const formattedQty = (qty % 1 === 0) ? qty.toFixed(3) : qty.toFixed(3);

              return `
                <tr style="border-bottom: 1px dotted ${isDark ? "#444" : "#000000"}; font-size: ${finalFontSize * 0.92}px;">
                  <td style="padding: 4px 0; vertical-align: top; font-weight: 700; font-size: ${finalFontSize * 0.85}px;">${idx + 1}</td>
                  <td style="padding: 4px 0; vertical-align: top; font-weight: 800; word-break: break-word;">
                    ${icon}${item.name}
                    ${isManual ? `<span style="border: 1px solid ${textCol}; padding: 0 2px; font-size: 7px; border-radius: 1px; font-weight: bold; margin-left: 2px; display: inline-block;">(M)</span>` : ""}
                    ${item.customization ? `<div style="font-size: ${finalFontSize * 0.8}px; color: ${isDark ? "#a8a29e" : "#555555"}; font-style: italic; font-weight: 600; padding-left: 8px;">+ ${item.customization}</div>` : ""}
                  </td>
                  <td style="padding: 4px 0; text-align: right; vertical-align: top; font-family: monospace; font-weight: 900; font-size: ${finalFontSize * 0.95}px;">${formattedQty}</td>
                  <td style="padding: 4px 0; text-align: right; vertical-align: top; font-family: monospace; font-weight: 700; font-size: ${finalFontSize * 0.9}px;">${isFree ? "0.00" : originalPrice.toFixed(2)}</td>
                  <td style="padding: 4px 0; text-align: right; vertical-align: top; font-family: monospace; font-weight: 900; font-size: ${finalFontSize * 0.95}px;">
                    ${isFree ? "FREE" : itemTotal.toFixed(2)}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <div style="border-bottom: 1.5px dashed ${textCol}; margin: 5px 0;"></div>

        <!-- Quantity & Subtotal Summary -->
        <div style="font-family: monospace; font-size: ${finalFontSize * 0.95}px; font-weight: 700;">
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Sub Total:</span>
            <span>₹${subtotal.toFixed(2)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; padding: 1px 0; font-size: ${finalFontSize * 0.85}px; color: ${isDark ? "#cbd5e1" : "#4b5563"};">
            <span>Total Qty: <b>${totalQty.toFixed(3)}</b></span>
            <span>Total Items: <b>${totalItemsCount}</b></span>
          </div>
          
          ${discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; color: ${isDark ? "#34d399" : "#059669"}; font-weight: 800; padding: 2px 0;">
              <span>Discount ${coupon ? `(${coupon})` : ""}:</span>
              <span>-₹${discountAmount.toFixed(2)}</span>
            </div>
          ` : ""}

          ${packagingCharge > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 2px 0;">
              <span>Packing Charge:</span>
              <span>₹${packagingCharge.toFixed(2)}</span>
            </div>
          ` : ""}

          ${deliveryCharge > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 2px 0;">
              <span>Delivery Charge:</span>
              <span>₹${deliveryCharge.toFixed(2)}</span>
            </div>
          ` : ""}

          ${gst > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>SGST (${halfGstPct}%):</span>
              <span>₹${(gst / 2).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>CGST (${halfGstPct}%):</span>
              <span>₹${(gst / 2).toFixed(2)}</span>
            </div>
          ` : ""}

          ${Number(roundOff) !== 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>Round Off:</span>
              <span>₹${roundOff}</span>
            </div>
          ` : ""}

          <!-- Grand Total Box -->
          <div style="border-top: 2px solid ${textCol}; border-bottom: 2px solid ${textCol}; margin: 5px 0; padding: 5px 0;">
            <div style="display: flex; justify-content: space-between; font-size: ${finalFontSize * 1.35}px; font-weight: 950;">
              <span>GRAND TOTAL:</span>
              <span>₹${finalGrandTotal.toFixed(2)}</span>
            </div>
          </div>

          ${opts.showAmountInWords ? `
            <div style="padding: 2px 0; font-size: ${finalFontSize * 0.78}px; color: ${isDark ? "#cbd5e1" : "#1f2937"}; font-weight: bold; font-style: italic; line-height: 1.25;">
              (Rupees ${PhysicalThermalPrinter.numberToWordsINR(finalGrandTotal)} Only)
            </div>
          ` : ""}

          <!-- Payment Info -->
          <div style="font-size: ${finalFontSize * 0.85}px; padding: 3px 0; border-top: 1px dotted ${isDark ? "#444" : "#000000"}; margin-top: 3px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Pay Mode: <b>${paymentMode}</b></span>
              <span>Status: <b style="color: ${paymentStatus === 'PAID' ? '#16a34a' : paymentStatus === 'PARTIAL' ? '#d97706' : '#ea580c'};">${paymentStatus}</b></span>
            </div>
            ${data.paidAmount !== undefined && Number(data.paidAmount) > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-top: 2px; font-size: ${finalFontSize * 0.82}px;">
                <span>Total Paid: ₹${Number(data.paidAmount).toFixed(2)}</span>
                <span>Balance Due: ₹${Math.max(0, Number(data.remainingAmount !== undefined ? data.remainingAmount : (finalGrandTotal - Number(data.paidAmount)))).toFixed(2)}</span>
              </div>
            ` : ""}
            ${(data.payments && Array.isArray(data.payments) && data.payments.length > 0) ? `
              <div style="margin-top: 3px; padding-top: 2px; border-top: 0.5px dashed ${isDark ? '#444' : '#ccc'}; font-size: ${finalFontSize * 0.78}px;">
                ${data.payments.filter((p: any) => p.status === 'Paid').map((p: any) => `
                  <div style="display: flex; justify-content: space-between;">
                    <span>• ${p.paymentMethod}${p.transactionReference ? ` (${p.transactionReference})` : ''}</span>
                    <span>₹${Number(p.amount).toFixed(2)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ""}
          </div>
        </div>
          
          ${discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; color: ${isDark ? "#34d399" : "#059669"}; font-weight: 800; padding: 2px 0;">
              <span>Discount ${coupon ? `(${coupon})` : ""}:</span>
              <span>-₹${discountAmount.toFixed(2)}</span>
            </div>
          ` : ""}

          ${packagingCharge > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 2px 0;">
              <span>Packing Charge:</span>
              <span>₹${packagingCharge.toFixed(2)}</span>
            </div>
          ` : ""}

          ${deliveryCharge > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 2px 0;">
              <span>Delivery Charge:</span>
              <span>₹${deliveryCharge.toFixed(2)}</span>
            </div>
          ` : ""}

          ${gst > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>SGST (${halfGstPct}%):</span>
              <span>₹${(gst / 2).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>CGST (${halfGstPct}%):</span>
              <span>₹${(gst / 2).toFixed(2)}</span>
            </div>
          ` : ""}

          ${Number(roundOff) !== 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>Round Off:</span>
              <span>₹${roundOff}</span>
            </div>
          ` : ""}

          <!-- Grand Total Box -->
          <div style="border-top: 2px solid ${textCol}; border-bottom: 2px solid ${textCol}; margin: 5px 0; padding: 5px 0;">
            <div style="display: flex; justify-content: space-between; font-size: ${finalFontSize * 1.4}px; font-weight: 950;">
              <span>GRAND TOTAL:</span>
              <span>₹${finalGrandTotal.toLocaleString()}.00</span>
            </div>
          </div>

          ${opts.showAmountInWords ? `
            <div style="padding: 2px 0; font-size: ${finalFontSize * 0.78}px; color: ${isDark ? "#cbd5e1" : "#1f2937"}; font-style: italic; line-height: 1.2;">
              <b>In Words:</b> ${PhysicalThermalPrinter.numberToWordsINR(finalGrandTotal)}
            </div>
          ` : ""}

          <!-- Payment Info -->
          <div style="display: flex; justify-content: space-between; font-size: ${finalFontSize * 0.85}px; padding: 3px 0; border-top: 1px dotted ${isDark ? "#444" : "#000000"}; margin-top: 3px;">
            <span>Payment Mode: <b>${paymentMode}</b></span>
            <span>Status: <b style="color: ${paymentStatus === 'PAID' ? '#16a34a' : '#ea580c'};">${paymentStatus}</b></span>
          </div>
        </div>

        <!-- Dynamic UPI QR Code & Barcode -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px;">
          ${opts.showBarcode ? `
            <div style="flex: 1;">
              ${PhysicalThermalPrinter.generateBarcodeHTML(billNo, textCol)}
            </div>
          ` : ""}
        </div>

        ${opts.showSignature ? `
          <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 8px; font-size: ${finalFontSize * 0.78}px; font-weight: bold;">
            <div>Customer Sign: ________</div>
            <div style="text-align: right;">Auth Sign: ________</div>
          </div>
        ` : ""}

        <!-- Front Side Footer -->
        <div style="text-align: center; margin-top: 8px; border-top: 1.5px dashed ${textCol}; padding-top: 6px;">
          <div style="font-size: ${finalFontSize * 1.05}px; font-weight: 900; letter-spacing: 0.5px;">
            Thank You! Visit Again.
          </div>
          <div style="font-size: ${finalFontSize * 0.78}px; color: ${isDark ? "#a8a29e" : "#555555"}; font-weight: 600; margin-top: 2px;">
            ${opts.customFooter}
          </div>
          ${settings.website ? `
            <div style="font-size: ${finalFontSize * 0.75}px; color: ${isDark ? "#9ca3af" : "#666666"}; font-weight: 700; margin-top: 1px;">
              ${settings.website}
            </div>
          ` : ""}
          <div style="font-size: ${finalFontSize * 0.72}px; color: ${isDark ? "#9ca3af" : "#666666"}; font-weight: 700; margin-top: 4px; letter-spacing: 0.5px; border-top: 1px dotted ${isDark ? "#444" : "#ccc"}; padding-top: 3px;">
            ${RESTAURANT_BRANDING.receipt.poweredByNote}
          </div>
        </div>

      </div>
    `;
  }



  /**
   * Generates a premium restaurant POS thermal receipt in HTML/CSS
   */
  public static generatePremiumReceiptHTML(
    type: "bill" | "kot" | string,
    data: any,
    settings: any,
    options: any = {}
  ): string {
    const opts = {
      paperWidth: options.paperWidth || settings?.paperWidth || "80mm",
      darkPrintMode: options.darkPrintMode ?? false,
      logoUrl: options.logoUrl || settings?.logoUrl || "",
      customFooter: options.customFooter || settings?.customFooter || "Taste That Brings You Back.",
      showQrCode: options.showQrCode ?? settings?.showQrCode ?? true,
      showBarcode: options.showBarcode ?? settings?.showBarcode ?? true,
      printCount: options.printCount ?? 1,
      showSignature: options.showSignature ?? settings?.showSignature ?? true,
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
    const finalFontSize = is80 ? 13.0 : 11.0;
    const lineSpacing = "1.25";
    const paddingVal = "8px";

    const isDark = opts.darkPrintMode;
    const bg = isDark ? "#121212" : "#ffffff";
    const textCol = isDark ? "#f3f4f6" : "#000000";

    if (type === "kot") {
      const kotNo = data.id || "KOT-NEW";
      const orderNo = data.orderId || "XK-NEW";
      const orderNumOnly = orderNo.replace(/^(SR|XK)-/, "#");

      return `
        <div style="position: relative; width: ${paperWidthPixels}; background: ${bg}; color: ${textCol}; padding: ${paddingVal}; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: ${finalFontSize}px; font-weight: bold; line-height: ${lineSpacing}; text-align: left; overflow: hidden; margin: 0 auto; border: 1px solid ${isDark ? "#292524" : "#000000"};">
          <div style="text-align: center; text-transform: uppercase;">
            <div style="font-size: ${finalFontSize * 1.15}px; font-weight: bold; letter-spacing: 1px;">${settings.name || RESTAURANT_BRANDING.name}</div>
            <div style="font-size: ${finalFontSize * 1.4}px; font-weight: 900; margin: 4px 0; border: 1.5px solid ${textCol}; padding: 3px; display: inline-block; letter-spacing: 1px;">${(data as any).isAddOn ? "ADD-ON KOT" : "KITCHEN ORDER TICKET"}</div>
            <div style="font-size: ${finalFontSize * 1.1}px; font-weight: bold; margin-top: 2px;">KOT: ${kotNo}</div>
          </div>

          <div style="border-bottom: 1px dashed ${textCol}; margin: 6px 0;"></div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: ${finalFontSize * 0.95}px;">
            <div><b>Table:</b> <span style="font-size: ${finalFontSize * 1.3}px; font-weight: 900; background: ${isDark ? "#292524" : "#e5e5e5"}; padding: 1px 4px; border-radius: 2px;">${data.tableNumber || "Takeaway"}</span></div>
            <div style="text-align: right;"><b>Order:</b> ${orderNo}</div>
            <div><b>Type:</b> ${(data.orderType || "dine-in").toUpperCase()}</div>
            <div style="text-align: right;"><b>Captain:</b> Admin</div>
            <div><b>Date:</b> ${new Date(data.createdAt || Date.now()).toLocaleDateString()}</div>
            <div style="text-align: right;"><b>Time:</b> ${new Date(data.createdAt || Date.now()).toLocaleTimeString()}</div>
          </div>

          <div style="border-bottom: 1px dashed ${textCol}; margin: 6px 0;"></div>

          <div style="text-align: center; margin: 8px 0; padding: 4px; background: ${isDark ? "#1c1917" : "#fafaf9"}; border: 1px dashed ${textCol};">
            <span style="font-size: ${finalFontSize * 0.85}px; font-weight: bold; display: block; letter-spacing: 1px; color: ${isDark ? "#a8a29e" : "#000000"};">QUEUE TOKEN</span>
            <span style="font-size: ${finalFontSize * 1.8}px; font-weight: 950; letter-spacing: 2px;">${orderNumOnly}</span>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-bottom: 6px;">
            ${isVeg(items[0]?.name || "") ? `<span style="border: 1px solid #22c55e; color: #22c55e; padding: 1px 4px; font-size: ${finalFontSize * 0.8}px; font-weight: bold; border-radius: 2px;">PURE VEG</span>` : `<span style="border: 1px solid #ef4444; color: #ef4444; padding: 1px 4px; font-size: ${finalFontSize * 0.8}px; font-weight: bold; border-radius: 2px;">NON-VEG</span>`}
            ${data.specialInstructions ? `<span style="border: 1px solid #ea580c; color: #ea580c; padding: 1px 4px; font-size: ${finalFontSize * 0.8}px; font-weight: bold; border-radius: 2px;">RUSH ORDER</span>` : ""}
            ${items.some((it: any) => it.isChefSpecial) ? `<span style="border: 1px solid #c026d3; color: #c026d3; padding: 1px 4px; font-size: ${finalFontSize * 0.8}px; font-weight: bold; border-radius: 2px;">CHEF SPECIAL</span>` : ""}
          </div>

          <div style="border-bottom: 1px dashed ${textCol}; margin: 6px 0;"></div>

          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid ${textCol}; font-weight: bold; font-size: ${finalFontSize * 0.95}px;">
                <th style="padding: 3px 0; width: 15%; text-align: center;">QTY</th>
                <th style="padding: 3px 0; width: 85%;">KITCHEN PREP ITEM</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any) => {
                const itemVeg = isVeg(item.name);
                const icon = itemVeg 
                  ? `<span style="border: 1.5px solid #22c55e; display: inline-flex; justify-content: center; align-items: center; width: 10px; height: 10px; font-size: 7px; color: #22c55e; font-weight: bold; margin-right: 4px; vertical-align: middle; line-height: 1;">□</span>`
                  : `<span style="border: 1.5px solid #ef4444; display: inline-flex; justify-content: center; align-items: center; width: 10px; height: 10px; font-size: 7px; color: #ef4444; font-weight: bold; margin-right: 4px; vertical-align: middle; line-height: 1;">▲</span>`;

                const isManual = item.isManual || item.menuItemId === 'manual' || item.name.toUpperCase() === item.name || item.name.toLowerCase().includes("manual");

                return `
                  <tr style="border-bottom: 1px dotted ${isDark ? "#444" : "#000000"}; font-size: ${finalFontSize}px;">
                    <td style="padding: 6px 0; text-align: center; font-size: ${finalFontSize * 1.3}px; font-weight: 900; vertical-align: top;">${item.quantity}</td>
                    <td style="padding: 6px 0; vertical-align: top; font-weight: bold;">
                      ${icon}${item.name}
                      ${isManual ? `<span style="border: 1px solid ${textCol}; padding: 0 2px; font-size: 7px; border-radius: 1px; font-weight: bold; margin-left: 3px; display: inline-block;">(Manual)</span>` : ""}
                      ${item.customization ? `<div style="font-size: ${finalFontSize * 0.85}px; font-weight: bold; font-style: italic; color: ${isDark ? "#a8a29e" : "#000000"}; margin-top: 2px; padding-left: 14px;">+ ${item.customization}</div>` : ""}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>

          <div style="border-bottom: 1px dashed ${textCol}; margin: 6px 0;"></div>

          ${data.specialInstructions && data.specialInstructions !== "None" && data.specialInstructions.trim() !== "" ? `
            <div style="border: 1px solid ${textCol}; padding: 5px; margin: 6px 0; background: ${isDark ? "#1c1917" : "#fafaf9"}; border-radius: 3px;">
              <b style="font-size: ${finalFontSize * 0.85}px; display: block; margin-bottom: 2px;">KITCHEN INSTRUCTIONS:</b>
              <span style="font-size: ${finalFontSize * 0.95}px; font-style: italic; color: #e11d48; font-weight: bold;">"${data.specialInstructions}"</span>
            </div>
          ` : ""}

          <div style="text-align: center; font-size: ${finalFontSize * 0.85}px; margin-top: 8px; color: ${isDark ? "#a8a29e" : "#000000"}; font-weight: bold;">
            <div>KOT Printed At: ${new Date().toLocaleTimeString()}</div>
            <div>KOT Print Count: ${opts.printCount}</div>
            <div style="font-weight: bold; margin-top: 4px; letter-spacing: 1px;">*** KITCHEN COPY ONLY ***</div>
          </div>
        </div>
      `;
    }

    return this.generatePremiumReceiptHTML("bill", data, settings, opts);
  }

  /**
   * Triggers the beautiful, stylized POS thermal receipt print using system dialog.
   */
  public static printPremiumHTML(
    type: "bill" | "kot" | string,
    data: any,
    settings: any,
    options: any = {}
  ): void {
    const is80 = (options.paperWidth || settings?.paperWidth || "80mm") === "80mm";
    
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    // Force light print mode (black on white) for physical receipt paper outputs!
    const receiptHtml = this.generatePremiumReceiptHTML(type, data, settings, {
      ...options,
      darkPrintMode: false
    });

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page {
              size: ${is80 ? "80mm" : "58mm"} auto;
              margin: 0 !important;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              text-align: center;
              box-sizing: border-box;
              font-weight: bold !important;
            }
            .page-break {
              page-break-after: always !important;
              break-after: page !important;
              height: 0 !important;
              margin: 0 !important;
              border: none !important;
              display: block !important;
            }
            @media print {
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-weight: bold !important;
              }
              .page-break {
                page-break-after: always !important;
                break-after: page !important;
                height: 0 !important;
                margin: 0 !important;
                border: none !important;
                display: block !important;
                visibility: hidden !important;
              }
              div {
                border-color: #000000 !important;
              }
            }
          </style>
        </head>
        <body>
          ${receiptHtml}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
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
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
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
   * Public KOT fallback rendering entrypoint
   */
  public static printSystemFallback(data: PrinterData, width: "58mm" | "80mm" = "80mm", cashierName: string = "Cashier"): void {
    this.printPremiumHTML("kot", data, { name: RESTAURANT_BRANDING.name }, { paperWidth: width });
  }

  /**
   * Public Bill fallback rendering entrypoint
   */
  public static printBillSystemFallback(data: any, settings: any, width: "58mm" | "80mm" = "80mm"): void {
    this.printPremiumHTML("bill", data, settings, { paperWidth: width });
  }

  /**
   * Generates a focused thermal receipt for an individual split bill settlement
   */
  public static generateSplitReceiptHTML(
    split: any,
    parentOrder: any,
    settings: any,
    options: any = {}
  ): string {
    const paperWidth = options.paperWidth || settings?.paperWidth || "80mm";
    const is80 = paperWidth === "80mm";
    const paperWidthPixels = is80 ? "290px" : "210px";
    const fontSize = is80 ? "12px" : "10px";
    const titleSize = is80 ? "15px" : "13px";
    const isDark = options.darkPrintMode || false;
    const bg = isDark ? "#121212" : "#ffffff";
    const textCol = isDark ? "#f3f4f6" : "#000000";

    const items = split.items || [];
    const splitTotal = Number(split.allocatedTotal || split.paidAmount || 0).toFixed(2);
    const splitSubtotal = Number(split.allocatedSubtotal || 0).toFixed(2);
    const splitGst = Number(split.allocatedGst || 0).toFixed(2);
    const splitDiscount = Number(split.allocatedDiscount || 0).toFixed(2);

    return `
      <div style="width: ${paperWidthPixels}; background: ${bg}; color: ${textCol}; padding: 8px; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: ${fontSize}; font-weight: bold; line-height: 1.25; margin: 0 auto; border: 1px solid ${isDark ? "#333" : "#000"}; text-align: left;">
        <div style="text-align: center; text-transform: uppercase;">
          <div style="font-size: ${titleSize}; font-weight: 900; letter-spacing: 1px;">${settings?.name || RESTAURANT_BRANDING.name}</div>
          <div style="font-size: ${fontSize}; margin-top: 2px;">${settings?.address || ""}</div>
          <div style="font-size: ${fontSize};">${settings?.contactNumber ? `Tel: ${settings.contactNumber}` : ""}</div>
          <div style="margin: 6px 0; border: 1.5px solid ${textCol}; padding: 2px 6px; display: inline-block; font-size: ${fontSize}; font-weight: 900;">
            *** SPLIT BILL RECEIPT ***
          </div>
        </div>

        <div style="border-bottom: 1px dashed ${textCol}; margin: 6px 0;"></div>

        <div style="font-size: ${fontSize}; line-height: 1.35;">
          <div><b>Invoice #:</b> ${parentOrder.id}</div>
          <div><b>Share:</b> ${split.personName || `Person #${split.splitIndex + 1}`} (${(split.splitType || "items").toUpperCase()})</div>
          <div><b>Table / Type:</b> ${parentOrder.tableNumber ? `Table #${parentOrder.tableNumber}` : (parentOrder.orderType || "Dine-in").toUpperCase()}</div>
          <div><b>Date:</b> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>

        <div style="border-bottom: 1px dashed ${textCol}; margin: 6px 0;"></div>

        ${items.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; font-size: ${fontSize}; margin-bottom: 6px;">
            <thead>
              <tr style="border-bottom: 1px solid ${textCol};">
                <th style="text-align: left; padding: 2px 0;">ITEM</th>
                <th style="text-align: center; padding: 2px 0;">QTY</th>
                <th style="text-align: right; padding: 2px 0;">AMT</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it: any) => `
                <tr>
                  <td style="padding: 2px 0;">${it.name}</td>
                  <td style="text-align: center; padding: 2px 0;">${it.quantity}</td>
                  <td style="text-align: right; padding: 2px 0;">₹${(Number(it.unitPrice || it.price || 0) * it.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div style="padding: 4px 0; font-style: italic; text-align: center;">
            Allocated share of bill (${split.splitType === 'equal' ? 'Equal Split' : 'Custom Amount'})
          </div>
        `}

        <div style="border-top: 1px dashed ${textCol}; padding-top: 4px; font-size: ${fontSize}; line-height: 1.35;">
          ${Number(splitSubtotal) > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Subtotal:</span>
              <span>₹${splitSubtotal}</span>
            </div>
          ` : ""}
          ${Number(splitDiscount) > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Discount Share:</span>
              <span>-₹${splitDiscount}</span>
            </div>
          ` : ""}
          ${Number(splitGst) > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>GST Share:</span>
              <span>₹${splitGst}</span>
            </div>
          ` : ""}
          
          <div style="border-top: 1.5px solid ${textCol}; border-bottom: 1.5px solid ${textCol}; margin: 4px 0; padding: 4px 0; display: flex; justify-content: space-between; font-size: ${titleSize}; font-weight: 900;">
            <span>SHARE TOTAL:</span>
            <span>₹${splitTotal}</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: ${fontSize}; padding-top: 2px;">
            <span>Payment Mode:</span>
            <span><b>${(split.paymentMethod || "CASH").toUpperCase()}</b></span>
          </div>
          ${split.transactionReference ? `
            <div style="display: flex; justify-content: space-between; font-size: ${fontSize};">
              <span>Txn Ref:</span>
              <span>${split.transactionReference}</span>
            </div>
          ` : ""}
          <div style="display: flex; justify-content: space-between; font-size: ${fontSize};">
            <span>Status:</span>
            <span style="color: ${split.paymentStatus === 'Paid' ? '#16a34a' : '#ea580c'}; font-weight: 900;">${(split.paymentStatus || 'PENDING').toUpperCase()}</span>
          </div>
        </div>

        <div style="border-bottom: 1px dashed ${textCol}; margin: 6px 0;"></div>
        
        <div style="text-align: center; font-size: 9px; line-height: 1.3;">
          <div>Total Bill: ₹${Number(parentOrder.grandTotal).toFixed(2)} | Split 1 of ${(parentOrder.splitSettlements || []).length || 1}</div>
          <div style="margin-top: 4px; font-weight: bold;">THANK YOU! VISIT AGAIN.</div>
          <div style="margin-top: 2px; color: ${isDark ? "#9ca3af" : "#666"};">${RESTAURANT_BRANDING.receipt.poweredByNote}</div>
        </div>
      </div>
    `;
  }

  /**
   * Direct printing helper for split receipts
   */
  public static printSplitReceipt(
    split: any,
    parentOrder: any,
    settings: any,
    options: any = {}
  ): void {
    const htmlContent = this.generateSplitReceiptHTML(split, parentOrder, settings, options);
    const paperWidth = options.paperWidth || settings?.paperWidth || "80mm";
    const is80 = paperWidth === "80mm";

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Split Bill - ${split.personName || parentOrder.id}</title>
          <style>
            @page {
              size: ${is80 ? "80mm" : "58mm"} auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 6px;
              display: flex;
              justify-content: center;
              background: #fff;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 400);
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
   * Render Customer Bill HTML based on administrator's BillFormatSettings
   */
  public static renderConfiguredBillHTML(
    data: any,
    settings: any,
    overrideFormat?: BillFormatSettings
  ): string {
    const fmt: BillFormatSettings = {
      ...defaultBillFormatSettings,
      ...(settings?.billFormat || {}),
      ...(overrideFormat || {}),
    };

    const is80 = fmt.paperWidth === "80mm";
    const paperWidthPixels = is80 ? "290px" : "210px";
    const bg = "#ffffff";
    const textCol = "#000000";

    const items = data.items || [];
    const subtotal = data.subtotal || data.subTotal || 0;
    const discountAmount = data.discountAmount || 0;
    const packagingCharge = data.packagingCharge || 0;
    const gst = data.gst || data.tax || 0;
    const grandTotal = data.grandTotal || (subtotal - discountAmount + packagingCharge + gst);
    const finalGrandTotal = Math.round(grandTotal);

    const createdAtDate = new Date(data.createdAt || Date.now());

    return `
      <div style="width: ${paperWidthPixels}; background: ${bg}; color: ${textCol}; padding: ${fmt.topMargin}px 4px ${fmt.bottomMargin}px 4px; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: ${fmt.bodyFontSize}px; line-height: ${fmt.lineSpacing}; text-align: left; margin: 0 auto; -webkit-print-color-adjust: exact;">

        <!-- Header -->
        <div style="text-align: ${fmt.headerAlignment}; margin-bottom: ${fmt.sectionSpacing}px;">
          ${fmt.showRestaurantName ? `
            <div style="font-size: ${fmt.headerFontSize}px; font-weight: ${fmt.boldHeader ? 'bold' : 'normal'}; text-transform: uppercase;">
              ${settings.name || RESTAURANT_BRANDING.name}
            </div>
          ` : ""}
          ${fmt.showAddress && (settings.address || RESTAURANT_BRANDING.contact.address) ? `
            <div style="font-size: ${fmt.bodyFontSize * 0.85}px;">${settings.address || RESTAURANT_BRANDING.contact.address}</div>
          ` : ""}
          ${fmt.showPhone && (settings.contactNumber || RESTAURANT_BRANDING.contact.phone) ? `
            <div style="font-size: ${fmt.bodyFontSize * 0.85}px;">Ph: ${settings.contactNumber || RESTAURANT_BRANDING.contact.phone}</div>
          ` : ""}
          ${fmt.showGstin && settings.gstin ? `
            <div style="font-size: ${fmt.bodyFontSize * 0.85}px;">GSTIN: ${settings.gstin}</div>
          ` : ""}
          ${fmt.showEmail && settings.email ? `
            <div style="font-size: ${fmt.bodyFontSize * 0.85}px;">Email: ${settings.email}</div>
          ` : ""}
          ${fmt.showWebsite && (settings.website || RESTAURANT_BRANDING.contact.website) ? `
            <div style="font-size: ${fmt.bodyFontSize * 0.85}px;">Web: ${settings.website || RESTAURANT_BRANDING.contact.website}</div>
          ` : ""}
        </div>

        <div style="border-bottom: 1px dashed ${textCol}; margin: ${fmt.sectionSpacing}px 0;"></div>

        <!-- Order Information -->
        <div style="font-size: ${fmt.bodyFontSize * 0.9}px; margin-bottom: ${fmt.sectionSpacing}px;">
          ${fmt.showBillNumber ? `<div><b>Bill No:</b> ${data.id || "1042"}</div>` : ""}
          ${fmt.showOrderNumber && data.orderId ? `<div><b>Order No:</b> ${data.orderId}</div>` : ""}
          ${fmt.showDate || fmt.showTime ? `
            <div>
              ${fmt.showDate ? `Date: ${createdAtDate.toLocaleDateString()}` : ""}
              ${fmt.showTime ? ` Time: ${createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ""}
            </div>
          ` : ""}
          ${fmt.showTableNumber ? `<div><b>Table:</b> ${data.tableNumber || "Takeaway"}</div>` : ""}
          ${fmt.showCashierName ? `<div>Cashier: ${settings.cashierName || "Staff"}</div>` : ""}
        </div>

        <!-- Customer Information -->
        ${(fmt.showCustomerName && data.customerName) || (fmt.showCustomerPhone && data.phoneNumber) || (fmt.showCustomerAddress && data.address) ? `
          <div style="font-size: ${fmt.bodyFontSize * 0.85}px; border-bottom: 1px dashed ${textCol}; padding-bottom: 4px; margin-bottom: ${fmt.sectionSpacing}px;">
            ${fmt.showCustomerName && data.customerName ? `<div>Customer: ${data.customerName}</div>` : ""}
            ${fmt.showCustomerPhone && data.phoneNumber ? `<div>Phone: ${data.phoneNumber}</div>` : ""}
            ${fmt.showCustomerAddress && data.address ? `<div>Addr: ${data.address}</div>` : ""}
          </div>
        ` : ""}

        <div style="border-bottom: 1px dashed ${textCol}; margin: ${fmt.sectionSpacing}px 0;"></div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: ${fmt.itemFontSize}px; margin-bottom: ${fmt.sectionSpacing}px; table-layout: fixed;">
          <thead>
            <tr style="border-bottom: 1px solid ${textCol}; text-transform: uppercase;">
              ${fmt.showItemName ? `<th style="text-align: left; padding: 2px 0;">Item</th>` : ""}
              ${fmt.showQuantity ? `<th style="text-align: right; padding: 2px 0; width: 15%;">Qty</th>` : ""}
              ${fmt.showRate ? `<th style="text-align: right; padding: 2px 0; width: 22%;">Rate</th>` : ""}
              ${fmt.showAmount ? `<th style="text-align: right; padding: 2px 0; width: 24%;">Amount</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${items.map((it: any) => {
              const qty = Number(it.quantity) || 1;
              const rate = Number(it.price) || 0;
              const amt = qty * rate;
              return `
                <tr style="border-bottom: 1px dotted #ccc;">
                  ${fmt.showItemName ? `
                    <td style="padding: 3px 0; font-weight: ${fmt.boldItems ? 'bold' : 'normal'}; word-break: break-word;">
                      ${it.name}
                      ${fmt.showItemSku && it.sku ? `<div style="font-size: 8px; color: #555;">SKU: ${it.sku}</div>` : ""}
                      ${fmt.showItemNotes && it.customization ? `<div style="font-size: 9px; font-style: italic;">* ${it.customization}</div>` : ""}
                    </td>
                  ` : ""}
                  ${fmt.showQuantity ? `<td style="text-align: right; padding: 3px 0; font-weight: bold;">${qty}</td>` : ""}
                  ${fmt.showRate ? `<td style="text-align: right; padding: 3px 0;">₹${rate.toFixed(2)}</td>` : ""}
                  ${fmt.showAmount ? `<td style="text-align: right; padding: 3px 0; font-weight: bold;">₹${amt.toFixed(2)}</td>` : ""}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <div style="border-bottom: 1px dashed ${textCol}; margin: ${fmt.sectionSpacing}px 0;"></div>

        <!-- Totals -->
        <div style="font-size: ${fmt.itemFontSize}px;">
          ${fmt.showSubtotal ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>Subtotal:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
          ` : ""}
          ${fmt.showDiscount && discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>Discount:</span>
              <span>-₹${discountAmount.toFixed(2)}</span>
            </div>
          ` : ""}
          ${fmt.showTax && gst > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1px 0;">
              <span>Tax (GST):</span>
              <span>₹${gst.toFixed(2)}</span>
            </div>
          ` : ""}
          ${fmt.showGrandTotal ? `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 1.5px solid ${textCol}; border-bottom: 1.5px solid ${textCol}; font-size: ${fmt.totalFontSize}px; font-weight: ${fmt.boldTotal ? 'bold' : 'normal'}; margin-top: 4px;">
              <span>GRAND TOTAL:</span>
              <span>₹${finalGrandTotal.toFixed(2)}</span>
            </div>
          ` : ""}
        </div>

        <!-- Payment -->
        ${fmt.showPaymentMethod ? `
          <div style="font-size: ${fmt.bodyFontSize * 0.85}px; margin-top: ${fmt.sectionSpacing}px; border-top: 1px dotted ${textCol}; padding-top: 2px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Payment Mode:</span>
              <b>${(data.paymentMethod || data.paymentMode || "CASH").toUpperCase()}</b>
            </div>
          </div>
        ` : ""}

        <!-- Footer -->
        <div style="text-align: ${fmt.footerAlignment}; margin-top: ${fmt.sectionSpacing * 1.5}px; font-size: ${fmt.footerFontSize}px;">
          ${fmt.showThankYou ? `<div style="font-weight: bold; margin-bottom: 2px;">Thank You! Visit Again.</div>` : ""}
          ${fmt.showCustomFooter && settings.customFooter ? `<div>${settings.customFooter}</div>` : ""}
          ${fmt.showPoweredBy ? `<div style="font-size: 8px; color: #555; margin-top: 4px;">Powered by WebRajya POS</div>` : ""}
        </div>

      </div>
    `;
  }

  /**
   * Render KOT HTML based on administrator's KOTFormatSettings
   */
  public static renderConfiguredKOTHTML(
    kot: any,
    settings: any,
    overrideFormat?: KOTFormatSettings
  ): string {
    const fmt: KOTFormatSettings = {
      ...defaultKOTFormatSettings,
      ...(settings?.kotFormat || {}),
      ...(overrideFormat || {}),
    };

    const is80 = fmt.paperWidth === "80mm";
    const paperWidthPixels = is80 ? "290px" : "210px";
    const bg = "#ffffff";
    const textCol = "#000000";

    const items = kot.items || [];
    const createdAtDate = new Date(kot.createdAt || Date.now());

    return `
      <div style="width: ${paperWidthPixels}; background: ${bg}; color: ${textCol}; padding: ${fmt.topMargin}px 4px ${fmt.bottomMargin}px 4px; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: ${fmt.itemFontSize}px; line-height: ${fmt.lineSpacing}; text-align: left; margin: 0 auto; -webkit-print-color-adjust: exact;">

        <!-- KOT Header -->
        <div style="text-align: center; margin-bottom: ${fmt.sectionSpacing}px;">
          ${fmt.showRestaurantName ? `
            <div style="font-size: ${fmt.headerFontSize}px; font-weight: ${fmt.boldRestaurantName ? 'bold' : 'normal'}; text-transform: uppercase;">
              ${settings.name || RESTAURANT_BRANDING.name}
            </div>
          ` : ""}
          <div style="font-size: ${fmt.headerFontSize * 0.9}px; font-weight: bold; text-transform: uppercase; margin-top: 2px;">
            KITCHEN ORDER TICKET (KOT)
          </div>
          ${fmt.showKotNumber ? `
            <div style="font-size: ${fmt.headerFontSize * 1.1}px; font-weight: ${fmt.boldKotNumber ? 'bold' : 'normal'}; border: 1.5px solid ${textCol}; display: inline-block; padding: 2px 10px; margin-top: 4px;">
              KOT: ${kot.id || "001"}
            </div>
          ` : ""}
        </div>

        <div style="border-bottom: 1px dashed ${textCol}; margin: ${fmt.sectionSpacing}px 0;"></div>

        <!-- Metadata -->
        <div style="font-size: ${fmt.itemFontSize * 0.9}px; margin-bottom: ${fmt.sectionSpacing}px;">
          ${fmt.showTableNumber ? `
            <div style="font-size: ${fmt.itemFontSize * 1.1}px; font-weight: ${fmt.boldTableNumber ? 'bold' : 'normal'};">
              TABLE: ${kot.tableNumber || "Takeaway"}
            </div>
          ` : ""}
          ${fmt.showOrderNumber && kot.orderId ? `<div>Order #: ${kot.orderId}</div>` : ""}
          ${fmt.showDate || fmt.showTime ? `
            <div>
              ${fmt.showDate ? `DATE: ${createdAtDate.toLocaleDateString()}` : ""}
              ${fmt.showTime ? ` TIME: ${createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ""}
            </div>
          ` : ""}
          ${fmt.showCashier ? `<div>CASHIER: ${kot.cashierName || "Staff"}</div>` : ""}
        </div>

        <div style="border-bottom: 1px dashed ${textCol}; margin: ${fmt.sectionSpacing}px 0;"></div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: ${fmt.itemFontSize}px; margin-bottom: ${fmt.sectionSpacing}px; table-layout: fixed;">
          <thead>
            <tr style="border-bottom: 1px solid ${textCol}; text-transform: uppercase;">
              ${fmt.showItemName ? `<th style="text-align: left; padding: 2px 0;">ITEM</th>` : ""}
              ${fmt.showQuantity ? `<th style="text-align: right; padding: 2px 0; width: 25%;">QTY</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${items.map((it: any) => {
              const qty = Number(it.quantity) || 1;
              return `
                <tr style="border-bottom: 1px dotted #ccc;">
                  ${fmt.showItemName ? `
                    <td style="padding: 4px 0; font-weight: ${fmt.boldItemName ? 'bold' : 'normal'}; word-break: break-word;">
                      ${it.name}
                      ${fmt.showItemCode && it.code ? `<div style="font-size: 9px; color: #555;">[${it.code}]</div>` : ""}
                      ${fmt.showItemNotes && it.customization ? `<div style="font-size: 10px; font-style: italic; font-weight: bold; color: #d97706;">NOTE: ${it.customization}</div>` : ""}
                    </td>
                  ` : ""}
                  ${fmt.showQuantity ? `<td style="text-align: right; padding: 4px 0; font-weight: bold; font-size: ${fmt.itemFontSize * 1.15}px;">${qty}</td>` : ""}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- Order Notes -->
        ${fmt.showOrderNotes && kot.specialInstructions && kot.specialInstructions !== "None" ? `
          <div style="border: 1px solid ${textCol}; padding: 6px; margin-top: ${fmt.sectionSpacing}px; font-size: ${fmt.noteFontSize}px;">
            <div style="font-weight: bold; text-transform: uppercase;">SPECIAL INSTRUCTIONS:</div>
            <div>${kot.specialInstructions}</div>
          </div>
        ` : ""}

        <div style="border-bottom: 1px dashed ${textCol}; margin: ${fmt.sectionSpacing * 1.5}px 0 ${fmt.sectionSpacing}px 0;"></div>
        <div style="text-align: center; font-size: ${fmt.footerFontSize}px; font-weight: bold;">
          Kitchen Copy Only
        </div>

      </div>
    `;
  }

  /**
   * Print KOT via Electron Silent Print or fallback
   */
  public static async printKOT(
    kot: PrinterData,
    width: "58mm" | "80mm" = "80mm",
    mode: "silent" | "usb" | "serial" | "fallback" = "silent",
    cashierName: string = "Cashier",
    settings: any = {}
  ): Promise<boolean> {
    const targetPrinter = settings?.kotPrinter || settings?.selectedPrinterName || "";
    const copies = Number(settings?.kotCopies) || 1;
    const paperWidth = settings?.kotFormat?.paperWidth || width || settings?.paperWidth || "80mm";

    const htmlContent = this.renderConfiguredKOTHTML(kot, settings);

    if (window.electronAPI?.silentPrint) {
      console.log(`[Electron Silent KOT Print] Printer: "${targetPrinter || 'Default'}", Copies: ${copies}, Paper: ${paperWidth}`);
      const res = await window.electronAPI.silentPrint({
        htmlContent,
        deviceName: targetPrinter,
        copies,
        paperWidth
      });
      return res.success;
    }

    console.log("[Browser Silent KOT Simulation] Executed silent KOT print.");
    return true;
  }

  /**
   * Print Bill via Electron Silent Print or fallback
   */
  public static async printBill(
    order: any,
    settings: any,
    width: "58mm" | "80mm" = "80mm",
    mode: "silent" | "usb" | "serial" | "fallback" = "silent"
  ): Promise<{ success: boolean; modeUsed: string; error?: string }> {
    const targetPrinter = settings?.billPrinter || settings?.selectedPrinterName || "";
    const copies = Number(settings?.billCopies) || 1;
    const paperWidth = settings?.billFormat?.paperWidth || width || settings?.paperWidth || "80mm";

    const htmlContent = this.renderConfiguredBillHTML(order, settings);

    if (window.electronAPI?.silentPrint) {
      console.log(`[Electron Silent Bill Print] Printer: "${targetPrinter || 'Default'}", Copies: ${copies}, Paper: ${paperWidth}`);
      const res = await window.electronAPI.silentPrint({
        htmlContent,
        deviceName: targetPrinter,
        copies,
        paperWidth
      });

      if (res.success) {
        return { success: true, modeUsed: "electron_silent" };
      }
      return { success: false, modeUsed: "electron_silent", error: res.error || "Electron silent print failed" };
    }

    console.log("[Browser Silent Bill Simulation] Executed silent Bill print.");
    return { success: true, modeUsed: "browser_simulated" };
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
    };
    return defaults;
  }
}

export function saveWRPrinterSettings(settings: WRPrinterSettings) {
  localStorage.setItem("wr_printer_settings", JSON.stringify(settings));
}

export function buildBillESCPOS(data: any, settings: any, printerSettings: WRPrinterSettings): string {
  const builder = new ESCPOSBuilder();
  const width = printerSettings.paperWidth || "80mm";
  
  builder.alignCenter().bold(true);
  const estd = settings.estd || RESTAURANT_BRANDING.estd;
  if (estd) {
    builder.writeText(estd + "\n");
  }
  builder.doubleSize(true);
  builder.writeText((settings.name || RESTAURANT_BRANDING.name).toUpperCase() + "\n");
  builder.doubleSize(false);
  const legalName = settings.legalName || RESTAURANT_BRANDING.legalName;
  if (legalName) {
    builder.writeText(legalName.toUpperCase() + "\n");
  }
  builder.bold(false);
  const address = settings.address || RESTAURANT_BRANDING.contact.address;
  if (address) {
    builder.writeText(address + "\n");
  }
  const contact = settings.contactNumber || RESTAURANT_BRANDING.contact.phone;
  if (contact) {
    builder.writeText(`Phone: ${contact}\n`);
  }
  if (settings.fssaiNumber) {
    builder.writeText(`FSSAI No: ${settings.fssaiNumber}\n`);
  }
  if (settings.gstin) {
    builder.writeText(`GSTIN: ${settings.gstin}\n`);
  }
  
  builder.divider(width, true);
  
  builder.alignLeft();
  builder.bold(true).doubleHeight(true);
  builder.writeText(`MEMO NO: ${data.id}\n`);
  builder.bold(false).doubleHeight(false);
  builder.writeText(`DATE: ${new Date(data.createdAt || Date.now()).toLocaleDateString()}  TIME: ${new Date(data.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`);
  if (data.customerName) {
    builder.writeText(`CUSTOMER: ${data.customerName}\n`);
  }
  builder.bold(true);
  builder.writeText(`TYPE: ${(data.orderType || "dine-in").toUpperCase()} ${data.tableNumber ? `(TABLE #${data.tableNumber})` : ""}\n`);
  builder.bold(false);
  
  builder.divider(width, true);
  
  // Columns header if 80mm
  builder.alignLeft();
  if (width === "80mm") {
    builder.bold(true);
    builder.writeText("SR  PRODUCT             QTY     RATE    AMOUNT\n");
    builder.bold(false);
    builder.divider(width, false);
  }
  
  const items = data.items || [];
  let totalQty = 0;
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const originalPrice = item.price || 0;
    const qty = Number(item.quantity) || 1;
    totalQty += qty;
    const itemTotal = originalPrice * qty;
    const isFree = originalPrice === 0;
    
    builder.itemRow(
      `${idx + 1}. ${item.name}`,
      qty.toFixed(3),
      isFree ? "0.00" : originalPrice.toFixed(2),
      isFree ? "FREE" : itemTotal.toFixed(2),
      width
    );
    if (item.customization) {
      builder.alignLeft().writeText(`  + ${item.customization}\n`);
    }
  }
  
  builder.divider(width, false);
  
  // Financial totals
  builder.alignLeft();
  const subtotal = data.subtotal || 0;
  const discountAmount = data.discountAmount || 0;
  const packagingCharge = data.packagingCharge || 0;
  const gst = data.gst || 0;
  const deliveryCharge = data.orderType === "delivery" ? (settings.deliveryCharges || 0) : 0;
  const grandTotal = data.grandTotal || (subtotal - discountAmount + packagingCharge + gst + deliveryCharge);
  const finalGrandTotal = Math.round(grandTotal);
  const roundOff = (finalGrandTotal - grandTotal).toFixed(2);
  
  builder.totalRow("Sub Total:", `Rs. ${subtotal.toFixed(2)}`, width);
  builder.totalRow("Total Qty:", totalQty.toFixed(3), width);
  if (discountAmount > 0) {
    builder.totalRow(`Discount (${data.appliedCoupon || "PROMO"}):`, `-Rs. ${discountAmount.toFixed(2)}`, width);
  }
  if (packagingCharge > 0) {
    builder.totalRow("Packing Charge:", `Rs. ${packagingCharge.toFixed(2)}`, width);
  }
  if (deliveryCharge > 0) {
    builder.totalRow("Delivery Charge:", `Rs. ${deliveryCharge.toFixed(2)}`, width);
  }
  if (gst > 0) {
    builder.totalRow("CGST (2.5%):", `Rs. ${(gst / 2).toFixed(2)}`, width);
    builder.totalRow("SGST (2.5%):", `Rs. ${(gst / 2).toFixed(2)}`, width);
  }
  if (Number(roundOff) !== 0) {
    builder.totalRow("Round Off:", `Rs. ${roundOff}`, width);
  }
  
  builder.divider(width, false);
  builder.bold(true).doubleHeight(true);
  builder.totalRow("GRAND TOTAL:", `Rs. ${finalGrandTotal}.00`, width);
  builder.bold(false).doubleHeight(false);
  
  builder.divider(width, true);
  
  builder.alignCenter().bold(true);
  builder.writeText(`Thank You! Visit ${settings.name || RESTAURANT_BRANDING.name} Again.\n`);
  builder.bold(false);
  builder.writeText("Powered by Webrajya\n");
  
  // Feed before cut
  const feedLines = printerSettings.feedBeforeCutBill ?? 5;
  builder.feed(feedLines);
  
  // Auto paper cut
  if (printerSettings.autoCut) {
    if (printerSettings.cutType === "partial") {
      builder.cutPartial();
    } else {
      builder.cutFull();
    }
  }
  
  return builder.compileHex();
}

export function buildKOTESCPOS(data: any, printerSettings: WRPrinterSettings): string {
  const builder = new ESCPOSBuilder();
  const width = printerSettings.paperWidth || "80mm";
  
  builder.alignCenter().bold(true).doubleSize(true);
  builder.writeText((data?.restaurantName || RESTAURANT_BRANDING.name).toUpperCase() + "\n");
  
  builder.doubleSize(false).doubleHeight(true);
  const isAddOn = data.isAddOn || data.type === "Add-On KOT";
  builder.writeText(isAddOn ? "ADD-ON KOT\n" : "KITCHEN ORDER TICKET\n");
  
  builder.bold(false).doubleHeight(false);
  builder.writeText(`KOT NO: ${data.id || "KOT-NEW"}\n`);
  builder.divider(width, true);
  
  builder.alignLeft();
  builder.writeText(`Table: ${data.tableNumber || "Takeaway"}\n`);
  builder.writeText(`Order: ${data.orderId || "XK-NEW"}\n`);
  builder.writeText(`Type: ${(data.orderType || "dine-in").toUpperCase()}\n`);
  builder.writeText(`Date: ${new Date(data.createdAt || Date.now()).toLocaleDateString()}  Time: ${new Date(data.createdAt || Date.now()).toLocaleTimeString()}\n`);
  builder.divider(width, true);
  
  // Large centered Token number!
  const orderNoNum = (data.orderId || "XK-NEW").replace(/^(SR|XK)-/, "#");
  builder.alignCenter().writeText("QUEUE TOKEN\n");
  builder.bold(true).doubleSize(true);
  builder.writeText(orderNoNum + "\n");
  builder.bold(false).doubleSize(false);
  
  builder.divider(width, false);
  
  // Items rows
  builder.alignLeft().bold(true);
  if (width === "80mm") {
    builder.writeText("QTY  KITCHEN PREP ITEM\n");
    builder.divider(width, false);
  }
  
  const items = data.items || [];
  for (const item of items) {
    builder.alignLeft();
    builder.writeText(`${item.quantity.toString().padEnd(4)} ${item.name}\n`);
    if (item.customization) {
      builder.writeText(`     + ${item.customization}\n`);
    }
  }
  builder.divider(width, false);
  
  if (data.specialInstructions && data.specialInstructions !== "None" && data.specialInstructions.trim() !== "") {
    builder.bold(true);
    builder.writeText("KITCHEN INSTRUCTIONS:\n");
    builder.writeText(`"${data.specialInstructions}"\n`);
    builder.bold(false);
    builder.divider(width, false);
  }
  
  builder.alignCenter().bold(true);
  builder.writeText("*** KITCHEN COPY ONLY ***\n");
  builder.bold(false);
  
  // Feed before cut
  const feedLines = printerSettings.feedBeforeCutKOT ?? 3;
  builder.feed(feedLines);
  
  // Auto paper cut
  if (printerSettings.autoCut) {
    if (printerSettings.cutType === "partial") {
      builder.cutPartial();
    } else {
      builder.cutFull();
    }
  }
  
  return builder.compileHex();
}



export function buildZReportESCPOS(
  shift: Shift,
  financials: ShiftFinancials,
  settings: any,
  printerSettings: WRPrinterSettings,
  reportType: "Z-REPORT" | "X-REPORT" = "Z-REPORT"
): string {
  const builder = new ESCPOSBuilder();
  const width = printerSettings.paperWidth || "80mm";
  const restName = settings?.name || "WEBRAJYA POS RESTAURANT";
  const restAddress = settings?.address || "MG Road, Bengaluru";
  const gstNumber = settings?.gstNumber || "29AAAAA0000A1Z5";

  builder.alignCenter().bold(true).doubleSize(true);
  builder.writeText(`${restName.toUpperCase()}\n`);
  builder.doubleSize(false).bold(false);
  builder.writeText(`${restAddress}\n`);
  builder.writeText(`GSTIN: ${gstNumber}\n`);
  builder.divider(width, true);

  // Header Title
  builder.bold(true).doubleHeight(true);
  builder.writeText(reportType === "Z-REPORT" ? "*** SHIFT Z-REPORT (FINAL RECONCILIATION) ***\n" : "*** SHIFT X-REPORT (MID-SHIFT AUDIT) ***\n");
  builder.bold(false).doubleHeight(false);
  builder.divider(width, false);

  builder.alignLeft();
  builder.writeText(`Shift ID    : ${shift.id}\n`);
  builder.writeText(`Cashier     : ${shift.cashierName || "Cashier"}\n`);
  builder.writeText(`Opened By   : ${shift.openedBy} (${new Date(shift.openedAt).toLocaleTimeString()})\n`);
  if (shift.closedAt) {
    builder.writeText(`Closed By   : ${shift.closedBy || "Admin"} (${new Date(shift.closedAt).toLocaleTimeString()})\n`);
  }
  builder.writeText(`Business Day: ${shift.businessDate}\n`);
  builder.writeText(`Print Time  : ${new Date().toLocaleString()}\n`);
  builder.divider(width, true);

  // Section 1: Drawer Financial Summary
  builder.bold(true);
  builder.writeText("CASH DRAWER RECONCILIATION:\n");
  builder.bold(false);
  builder.totalRow("Opening Cash Float", `Rs. ${financials.openingCash.toFixed(2)}`, width);
  builder.totalRow("(+) Cash Sales", `Rs. ${financials.cashSales.toFixed(2)}`, width);
  builder.totalRow("(+) Cash In / Additions", `Rs. ${financials.cashIn.toFixed(2)}`, width);
  builder.totalRow("(-) Cash Out / Drops", `Rs. ${financials.cashOut.toFixed(2)}`, width);
  builder.divider(width, false);

  builder.bold(true);
  builder.totalRow("EXPECTED CASH IN DRAWER", `Rs. ${financials.expectedCash.toFixed(2)}`, width);
  if (financials.actualCash !== undefined) {
    builder.totalRow("ACTUAL CASH COUNTED", `Rs. ${financials.actualCash.toFixed(2)}`, width);
    const diff = financials.difference || 0;
    const diffLabel = financials.differenceType === "Exact" ? "Rs. 0.00 (EXACT)" : diff < 0 ? `-Rs. ${Math.abs(diff).toFixed(2)} (SHORT)` : `+Rs. ${diff.toFixed(2)} (EXCESS)`;
    builder.totalRow("DISCREPANCY / VARIANCE", diffLabel, width);
    if (shift.differenceReason) {
      builder.writeText(`Discrepancy Note: "${shift.differenceReason}"\n`);
    }
  }
  builder.bold(false);
  builder.divider(width, true);

  // Section 2: Tender Breakdown
  builder.bold(true);
  builder.writeText("SALES BY TENDER / PAYMENT METHOD:\n");
  builder.bold(false);
  builder.totalRow("Cash Sales", `Rs. ${financials.cashSales.toFixed(2)}`, width);
  builder.totalRow("UPI / QR Payments", `Rs. ${financials.upiSales.toFixed(2)}`, width);
  builder.totalRow("Card / POS Payments", `Rs. ${financials.cardSales.toFixed(2)}`, width);
  if (financials.otherSales > 0) {
    builder.totalRow("Other Tender Sales", `Rs. ${financials.otherSales.toFixed(2)}`, width);
  }
  builder.divider(width, false);
  builder.bold(true);
  builder.totalRow("TOTAL REVENUE COLLECTED", `Rs. ${financials.totalSales.toFixed(2)}`, width);
  builder.bold(false);
  builder.divider(width, true);

  // Section 3: Operational Metrics & Exceptions
  builder.bold(true);
  builder.writeText("OPERATIONAL & AUDIT METRICS:\n");
  builder.bold(false);
  builder.totalRow("Total Settled Orders", `${financials.orderCount}`, width);
  builder.totalRow("Total Payment Records", `${financials.paymentCount}`, width);
  builder.totalRow("Voided Payments Total", `Rs. ${financials.voidedTotal.toFixed(2)}`, width);
  builder.totalRow("Refunds Total", `Rs. ${financials.refundedTotal.toFixed(2)}`, width);
  builder.divider(width, false);

  // Section 4: Cash Drawer Adjustments Log
  if (financials.adjustments && financials.adjustments.length > 0) {
    builder.bold(true);
    builder.writeText("CASH ADJUSTMENTS AUDIT LOG:\n");
    builder.bold(false);
    financials.adjustments.forEach((adj, idx) => {
      const timeStr = new Date(adj.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      builder.totalRow(`${idx + 1}. [${adj.type}] ${timeStr}`, `Rs. ${adj.amount.toFixed(2)}`, width);
      builder.writeText(`   Reason: ${adj.reason} (Auth: ${adj.authorizedBy})\n`);
    });
    builder.divider(width, false);
  }

  // Signatures
  builder.alignLeft();
  builder.writeText("\n\n");
  builder.writeText("Cashier Signature: ___________________\n\n");
  builder.writeText("Manager Signature: ___________________\n");
  builder.divider(width, true);

  builder.alignCenter().bold(true);
  builder.writeText(reportType === "Z-REPORT" ? "*** SHIFT OFFICIALLY RECONCILED ***\n" : "*** MID-SHIFT AUDIT ONLY ***\n");
  builder.bold(false);
  builder.writeText("Generated by WebRajya POS Financial Engine\n");

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
