import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Printer, 
  RefreshCw, 
  Sliders, 
  CheckCircle2, 
  FileText, 
  Activity,
  Save,
  RotateCcw,
  AlertTriangle,
  Flame,
  UtensilsCrossed,
  Layers,
  Sparkles
} from "lucide-react";
import { 
  LocalDB, 
  RestaurantSettings, 
  PrintMode, 
  BillFormatSettings, 
  KOTFormatSettings, 
  defaultBillFormatSettings, 
  defaultKOTFormatSettings 
} from "../lib/db";
import { PhysicalThermalPrinter } from "../lib/printerService";

interface DetectedPrinter {
  name: string;
  displayName?: string;
  isDefault?: boolean;
}

const sampleBillOrder = {
  id: "1042",
  orderId: "SR-1042",
  customerName: "Aarav Sharma",
  phoneNumber: "+91 98765 43210",
  address: "MG Road, Suite 402, Bengaluru",
  orderType: "dine-in",
  tableNumber: "05",
  createdAt: new Date().toISOString(),
  items: [
    { name: "Masala Dosa", quantity: 2, price: 90, sku: "DOSA-01", customization: "Extra crispy" },
    { name: "Paneer Tikka", quantity: 1, price: 199, sku: "STARTER-04" },
    { name: "Veg Noodles", quantity: 2, price: 140, sku: "CHINESE-02" },
  ],
  subtotal: 659,
  discountAmount: 50,
  gst: 30.45,
  grandTotal: 639.45,
  paymentMethod: "UPI",
  paymentStatus: "PAID",
};

const sampleKOTObject = {
  id: "001",
  orderId: "SR-1042",
  tableNumber: "05",
  cashierName: "Rohan Staff",
  createdAt: new Date().toISOString(),
  items: [
    { name: "Masala Dosa", quantity: 2, code: "DOSA-01", customization: "Less spicy" },
    { name: "Paneer Tikka", quantity: 1, code: "PT-04", customization: "No onion" },
    { name: "Veg Noodles", quantity: 2, code: "VN-02" },
  ],
  specialInstructions: "Less spicy, No onion",
};

