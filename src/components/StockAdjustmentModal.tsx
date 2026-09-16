// ====================================================================
// WEBRAJYA POS - STOCK ADJUSTMENT MODAL (PHASE 6)
// ====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  SlidersHorizontal,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardList,
  Scale,
  DollarSign,
  HelpCircle,
  User,
  Info
} from 'lucide-react';
import {
  Ingredient,
  StockAdjustmentType,
  StockAdjustmentReason
} from '../types/inventory';
import {
  SupportedUnit,
  SUPPORTED_UNITS,
  areUnitsCompatible
} from '../lib/unitConversion';
import { StockAdjustmentService } from '../lib/stockAdjustmentService';
import { RBACService } from '../lib/rbac';
import { LocalDB } from '../lib/db';

const REASONS: { value: StockAdjustmentReason; label: string; description: string }[] = [
  { value: 'Physical count correction', label: 'Physical count correction', description: 'Reconciliation following periodic physical stocktaking' },
  { value: 'Data-entry correction', label: 'Data-entry correction', description: 'Rectifying a clerical mistake made during prior entry' },
  { value: 'Initial correction', label: 'Initial correction', description: 'Adjustment to opening balance or migration baseline' },
  { value: 'Stock found', label: 'Stock found', description: 'Previously unaccounted inventory rediscovered in storage' },
  { value: 'Stock missing', label: 'Stock missing', description: 'Unexplained inventory shortage discovered during shift' },
  { value: 'Measurement correction', label: 'Measurement correction', description: 'Correction for scale calibration or weighing differences' },
  { value: 'Other', label: 'Other', description: 'Other administrative stock correction' }
];

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  initialIngredientId?: string;
  onAdjustmentRecorded?: () => void;
}

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  ingredients,
  initialIngredientId,
  onAdjustmentRecorded
}: StockAdjustmentModalProps) {
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(initialIngredientId || '');
  const [mode, setMode] = useState<'DIRECT' | 'PHYSICAL_COUNT'>('DIRECT');
  const [adjustmentType, setAdjustmentType] = useState<StockAdjustmentType>('ADJUSTMENT_IN');
  const [quantity, setQuantity] = useState<string>('');
  const [physicalCount, setPhysicalCount] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [reason, setReason] = useState<StockAdjustmentReason>('Physical count correction');
  const [notes, setNotes] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Active user name
  const activeStaff = RBACService.getActiveStaff();
  const reportedBy = activeStaff?.name || 'Staff Member';

  // Selected ingredient
  const activeIngredient = useMemo(() => {
    return ingredients.find((i) => i.id === selectedIngredientId) || null;
  }, [ingredients, selectedIngredientId]);

  // Sync initial ingredient
  useEffect(() => {
    if (initialIngredientId) {
      setSelectedIngredientId(initialIngredientId);
    } else if (ingredients.length > 0 && !selectedIngredientId) {
      setSelectedIngredientId(ingredients[0].id);
    }
  }, [initialIngredientId, ingredients]);

  // Sync default unit when ingredient changes
  useEffect(() => {
    if (activeIngredient) {
      setUnit(activeIngredient.unit);
      if (mode === 'PHYSICAL_COUNT' && !physicalCount) {
        setPhysicalCount(String(activeIngredient.currentStock));
      }
    }
  }, [activeIngredient, mode]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setQuantity('');
      setPhysicalCount('');
      setNotes('');
      setReference('');
      setErrorMessage(null);
      setShowConfirmDialog(false);
    }
  }, [isOpen]);

  // Compatible units list
  const compatibleUnits = useMemo(() => {
    if (!activeIngredient) return SUPPORTED_UNITS;
    return SUPPORTED_UNITS.filter((u) => areUnitsCompatible(u, activeIngredient.unit));
  }, [activeIngredient]);

  // Real-time estimation
  const estimate = useMemo(() => {
    if (!activeIngredient) return null;

    if (mode === 'PHYSICAL_COUNT') {
      const numCount = parseFloat(physicalCount);
      if (isNaN(numCount) || numCount < 0) return null;
      return StockAdjustmentService.estimateAdjustment(activeIngredient, 'PHYSICAL_COUNT', {
        physicalCount: numCount,
        unit
      });
    } else {
      const numQty = parseFloat(quantity);
      if (isNaN(numQty) || numQty <= 0) return null;
      return StockAdjustmentService.estimateAdjustment(activeIngredient, 'DIRECT', {
        adjustmentType,
        quantity: numQty,
        unit
      });
    }
  }, [activeIngredient, mode, adjustmentType, quantity, physicalCount, unit]);

  if (!isOpen) return null;

  const handleValidateAndPromptConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!activeIngredient) {
      setErrorMessage('Please select an ingredient.');
      return;
    }

    if (mode === 'DIRECT') {
      const numQty = parseFloat(quantity);
      if (isNaN(numQty) || numQty <= 0) {
        setErrorMessage('Quantity must be greater than 0.');
        return;
      }
    } else {
      const numCount = parseFloat(physicalCount);
      if (isNaN(numCount) || numCount < 0) {
        setErrorMessage('Physical count must be a non-negative number.');
        return;
      }
    }

    if (estimate?.warning && !estimate.isValid) {
      setErrorMessage(estimate.warning);
      return;
    }

    if (estimate?.normalizedQuantity === 0) {
      setErrorMessage('Adjustment amount is 0. No stock change required.');
      return;
    }

    // Safety: for decreasing stock operations or physical count deficits, prompt confirmation dialog
    if (estimate?.adjustmentType === 'ADJUSTMENT_OUT') {
      setShowConfirmDialog(true);
    } else {
      // Stock IN can be confirmed directly or prompted
      setShowConfirmDialog(true);
    }
  };

  const handleExecuteAdjustment = async () => {
    if (!activeIngredient || !estimate) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const idempotencyKey = `adj-${activeIngredient.id}-${Date.now()}`;

      await StockAdjustmentService.recordAdjustment(
        {
          ingredientId: activeIngredient.id,
          adjustmentType: estimate.adjustmentType,
          quantity: estimate.quantity,
          unit: unit as any,
          reason,
          notes: notes.trim() || undefined,
          reference: reference.trim() || undefined,
          isPhysicalCountMode: mode === 'PHYSICAL_COUNT',
          physicalCount: mode === 'PHYSICAL_COUNT' ? parseFloat(physicalCount) : undefined
        },
        reportedBy,
        undefined,
        idempotencyKey
      );

      setShowConfirmDialog(false);
      onAdjustmentRecorded?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record stock adjustment.');
      setShowConfirmDialog(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 font-mono">
                Stock Adjustment & Correction
              </h3>
              <p className="text-xs text-gray-500">
                Correct stock discrepancies, manual receipts, or physical count audits
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

        {/* Content / Form */}
        <form onSubmit={handleValidateAndPromptConfirm} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Switcher: Direct Adjustment vs Physical Count Reconciliation */}
          <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('DIRECT')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'DIRECT'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Direct Adjustment (IN / OUT)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('PHYSICAL_COUNT')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'PHYSICAL_COUNT'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Physical Count Mode</span>
            </button>
          </div>

          {/* Ingredient Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Ingredient <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              disabled={!!initialIngredientId}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none transition-colors disabled:opacity-75 disabled:bg-gray-100 font-mono text-gray-800"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} (Stock: {ing.currentStock} {ing.unit} @ ₹{ing.costPerUnit}/{ing.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Reference Box */}
          {activeIngredient && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs font-mono">
              <span className="text-gray-500 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-gray-400" />
                Current Recorded System Stock:
              </span>
              <span className="font-bold text-gray-900 text-sm">
                {activeIngredient.currentStock} {activeIngredient.unit}
              </span>
            </div>
          )}

          {/* Direct Mode Controls: Stock IN vs Stock OUT */}
          {mode === 'DIRECT' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Adjustment Direction <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('ADJUSTMENT_IN')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    adjustmentType === 'ADJUSTMENT_IN'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      adjustmentType === 'ADJUSTMENT_IN'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Stock IN (+)</div>
                    <div className="text-[10px] text-gray-500">Found, received, or corrected up</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustmentType('ADJUSTMENT_OUT')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    adjustmentType === 'ADJUSTMENT_OUT'
                      ? 'bg-orange-50 border-orange-500 text-orange-900 ring-2 ring-orange-500/20'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      adjustmentType === 'ADJUSTMENT_OUT'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Stock OUT (-)</div>
                    <div className="text-[10px] text-gray-500">Missing, shrink, or corrected down</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Mode inputs: Direct Quantity or Physical Count */}
          {mode === 'DIRECT' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Adjustment Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  placeholder="e.g. 2.5 or 500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none font-mono"
                >
                  {compatibleUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Actual Physical Count <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Counted stock"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Count Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none font-mono"
                >
                  {compatibleUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Reason Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Adjustment Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as StockAdjustmentReason)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none text-gray-800"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
          </div>

          {/* Live Impact Preview Card */}
          {estimate && (
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                !estimate.isValid
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : estimate.adjustmentType === 'ADJUSTMENT_IN'
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/70 border-amber-200 text-amber-900'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {estimate.adjustmentType === 'ADJUSTMENT_IN' ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-orange-700" />
                  )}
                  <span>
                    {mode === 'PHYSICAL_COUNT'
                      ? 'Reconciliation Outcome'
                      : 'Adjustment Impact Preview'}
                  </span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    estimate.adjustmentType === 'ADJUSTMENT_IN'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}
                >
                  {estimate.adjustmentType === 'ADJUSTMENT_IN' ? 'Stock IN (+)' : 'Stock OUT (-)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-gray-500 block text-[10px]">Adjustment Delta:</span>
                  <span
                    className={`font-bold ${
                      estimate.adjustmentType === 'ADJUSTMENT_IN'
                        ? 'text-emerald-700'
                        : 'text-orange-700'
                    }`}
                  >
                    {estimate.adjustmentType === 'ADJUSTMENT_IN' ? '+' : '-'}
                    {estimate.quantity} {unit}
                    {activeIngredient && unit !== activeIngredient.unit && (
                      <span className="text-[10px] text-gray-500 ml-1">
                        ({estimate.normalizedQuantity} {activeIngredient.unit})
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Resulting Live Stock:</span>
                  <span
                    className={`font-bold ${
                      estimate.stockAfter < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {estimate.stockAfter} {activeIngredient?.unit}
                  </span>
                </div>
                <div className="col-span-2 pt-1.5 border-t border-gray-200/60 flex items-center justify-between">
                  <span className="text-gray-600">Financial Valuation Impact:</span>
                  <span className="font-bold text-xs text-gray-900">
                    {estimate.adjustmentType === 'ADJUSTMENT_IN' ? '+' : '-'}₹
                    {estimate.costImpact.toFixed(2)}
                  </span>
                </div>
              </div>

              {estimate.warning && (
                <p className="mt-2 text-[11px] font-medium text-red-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {estimate.warning}
                </p>
              )}
            </div>
          )}

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Reference / Audit Ticket <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. AUDIT-2026-WK32"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Staff Audit Notes <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Explain the root cause of this adjustment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs outline-none"
              />
            </div>
          </div>

          {/* Footer controls */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-gray-400" />
              Adjusted by: <strong className="text-gray-700">{reportedBy}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!estimate?.isValid}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Review & Confirm
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Confirmation Dialog (Section 22: UI Safety for Decreasing Operations) */}
      {showConfirmDialog && activeIngredient && estimate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-100">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                estimate.adjustmentType === 'ADJUSTMENT_OUT'
                  ? 'bg-orange-50 border border-orange-200 text-orange-600'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
              }`}
            >
              {estimate.adjustmentType === 'ADJUSTMENT_OUT' ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>

            <h4 className="text-base font-bold text-gray-900 mb-1">
              {estimate.adjustmentType === 'ADJUSTMENT_OUT'
                ? 'Confirm Stock Reduction'
                : 'Confirm Stock Addition'}
            </h4>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              {estimate.adjustmentType === 'ADJUSTMENT_OUT' ? (
                <>
                  You are reducing stock for{' '}
                  <strong className="text-gray-900">{activeIngredient.name}</strong> by{' '}
                  <strong className="text-orange-700 font-mono">
                    {estimate.quantity} {unit}
                  </strong>
                  .
                </>
              ) : (
                <>
                  You are increasing stock for{' '}
                  <strong className="text-gray-900">{activeIngredient.name}</strong> by{' '}
                  <strong className="text-emerald-700 font-mono">
                    {estimate.quantity} {unit}
                  </strong>
                  .
                </>
              )}
            </p>

            <div className="p-3 bg-stone-50 rounded-xl border border-gray-200 text-xs font-mono space-y-1.5 mb-5">
              <div className="flex justify-between">
                <span className="text-gray-500">Ingredient:</span>
                <span className="font-bold text-gray-800">{activeIngredient.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Stock:</span>
                <span>
                  {activeIngredient.currentStock} {activeIngredient.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">New Stock Level:</span>
                <span
                  className={`font-bold ${
                    estimate.adjustmentType === 'ADJUSTMENT_OUT'
                      ? 'text-orange-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {estimate.stockAfter} {activeIngredient.unit}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="text-gray-500">Ledger Entry:</span>
                <span className="font-bold text-gray-800">{estimate.adjustmentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reason:</span>
                <span className="font-semibold text-gray-800">{reason}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAdjustment}
                disabled={isSubmitting}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                  estimate.adjustmentType === 'ADJUSTMENT_OUT'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSubmitting ? (
                  <span>Recording...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Adjustment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
