import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Printer, 
  RefreshCw, 
  Trash2, 
  Sliders, 
  CheckCircle2, 
  FileText, 
  Terminal,
  Activity,
  Save,
  Check
} from "lucide-react";
import { PrintQueueManager, PrintJob, PrintHistoryLog } from "../lib/printQueueManager";
import { LocalDB } from "../lib/db";
import { 
  getWRPrinterSettings, 
  saveWRPrinterSettings, 
  WRPrinterSettings,
  PhysicalThermalPrinter
} from "../lib/printerService";
import { RESTAURANT_BRANDING } from "../config/branding";

export default function PrintersConfigTab() {
  const [pSettings, setPSettings] = useState<WRPrinterSettings>(() => getWRPrinterSettings());
  
  const [queue, setQueue] = useState<PrintJob[]>(() => PrintQueueManager.getQueue());
  const [logs, setLogs] = useState<PrintHistoryLog[]>(() => PrintQueueManager.getLogs());
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setQueue(PrintQueueManager.getQueue());
      setLogs(PrintQueueManager.getLogs());
    };

    window.addEventListener("print_queue_updated", handleUpdate);
    const interval = setInterval(handleUpdate, 3000);

    return () => {
      window.removeEventListener("print_queue_updated", handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleSaveSettings = () => {
    saveWRPrinterSettings(pSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    window.dispatchEvent(new CustomEvent("print_queue_updated"));
  };

  const handleThermalTestPrint = () => {
    try {
      const dummyOrder = {
        id: "TEST-001",
        customerName: "Thermal Test Ticket",
        phoneNumber: "9876543210",
        orderType: "dine-in",
        tableNumber: "T-01",
        createdAt: new Date().toISOString(),
        items: [
          { name: "Sample Culinary Dish", quantity: 2, price: 180, gstRate: 5 },
          { name: "Special House Beverage", quantity: 1, price: 120, gstRate: 5 }
        ],
        subTotal: 480,
        cgst: 12,
        sgst: 12,
        tax: 24,
        grandTotal: 504,
        orderStatus: "Completed",
        paymentStatus: "Paid",
        paymentMethod: "Cash"
      };

      PhysicalThermalPrinter.printPremiumHTML("bill", dummyOrder, LocalDB.getSettings(), {
        paperWidth: pSettings.paperWidth,
        copies: pSettings.copies,
        autoCut: pSettings.autoCut,
        cutType: pSettings.cutType
      });
    } catch (err: any) {
      alert("❌ Test Print Failed: " + (err.message || "Unknown error"));
    }
  };

  const handleManualRetry = async () => {
    setIsProcessing(true);
    await PrintQueueManager.processQueue();
    setIsProcessing(false);
  };

  const handleClearQueue = () => {
    if (confirm("Are you sure you want to purge the current background print queue? This cannot be undone.")) {
      PrintQueueManager.saveQueue([]);
    }
  };

  const handlePurgeLogs = () => {
    if (confirm("Are you sure you want to clear the printer transaction log history?")) {
      PrintQueueManager.saveLogs([]);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 w-full text-left">
      
      {/* Title & Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-serif font-bold text-stone-900 uppercase tracking-wider text-left flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#C67C4E]" />
            Thermal Printing Configuration
          </h2>
          <p className="text-xs text-stone-500 font-sans">
            Configure receipt and KOT printer parameters, paper roll width, auto-cut settings, and monitor print queues.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={isProcessing}
            className={`px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
            <span>{isProcessing ? "Processing..." : "Flush / Process Queue"}</span>
          </button>
          <button
            type="button"
            onClick={handleClearQueue}
            className="px-4 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 font-semibold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-stone-500" />
            <span>Purge Queue</span>
          </button>
        </div>
      </div>

      {/* Grid: Console Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Status & Settings Panel */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Connection Status Panel */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs">
            <h3 className="text-2xs font-mono font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-stone-400" />
              SYSTEM COMPONENT TELEMETRY
            </h3>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-50 p-4 border border-stone-200 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl border bg-green-50 border-green-200 text-green-600">
                  <Printer className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider leading-none block mb-1">
                    Thermal Print Engine
                  </span>
                  <span className="text-sm font-bold text-stone-850 block leading-tight">
                    Native Browser & System Print Dialog Ready
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  READY
                </span>
              </div>
            </div>
          </div>

          {/* Master Printer Configuration panel */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="border-b border-stone-150 pb-4">
              <h3 className="text-sm font-serif font-bold text-stone-900 uppercase tracking-wide">
                Hardware Configuration & Directives
              </h3>
              <p className="text-[11px] text-stone-500 font-sans">
                Fine-tune hardware commands, roll widths, copy count, and auto-dispatch logic.
              </p>
            </div>

            {/* Form fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-extrabold text-stone-450 uppercase tracking-wider block">
                  PHYSICAL THERMAL PRINTER NAME / PROFILE
                </label>
                <input
                  type="text"
                  value={pSettings.printerName}
                  onChange={(e) => setPSettings({ ...pSettings, printerName: e.target.value })}
                  className="w-full bg-[#FAF6F0]/60 border border-stone-200 px-3.5 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#C67C4E] font-sans text-stone-900 font-bold"
                  placeholder="e.g. EPSON TM-T82X, POS-80"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-extrabold text-stone-450 uppercase tracking-wider block">
                  PAPER ROLL DIAMETER/WIDTH
                </label>
                <select
                  value={pSettings.paperWidth}
                  onChange={(e) => setPSettings({ ...pSettings, paperWidth: e.target.value as any })}
                  className="w-full bg-[#FAF6F0]/60 border border-stone-200 px-3.5 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#C67C4E] font-sans text-stone-900 font-bold"
                >
                  <option value="80mm">80mm Professional Thermal Roll (Standard)</option>
                  <option value="58mm">58mm Compact Handheld Roll (Mobile)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-extrabold text-stone-450 uppercase tracking-wider block">
                  PRINT COPIES (MULTIPLIER)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={pSettings.copies}
                  onChange={(e) => setPSettings({ ...pSettings, copies: Math.max(1, Number(e.target.value)) })}
                  className="w-full bg-[#FAF6F0]/60 border border-stone-200 px-3.5 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#C67C4E] font-sans text-stone-900 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-extrabold text-stone-450 uppercase tracking-wider block">
                  AUTO CUT DIRECTIVE
                </label>
                <div className="flex items-center gap-3 bg-[#FAF6F0]/30 border border-stone-200 px-3 py-2 rounded-xl h-[42px]">
                  <input
                    type="checkbox"
                    id="autoCutCheckbox"
                    checked={pSettings.autoCut}
                    onChange={(e) => setPSettings({ ...pSettings, autoCut: e.target.checked })}
                    className="w-4 h-4 accent-[#C67C4E]"
                  />
                  <label htmlFor="autoCutCheckbox" className="text-xs text-stone-700 font-bold select-none">
                    Trigger Paper Cut Command
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-extrabold text-stone-450 uppercase tracking-wider block">
                  PAPER CUT MODALITY
                </label>
                <select
                  value={pSettings.cutType}
                  disabled={!pSettings.autoCut}
                  onChange={(e) => setPSettings({ ...pSettings, cutType: e.target.value as any })}
                  className="w-full bg-[#FAF6F0]/60 border border-stone-200 px-3.5 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#C67C4E] font-sans text-stone-900 font-bold disabled:bg-stone-100 disabled:text-stone-400"
                >
                  <option value="full">Full Clean Cut (Separate sheets entirely)</option>
                  <option value="partial">Partial Cut (Maintains small connecting point)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-extrabold text-stone-450 uppercase tracking-wider block">
                  BILL FEED BLANK LINES (PRE-CUT)
                </label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={pSettings.feedBeforeCutBill}
                  onChange={(e) => setPSettings({ ...pSettings, feedBeforeCutBill: Number(e.target.value) })}
                  className="w-full bg-[#FAF6F0]/60 border border-stone-200 px-3.5 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#C67C4E] font-sans text-stone-900 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-extrabold text-stone-450 uppercase tracking-wider block">
                  KOT FEED BLANK LINES (PRE-CUT)
                </label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={pSettings.feedBeforeCutKOT}
                  onChange={(e) => setPSettings({ ...pSettings, feedBeforeCutKOT: Number(e.target.value) })}
                  className="w-full bg-[#FAF6F0]/60 border border-stone-200 px-3.5 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#C67C4E] font-sans text-stone-900 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-extrabold text-stone-450 uppercase tracking-wider block">
                  CUSTOMER BILL TRIGGER
                </label>
                <div className="flex items-center gap-3 bg-[#FAF6F0]/30 border border-stone-200 px-3 py-2 rounded-xl h-[42px]">
                  <input
                    type="checkbox"
                    id="autoPrintBillCheckbox"
                    checked={pSettings.autoPrintBill}
                    onChange={(e) => setPSettings({ ...pSettings, autoPrintBill: e.target.checked })}
                    className="w-4 h-4 accent-[#C67C4E]"
                  />
                  <label htmlFor="autoPrintBillCheckbox" className="text-xs text-stone-700 font-bold select-none">
                    Spool Bill on Paid Checkout
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-extrabold text-stone-450 uppercase tracking-wider block">
                  KITCHEN ORDER TICKET TRIGGER
                </label>
                <div className="flex items-center gap-3 bg-[#FAF6F0]/30 border border-stone-200 px-3 py-2 rounded-xl h-[42px]">
                  <input
                    type="checkbox"
                    id="autoPrintKOTCheckbox"
                    checked={pSettings.autoPrintKOT}
                    onChange={(e) => setPSettings({ ...pSettings, autoPrintKOT: e.target.checked })}
                    className="w-4 h-4 accent-[#C67C4E]"
                  />
                  <label htmlFor="autoPrintKOTCheckbox" className="text-xs text-stone-700 font-bold select-none">
                    Spool KOT on Kitchen Dispatch
                  </label>
                </div>
              </div>

            </div>

            {/* Action panel footer */}
            <div className="pt-4 border-t border-stone-150 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-5 py-3 bg-[#C67C4E] hover:bg-[#aa663a] text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Printer Parameters</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleThermalTestPrint}
                  className="px-5 py-3 bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Test Slip</span>
                </button>
              </div>

              {saveSuccess && (
                <span className="text-[10px] font-mono font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg border border-green-200">
                  ✔ System settings saved successfully!
                </span>
              )}
            </div>

          </div>

        </div>

        {/* Right column: Dispatch Stats Telemetry */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-stone-900 text-stone-100 border border-stone-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-800 pb-2.5">
              <Sliders className="w-4 h-4 text-[#e2935c]" />
              <h4 className="text-2xs font-mono font-bold uppercase tracking-wider text-stone-300">
                DISPATCH ENGINE TELEMETRY
              </h4>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] font-mono text-stone-500 uppercase block leading-none mb-1">
                  Queue Load
                </span>
                <span className="text-lg font-bold font-mono text-[#e2935c]">
                  {queue.filter(j => j.status === "Pending" || j.status === "Retrying").length} Spools
                </span>
              </div>
              <div>
                <span className="text-[9px] font-mono text-stone-500 uppercase block leading-none mb-1">
                  Total Spooled
                </span>
                <span className="text-lg font-bold font-mono text-stone-100">
                  {queue.length} jobs
                </span>
              </div>
              <div>
                <span className="text-[9px] font-mono text-stone-500 uppercase block leading-none mb-1">
                  Print Success
                </span>
                <span className="text-lg font-bold font-mono text-green-400">
                  {logs.filter(l => l.status === "Success").length} slips
                </span>
              </div>
              <div>
                <span className="text-[9px] font-mono text-stone-500 uppercase block leading-none mb-1">
                  Spool Failures
                </span>
                <span className="text-lg font-bold font-mono text-red-400">
                  {logs.filter(l => l.status === "Failed").length} errors
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <h4 className="text-2xs font-mono font-bold text-stone-400 uppercase tracking-widest">
              HARDWARE INTEGRATION TIPS
            </h4>
            <ul className="text-[11px] text-stone-600 font-sans space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-[#C67C4E] font-bold">•</span>
                <span><strong>Sequential Printing:</strong> WebRajya automatically enforces separate queues. Bill and KOT always print sequentially with a hardware feed and cut between them to prevent overlap.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#C67C4E] font-bold">•</span>
                <span><strong>Auto Cuts:</strong> Standard 80mm printers support native ESC/POS cuts. For 58mm portable devices, disable auto-cut or select partial cut to save paper wear.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#C67C4E] font-bold">•</span>
                <span><strong>Browser Print Integration:</strong> Thermal receipts and KOTs format seamlessly in standard 80mm and 58mm layouts for any connected thermal or system printer.</span>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* SECTION 2: Active Dispatch Queue Spooler */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-150 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg border border-yellow-100 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-serif font-bold text-stone-900 uppercase tracking-wide">
              Active Dispatch Queue Spooler
            </h3>
          </div>
          <span className="text-[10px] font-mono text-stone-400 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-lg">
            {queue.length} Active Tasks
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-stone-200 rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-stone-300" />
            <p className="text-xs text-stone-500 font-sans italic">All dispatch queues are clear. Thermal buffers are empty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50 text-[10px] font-mono font-bold text-stone-450 uppercase">
                  <th className="p-3">Job ID</th>
                  <th className="p-3">Order Reference</th>
                  <th className="p-3">Slip Type</th>
                  <th className="p-3">Destination Printer</th>
                  <th className="p-3">Culinary Items</th>
                  <th className="p-3">Telemetry Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((job) => {
                  return (
                    <tr key={job.id} className="border-b border-stone-100 hover:bg-stone-50/50 text-xs font-sans text-stone-700">
                      <td className="p-3 font-mono text-[10px] text-stone-400 font-bold">{job.id.substring(0, 14)}</td>
                      <td className="p-3 font-mono font-bold text-stone-900">{job.orderId}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          job.type === "Bill" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                            : job.type === "Add-On KOT"
                            ? "bg-purple-50 text-purple-700 border border-purple-100"
                            : "bg-blue-50 text-blue-700 border border-blue-100"
                        }`}>
                          {job.type}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Printer className="w-3 h-3 text-stone-400" />
                          <span className="font-semibold">{pSettings.printerName}</span>
                        </div>
                      </td>
                      <td className="p-3 max-w-[200px] truncate">
                        {job.items.map(i => `${i.name} ×${i.quantity}`).join(", ")}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold w-fit ${
                            job.status === "Printed" 
                              ? "bg-green-500/10 text-green-700" 
                              : job.status === "Printing"
                              ? "bg-blue-500/10 text-blue-700 animate-pulse"
                              : job.status === "Retrying"
                              ? "bg-amber-500/10 text-amber-700"
                              : job.status === "Failed"
                              ? "bg-red-500/10 text-red-700"
                              : "bg-stone-100 text-stone-500"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              job.status === "Printed" ? "bg-green-500" :
                              job.status === "Printing" ? "bg-blue-500" :
                              job.status === "Retrying" ? "bg-amber-500" :
                              job.status === "Failed" ? "bg-red-500" : "bg-stone-400"
                            }`} />
                            {job.status.toUpperCase()}
                          </span>
                          {job.errorMessage && (
                            <span className="text-[9px] font-mono text-red-500 block leading-tight max-w-[150px] truncate" title={job.errorMessage}>
                              {job.errorMessage}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[10px] text-stone-400">
                        {new Date(job.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {(job.status === "Failed" || job.status === "Retrying") && (
                            <button
                              type="button"
                              onClick={async () => {
                                job.status = "Pending";
                                job.retryCount = 0;
                                PrintQueueManager.saveQueue([...queue]);
                                await PrintQueueManager.processQueue();
                              }}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded font-bold uppercase text-[9px] cursor-pointer"
                            >
                              Retry Now
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const next = queue.filter(q => q.id !== job.id);
                              PrintQueueManager.saveQueue(next);
                            }}
                            className="p-1 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-450 rounded cursor-pointer"
                            title="Delete Spool"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: Spool output transaction ledger logs */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-150 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-stone-100 text-stone-600 rounded-lg border border-stone-250/30 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-serif font-bold text-stone-900 uppercase tracking-wide">
              Thermal Output Logs Ledger
            </h3>
          </div>
          <button
            type="button"
            onClick={handlePurgeLogs}
            className="px-3 py-1 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-600 font-bold text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
          >
            Clear Log History
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-400 font-sans italic">
            No printer transaction log records saved in this station.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50 text-[10px] font-mono font-bold text-stone-450 uppercase">
                  <th className="p-3">Log ID</th>
                  <th className="p-3">Order</th>
                  <th className="p-3">Print Type</th>
                  <th className="p-3">Printer Spool Target</th>
                  <th className="p-3">Printed By</th>
                  <th className="p-3">Logged Date / Time</th>
                  <th className="p-3">Reprint Metadata</th>
                  <th className="p-3">Result Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((lg) => {
                  return (
                    <tr key={lg.id} className="border-b border-stone-100 hover:bg-stone-50/50 text-xs font-sans text-stone-600">
                      <td className="p-3 font-mono text-[10px] text-stone-400">{lg.id.replace("prt-log-", "").substring(0, 8)}</td>
                      <td className="p-3 font-mono font-bold text-stone-900">{lg.orderId}</td>
                      <td className="p-3">
                        <span className="font-semibold text-stone-800">{lg.printType}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-[11px] text-stone-500">{lg.printerName}</span>
                      </td>
                      <td className="p-3 text-[11px] text-stone-500">{lg.printedBy}</td>
                      <td className="p-3 font-mono text-[10px] text-stone-400">
                        {new Date(lg.printTime).toLocaleString()}
                      </td>
                      <td className="p-3">
                        {lg.reprints > 0 ? (
                           <div className="space-y-0.5 leading-none">
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-mono font-extrabold uppercase">
                              REPRINT ×{lg.reprints}
                            </span>
                            {lg.originalPrintTime && (
                              <p className="text-[8px] font-mono text-stone-400 block pt-0.5">
                                Orig: {new Date(lg.originalPrintTime).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-300 font-mono text-[10px]">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center gap-1 font-mono font-bold text-[10px] ${
                            lg.status === "Success" ? "text-green-600" : "text-red-600"
                          }`}>
                            {lg.status === "Success" ? "● SUCCESS" : "● FAILED"}
                          </span>
                          {lg.errorMessage && (
                            <span className="text-[9px] font-mono text-red-500 block leading-tight max-w-[120px] truncate" title={lg.errorMessage}>
                              {lg.errorMessage}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </motion.div>
  );
}
