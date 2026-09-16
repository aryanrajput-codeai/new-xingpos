import React, { useState, useEffect } from "react";
import { 
  X, Clock, Calendar, User, Shield, Printer, AlertTriangle, 
  CheckCircle2, ChevronRight, RotateCcw, Search, Eye, Landmark, Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LocalDB, RestaurantSettings } from "../lib/db";
import { Shift, ShiftFinancials } from "../types";
import { buildZReportESCPOS, getWRPrinterSettings } from "../lib/printerService";

interface ShiftHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: "Owner" | "Manager" | "Cashier";
  settings: RestaurantSettings;
  onShiftStatusChanged?: () => void;
}

export const ShiftHistoryModal: React.FC<ShiftHistoryModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  settings,
  onShiftStatusChanged
}) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedFinancials, setSelectedFinancials] = useState<ShiftFinancials | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reopen Shift Form State
  const [showReopenDialog, setShowReopenDialog] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>("");
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadShifts = () => {
    const list = LocalDB.getShifts();
    setShifts(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadShifts();
      setSelectedShift(null);
      setSelectedFinancials(null);
      setShowReopenDialog(false);
      setReopenError(null);
    }
  }, [isOpen]);

  const handleSelectShift = (shift: Shift) => {
    setSelectedShift(shift);
    try {
      const fin = LocalDB.calculateShiftFinancials(shift.id);
      setSelectedFinancials(fin);
    } catch (e) {
      console.warn("Failed to calculate shift financials:", e);
    }
  };

  const handleReprintZReport = (shift: Shift) => {
    try {
      const fin = LocalDB.calculateShiftFinancials(shift.id);
      const printWindow = window.open("", "_blank", "width=450,height=850");
      if (printWindow) {
        const diff = (shift.actualCash !== undefined ? shift.actualCash - fin.expectedCash : 0);
        const diffType = shift.differenceType || (Math.abs(diff) <= 0.01 ? "Exact" : diff < 0 ? "Short" : "Excess");

        printWindow.document.write(`
          <html>
            <head>
              <title>Reprint Shift Z-Report - #${shift.id}</title>
              <style>
                body { font-family: monospace; padding: 16px; font-size: 13px; color: #111; line-height: 1.4; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-bottom: 1px dashed #666; margin: 8px 0; }
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
                <h3>*** DUPLICATE SHIFT Z-REPORT ***</h3>
              </div>
              <div class="divider"></div>
              <div><b>Shift ID:</b> ${shift.id}</div>
              <div><b>Cashier:</b> ${shift.cashierName}</div>
              <div><b>Business Date:</b> ${shift.businessDate}</div>
              <div><b>Opened:</b> ${new Date(shift.openedAt).toLocaleString()} (By ${shift.openedBy})</div>
              <div><b>Closed:</b> ${shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'N/A'} (By ${shift.closedBy || 'Admin'})</div>
              <div class="divider"></div>

              <div class="bold">1. CASH DRAWER RECONCILIATION:</div>
              <div class="flex"><span>Opening Float:</span> <span>₹${fin.openingCash.toFixed(2)}</span></div>
              <div class="flex"><span>(+) Cash Sales:</span> <span>₹${fin.cashSales.toFixed(2)}</span></div>
              <div class="flex"><span>(+) Cash In:</span> <span>₹${fin.cashIn.toFixed(2)}</span></div>
              <div class="flex"><span>(-) Cash Out:</span> <span>₹${fin.cashOut.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="flex bold"><span>EXPECTED CASH:</span> <span>₹${fin.expectedCash.toFixed(2)}</span></div>
              <div class="flex bold"><span>ACTUAL CASH COUNT:</span> <span>₹${(shift.actualCash ?? fin.expectedCash).toFixed(2)}</span></div>
              <div class="flex bold">
                <span>DISCREPANCY:</span>
                <span>${diffType === 'Exact' ? '₹0.00 (EXACT)' : diff < 0 ? `-₹${Math.abs(diff).toFixed(2)} (SHORT)` : `+₹${diff.toFixed(2)} (EXCESS)`}</span>
              </div>
              ${shift.differenceReason ? `<div><b>Discrepancy Reason:</b> "${shift.differenceReason}"</div>` : ""}

              <div class="divider"></div>
              <div class="bold">2. SALES BY TENDER:</div>
              <div class="flex"><span>Cash:</span> <span>₹${fin.cashSales.toFixed(2)}</span></div>
              <div class="flex"><span>UPI / QR:</span> <span>₹${fin.upiSales.toFixed(2)}</span></div>
              <div class="flex"><span>Card / POS:</span> <span>₹${fin.cardSales.toFixed(2)}</span></div>
              ${fin.otherSales > 0 ? `<div class="flex"><span>Other:</span> <span>₹${fin.otherSales.toFixed(2)}</span></div>` : ""}
              <div class="divider"></div>
              <div class="flex bold"><span>TOTAL SALES:</span> <span>₹${fin.totalSales.toFixed(2)}</span></div>

              <div class="divider"></div>
              <div class="bold">3. OPERATIONAL METRICS:</div>
              <div class="flex"><span>Settled Orders:</span> <span>${fin.orderCount}</span></div>
              <div class="flex"><span>Voided Amount:</span> <span>₹${fin.voidedTotal.toFixed(2)}</span></div>

              <div class="divider"></div>
              <div class="center" style="font-size: 11px; margin-top: 16px;">
                *** REPRINTED AUDIT COPY ***<br/>
                WebRajya Financial Engine
              </div>
              <script>window.onload = function() { window.print(); }</script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (e) {
      console.error("Reprint Z-Report failed:", e);
    }
  };

  const handleReopenShift = async () => {
    setReopenError(null);
    if (!selectedShift) return;
    try {
      if (!reopenReason.trim()) {
        throw new Error("Please provide a justification reason to reopen this shift.");
      }
      await LocalDB.apiReopenShift({
        shiftId: selectedShift.id,
        reopenedBy: currentRole,
        reason: reopenReason.trim()
      });
      setSuccessMsg(`Shift #${selectedShift.id} has been reopened.`);
      loadShifts();
      setShowReopenDialog(false);
      onShiftStatusChanged?.();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setReopenError(err.message || "Failed to reopen shift.");
    }
  };

  const filteredShifts = shifts.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.id.toLowerCase().includes(q) ||
      s.cashierName.toLowerCase().includes(q) ||
      s.businessDate.includes(q) ||
      (s.status || "").toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <div id="shift-history-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-stone-100">Shift History & Z-Reports Ledger</h3>
              <p className="text-xs text-stone-400">
                Audited cash reconciliation archives, discrepancy records & reprints
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

        {/* Success Banner */}
        <AnimatePresence>
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-50 border-b border-emerald-200 px-5 py-3 flex items-center gap-3 text-emerald-800 text-sm"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Layout */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          
          {/* Left Column: Shift List */}
          <div className="md:col-span-5 flex flex-col h-full bg-stone-50/50">
            <div className="p-3 border-b border-stone-200 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shift ID, cashier, date..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[60vh] md:max-h-[68vh]">
              {filteredShifts.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-xs">
                  No shifts found.
                </div>
              ) : (
                filteredShifts.map((s) => {
                  const isSelected = selectedShift?.id === s.id;
                  const isOpen = s.status === "Open" || s.status === "Closing";
                  const isForceClosed = s.status === "Force Closed";
                  const diff = s.difference || 0;
                  const hasDiscrepancy = Math.abs(diff) > 0.01;

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectShift(s)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-50/80 border-amber-300 shadow-sm ring-1 ring-amber-400/50"
                          : "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-stone-900">{s.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isOpen
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : isForceClosed
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : "bg-stone-100 text-stone-700 border border-stone-300"
                        }`}>
                          {s.status}
                        </span>
                      </div>

                      <div className="text-xs text-stone-500 mt-1 flex items-center justify-between">
                        <span>{s.cashierName}</span>
                        <span>{s.businessDate}</span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                        <span className="text-stone-500">Sales: <b className="text-stone-800">₹{(s.totalSales ?? 0).toFixed(2)}</b></span>
                        {hasDiscrepancy ? (
                          <span className={`font-bold ${diff < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {diff < 0 ? `-₹${Math.abs(diff).toFixed(2)} (Short)` : `+₹${diff.toFixed(2)} (Excess)`}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Exact</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Shift Details & Z-Report Preview */}
          <div className="md:col-span-7 p-5 overflow-y-auto flex flex-col justify-between max-h-[60vh] md:max-h-[68vh] bg-white">
            {selectedShift ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <div>
                    <h4 className="font-black text-lg text-stone-900">Shift #{selectedShift.id}</h4>
                    <p className="text-xs text-stone-500">
                      Opened by {selectedShift.openedBy} on {new Date(selectedShift.openedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReprintZReport(selectedShift)}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Reprint Z-Report
                    </button>
                    {(selectedShift.status === "Closed" || selectedShift.status === "Force Closed") && currentRole !== "Cashier" && (
                      <button
                        onClick={() => setShowReopenDialog(true)}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reopen Shift
                      </button>
                    )}
                  </div>
                </div>

                {/* Reopen Shift Prompt */}
                {showReopenDialog && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
                    <div className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-600" />
                      Manager Authorization to Reopen Shift #{selectedShift.id}
                    </div>
                    {reopenError && (
                      <div className="text-xs text-rose-700 font-semibold">{reopenError}</div>
                    )}
                    <input
                      type="text"
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      placeholder="Reason for reopening (e.g. Missed bill adjustment before midnight)"
                      className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowReopenDialog(false)}
                        className="px-3 py-1.5 text-xs font-bold border border-stone-300 rounded-lg bg-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReopenShift}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                      >
                        Confirm Reopen
                      </button>
                    </div>
                  </div>
                )}

                {/* Financial Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                    <div className="text-[11px] text-stone-500 font-medium">Opening Float</div>
                    <div className="text-sm font-bold text-stone-900 mt-0.5">₹{selectedShift.openingCash.toFixed(2)}</div>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                    <div className="text-[11px] text-stone-500 font-medium">Expected Cash</div>
                    <div className="text-sm font-bold text-amber-950 mt-0.5">₹{selectedShift.expectedCash.toFixed(2)}</div>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                    <div className="text-[11px] text-stone-500 font-medium">Actual Counted</div>
                    <div className="text-sm font-bold text-stone-900 mt-0.5">
                      {selectedShift.actualCash !== undefined ? `₹${selectedShift.actualCash.toFixed(2)}` : "In Progress"}
                    </div>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                    <div className="text-[11px] text-stone-500 font-medium">Difference</div>
                    <div className={`text-sm font-bold mt-0.5 ${
                      (selectedShift.difference || 0) < -0.01 ? "text-rose-600" : (selectedShift.difference || 0) > 0.01 ? "text-emerald-600" : "text-stone-800"
                    }`}>
                      {selectedShift.difference !== undefined ? `${selectedShift.difference < 0 ? '-' : '+'}₹${Math.abs(selectedShift.difference).toFixed(2)}` : "—"}
                    </div>
                  </div>
                </div>

                {/* Tender Breakdown */}
                {selectedFinancials && (
                  <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-2">
                    <h5 className="text-xs font-bold text-stone-700 uppercase tracking-wide">Tender Breakdown</h5>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                        <span className="text-stone-500">Cash:</span>
                        <div className="font-bold text-stone-900">₹{selectedFinancials.cashSales.toFixed(2)}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                        <span className="text-stone-500">UPI / QR:</span>
                        <div className="font-bold text-indigo-900">₹{selectedFinancials.upiSales.toFixed(2)}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                        <span className="text-stone-500">Card / POS:</span>
                        <div className="font-bold text-blue-900">₹{selectedFinancials.cardSales.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes & Discrepancies */}
                {selectedShift.differenceReason && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900">
                    <div className="font-bold text-rose-950 mb-0.5">Discrepancy Justification Note:</div>
                    "{selectedShift.differenceReason}"
                  </div>
                )}

                {selectedShift.closingNotes && (
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-800">
                    <div className="font-bold text-stone-900 mb-0.5">Closing Handover Notes:</div>
                    "{selectedShift.closingNotes}"
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 py-16">
                <Landmark className="w-12 h-12 text-stone-300 mb-2" />
                <p className="text-xs">Select a shift on the left to review financial reconciliation details.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
