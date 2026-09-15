import qz from "qz-tray";
import { ESCPOSBuilder } from "./escposBuilder";
import { BRAND_CONFIG } from "../config/brand";

export interface QZTrayStatus {
  connected: boolean;
  isConnecting: boolean;
  statusText: string;
  selectedPrinter?: string;
  detectedPrinters: string[];
  lastError: string | null;
}

export type QZTrayConnectionStatus = QZTrayStatus;

export class QZTrayOfflineError extends Error {
  constructor(
    message = "QZ Tray is not connected. Please ensure the QZ Tray application is running on your Windows computer (green icon in system tray), then click Connect QZ Tray."
  ) {
    super(message);
    this.name = "QZTrayOfflineError";
  }
}

/**
 * Centralized, singleton QZ Tray service for high-reliability thermal printing.
 * Controls WebSocket connection, printer discovery, test prints, KOT and Customer Bill raw ESC/POS printing.
 * Prevents multiple simultaneous connection attempts and guarantees zero browser-print dialogs.
 */
export class QZTrayService {
  private static connectionPromise: Promise<boolean> | null = null;
  private static _isConnecting = false;
  private static _isTrulyConnected = false;
  private static detectedPrinters: string[] = [];
  private static selectedPrinter: string = "";
  private static lastError: string | null = null;
  private static securityInitialized = false;
  private static listeners: Set<(status: QZTrayStatus) => void> = new Set();
  private static boundConnectionEvents = false;

  public static isConnecting(): boolean {
    return this._isConnecting;
  }

  /**
   * Translates technical and QZ-level errors into clean, informative application errors.
   * Prevents raw cryptic errors like "Failed to sign request" from confusing the user,
   * while logging full diagnostic context to the console in development.
   */
  public static formatErrorMessage(err: any, printerName?: string): string {
    const raw = err?.message || String(err || "");

    if (raw.includes("Failed to sign request") || raw.includes("QZ signing request failed") || raw.includes("signature")) {
      return "QZ signing request failed: The print request could not be cryptographically signed by the server. Please verify the QZ security signature service.";
    }

    if (raw.includes("certificate") || raw.includes("Certificate")) {
      return "QZ certificate unavailable: Secure digital certificate could not be validated.";
    }

    if (
      raw.includes("sendData is not a function") ||
      raw.includes("has not been established yet") ||
      raw.includes("offline")
    ) {
      return "QZ Tray connection failed: Please ensure QZ Tray is running on your Windows computer (check system tray icon).";
    }

    if (
      raw.includes("Unable to establish connection") ||
      raw.includes("Connection refused") ||
      raw.includes("Connection closed")
    ) {
      return "QZ Tray connection failed: QZ Tray desktop app is not responding.";
    }

    if (raw.includes("No printer") || (printerName && raw.includes(printerName) && raw.includes("not found"))) {
      return `Printer not found: "${printerName || "Selected printer"}" is not available in QZ Tray. Check USB connection and power.`;
    }

    return raw || "Print dispatch failed. Check printer connection and paper.";
  }