export default function PrintersConfigTab() {
  const [settings, setSettings] = useState<RestaurantSettings>(() => LocalDB.getSettings());
  const [osPrinters, setOsPrinters] = useState<DetectedPrinter[]>([]);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [activeTab, setActiveTab] = useState<"assignment" | "billFormat" | "kotFormat">("assignment");
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testNotice, setTestNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Deep comparison check for unsaved state
  const isDirty = (() => {
    const saved = LocalDB.getSettings();
    return JSON.stringify(settings) !== JSON.stringify(saved);
  })();

  const fetchPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      if (window.electronAPI?.getPrinters) {
        const printers = await window.electronAPI.getPrinters();
        setOsPrinters(printers || []);
      } else {
        // Fallback sample USB printers for browser dev environment
        setOsPrinters([
          { name: "EPSON TM-T82X (USB)", displayName: "EPSON TM-T82X USB Thermal Printer", isDefault: true },
          { name: "Artery POS80 (USB)", displayName: "Artery POS80 USB Thermal Printer", isDefault: false },
        ]);
      }
    } catch (err: any) {
      console.warn("Failed to fetch OS printers:", err);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const handleSave = async () => {
    await LocalDB.apiSaveSettings(settings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetToDefaults = () => {
    if (confirm("Reset printing and receipt format configurations to defaults? This will not alter database orders or menu items.")) {
      setSettings(prev => ({
        ...prev,
        printMode: "BOTH",
        kotCopies: 1,
        billCopies: 1,
        billFormat: { ...defaultBillFormatSettings },
        kotFormat: { ...defaultKOTFormatSettings }
      }));
    }
  };

  const handleTestBillPrint = async () => {
    setTestNotice({ type: "info", message: "Sending test Bill print to configured printer..." });
    const res = await PhysicalThermalPrinter.printBill(sampleBillOrder, settings, settings.billFormat?.paperWidth || "80mm", "silent");
    if (res.success) {
      setTestNotice({ type: "success", message: "Test Bill print job dispatched successfully!" });
    } else {
      setTestNotice({ type: "error", message: `Test Bill print failed: ${res.error || "Printer not responding"}` });
    }
    setTimeout(() => setTestNotice(null), 4000);
  };

  const handleTestKOTPrint = async () => {
    setTestNotice({ type: "info", message: "Sending test KOT print to configured printer..." });
    const success = await PhysicalThermalPrinter.printKOT(sampleKOTObject as any, settings.kotFormat?.paperWidth || "80mm", "silent", "Admin", settings);
    if (success) {
      setTestNotice({ type: "success", message: "Test KOT print job dispatched successfully!" });
    } else {
      setTestNotice({ type: "error", message: "Test KOT print failed! Check printer connection." });
    }
    setTimeout(() => setTestNotice(null), 4000);
  };

  const currentBillFormat: BillFormatSettings = {
    ...defaultBillFormatSettings,
    ...(settings.billFormat || {})
  };

  const currentKotFormat: KOTFormatSettings = {
    ...defaultKOTFormatSettings,
    ...(settings.kotFormat || {})
  };

  const updateBillFormat = (updates: Partial<BillFormatSettings>) => {
    setSettings(prev => ({
      ...prev,
      billFormat: {
        ...defaultBillFormatSettings,
        ...(prev.billFormat || {}),
        ...updates
      }
    }));
  };

  const updateKotFormat = (updates: Partial<KOTFormatSettings>) => {
    setSettings(prev => ({
      ...prev,
      kotFormat: {
        ...defaultKOTFormatSettings,
        ...(prev.kotFormat || {}),
        ...updates
      }
    }));
  };

  // Helper for printer assignment select
  const isKotPrinterFound = !settings.kotPrinter || osPrinters.some(p => p.name === settings.kotPrinter);
  const isBillPrinterFound = !settings.billPrinter || osPrinters.some(p => p.name === settings.billPrinter);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 w-full text-left font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 border border-stone-200 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-stone-900 text-[#d4af37] rounded-xl shadow-xs">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-serif font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              PRINTING & RECEIPT DESIGNER
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                Direct Thermal Engine
              </span>
            </h2>
            <p className="text-xs text-stone-500 font-sans mt-0.5">
              Configure print modes, native OS printer assignments, copy counts, and live thermal format layouts for Bill & KOT.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              Unsaved Changes
            </span>
          )}
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-stone-250"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {saveSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4 text-[#d4af37]" />}
            <span>{saveSuccess ? "Saved!" : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* Test Notice Banner */}
      {testNotice && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold ${
          testNotice.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
          testNotice.type === "error" ? "bg-red-50 text-red-800 border-red-200" :
          "bg-blue-50 text-blue-800 border-blue-200"
        }`}>
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{testNotice.message}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-stone-200 gap-1 bg-stone-100/60 p-1 rounded-2xl border">
        <button
          type="button"
          onClick={() => setActiveTab("assignment")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "assignment"
              ? "bg-stone-900 text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/50"
          }`}
        >
          <Sliders className="w-4 h-4 text-[#d4af37]" />
          <span>Printer Assignment & Mode</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("billFormat")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "billFormat"
              ? "bg-stone-900 text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/50"
          }`}
        >
          <FileText className="w-4 h-4 text-[#d4af37]" />
          <span>Bill Format Designer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("kotFormat")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "kotFormat"
              ? "bg-stone-900 text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/50"
          }`}
        >
          <Flame className="w-4 h-4 text-[#d4af37]" />
          <span>KOT Format Designer</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: PRINTER ASSIGNMENT & PRINT MODE */}
      {/* ============================================================ */}
      {activeTab === "assignment" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-8 space-y-6">
            
            {/* Print Mode Selector Card */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="border-b border-stone-150 pb-3">
                <h3 className="text-sm font-serif font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#d4af37]" />
                  PRINT ON BILL FINALISE (PRINT MODE)
                </h3>
                <p className="text-xs text-stone-500">
                  Select which receipt documents automatically execute upon finalizing a POS bill.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { mode: "BOTH", label: "BILL + KOT", desc: "Prints KOT first, then Customer Bill in 1-click." },
                  { mode: "BILL_ONLY", label: "BILL ONLY", desc: "Prints Customer Bill only upon bill finalisation." },
                  { mode: "KOT_ONLY", label: "KOT ONLY", desc: "Prints KOT only upon bill finalisation." },
                ].map(item => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, printMode: item.mode as PrintMode }))}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      (settings.printMode || "BOTH") === item.mode
                        ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                        : "bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200"
                    }`}
                  >
                    <div className="font-extrabold text-xs uppercase tracking-wider flex items-center justify-between mb-1">
                      <span>{item.label}</span>
                      {(settings.printMode || "BOTH") === item.mode && <CheckCircle2 className="w-4 h-4 text-[#d4af37]" />}
                    </div>
                    <p className={`text-[11px] leading-tight ${ (settings.printMode || "BOTH") === item.mode ? "text-stone-300" : "text-stone-500" }`}>
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Hardware Assignment Card */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-stone-150 pb-3">
                <div>
                  <h3 className="text-sm font-serif font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2">
                    <Printer className="w-4 h-4 text-[#d4af37]" />
                    USB PRINTER ASSIGNMENT & COPIES
                  </h3>
                  <p className="text-xs text-stone-500">
                    Assign locally connected USB thermal printers and copy counts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchPrinters}
                  disabled={isLoadingPrinters}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border border-stone-250"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPrinters ? "animate-spin" : ""}`} />
                  <span>Refresh List</span>
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* KOT Printer & Copies */}
                <div className="space-y-4 p-4 bg-stone-50/80 rounded-xl border border-stone-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-600" />
                      KOT PRINTER
                    </span>
                    {!isKotPrinterFound && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        ⚠️ Printer Not Found
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-stone-500 uppercase block">Select Device</label>
                    <select
                      value={settings.kotPrinter || ""}
                      onChange={(e) => setSettings(prev => ({ ...prev, kotPrinter: e.target.value }))}
                      className="w-full bg-white border border-stone-300 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-stone-800 font-sans font-bold"
                    >
                      <option value="">Auto-Detect USB Printer</option>
                      {osPrinters.map(p => (
                        <option key={p.name} value={p.name}>
                          {p.name} {p.isDefault ? "(USB Default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-stone-500 uppercase block">KOT Copies Multiplier</label>
                    <select
                      value={settings.kotCopies || 1}
                      onChange={(e) => setSettings(prev => ({ ...prev, kotCopies: Number(e.target.value) }))}
                      className="w-full bg-white border border-stone-300 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-stone-800 font-sans font-bold"
                    >
                      {[1, 2, 3, 4, 5].map(num => (
                        <option key={num} value={num}>{num} Copy {num > 1 ? "Copies" : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bill Printer & Copies */}
                <div className="space-y-4 p-4 bg-stone-50/80 rounded-xl border border-stone-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-stone-800" />
                      BILL PRINTER
                    </span>
                    {!isBillPrinterFound && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        ⚠️ Printer Not Found
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-stone-500 uppercase block">Select Device</label>
                    <select
                      value={settings.billPrinter || ""}
                      onChange={(e) => setSettings(prev => ({ ...prev, billPrinter: e.target.value }))}
                      className="w-full bg-white border border-stone-300 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-stone-800 font-sans font-bold"
                    >
                      <option value="">Auto-Detect USB Printer</option>
                      {osPrinters.map(p => (
                        <option key={p.name} value={p.name}>
                          {p.name} {p.isDefault ? "(USB Default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-stone-500 uppercase block">Bill Copies Multiplier</label>
                    <select
                      value={settings.billCopies || 1}
                      onChange={(e) => setSettings(prev => ({ ...prev, billCopies: Number(e.target.value) }))}
                      className="w-full bg-white border border-stone-300 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-stone-800 font-sans font-bold"
                    >
                      {[1, 2, 3, 4, 5].map(num => (
                        <option key={num} value={num}>{num} Copy {num > 1 ? "Copies" : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>
            </div>

            {/* Test Print Actions Card */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="border-b border-stone-150 pb-3">
                <h3 className="text-sm font-serif font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#d4af37]" />
                  INSTANT HARDWARE TEST PRINT
                </h3>
                <p className="text-xs text-stone-500">
                  Verify configured printers, font sizes, and paper layout silently without opening print dialogs.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestKOTPrint}
                  className="w-full py-3 px-4 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Flame className="w-4 h-4" />
                  <span>TEST KOT PRINT</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestBillPrint}
                  className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <FileText className="w-4 h-4" />
                  <span>TEST BILL PRINT</span>
                </button>
              </div>
            </div>

          </div>

          {/* Right Status Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-stone-900 text-stone-200 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-4 text-left">
              <h4 className="text-xs font-mono font-bold text-[#d4af37] uppercase tracking-wider flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4" />
                ACTIVE CONFIG SUMMARY
              </h4>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-stone-800 pb-1.5">
                  <span className="text-stone-400">Print Mode:</span>
                  <span className="font-bold text-white">{settings.printMode || "BOTH"}</span>
                </div>
                <div className="flex justify-between border-b border-stone-800 pb-1.5">
                  <span className="text-stone-400">KOT Printer:</span>
                  <span className="font-bold text-white truncate max-w-[140px]">{settings.kotPrinter || "Auto-Detect USB"}</span>
                </div>
                <div className="flex justify-between border-b border-stone-800 pb-1.5">
                  <span className="text-stone-400">KOT Copies:</span>
                  <span className="font-bold text-white">{settings.kotCopies || 1}</span>
                </div>
                <div className="flex justify-between border-b border-stone-800 pb-1.5">
                  <span className="text-stone-400">Bill Printer:</span>
                  <span className="font-bold text-white truncate max-w-[140px]">{settings.billPrinter || "Auto-Detect USB"}</span>
                </div>
                <div className="flex justify-between border-b border-stone-800 pb-1.5">
                  <span className="text-stone-400">Bill Copies:</span>
                  <span className="font-bold text-white">{settings.billCopies || 1}</span>
                </div>
                <div className="flex justify-between border-b border-stone-800 pb-1.5">
                  <span className="text-stone-400">Bill Paper:</span>
                  <span className="font-bold text-white">{currentBillFormat.paperWidth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">KOT Paper:</span>
                  <span className="font-bold text-white">{currentKotFormat.paperWidth}</span>
                </div>
              </div>
            </div>

            {/* Detected Printers List */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <h4 className="text-xs font-mono font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-stone-500" />
                DETECTED USB PRINTERS ({osPrinters.length})
              </h4>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {osPrinters.length === 0 ? (
                  <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-xl space-y-2 text-center">
                    <p className="text-xs font-bold text-stone-700">No USB thermal printer detected.</p>
                    <p className="text-[11px] text-stone-500 font-sans">
                      Connect a USB thermal printer and click Refresh List.
                    </p>
                    <button
                      type="button"
                      onClick={fetchPrinters}
                      disabled={isLoadingPrinters}
                      className="mt-1 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPrinters ? "animate-spin" : ""}`} />
                      <span>Refresh List</span>
                    </button>
                  </div>
                ) : (
                  osPrinters.map(p => (
                    <div key={p.name} className="p-2 bg-stone-50 rounded-lg border border-stone-200/60 text-xs flex items-center justify-between">
                      <span className="font-bold text-stone-800 truncate">{p.name}</span>
                      {p.isDefault && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                          USB DEFAULT
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: BILL FORMAT DESIGNER */}
      {/* ============================================================ */}
      {activeTab === "billFormat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Controls Panel */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Paper Width & Basic Options */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="text-xs font-mono font-bold text-stone-500 uppercase tracking-wider">PAPER & DISPLAY REGION</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateBillFormat({ paperWidth: "80mm" })}
                  className={`p-3 rounded-xl border text-xs font-bold uppercase transition-all ${
                    currentBillFormat.paperWidth === "80mm" ? "bg-stone-900 text-white border-stone-900" : "bg-stone-50 text-stone-700 border-stone-250"
                  }`}
                >
                  80mm Standard Thermal Roll
                </button>
                <button
                  type="button"
                  onClick={() => updateBillFormat({ paperWidth: "58mm" })}
                  className={`p-3 rounded-xl border text-xs font-bold uppercase transition-all ${
                    currentBillFormat.paperWidth === "58mm" ? "bg-stone-900 text-white border-stone-900" : "bg-stone-50 text-stone-700 border-stone-250"
                  }`}
                >
                  58mm Compact Handheld Roll
                </button>
              </div>
            </div>

            {/* Checkbox Sections Grid */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-6">
              
              {/* Header Checkboxes */}
              <div className="space-y-2 border-b border-stone-150 pb-4">
                <span className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider block">HEADER FIELDS</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: "showRestaurantName", label: "Restaurant Name" },
                    { key: "showAddress", label: "Address" },
                    { key: "showPhone", label: "Phone" },
                    { key: "showGstin", label: "GSTIN" },
                    { key: "showEmail", label: "Email" },
                    { key: "showWebsite", label: "Website" },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer font-bold text-stone-700">
                      <input
                        type="checkbox"
                        checked={(currentBillFormat as any)[f.key]}
                        onChange={(e) => updateBillFormat({ [f.key]: e.target.checked })}
                        className="w-4 h-4 accent-stone-900"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Order Information Checkboxes */}
              <div className="space-y-2 border-b border-stone-150 pb-4">
                <span className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider block">ORDER INFORMATION</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: "showBillNumber", label: "Bill Number" },
                    { key: "showDate", label: "Date" },
                    { key: "showTime", label: "Time" },
                    { key: "showTableNumber", label: "Table Number" },
                    { key: "showOrderNumber", label: "Order Number" },
                    { key: "showCashierName", label: "Cashier Name" },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer font-bold text-stone-700">
                      <input
                        type="checkbox"
                        checked={(currentBillFormat as any)[f.key]}
                        onChange={(e) => updateBillFormat({ [f.key]: e.target.checked })}
                        className="w-4 h-4 accent-stone-900"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Customer Information Checkboxes */}
              <div className="space-y-2 border-b border-stone-150 pb-4">
                <span className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider block">CUSTOMER INFORMATION</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: "showCustomerName", label: "Customer Name" },
                    { key: "showCustomerPhone", label: "Customer Phone" },
                    { key: "showCustomerAddress", label: "Customer Address" },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer font-bold text-stone-700">
                      <input
                        type="checkbox"
                        checked={(currentBillFormat as any)[f.key]}
                        onChange={(e) => updateBillFormat({ [f.key]: e.target.checked })}
                        className="w-4 h-4 accent-stone-900"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Items & Totals */}
              <div className="space-y-2 border-b border-stone-150 pb-4">
                <span className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider block">ITEMS & TOTALS</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: "showItemName", label: "Item Name" },
                    { key: "showQuantity", label: "Quantity" },
                    { key: "showRate", label: "Rate" },
                    { key: "showAmount", label: "Amount" },
                    { key: "showItemSku", label: "Item SKU" },
                    { key: "showItemNotes", label: "Item Notes" },
                    { key: "showSubtotal", label: "Subtotal" },
                    { key: "showDiscount", label: "Discount" },
                    { key: "showTax", label: "Tax (GST)" },
                    { key: "showGrandTotal", label: "Grand Total" },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer font-bold text-stone-700">
                      <input
                        type="checkbox"
                        checked={(currentBillFormat as any)[f.key]}
                        onChange={(e) => updateBillFormat({ [f.key]: e.target.checked })}
                        className="w-4 h-4 accent-stone-900"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Payment & Footer */}
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider block">PAYMENT & FOOTER</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: "showPaymentMethod", label: "Payment Method" },
                    { key: "showThankYou", label: "Thank You Greeting" },
                    { key: "showCustomFooter", label: "Custom Footer Text" },
                    { key: "showPoweredBy", label: "Powered by WebRajya POS" },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer font-bold text-stone-700">
                      <input
                        type="checkbox"
                        checked={(currentBillFormat as any)[f.key]}
                        onChange={(e) => updateBillFormat({ [f.key]: e.target.checked })}
                        className="w-4 h-4 accent-stone-900"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>

            {/* Typography & Spacing Controls */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="text-xs font-mono font-bold text-stone-500 uppercase tracking-wider">TYPOGRAPHY & MARGINS</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-bold">
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Header Font Size (12-28)</label>
                  <input
                    type="number"
                    min={12}
                    max={28}
                    value={currentBillFormat.headerFontSize}
                    onChange={(e) => updateBillFormat({ headerFontSize: Number(e.target.value) })}
                    className="w-full bg-stone-50 border border-stone-300 p-2 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Item Font Size (8-18)</label>
                  <input
                    type="number"
                    min={8}
                    max={18}
                    value={currentBillFormat.itemFontSize}
                    onChange={(e) => updateBillFormat({ itemFontSize: Number(e.target.value) })}
                    className="w-full bg-stone-50 border border-stone-300 p-2 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Total Font Size (10-24)</label>
                  <input
                    type="number"
                    min={10}
                    max={24}
                    value={currentBillFormat.totalFontSize}
                    onChange={(e) => updateBillFormat({ totalFontSize: Number(e.target.value) })}
                    className="w-full bg-stone-50 border border-stone-300 p-2 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Footer Font Size (8-16)</label>
                  <input
                    type="number"
                    min={8}
                    max={16}
                    value={currentBillFormat.footerFontSize}
                    onChange={(e) => updateBillFormat({ footerFontSize: Number(e.target.value) })}
                    className="w-full bg-stone-50 border border-stone-300 p-2 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Header Alignment</label>
                  <select
                    value={currentBillFormat.headerAlignment}
                    onChange={(e) => updateBillFormat({ headerAlignment: e.target.value as any })}
                    className="w-full bg-stone-50 border border-stone-300 p-2 rounded-lg font-bold"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Footer Alignment</label>
                  <select
                    value={currentBillFormat.footerAlignment}
                    onChange={(e) => updateBillFormat({ footerAlignment: e.target.value as any })}
                    className="w-full bg-stone-50 border border-stone-300 p-2 rounded-lg font-bold"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* Right Live Preview Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm text-left">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
                <span className="text-xs font-mono font-bold text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  LIVE BILL PREVIEW
                </span>
                <span className="text-[10px] font-mono text-stone-400 bg-stone-800 px-2 py-0.5 rounded">
                  {currentBillFormat.paperWidth}
                </span>
              </div>

              {/* Rendered HTML Container */}
              <div 
                className="bg-white rounded-xl p-3 shadow-inner overflow-x-auto min-h-[450px]"
                dangerouslySetInnerHTML={{
                  __html: PhysicalThermalPrinter.renderConfiguredBillHTML(sampleBillOrder, settings, currentBillFormat)
                }}
              />
            </div>
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: KOT FORMAT DESIGNER */}
      {/* ============================================================ */}
      {activeTab === "kotFormat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Controls Panel */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Paper Width */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="text-xs font-mono font-bold text-stone-500 uppercase tracking-wider">KOT PAPER WIDTH</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateKotFormat({ paperWidth: "80mm" })}
                  className={`p-3 rounded-xl border text-xs font-bold uppercase transition-all ${
                    currentKotFormat.paperWidth === "80mm" ? "bg-stone-900 text-white border-stone-900" : "bg-stone-50 text-stone-700 border-stone-250"
                  }`}
                >
                  80mm Standard Thermal Roll
                </button>
                <button
                  type="button"
                  onClick={() => updateKotFormat({ paperWidth: "58mm" })}
                  className={`p-3 rounded-xl border text-xs font-bold uppercase transition-all ${
                    currentKotFormat.paperWidth === "58mm" ? "bg-stone-900 text-white border-stone-900" : "bg-stone-50 text-stone-700 border-stone-250"
                  }`}
                >
                  58mm Compact Handheld Roll
                </button>
              </div>
            </div>

            {/* Field Visibility Checkboxes */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-6">
              
              {/* KOT Header */}
              <div className="space-y-2 border-b border-stone-150 pb-4">
                <span className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider block">KOT HEADER FIELDS</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: "showRestaurantName", label: "Restaurant Name" },
                    { key: "showKotNumber", label: "KOT Number" },
                    { key: "showTableNumber", label: "Table Number" },
                    { key: "showDate", label: "Date" },
                    { key: "showTime", label: "Time" },
                    { key: "showOrderNumber", label: "Order Number" },
                    { key: "showCashier", label: "Cashier" },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer font-bold text-stone-700">
                      <input
                        type="checkbox"
                        checked={(currentKotFormat as any)[f.key]}
                        onChange={(e) => updateKotFormat({ [f.key]: e.target.checked })}
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Items & Notes */}
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider block">ITEMS & ORDER INSTRUCTIONS</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: "showItemName", label: "Item Name" },
                    { key: "showQuantity", label: "Quantity" },
                    { key: "showItemCode", label: "Item Code" },
                    { key: "showItemNotes", label: "Item Custom Notes" },
                    { key: "showOrderNotes", label: "Order Special Notes" },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer font-bold text-stone-700">
                      <input
                        type="checkbox"
                        checked={(currentKotFormat as any)[f.key]}
                        onChange={(e) => updateKotFormat({ [f.key]: e.target.checked })}
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>

            {/* Typography */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="text-xs font-mono font-bold text-stone-500 uppercase tracking-wider">KOT TYPOGRAPHY</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-bold">
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Header Font Size (12-28)</label>
                  <input
                    type="number"
                    min={12}
                    max={28}
                    value={currentKotFormat.headerFontSize}
                    onChange={(e) => updateKotFormat({ headerFontSize: Number(e.target.value) })}
                    className="w-full bg-stone-50 border border-stone-300 p-2 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Item Font Size (8-18)</label>
                  <input
                    type="number"
                    min={8}
                    max={18}
                    value={currentKotFormat.itemFontSize}
                    onChange={(e) => updateKotFormat({ itemFontSize: Number(e.target.value) })}
                    className="w-full bg-stone-50 border border-stone-300 p-2 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-1">Note Font Size (8-18)</label>
                  <input
                    type="number"
                    min={8}
                    max={18}
                    value={currentKotFormat.noteFontSize}
                    onChange={(e) => updateKotFormat({ noteFontSize: Number(e.target.value) })}
                    className="w-full bg-stone-50 border border-stone-300 p-2 rounded-lg font-bold"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Right Live Preview Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm text-left">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
                <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  LIVE KOT PREVIEW
                </span>
                <span className="text-[10px] font-mono text-stone-400 bg-stone-800 px-2 py-0.5 rounded">
                  {currentKotFormat.paperWidth}
                </span>
              </div>

              {/* Rendered KOT HTML Container */}
              <div 
                className="bg-white rounded-xl p-3 shadow-inner overflow-x-auto min-h-[400px]"
                dangerouslySetInnerHTML={{
                  __html: PhysicalThermalPrinter.renderConfiguredKOTHTML(sampleKOTObject, settings, currentKotFormat)
                }}
              />
            </div>
          </div>

        </div>
      )}

    </motion.div>
  );
}
