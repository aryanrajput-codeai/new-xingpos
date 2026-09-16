import React, { useState, useEffect, useMemo } from "react";
import { 
  X, DollarSign, Clock, User, Shield, AlertTriangle, CheckCircle, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Printer, AlertCircle, FileText,
  Lock, KeyRound, Check, ChevronRight, Landmark, ReceiptText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LocalDB, RestaurantSettings } from "../lib/db";
import { Shift, ShiftFinancials, CashAdjustmentType, CashAdjustment } from "../types";
import { buildZReportESCPOS, getWRPrinterSettings } from "../lib/printerService";

interface ShiftManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: "Owner" | "Manager" | "Cashier";
  settings: RestaurantSettings;
  onShiftStatusChanged?: () => void;
}

export const ShiftManagementModal: React.FC<ShiftManagementModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  settings,
  onShiftStatusChanged
}) => {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [financials, setFinancials] = useState<ShiftFinancials | null>(null);
  const [mode, setMode] = useState<"view" | "open" | "close" | "adjust" | "force_close">("view");

  // Open Shift Form State
  const [openingCash, setOpeningCash] = useState<number>(1000);
  const [cashierName, setCashierName] = useState<string>("Cashier 1");
  const [openingNotes, setOpeningNotes] = useState<string>("");
  const [businessDate, setBusinessDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Denominations Counter for Open/Close
  const [denominations, setDenominations] = useState<{ [denom: number]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0
  });

  // Close Shift Form State
  const [actualCash, setActualCash] = useState<number>(0);
  const [differenceReason, setDifferenceReason] = useState<string>("");
  const [closingNotes, setClosingNotes] = useState<string>("");
  const [isClosingSubmitting, setIsClosingSubmitting] = useState<boolean>(false);
  const [forceCloseReason, setForceCloseReason] = useState<string>("");

  // Cash Adjustment Form State
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(100);
  const [adjustmentType, setAdjustmentType] = useState<CashAdjustmentType>("Cash Out");
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");
  const [adjustmentAuthBy, setAdjustmentAuthBy] = useState<string>(currentRole);

  // Success / Error Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Calculated denomination total
  const countedDenominationsTotal = useMemo(() => {
    return Object.entries(denominations).reduce((sum, [denom, count]) => {
      return sum + Number(denom) * (Number(count) || 0);
    }, 0);
  }, [denominations]);

  const refreshShiftData = () => {
    const shift = LocalDB.getActiveShift();
    setActiveShift(shift);
    if (shift) {
      try {
        const fin = LocalDB.calculateShiftFinancials(shift.id);
        setFinancials(fin);
        setActualCash(fin.expectedCash);
      } catch (e) {
        console.error(e);
      }
    } else {
      setFinancials(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshShiftData();
      setErrorMsg(null);
      setSuccessMsg(null);
      const shift = LocalDB.getActiveShift();
      if (!shift) {
        setMode("open");
      } else {
        setMode("view");
      }
    }
  }, [isOpen]);

  // Sync denominations to input field when counting
  const handleApplyDenominationTotalToOpening = () => {
    setOpeningCash(countedDenominationsTotal);
  };

  const handleApplyDenominationTotalToClosing = () => {
    setActualCash(countedDenominationsTotal);
  };

  const handleOpenShift = async () => {
    setErrorMsg(null);
    try {
      if (openingCash < 0 || isNaN(openingCash)) {
        throw new Error("Please enter a valid non-negative opening cash float.");
      }
      await LocalDB.apiOpenShift({
        openingCash,
        cashierName: cashierName.trim() || "Cashier",
        openedBy: currentRole,
        openingNotes,
        businessDate
      });
      setSuccessMsg(`Shift opened successfully with ₹${openingCash} opening float.`);
      refreshShiftData();
      setMode("view");
      onShiftStatusChanged?.();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to open shift.");
    }
  };

  const handleAddAdjustment = async () => {
    setErrorMsg(null);
    if (!activeShift) return;
    try {
      if (adjustmentAmount <= 0 || isNaN(adjustmentAmount)) {
        throw new Error("Adjustment amount must be greater than ₹0.");
      }
      if (!adjustmentReason.trim()) {
        throw new Error("Please provide a reason for the cash adjustment.");
      }
      await LocalDB.apiAddCashAdjustment({
        shiftId: activeShift.id,
        amount: adjustmentAmount,
        type: adjustmentType,
        reason: adjustmentReason,
        authorizedBy: adjustmentAuthBy || currentRole,
        createdBy: currentRole
      });
      setSuccessMsg(`₹${adjustmentAmount} [${adjustmentType}] recorded successfully.`);
      setAdjustmentReason("");
      setAdjustmentAmount(100);
      refreshShiftData();
      setMode("view");
      onShiftStatusChanged?.();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record cash adjustment.");
    }
  };

  const handleCloseShift = async (force: boolean = false) => {
    setErrorMsg(null);
    if (!activeShift) return;
    try {
      setIsClosingSubmitting(true);
      const res = await LocalDB.apiCloseShift({
        shiftId: activeShift.id,
        actualCash,
        differenceReason: differenceReason.trim() || undefined,
        closingNotes: closingNotes.trim() || undefined,
        closedBy: currentRole,
        forceClose: force,
        forceCloseReason: force ? forceCloseReason : undefined
      });
      setSuccessMsg(res.message);
      refreshShiftData();
      onShiftStatusChanged?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to close shift.");
    } finally {
      setIsClosingSubmitting(false);
    }
  };

  const handlePrintXReport = () => {
    if (!activeShift || !financials) return;
    try {
      const printerSettings = getWRPrinterSettings();
      const escposHex = buildZReportESCPOS(activeShift, financials, settings, printerSettings, "X-REPORT");
      
      // Also open clean browser print preview
      const printWindow = window.open("", "_blank", "width=450,height=750");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Shift X-Report - #${activeShift.id}</title>
              <style>
                body { font-family: monospace; padding: 16px; font-size: 13px; color: #111; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-bottom: 1px dashed #888; margin: 8px 0; }
                .flex { display: flex; justify-content: space-between; margin: 4px 0; }
                h2, h3, h4 { margin: 4px 0; }
              </style>
            </head>
            <body>
              <div class="center bold">
                <h2>${(settings?.name || "WEBRAJYA POS").toUpperCase()}</h2>
                <div>${settings?.address || "Bengaluru"}</div>
                <div>GSTIN: ${settings?.gstNumber || "29AAAAA0000A1Z5"}</div>
                <div class="divider"></div>
                <h3>*** SHIFT X-REPORT (MID-SHIFT AUDIT) ***</h3>
              </div>
              <div class="divider"></div>
              <div><b>Shift ID:</b> ${activeShift.id}</div>
              <div><b>Cashier:</b> ${activeShift.cashierName}</div>
              <div><b>Opened:</b> ${new Date(activeShift.openedAt).toLocaleString()}</div>
              <div><b>Audit Time:</b> ${new Date().toLocaleString()}</div>
              <div class="divider"></div>
              <div class="bold">CASH DRAWER TOTALS:</div>
              <div class="flex"><span>Opening Float:</span> <span>₹${financials.openingCash.toFixed(2)}</span></div>
              <div class="flex"><span>(+) Cash Sales:</span> <span>₹${financials.cashSales.toFixed(2)}</span></div>
              <div class="flex"><span>(+) Cash In:</span> <span>₹${financials.cashIn.toFixed(2)}</span></div>
              <div class="flex"><span>(-) Cash Out:</span> <span>₹${financials.cashOut.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="flex bold"><span>EXPECTED CASH:</span> <span>₹${financials.expectedCash.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="bold">REVENUE BY TENDER:</div>
              <div class="flex"><span>Cash Sales:</span> <span>₹${financials.cashSales.toFixed(2)}</span></div>
              <div class="flex"><span>UPI / QR:</span> <span>₹${financials.upiSales.toFixed(2)}</span></div>
              <div class="flex"><span>Card / POS:</span> <span>₹${financials.cardSales.toFixed(2)}</span></div>
              ${financials.otherSales > 0 ? `<div class="flex"><span>Other:</span> <span>₹${financials.otherSales.toFixed(2)}</span></div>` : ""}
              <div class="divider"></div>
              <div class="flex bold"><span>TOTAL REVENUE:</span> <span>₹${financials.totalSales.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="center" style="font-size: 11px; margin-top: 16px;">
                *** MID-SHIFT AUDIT ONLY ***<br/>
                WebRajya Financial Engine
              </div>
              <script>window.onload = function() { window.print(); }</script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (e) {
      console.error("Print X-Report failed:", e);
    }
  };

  const handlePrintZReport = () => {
    if (!activeShift || !financials) return;
    try {
      const printerSettings = getWRPrinterSettings();
      const diff = (actualCash - financials.expectedCash);
      const diffType = Math.abs(diff) <= 0.01 ? "Exact" : diff < 0 ? "Short" : "Excess";

      const printWindow = window.open("", "_blank", "width=450,height=850");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Shift Z-Report - #${activeShift.id}</title>
              <style>
                body { font-family: monospace; padding: 16px; font-size: 13px; color: #111; line-height: 1.4; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-bottom: 1px dashed #666; margin: 8px 0; }
                .flex { display: flex; justify-content: space-between; margin: 4px 0; }
                h2, h3, h4 { margin: 4px 0; }
                .box { border: 1px solid #999; padding: 8px; margin: 8px 0; }
              </style>
            </head>
            <body>
              <div class="center bold">
                <h2>${(settings?.name || "WEBRAJYA POS").toUpperCase()}</h2>
                <div>${settings?.address || "Bengaluru"}</div>
                <div>GSTIN: ${settings?.gstNumber || "29AAAAA0000A1Z5"}</div>
                <div class="divider"></div>
                <h3>*** SHIFT Z-REPORT (FINAL RECONCILIATION) ***</h3>
              </div>
              <div class="divider"></div>
              <div><b>Shift ID:</b> ${activeShift.id}</div>
              <div><b>Cashier:</b> ${activeShift.cashierName}</div>
              <div><b>Business Day:</b> ${activeShift.businessDate}</div>
              <div><b>Opened:</b> ${new Date(activeShift.openedAt).toLocaleString()}</div>
              <div><b>Closed:</b> ${new Date().toLocaleString()} (By ${currentRole})</div>
              <div class="divider"></div>

              <div class="bold">1. CASH DRAWER RECONCILIATION:</div>
              <div class="flex"><span>Opening Float:</span> <span>₹${financials.openingCash.toFixed(2)}</span></div>
              <div class="flex"><span>(+) Cash Sales:</span> <span>₹${financials.cashSales.toFixed(2)}</span></div>
              <div class="flex"><span>(+) Cash In:</span> <span>₹${financials.cashIn.toFixed(2)}</span></div>
              <div class="flex"><span>(-) Cash Out:</span> <span>₹${financials.cashOut.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="flex bold"><span>EXPECTED CASH:</span> <span>₹${financials.expectedCash.toFixed(2)}</span></div>
              <div class="flex bold"><span>ACTUAL CASH COUNT:</span> <span>₹${actualCash.toFixed(2)}</span></div>
              <div class="flex bold" style="color: ${diffType === 'Exact' ? 'black' : diffType === 'Short' ? '#b91c1c' : '#15803d'};">
                <span>DISCREPANCY / VARIANCE:</span>
                <span>${diffType === 'Exact' ? '₹0.00 (EXACT)' : diff < 0 ? `-₹${Math.abs(diff).toFixed(2)} (SHORT)` : `+₹${diff.toFixed(2)} (EXCESS)`}</span>
              </div>
              ${differenceReason ? `<div><b>Discrepancy Note:</b> "${differenceReason}"</div>` : ""}
              
              <div class="divider"></div>
              <div class="bold">2. SALES BY TENDER METHOD:</div>
              <div class="flex"><span>Cash:</span> <span>₹${financials.cashSales.toFixed(2)}</span></div>
              <div class="flex"><span>UPI / QR:</span> <span>₹${financials.upiSales.toFixed(2)}</span></div>
              <div class="flex"><span>Card / POS:</span> <span>₹${financials.cardSales.toFixed(2)}</span></div>
              ${financials.otherSales > 0 ? `<div class="flex"><span>Other:</span> <span>₹${financials.otherSales.toFixed(2)}</span></div>` : ""}
              <div class="divider"></div>
              <div class="flex bold"><span>TOTAL REVENUE:</span> <span>₹${financials.totalSales.toFixed(2)}</span></div>

              <div class="divider"></div>
              <div class="bold">3. AUDIT & METRICS:</div>
              <div class="flex"><span>Settled Orders:</span> <span>${financials.orderCount}</span></div>
              <div class="flex"><span>Voided Payments:</span> <span>₹${financials.voidedTotal.toFixed(2)}</span></div>
              <div class="flex"><span>Refunds Total:</span> <span>₹${financials.refundedTotal.toFixed(2)}</span></div>

              <div class="divider"></div>
              <br/><br/>
              <div>Cashier Signature: _______________________</div>
              <br/>
              <div>Manager Signature: _______________________</div>
              <div class="divider"></div>
              <div class="center" style="font-size: 11px; margin-top: 12px;">
                *** SHIFT OFFICIALLY RECONCILED ***<br/>
                WebRajya Financial Engine
              </div>
              <script>window.onload = function() { window.print(); }</script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (e) {
      console.error("Print Z-Report failed:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="shift-management-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-stone-100">Shift & Cash Reconciliation</h3>
                {activeShift ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Active Shift #{activeShift.id}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    No Active Shift
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400">
                Authoritative drawer float management, tenders & Z-Report closing
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-rose-50 border-b border-rose-200 px-5 py-3 flex items-center gap-3 text-rose-800 text-sm"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <div className="flex-1 font-medium">{errorMsg}</div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-50 border-b border-emerald-200 px-5 py-3 flex items-center gap-3 text-emerald-800 text-sm"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <div className="flex-1 font-medium">{successMsg}</div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-navigation Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-5 pt-3 gap-2 overflow-x-auto">
          {activeShift && (
            <>
              <button
                onClick={() => setMode("view")}
                className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
                  mode === "view"
                    ? "bg-white border-amber-600 text-amber-900 shadow-sm"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Live Drawer Status
              </button>
              <button
                onClick={() => setMode("adjust")}
                className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
                  mode === "adjust"
                    ? "bg-white border-amber-600 text-amber-900 shadow-sm"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Cash In / Out
              </button>
              <button
                onClick={() => setMode("close")}
                className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
                  mode === "close"
                    ? "bg-white border-amber-600 text-amber-900 shadow-sm"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <Lock className="w-4 h-4" />
                Close Shift (Z-Report)
              </button>
              {currentRole === "Owner" && (
                <button
                  onClick={() => setMode("force_close")}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
                    mode === "force_close"
                      ? "bg-white border-rose-600 text-rose-900 shadow-sm"
                      : "border-transparent text-stone-600 hover:text-rose-700"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Force Close
                </button>
              )}
            </>
          )}
          {!activeShift && (
            <button
              onClick={() => setMode("open")}
              className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
                mode === "open"
                  ? "bg-white border-emerald-600 text-emerald-900 shadow-sm"
                  : "border-transparent text-stone-600 hover:text-stone-900"
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Open New Shift
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          
          {/* MODE: VIEW LIVE DRAWER STATUS */}
          {mode === "view" && activeShift && financials && (
            <div className="space-y-5">
              {/* Shift Meta Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
                <div>
                  <div className="text-xs text-stone-500 font-medium">Shift Cashier</div>
                  <div className="text-sm font-bold text-stone-800 flex items-center gap-1.5 mt-0.5">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    {activeShift.cashierName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500 font-medium">Business Date</div>
                  <div className="text-sm font-bold text-stone-800 mt-0.5">
                    {activeShift.businessDate}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500 font-medium">Opened At</div>
                  <div className="text-sm font-bold text-stone-800 flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500 font-medium">Authorizer</div>
                  <div className="text-sm font-bold text-stone-800 flex items-center gap-1.5 mt-0.5">
                    <Shield className="w-3.5 h-3.5 text-amber-500" />
                    {activeShift.openedBy}
                  </div>
                </div>
              </div>

              {/* Primary Drawer Cash Display */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      Authoritative Drawer Cash (In Till)
                    </div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-amber-950 mt-1">
                      ₹{financials.expectedCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-amber-800 mt-1">
                      Opening Float (₹{financials.openingCash}) + Cash Sales (₹{financials.cashSales}) + Adjustments (₹{financials.netAdjustments})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrintXReport}
                      className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      Print X-Report
                    </button>
                    <button
                      onClick={() => setMode("adjust")}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow transition-colors flex items-center gap-1.5"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Cash In / Out
                    </button>
                  </div>
                </div>
              </div>

              {/* Tender Breakdown Ledger */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                  Shift Sales by Payment Tender
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs">
                    <div className="text-xs text-stone-500 font-medium">Cash Collected</div>
                    <div className="text-lg font-bold text-stone-900 mt-0.5">
                      ₹{financials.cashSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs">
                    <div className="text-xs text-stone-500 font-medium">UPI / QR Sales</div>
                    <div className="text-lg font-bold text-indigo-900 mt-0.5">
                      ₹{financials.upiSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs">
                    <div className="text-xs text-stone-500 font-medium">Card / EDC Sales</div>
                    <div className="text-lg font-bold text-blue-900 mt-0.5">
                      ₹{financials.cardSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs bg-stone-50">
                    <div className="text-xs text-stone-500 font-bold">Total Sales Collected</div>
                    <div className="text-lg font-black text-emerald-900 mt-0.5">
                      ₹{financials.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Adjustments & Operational Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                      Recent Cash Adjustments
                    </h5>
                    <span className="text-xs text-stone-500">{financials.adjustments.length} total</span>
                  </div>
                  {financials.adjustments.length === 0 ? (
                    <div className="text-xs text-stone-400 italic py-3 text-center">
                      No Cash In / Out recorded this shift.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {financials.adjustments.map((adj) => (
                        <div key={adj.id} className="bg-white p-2 rounded-lg border border-stone-200 text-xs flex items-center justify-between">
                          <div>
                            <span className={`font-bold mr-1.5 ${adj.type === "Cash In" ? "text-emerald-700" : "text-rose-700"}`}>
                              [{adj.type}]
                            </span>
                            <span className="text-stone-700">{adj.reason}</span>
                          </div>
                          <div className="font-bold text-stone-900 ml-2">
                            {adj.type === "Cash In" ? "+" : "-"}₹{adj.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 flex flex-col justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-stone-700 uppercase tracking-wide mb-2">
                      Operational Ledger Metrics
                    </h5>
                    <div className="space-y-1.5 text-xs text-stone-600">
                      <div className="flex justify-between">
                        <span>Settled Orders Count:</span>
                        <span className="font-bold text-stone-900">{financials.orderCount} orders</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Records Count:</span>
                        <span className="font-bold text-stone-900">{financials.paymentCount} payments</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Voided / Reversals:</span>
                        <span className="font-bold text-stone-900">₹{financials.voidedTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-200 mt-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-600">Ready to wrap up?</span>
                    <button
                      onClick={() => setMode("close")}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      Begin Closing & Z-Report <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE: OPEN SHIFT FORM */}
          {mode === "open" && (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800">
                <div className="font-bold text-sm text-emerald-950 mb-0.5">Start New Cashier Shift</div>
                Opening a shift initializes the cash drawer with your float amount and associates all incoming orders and payments with this session.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Cashier Name / Terminal
                  </label>
                  <input
                    type="text"
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    placeholder="e.g. Rahul S / Counter 1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Business Date
                  </label>
                  <input
                    type="date"
                    value={businessDate}
                    onChange={(e) => setBusinessDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Opening Cash Float (₹)
                    </label>
                    <span className="text-xs text-stone-500">Physical drawer cash at start</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-stone-500">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={openingCash}
                      onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-stone-300 text-lg font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Denomination Counter Helper */}
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <ReceiptText className="w-4 h-4 text-stone-600" />
                    <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                      Float Denominations Helper (Optional)
                    </span>
                  </div>
                  <div className="text-xs font-bold text-stone-900">
                    Counted Total: <span className="text-emerald-700 font-black">₹{countedDenominationsTotal}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[500, 200, 100, 50, 20, 10].map((denom) => (
                    <div key={denom} className="bg-white p-2 rounded-lg border border-stone-200 text-center">
                      <div className="text-xs font-bold text-stone-600">₹{denom}</div>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={denominations[denom] || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setDenominations(prev => ({ ...prev, [denom]: val }));
                        }}
                        className="w-full text-center text-xs font-bold py-1 border border-stone-200 rounded mt-1"
                      />
                    </div>
                  ))}
                </div>

                {countedDenominationsTotal > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyDenominationTotalToOpening}
                    className="mt-3 w-full py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition-colors"
                  >
                    Apply Denomination Count (₹{countedDenominationsTotal}) as Opening Float
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Opening Notes (Optional)
                </label>
                <input
                  type="text"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="e.g. Received float from morning safe deposit"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={handleOpenShift}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Initialize & Open Shift
              </button>
            </div>
          )}

          {/* MODE: CASH ADJUSTMENT FORM (CASH IN / OUT) */}
          {mode === "adjust" && activeShift && (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
                <div className="font-bold text-sm text-amber-950 mb-0.5">Record Cash Drawer Adjustment</div>
                Track mid-shift cash drops, petty cash expenses, change replenishment, or manager float additions.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Adjustment Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Cash Out", "Cash In", "Float Addition"] as CashAdjustmentType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAdjustmentType(t)}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center ${
                          adjustmentType === t
                            ? t === "Cash In" || t === "Float Addition"
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : "bg-rose-600 text-white border-rose-600 shadow-xs"
                            : "bg-white text-stone-700 border-stone-300 hover:bg-stone-100"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Adjustment Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-stone-500">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-4 py-2 rounded-xl border border-stone-300 text-lg font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Reason / Purpose <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="e.g. Milk & Grocery purchase, Cash Drop to Safe, 10-rupee coin roll addition"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Authorized By
                  </label>
                  <input
                    type="text"
                    value={adjustmentAuthBy}
                    onChange={(e) => setAdjustmentAuthBy(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMode("view")}
                  className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700 font-bold text-sm hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddAdjustment}
                  className="flex-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Save Cash Adjustment
                </button>
              </div>
            </div>
          )}

          {/* MODE: CLOSE SHIFT (Z-REPORT RECONCILIATION) */}
          {mode === "close" && activeShift && financials && (
            <div className="space-y-5">
              <div className="bg-stone-900 text-white rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                      Authoritative System Expected Cash
                    </div>
                    <div className="text-3xl font-extrabold text-white mt-1">
                      ₹{financials.expectedCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right text-xs text-stone-400">
                    <div>Shift ID: {activeShift.id}</div>
                    <div>Total Sales: ₹{financials.totalSales.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Physical Cash Count Field */}
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Actual Physical Cash Counted in Drawer (₹) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs text-stone-500">Count physical notes & coins</span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-stone-500 text-xl">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={actualCash}
                    onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-stone-300 text-2xl font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Live Discrepancy Indicator */}
                {(() => {
                  const diff = Math.round((actualCash - financials.expectedCash) * 100) / 100;
                  const isExact = Math.abs(diff) <= 0.01;
                  const isShort = diff < -0.01;
                  const isExcess = diff > 0.01;

                  return (
                    <div className={`mt-3 p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                      isExact 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : isShort
                        ? "bg-rose-50 text-rose-800 border-rose-300"
                        : "bg-blue-50 text-blue-800 border-blue-300"
                    }`}>
                      <div className="flex items-center gap-2">
                        {isExact ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                        <span>Drawer Status:</span>
                        <span className="uppercase">{isExact ? "EXACT RECONCILIATION" : isShort ? "SHORTAGE DETECTED" : "EXCESS CASH DETECTED"}</span>
                      </div>
                      <div className="text-sm">
                        {isExact ? "₹0.00 Difference" : `${isShort ? "-" : "+"}₹${Math.abs(diff).toFixed(2)}`}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Denominations Helper */}
              <div className="border border-stone-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                    Closing Denominations Tally
                  </span>
                  <span className="text-xs font-bold text-stone-900">
                    Tally: <span className="text-emerald-700 font-bold">₹{countedDenominationsTotal}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[500, 200, 100, 50, 20, 10].map((denom) => (
                    <div key={denom} className="bg-stone-50 p-2 rounded-lg border border-stone-200 text-center">
                      <div className="text-xs font-bold text-stone-600">₹{denom}</div>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={denominations[denom] || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setDenominations(prev => ({ ...prev, [denom]: val }));
                        }}
                        className="w-full text-center text-xs font-bold py-1 border border-stone-200 rounded mt-1 bg-white"
                      />
                    </div>
                  ))}
                </div>
                {countedDenominationsTotal > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyDenominationTotalToClosing}
                    className="mt-2 w-full py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded transition-colors"
                  >
                    Apply ₹{countedDenominationsTotal} to Actual Cash Count
                  </button>
                )}
              </div>

              {/* Discrepancy Reason if not exact */}
              {Math.abs(actualCash - financials.expectedCash) > 0.01 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5">
                    Discrepancy Justification Reason <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={differenceReason}
                    onChange={(e) => setDifferenceReason(e.target.value)}
                    placeholder="e.g. Unaccounted coin change shortage, tip drawer rounding"
                    className="w-full px-3.5 py-2 rounded-xl border border-amber-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Closing Notes (Optional)
                </label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="e.g. Handover done to evening shift manager"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-3">
                <button
                  type="button"
                  onClick={handlePrintZReport}
                  className="py-3 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Z-Report
                </button>
                <button
                  type="button"
                  disabled={isClosingSubmitting}
                  onClick={() => handleCloseShift(false)}
                  className="flex-1 py-3.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Lock className="w-5 h-5 text-amber-400" />
                  {isClosingSubmitting ? "Finalizing Shift..." : "Reconcile & Close Shift"}
                </button>
              </div>
            </div>
          )}

          {/* MODE: FORCE CLOSE (OWNER/ADMIN ONLY) */}
          {mode === "force_close" && activeShift && (
            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900">
                <div className="font-bold text-sm text-rose-950 mb-0.5 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-rose-600" />
                  Emergency Force Close Shift
                </div>
                Force closing terminates an abandoned or orphaned shift session immediately and records an immutable administrative audit log.
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Force Close Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={forceCloseReason}
                  onChange={(e) => setForceCloseReason(e.target.value)}
                  placeholder="e.g. Cashier emergency leave, terminal crash recovery"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMode("view")}
                  className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700 font-bold text-sm hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleCloseShift(true)}
                  className="flex-2 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <AlertCircle className="w-5 h-5" />
                  Confirm Force Close Shift
                </button>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
};