  /**
   * Initializes QZ security handlers (Certificate and Signature promises).
   * Must be executed BEFORE qz.websocket.connect(), qz.printers.find(), or qz.print().
   */
  public static ensureSecurityConfigured(): void {
    if (this.securityInitialized) return;
    this.securityInitialized = true;

    try {
      this.bindConnectionEvents();

      // 1. Digital Certificate Promise (X.509 PEM certificate)
      qz.security.setCertificatePromise((resolve, reject) => {
        fetch("/api/qz/cert", {
          method: "GET",
          headers: { Accept: "text/plain, */*" },
        })
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.text().catch(() => "");
              console.warn(`[QZTray] Certificate endpoint returned HTTP ${res.status}:`, body);
              console.log("QZ certificate loaded: false");
              reject(new Error(`QZ certificate unavailable (HTTP ${res.status})`));
              return;
            }
            return res.text();
          })
          .then((text) => {
            if (
              text &&
              typeof text === "string" &&
              text.includes("BEGIN CERTIFICATE") &&
              !text.includes("<html") &&
              !text.includes("<!DOCTYPE")
            ) {
              console.log("QZ certificate loaded: true");
              resolve(text.trim());
            } else {
              console.warn("[QZTray] Received malformed or HTML certificate from /api/qz/cert");
              console.log("QZ certificate loaded: false");
              reject(new Error("QZ certificate unavailable: invalid PEM certificate"));
            }
          })
          .catch((err) => {
            console.warn("[QZTray] Certificate fetch error:", err?.message || err);
            console.log("QZ certificate loaded: false");
            reject(new Error(`QZ certificate unavailable: ${err?.message || err}`));
          });
      });

      // 2. Signature Algorithm & Promise (RSA-SHA512)
      qz.security.setSignatureAlgorithm("SHA512");
      qz.security.setSignaturePromise((toSign) => {
        return (resolve, reject) => {
          fetch("/api/qz/sign", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, text/plain, */*",
            },
            body: JSON.stringify({ request: toSign, algorithm: "SHA512" }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const errBody = await res.text().catch(() => "");
                console.error(`[QZ Security] Sign endpoint HTTP ${res.status}:`, errBody);
                reject(
                  new Error(`QZ signing request failed (HTTP ${res.status}): ${errBody || res.statusText}`)
                );
                return;
              }

              const contentType = res.headers.get("content-type") || "";
              if (contentType.includes("application/json")) {
                const data = await res.json();
                if (data && typeof data.signature === "string" && data.signature.length > 0) {
                  resolve(data.signature);
                } else {
                  console.error("[QZ Security] Invalid signature payload from /api/qz/sign:", data);
                  reject(new Error("QZ signature service returned invalid format"));
                }
              } else {
                const rawText = await res.text();
                const trimmed = rawText ? rawText.trim() : "";
                if (trimmed.length > 0 && !trimmed.includes("<html") && !trimmed.includes("<!DOCTYPE")) {
                  resolve(trimmed);
                } else {
                  console.error("[QZ Security] Empty or HTML signature received from /api/qz/sign:", trimmed);
                  reject(new Error("QZ signature service unavailable"));
                }
              }
            })
            .catch((networkErr) => {
              console.error("[QZ Security] Network error contacting /api/qz/sign:", networkErr);
              reject(new Error(`QZ signature service unavailable: ${networkErr?.message || networkErr}`));
            });
        };
      });

      console.log("[QZTray] Security initialized successfully with RSA-SHA512 signing");
    } catch (err: any) {
      console.warn("[QZTray] Security initialization notice:", err?.message || err);
    }
  }

  /**
   * Backward compatibility alias for ensureSecurityConfigured
   */
  private static initSecurity() {
    this.ensureSecurityConfigured();
  }

  /**
   * Subscribes a callback to connection and printer status changes.
   */
  public static subscribe(callback: (status: QZTrayStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Broadcasts the current status to all subscribers and dispatch a window event.
   */
  private static notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error("[QZTray] Error in subscriber callback:", err);
      }
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qz_connection_changed", { detail: status }));
    }
  }

  /**
   * Returns whether QZ Tray WebSocket is genuinely active and ready to transmit data.
   * Prevents invoking methods while connecting or when sendData is not yet bound.
   */
  public static isConnected(): boolean {
    if (this._isConnecting) return false;
    if (!this._isTrulyConnected) return false;
    try {
      return Boolean(qz && qz.websocket && qz.websocket.isActive());
    } catch {
      return false;
    }
  }

  /**
   * Returns current snapshot of QZ Tray connection status.
   */
  public static getStatus(): QZTrayStatus {
    const active = this.isConnected();
    let statusText = "QZ Tray Not Connected";

    if (this._isConnecting) {
      statusText = "Connecting to QZ Tray...";
    } else if (active) {
      statusText = "QZ Tray Connected";
    }

    const currentPrinter = this.selectedPrinter || this.resolveSavedPrinterName();

    return {
      connected: active,
      isConnecting: this._isConnecting,
      statusText,
      selectedPrinter: currentPrinter,
      detectedPrinters: this.detectedPrinters,
      lastError: this.lastError,
    };
  }

  private static resolveSavedPrinterName(): string {
    if (typeof localStorage === "undefined") return "EPSON TM-T82X";
    try {
      const explicit = localStorage.getItem("qz_selected_printer");
      if (explicit) return explicit;
      const settingsStr = localStorage.getItem("wr_printer_settings");
      if (settingsStr) {
        const parsed = JSON.parse(settingsStr);
        if (parsed.printerName) return parsed.printerName;
      }
    } catch (_) {}
    return "EPSON TM-T82X";
  }

  /**
   * Connects to QZ Tray desktop service via WebSocket.
   * Deduplicates concurrent connection attempts via a singleton promise.
   * Auto-detects HTTPS and negotiates secure WSS to localhost/localhost.qz.io across standard ports.
   */
  public static async connect(force = false): Promise<boolean> {
    this.initSecurity();

    // If already connected and confirmed active
    if (!force && this.isConnected()) {
      this._isConnecting = false;
      this.lastError = null;
      this.notifyListeners();
      if (this.detectedPrinters.length === 0) {
        await this.getPrinters();
      }
      return true;
    }

    // Return active connection promise if one is already in-flight
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this._isConnecting = true;
    this._isTrulyConnected = false;
    this.lastError = null;
    this.notifyListeners();

    this.connectionPromise = (async () => {
      try {
        const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

        this.bindConnectionEvents();
        console.log(`[QZTray] Establishing WebSocket connection (isHttps=${isHttps})...`);

        // Connect using default port configuration (8181/8282/8383/8484 secure, 8182/8283/8384/8485 insecure)
        // retries: 0 to fail fast without hanging the browser when QZ Tray is not running
        await qz.websocket.connect({
          host: ["localhost", "localhost.qz.io"],
          usingSecure: isHttps,
          keepAlive: 60,
          retries: 0,
          delay: 0,
        });

        this._isTrulyConnected = true;
        this._isConnecting = false;
        this.lastError = null;

        console.log("[QZTray] Successfully connected to QZ Tray!");

        // Safely query system printers
        try {
          const list = await qz.printers.find();
          this.detectedPrinters = Array.isArray(list) ? list : [];
          this.resolveBestPrinter();
        } catch (pErr: any) {
          console.warn("[QZTray] Initial printer query note:", pErr?.message || pErr);
        }

        this.notifyListeners();
        return true;
      } catch (err: any) {
        const errMsg = err?.message || String(err);

        // If an open connection already exists according to QZ Tray, mark as connected
        if (errMsg.includes("already exists")) {
          this._isTrulyConnected = true;
          this._isConnecting = false;
          this.lastError = null;
          try {
            const list = await qz.printers.find();
            this.detectedPrinters = Array.isArray(list) ? list : [];
            this.resolveBestPrinter();
          } catch (_) {}
          this.notifyListeners();
          return true;
        }

        console.warn("[QZTray] Connection failed:", errMsg);
        this._isTrulyConnected = false;
        this._isConnecting = false;
        this.detectedPrinters = [];

        let friendlyErr = "QZ Tray is not running or not reachable.";
        if (
          errMsg.includes("Unable to establish connection") ||
          errMsg.includes("Connection refused") ||
          errMsg.includes("has not been established yet")
        ) {
          friendlyErr =
            "Unable to connect to QZ Tray. Ensure QZ Tray is running on your Windows computer (check system tray icon) and try again.";
        } else {
          friendlyErr = errMsg;
        }

        this.lastError = friendlyErr;
        this.notifyListeners();
        return false;
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Safely registers disconnect & error callbacks on QZ Tray's websocket module.
   */
  private static bindConnectionEvents() {
    if (this.boundConnectionEvents) return;
    this.boundConnectionEvents = true;

    try {
      if (qz && qz.websocket) {
        qz.websocket.setClosedCallbacks((evt: any) => {
          console.warn("[QZTray] Underlying WebSocket closed:", evt);
          this._isTrulyConnected = false;
          this._isConnecting = false;
          this.lastError = "Connection to QZ Tray was closed.";
          this.notifyListeners();
        });

        qz.websocket.setErrorCallbacks((evt: any) => {
          console.warn("[QZTray] Underlying WebSocket error:", evt);
          this._isTrulyConnected = false;
          this._isConnecting = false;
          this.lastError = "QZ Tray communication error.";
          this.notifyListeners();
        });
      }
    } catch (err) {
      console.warn("[QZTray] Could not bind connection callbacks:", err);
    }
  }

  /**
   * Disconnects the active QZ Tray WebSocket.
   */
  public static async disconnect(): Promise<void> {
    this.connectionPromise = null;
    this._isConnecting = false;
    this._isTrulyConnected = false;
    if (typeof qz !== "undefined" && qz.websocket && qz.websocket.isActive()) {
      try {
        await qz.websocket.disconnect();
      } catch (err) {
        console.error("[QZTray] Error during disconnect:", err);
      }
    }
    this.notifyListeners();
  }

  /**
   * Queries the system for available printers via QZ Tray.
   */
  public static async getPrinters(): Promise<string[]> {
    this.ensureSecurityConfigured();
    if (!this.isConnected()) {
      return this.detectedPrinters;
    }
    try {
      const list = await qz.printers.find();
      this.detectedPrinters = Array.isArray(list) ? list : [];
      console.log("[QZTray] System printers detected:", this.detectedPrinters);

      // Auto-validate and select best matching printer without recursion
      this.resolveBestPrinter();

      this.notifyListeners();
      return this.detectedPrinters;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn("[QZTray] Error querying printers:", errMsg);
      if (errMsg.includes("sendData is not a function") || errMsg.includes("has not been established")) {
        this._isTrulyConnected = false;
        this.lastError = "QZ Tray is not connected.";
        this.notifyListeners();
      } else if (errMsg.includes("Failed to sign request") || errMsg.includes("signature")) {
        this.lastError = this.formatErrorMessage(err);
        this.notifyListeners();
      }
      return this.detectedPrinters;
    }
  }

  /**
   * Alias for backward compatibility
   */
  public static async refreshPrinters(): Promise<string[]> {
    return this.getPrinters();
  }

  public static getDetectedPrinters(): string[] {
    return this.detectedPrinters;
  }

  /**
   * Explicitly sets the active printer name and saves to local storage.
   */
  public static setSelectedPrinter(printerName: string): void {
    this.selectedPrinter = printerName;
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("qz_selected_printer", printerName);
        const settingsStr = localStorage.getItem("wr_printer_settings");
        if (settingsStr) {
          const parsed = JSON.parse(settingsStr);
          parsed.printerName = printerName;
          localStorage.setItem("wr_printer_settings", JSON.stringify(parsed));
        }
      } catch (_) {}
    }
    this.notifyListeners();
  }

  /**
   * Synchronously resolves the best matched printer name from detected printers.
   */
  private static resolveBestPrinter(): string {
    const target = this.selectedPrinter || this.resolveSavedPrinterName();

    if (this.detectedPrinters.length > 0) {
      // 1. Exact match
      const exact = this.detectedPrinters.find((p) => p.toLowerCase() === target.toLowerCase());
      if (exact) {
        this.selectedPrinter = exact;
        return exact;
      }

      // 2. Partial match on preferred
      const partialTarget = this.detectedPrinters.find((p) => p.toLowerCase().includes(target.toLowerCase()));
      if (partialTarget) {
        this.selectedPrinter = partialTarget;
        return partialTarget;
      }

      // 3. Epson TM-T82X variants
      const epsonT82 = this.detectedPrinters.find(
        (p) =>
          p.toLowerCase().includes("tm-t82x") ||
          p.toLowerCase().includes("tm-t82") ||
          p.toLowerCase().includes("t82x") ||
          p.toLowerCase().includes("tm-t88") ||
          p.toLowerCase().includes("tm-t20")
      );
      if (epsonT82) {
        this.selectedPrinter = epsonT82;
        return epsonT82;
      }

      // 4. Any Epson printer
      const anyEpson = this.detectedPrinters.find((p) => p.toLowerCase().includes("epson"));
      if (anyEpson) {
        this.selectedPrinter = anyEpson;
        return anyEpson;
      }

      // 5. Any thermal / POS printer
      const thermal = this.detectedPrinters.find(
        (p) =>
          p.toLowerCase().includes("pos") ||
          p.toLowerCase().includes("thermal") ||
          p.toLowerCase().includes("receipt") ||
          p.toLowerCase().includes("xp-80") ||
          p.toLowerCase().includes("80mm")
      );
      if (thermal) {
        this.selectedPrinter = thermal;
        return thermal;
      }

      // 6. First detected printer
      this.selectedPrinter = this.detectedPrinters[0];
      return this.detectedPrinters[0];
    }

    this.selectedPrinter = target;
    return target;
  }

  /**
   * Finds and returns the best matched printer name.
   */
  public static async getSelectedPrinter(preferredName?: string): Promise<string> {
    if (preferredName) {
      this.selectedPrinter = preferredName;
    }

    if (this.isConnected() && this.detectedPrinters.length === 0) {
      await this.getPrinters();
    }

    return this.resolveBestPrinter();
  }

  /**
   * Alias for backward compatibility
   */
  public static async resolveTargetPrinter(preferredName?: string): Promise<string> {
    return this.getSelectedPrinter(preferredName);
  }

  /**
   * Sends raw ESC/POS hex commands directly through QZ Tray to the physical printer.
   * Auto-connects if disconnected. Throws QZTrayOfflineError if QZ Tray is not running.
   */
  public static async printRaw(
    printerName?: string,
    hexString?: string,
    copies = 1
  ): Promise<{ success: boolean; printerUsed: string }> {
    this.ensureSecurityConfigured();

    if (!hexString) {
      throw new Error("No ESC/POS print data provided.");
    }

    // Auto-connect if not connected
    if (!this.isConnected()) {
      const connected = await this.connect();
      if (!connected || !this.isConnected()) {
        throw new QZTrayOfflineError();
      }
    }

    const resolvedPrinter = await this.getSelectedPrinter(printerName);

    try {
      console.log(`[QZTray] Dispatching raw ESC/POS job to "${resolvedPrinter}" (copies=${copies})...`);

      const config = qz.configs.create(resolvedPrinter, {
        copies: Math.max(1, copies),
        unsaved: true,
      });

      await qz.print(config, [
        {
          type: "raw",
          format: "command",
          flavor: "hex",
          data: hexString,
          options: { encoding: "hex" },
        },
      ]);

      console.log(`[QZTray] Print successfully completed on "${resolvedPrinter}"`);
      return { success: true, printerUsed: resolvedPrinter };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[QZTray] Print dispatch failed on "${resolvedPrinter}":`, errMsg);

      if (
        errMsg.includes("sendData is not a function") ||
        errMsg.includes("has not been established yet") ||
        errMsg.includes("Connection closed") ||
        !this.isConnected()
      ) {
        this._isTrulyConnected = false;
        this.notifyListeners();
        throw new QZTrayOfflineError();
      }

      throw new Error(this.formatErrorMessage(err, resolvedPrinter));
    }
  }

  /**
   * Alias for backward compatibility
   */
  public static async printRawHex(
    printerName: string = "EPSON TM-T82X",
    hexString: string,
    copies: number = 1
  ): Promise<{ success: boolean; printerUsed: string }> {
    return this.printRaw(printerName, hexString, copies);
  }

  /**
   * Real hardware test print.
   * Sends ESC/POS test commands directly to the Epson TM-T82X thermal printer via QZ Tray.
   * Zero browser dialogs.
   */
  public static async testPrint(preferredPrinter?: string): Promise<{ success: boolean; printerUsed: string }> {
    if (!this.isConnected()) {
      const ok = await this.connect();
      if (!ok || !this.isConnected()) {
        throw new QZTrayOfflineError();
      }
    }

    const targetPrinter = await this.getSelectedPrinter(preferredPrinter);

    const builder = new ESCPOSBuilder();
    builder.init();
    builder.alignCenter().bold(true).doubleSize(true);
    builder.writeText(`${BRAND_CONFIG.restaurantName.toUpperCase()}\n`);

    builder.bold(false).doubleSize(false).doubleHeight(true);
    builder.writeText("Epson TM-T82X Test Print\n");
    builder.doubleHeight(false);

    builder.divider("80mm", true);

    builder.alignLeft();
    builder.writeText(`Date: ${new Date().toLocaleDateString()}\n`);
    builder.writeText(`Time: ${new Date().toLocaleTimeString()}\n`);
    builder.writeText(`Printer: ${targetPrinter}\n`);
    builder.writeText(`Connection: QZ Tray WebSocket (Raw ESC/POS)\n`);

    builder.divider("80mm", false);

    builder.alignCenter().bold(true);
    builder.writeText("TEST PRINT SUCCESSFUL\n");
    builder.writeText("SILENT DIRECT PRINTING ACTIVE\n");
    builder.bold(false);

    builder.feed(4);
    builder.cutFull();

    const hex = builder.compileHex();
    return this.printRaw(targetPrinter, hex, 1);
  }

  /**
   * Sends a Kitchen Order Ticket (KOT) directly to the thermal printer via QZ Tray.
   * Strictly adheres to KOT format without prices, GST, or customer personal information.
   */
  public static async printKOT(
    kotData: any,
    printerName?: string,
    copies = 1
  ): Promise<{ success: boolean; printerUsed: string }> {
    const builder = new ESCPOSBuilder();
    builder.init();
    builder.bold(true);
    builder.alignLeft();

    // Build exact KOT formatted text
    const kotNum = String(kotData.kotNumber || kotData.id || "001")
      .replace(/^KOT-?/i, "")
      .padStart(3, "0");
    const orderNum = `#${String(kotData.orderId || kotData.id || "1001").replace(/^(SR-|XK-|ORD-|#)/i, "")}`;
    const tableNum = String(kotData.tableNumber || "Takeaway")
      .replace(/^T-?/i, "")
      .trim();

    const dividerDouble = "========================";
    const dividerSingle = "------------------------";

    const lines: string[] = [];
    lines.push(dividerDouble);
    lines.push(`     ${BRAND_CONFIG.restaurantName.toUpperCase()}`);
    lines.push("          KOT");
    if (kotData.isReprint || (kotData.printCount && kotData.printCount > 1)) {
      lines.push("        REPRINT");
    }
    lines.push(dividerDouble);
    lines.push("");

    // KOT: 001    #1042
    lines.push(`KOT: ${kotNum}    ${orderNum}`);
    // TABLE: 05
    lines.push(`TABLE: ${/^\d+$/.test(tableNum) ? tableNum.padStart(2, "0") : tableNum}`);
    lines.push("");

    lines.push(dividerSingle);
    lines.push("ITEM                 QTY");
    lines.push(dividerSingle);

    const items = Array.isArray(kotData.items) ? kotData.items : [];
    for (const itm of items) {
      const name = String(itm.name || "Item").trim();
      const qty = String(itm.quantity || 1).trim();
      const maxNameLen = 24 - qty.length - 1;
      let displayName = name;
      if (displayName.length > maxNameLen) {
        displayName = displayName.substring(0, maxNameLen);
      }
      const spacesCount = Math.max(1, 24 - displayName.length - qty.length);
      lines.push(`${displayName}${" ".repeat(spacesCount)}${qty}`);
    }

    lines.push(dividerSingle);

    // Notes / Special Instructions
    const notes: string[] = [];
    if (kotData.specialInstructions && typeof kotData.specialInstructions === "string") {
      const trimmed = kotData.specialInstructions.trim();
      if (trimmed && trimmed.toLowerCase() !== "none" && trimmed.toLowerCase() !== "no instructions") {
        notes.push(...trimmed.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean));
      }
    }
    for (const itm of items) {
      if (itm.customization && typeof itm.customization === "string") {
        const c = itm.customization.trim();
        if (c && c.toLowerCase() !== "none" && !notes.includes(c)) {
          notes.push(c);
        }
      }
    }

    if (notes.length > 0) {
      lines.push("");
      lines.push("NOTE:");
      for (const note of notes) {
        lines.push(note);
      }
    }

    lines.push("");
    lines.push(dividerDouble);

    builder.writeText(lines.join("\n") + "\n");
    builder.feed(3);
    builder.cutFull();

    const hex = builder.compileHex();
    return this.printRaw(printerName, hex, copies);
  }

  /**
   * Sends a Customer Bill directly to the thermal printer via QZ Tray.
   * Cleanly formatted for 80mm/58mm thermal paper, zero browser dialogs.
   */
  public static async printBill(
    orderData: any,
    settings: any,
    printerName?: string,
    copies = 1,
    paperWidth: "58mm" | "80mm" = "80mm"
  ): Promise<{ success: boolean; printerUsed: string }> {
    const pSettings = getLocalPrinterSettings();
    const hex = buildCustomerBillESCPOS(orderData, settings, paperWidth, pSettings);
    return this.printRaw(printerName, hex, copies);
  }

  /**
   * Direct silent customer bill print method
   */
  public static async printCustomerBillDirect(
    orderData: any,
    settings?: any
  ): Promise<DirectPrintResult> {
    return printCustomerBillDirect(orderData, settings);
  }
}

function getLocalPrinterSettings() {
  try {
    const raw = localStorage.getItem("wr_printer_settings");
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    printerName: "EPSON TM-T82X",
    paperWidth: "80mm",
    autoPrintBill: true,
    autoPrintKOT: true,
    autoCut: true,
    cutType: "full",
    feedBeforeCutBill: 3,
    feedBeforeCutKOT: 3,
    copies: 1,
    useQZTray: true,
  };
}

export interface DirectPrintResult {
  success: boolean;
  error?: string;
  printerUsed?: string;
}

/**
 * Builds high-contrast, fixed-width monospaced ESC/POS Customer Bill for 80mm / 58mm thermal printers.
 * Strictly uses live selling price (never original_price).
 * Fixed columns: ITEM (24) | QTY (8) | AMOUNT (16) on 80mm.
 * Long item names wrap cleanly without shifting QTY or AMOUNT.
 * Amount is strictly right aligned.
 */
export function buildCustomerBillESCPOS(
  orderData: any,
  settings: any,
  paperWidth: "58mm" | "80mm" = "80mm",
  printerSettings?: any
): string {
  const builder = new ESCPOSBuilder();
  builder.init();

  // Dark, high-contrast, clean font initialization
  builder.bold(true);

  // Restaurant Brand Header
  builder.alignCenter().doubleHeight(true);
  builder.writeText(`${(settings?.name || BRAND_CONFIG.restaurantName).toUpperCase()}\n`);
  builder.doubleHeight(false);

  if (settings?.tagline || BRAND_CONFIG.tagline) {
    builder.writeText(`${settings?.tagline || BRAND_CONFIG.tagline}\n`);
  }
  if (settings?.phone || BRAND_CONFIG.defaultPhone) {
    builder.writeText(`Tel: ${settings?.phone || BRAND_CONFIG.defaultPhone}\n`);
  }

  builder.divider(paperWidth, true);

  // Order Info
  builder.alignLeft();
  const orderNum = String(orderData.id || "1001").replace(/^(SR-|XK-|ORD-)/i, "#");
  const createdAt = new Date(orderData.createdAt || Date.now());
  const dateStr = createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  builder.totalRow(`Order No: ${orderNum}`, `Date: ${dateStr}`, paperWidth);
  builder.totalRow(`Customer: ${orderData.customerName || "Walk-in Guest"}`, `Time: ${timeStr}`, paperWidth);
  const orderTypeStr = (orderData.orderType || "takeaway").toUpperCase();
  const tableStr = orderData.tableNumber ? ` (#${orderData.tableNumber})` : "";
  builder.totalRow(`Order Type: ${orderTypeStr}${tableStr}`, `Guest: ${orderData.customerName || "Walk-in"}`, paperWidth);

  builder.divider(paperWidth, true);

  // Columns Header
  builder.bold(true);
  if (paperWidth === "80mm") {
    // 24 + 8 + 16 = 48 chars
    const headerLine = "ITEM".padEnd(24) + "  QTY   " + "AMOUNT".padStart(16) + "\n";
    builder.writeText(headerLine);
  } else {
    // 16 + 4 + 12 = 32 chars
    const headerLine = "ITEM".padEnd(16) + " QTY" + "AMOUNT".padStart(12) + "\n";
    builder.writeText(headerLine);
  }
  builder.divider(paperWidth, false);

  // Items Table Rows: Fixed monospaced columns with clean word wrapping
  const items = orderData.items || [];
  for (const item of items) {
    // Live selling price only — NEVER original_price
    const unitPrice = Number(item.price ?? item.sellingPrice ?? 0);
    const qty = Number(item.quantity) || 1;
    const lineTotal = Math.round(unitPrice * qty);
    const amountText = `Rs. ${lineTotal}`;

    builder.tableItemRow(item.name || "Item", qty, amountText, paperWidth);
  }

  builder.divider(paperWidth, false);

  // Financial Totals
  const subtotal = Number(orderData.subtotal || 0);
  const gst = Number(orderData.gst || 0);
  const discountAmount = Number(orderData.discountAmount || 0);
  const packagingCharge = Number(orderData.packagingCharge || 0);
  const deliveryCharge = orderData.orderType === "delivery" ? Number(settings?.deliveryCharges || 0) : 0;
  const grandTotal = Math.round(
    Number(orderData.grandTotal) || (subtotal + gst - discountAmount + packagingCharge + deliveryCharge)
  );

  builder.totalRow("Subtotal", `Rs. ${Math.round(subtotal)}`, paperWidth);
  if (gst > 0) {
    builder.totalRow("GST", `Rs. ${Math.round(gst)}`, paperWidth);
  }
  if (discountAmount > 0) {
    builder.totalRow("Discount", `-Rs. ${Math.round(discountAmount)}`, paperWidth);
  }
  if (packagingCharge > 0) {
    builder.totalRow("Packaging", `Rs. ${Math.round(packagingCharge)}`, paperWidth);
  }
  if (deliveryCharge > 0) {
    builder.totalRow("Delivery", `Rs. ${Math.round(deliveryCharge)}`, paperWidth);
  }

  builder.divider(paperWidth, true);
  builder.bold(true).doubleHeight(true);
  builder.totalRow("TOTAL", `Rs. ${grandTotal}`, paperWidth);
  builder.bold(false).doubleHeight(false);
  builder.divider(paperWidth, true);

  const paymentMode = (orderData.paymentMethod || orderData.paymentMode || "POS COUNTER TERMINAL").toUpperCase();
  const paymentStatus = (orderData.paymentStatus || "PAID").toUpperCase();
  builder.alignLeft();
  builder.writeText(`Payment: ${paymentMode} [${paymentStatus}]\n\n`);

  // Centered Footer
  builder.alignCenter().bold(true);
  builder.writeText("THANK YOU!\n");
  builder.writeText("VISIT AGAIN\n");
  builder.bold(false);

  // Auto Cut: feed 3 lines and cut receipt
  const feedLines = Math.min(3, Math.max(2, printerSettings?.feedBeforeCutBill ?? 3));
  builder.feed(feedLines);
  builder.cutFull();

  return builder.compileHex();
}

/**
 * Direct Silent Customer Bill Printing for POS.
 * 1. Verify QZ Tray is connected.
 * 2. Verify selected thermal printer.
 * 3. Generate RAW ESC/POS bill.
 * 4. Send directly through QZ Tray.
 * 5. Return success/failure.
 * Never invokes browser printing, window.print(), or any dialogs.
 */
export async function printCustomerBillDirect(
  orderData: any,
  customSettings?: any
): Promise<DirectPrintResult> {
  // 1. Check QZ Tray connection
  if (!QZTrayService.isConnected()) {
    const connected = await QZTrayService.connect().catch(() => false);
    if (!connected || !QZTrayService.isConnected()) {
      console.warn("[QZTray] QZ Tray is not connected or offline.");
      return {
        success: false,
        error: "QZ Tray is not connected."
      };
    }
  }

  // 2. Check selected thermal printer
  const printerName = await QZTrayService.getSelectedPrinter();
  if (!printerName) {
    console.warn("[QZTray] Thermal printer not selected.");
    return {
      success: false,
      error: "Thermal printer not selected."
    };
  }

  // 3. Generate RAW ESC/POS
  const pSettings = getLocalPrinterSettings();
  const paperWidth = (pSettings.paperWidth === "58mm" ? "58mm" : "80mm") as "58mm" | "80mm";
  const hex = buildCustomerBillESCPOS(orderData, customSettings, paperWidth, pSettings);

  // 4. Send directly through QZ Tray
  try {
    const printResult = await QZTrayService.printRaw(printerName, hex, pSettings.copies || 1);
    return {
      success: true,
      printerUsed: printResult.printerUsed || printerName
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.warn("[QZTray] Direct print error:", msg);
    if (
      err instanceof QZTrayOfflineError ||
      msg.includes("not running") ||
      msg.includes("offline") ||
      msg.includes("sendData is not a function") ||
      msg.includes("not been established yet")
    ) {
      return {
        success: false,
        error: "QZ Tray is not connected.",
        printerUsed: printerName
      };
    }
    return {
      success: false,
      error: QZTrayService.formatErrorMessage(err, printerName),
      printerUsed: printerName
    };
  }
}

// Auto-configure security early in browser environment
if (typeof window !== "undefined") {
  try {
    QZTrayService.ensureSecurityConfigured();
  } catch (_) {}
}

export const qzTray = QZTrayService;
export default QZTrayService;
