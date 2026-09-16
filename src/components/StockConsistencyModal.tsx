// ====================================================================
// WEBRAJYA POS - STOCK CONSISTENCY & INTEGRITY AUDIT MODAL (PHASE 6)
// ====================================================================

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  X,
  CheckCircle2,
  RefreshCw,
  Scale,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Ingredient } from '../types/inventory';
import { IngredientService } from '../lib/ingredientService';

interface StockConsistencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient: Ingredient | null;
}

export default function StockConsistencyModal({
  isOpen,
  onClose,
  ingredient
}: StockConsistencyModalProps) {
  const [report, setReport] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !ingredient) {
      setReport(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const runAudit = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await IngredientService.verifyStockConsistency(ingredient.id);
        if (isMounted) {
          setReport(result);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to verify ledger consistency.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    runAudit();
    return () => {
      isMounted = false;
    };
  }, [isOpen, ingredient]);

  if (!isOpen || !ingredient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 font-mono">
                Ledger Consistency Audit
              </h3>
              <p className="text-xs text-gray-500">
                Verifying mathematical balance between transactions and current stock
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-gray-500 font-mono">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto mb-2" />
              Verifying all historical ledger transactions...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <strong>Consistency check error:</strong>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          ) : report ? (
            <div className="space-y-4 text-xs font-mono">
              {/* Verdict Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  report.isConsistent
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-red-50 border-red-300 text-red-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  {report.isConsistent ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">
                      {report.isConsistent
                        ? '100% Consistent — Zero Drift'
                        : 'Integrity Warning: Drift Detected'}
                    </h4>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {report.isConsistent
                        ? `All ${report.transactionCount} ledger transactions mathematically match current stock.`
                        : `Calculated stock differs from stored stock by ${report.drift} ${report.unit}.`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-gray-500 font-semibold">Drift</div>
                  <div className="text-base font-bold text-gray-900">
                    {report.drift} {report.unit}
                  </div>
                </div>
              </div>

              {/* Master Formula Grid */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Consistency Equation Breakdown
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* IN additions */}
                  <div className="p-2.5 bg-white border border-gray-200/80 rounded-lg space-y-1">
                    <div className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Stock Additions (+)</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Opening Stock:</span>
                      <span className="font-bold">{report.breakdown.openingStock}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Purchases:</span>
                      <span className="font-bold">{report.breakdown.purchases}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Adjustments In:</span>
                      <span className="font-bold">{report.breakdown.adjustmentsIn}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Returns:</span>
                      <span className="font-bold">{report.breakdown.returns}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Transfers In:</span>
                      <span className="font-bold">{report.breakdown.transfersIn}</span>
                    </div>
                  </div>

                  {/* OUT deductions */}
                  <div className="p-2.5 bg-white border border-gray-200/80 rounded-lg space-y-1">
                    <div className="text-amber-700 font-bold flex items-center gap-1 text-[11px]">
                      <MinusCircle className="w-3.5 h-3.5" />
                      <span>Stock Deductions (-)</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Sale Consumption:</span>
                      <span className="font-bold">{report.breakdown.saleConsumption}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Wastage:</span>
                      <span className="font-bold text-red-700">{report.breakdown.wastage}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Adjustments Out:</span>
                      <span className="font-bold text-orange-700">{report.breakdown.adjustmentsOut}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Transfers Out:</span>
                      <span className="font-bold">{report.breakdown.transfersOut}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparison Footer */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px]">Calculated from Ledger:</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {report.calculatedStock} {report.unit}
                  </span>
                </div>
                <div className="text-center font-bold text-gray-400 text-lg">
                  {report.isConsistent ? '=' : '≠'}
                </div>
                <div className="text-right">
                  <span className="text-gray-500 block text-[10px]">Current Recorded Stock:</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {report.currentStock} {report.unit}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end bg-stone-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}
