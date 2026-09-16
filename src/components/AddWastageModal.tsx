// ====================================================================
// WEBRAJYA POS - ADD WASTAGE MODAL (PHASE 6)
// ====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Scale,
  DollarSign,
  HelpCircle,
  Clock,
  User,
  FileText
} from 'lucide-react';
import { Ingredient, WastageReason } from '../types/inventory';
import { SupportedUnit, SUPPORTED_UNITS, areUnitsCompatible } from '../lib/unitConversion';
import { WastageService } from '../lib/wastageService';
import { RBACService } from '../lib/rbac';
import { LocalDB } from '../lib/db';

const WASTAGE_REASONS: { value: WastageReason; label: string; description: string }[] = [
  { value: 'Spoiled', label: 'Spoiled', description: 'Decomposed, curdled, rotten, or sour' },
  { value: 'Expired', label: 'Expired', description: 'Passed product expiry or best-before date' },
  { value: 'Damaged', label: 'Damaged', description: 'Crushed packaging, punctured, contaminated' },
  { value: 'Spillage', label: 'Spillage', description: 'Dropped or spilled on kitchen floor / prep counter' },
  { value: 'Burnt', label: 'Burnt', description: 'Overcooked, charred, or scorched in kitchen prep' },
  { value: 'Over-preparation', label: 'Over-preparation', description: 'Cooked/prepared in excess of daily demand' },
  { value: 'Lost', label: 'Lost', description: 'Missing unaccounted inventory or theft' },
  { value: 'Other', label: 'Other', description: 'Other kitchen or operational wastage' }
];

interface AddWastageModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  initialIngredientId?: string;
  onWastageRecorded?: () => void;
}

export default function AddWastageModal({
  isOpen,
  onClose,
  ingredients,
  initialIngredientId,
  onWastageRecorded
}: AddWastageModalProps) {
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(initialIngredientId || '');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [reason, setReason] = useState<WastageReason>('Spoiled');
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

  // Set unit whenever ingredient changes
  useEffect(() => {
    if (activeIngredient) {
      setUnit(activeIngredient.unit);
    }
  }, [activeIngredient]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setQuantity('');
      setNotes('');
      setReference('');
      setErrorMessage(null);
      setShowConfirmDialog(false);
    }
  }, [isOpen]);

  // Compatible units list for selected ingredient
  const compatibleUnits = useMemo(() => {
    if (!activeIngredient) return SUPPORTED_UNITS;
    return SUPPORTED_UNITS.filter((u) => areUnitsCompatible(u, activeIngredient.unit));
  }, [activeIngredient]);

  // Live estimate calculation
  const estimate = useMemo(() => {
    if (!activeIngredient) return null;
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) return null;

    return WastageService.estimateWastage(activeIngredient, numQty, unit);
  }, [activeIngredient, quantity, unit]);

  if (!isOpen) return null;

  const handleValidateAndPromptConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!activeIngredient) {
      setErrorMessage('Please select an ingredient.');
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setErrorMessage('Wastage quantity must be greater than 0.');
      return;
    }

    if (estimate?.warning && !estimate.isValid) {
      setErrorMessage(estimate.warning);
      return;
    }

    // Require confirmation
    setShowConfirmDialog(true);
  };

  const handleExecuteWastage = async () => {
    if (!activeIngredient) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const numQty = parseFloat(quantity);
      const idempotencyKey = `waste-${activeIngredient.id}-${Date.now()}`;

      await WastageService.recordWastage(
        {
          ingredientId: activeIngredient.id,
          quantity: numQty,
          unit: unit as any,
          reason,
          notes: notes.trim() || undefined,
          reference: reference.trim() || undefined
        },
        reportedBy,
        undefined,
        idempotencyKey
      );

      setShowConfirmDialog(false);
      onWastageRecorded?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record wastage.');
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
            <div className="p-2 bg-red-100 text-red-700 rounded-xl">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 font-mono">
                Record Ingredient Wastage
              </h3>
              <p className="text-xs text-gray-500">
                Log spoilage, expiry, damage, or kitchen preparation loss
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

          {/* Ingredient Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Ingredient <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              disabled={!!initialIngredientId}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-red-500 focus:bg-white rounded-xl text-sm outline-none transition-colors disabled:opacity-75 disabled:bg-gray-100 font-mono text-gray-800"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} (Stock: {ing.currentStock} {ing.unit} @ ₹{ing.costPerUnit}/{ing.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Live Stock & Valuation Card */}
          {activeIngredient && (
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-gray-400" />
                  Current System Stock:
                </span>
                <span className="font-bold font-mono text-gray-900">
                  {activeIngredient.currentStock} {activeIngredient.unit}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                  Valuation Rate:
                </span>
                <span className="font-semibold font-mono text-gray-700">
                  ₹{activeIngredient.costPerUnit} / {activeIngredient.unit}
                </span>
              </div>
            </div>
          )}

          {/* Quantity & Unit Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Wastage Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                placeholder="e.g. 500 or 1.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-red-500 focus:bg-white rounded-xl text-sm outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-red-500 focus:bg-white rounded-xl text-sm outline-none font-mono"
              >
                {compatibleUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Wastage Reason Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Reason for Wastage <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as WastageReason)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-red-500 focus:bg-white rounded-xl text-sm outline-none text-gray-800"
            >
              {WASTAGE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Impact Preview Card (Section 20 requirement) */}
          {estimate && (
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                estimate.isValid
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>Calculated Stock Deduction Preview</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-gray-500 block text-[10px]">Wastage Quantity:</span>
                  <span className="font-bold text-red-700">
                    -{quantity} {unit}
                    {activeIngredient && unit !== activeIngredient.unit && (
                      <span className="text-[10px] text-gray-500 ml-1">
                        ({estimate.normalizedQuantity} {activeIngredient.unit})
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Remaining Stock:</span>
                  <span
                    className={`font-bold ${
                      estimate.remainingStock < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {estimate.remainingStock} {activeIngredient?.unit}
                  </span>
                </div>
                <div className="col-span-2 pt-1.5 border-t border-amber-200/60 flex items-center justify-between">
                  <span className="text-gray-600">Estimated Write-Off Loss:</span>
                  <span className="font-bold text-sm text-red-700">₹{estimate.estimatedLoss.toFixed(2)}</span>
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
                Reference / Batch / Order # <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. KITCHEN-BIN-04 or PO-889"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 focus:border-red-500 focus:bg-white rounded-xl text-xs outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Staff Notes / Explanation <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Provide context on why this item had to be wasted..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 focus:border-red-500 focus:bg-white rounded-xl text-xs outline-none"
              />
            </div>
          </div>

          {/* Reporter & Action buttons */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-gray-400" />
              Reported by: <strong className="text-gray-700">{reportedBy}</strong>
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
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Review & Confirm
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Confirmation Dialog (Section 20 & 22 UI Safety) */}
      {showConfirmDialog && activeIngredient && estimate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl border border-red-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h4 className="text-base font-bold text-gray-900 mb-1">
              Confirm Wastage Write-Off
            </h4>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              You are about to deduct stock for{' '}
              <strong className="text-gray-900 font-semibold">{activeIngredient.name}</strong>. This
              action will post an immutable <span className="font-mono font-bold text-red-700">WASTAGE</span> entry
              to the inventory ledger.
            </p>

            <div className="p-3 bg-stone-50 rounded-xl border border-gray-200 text-xs font-mono space-y-1.5 mb-5">
              <div className="flex justify-between">
                <span className="text-gray-500">Ingredient:</span>
                <span className="font-bold text-gray-800">{activeIngredient.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Wastage Deduction:</span>
                <span className="font-bold text-red-700">
                  {quantity} {unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Stock:</span>
                <span>
                  {activeIngredient.currentStock} {activeIngredient.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">New Stock Level:</span>
                <span className="font-bold text-emerald-700">
                  {estimate.remainingStock} {activeIngredient.unit}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="text-gray-500">Loss Value:</span>
                <span className="font-bold text-red-700">₹{estimate.estimatedLoss.toFixed(2)}</span>
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
                onClick={handleExecuteWastage}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Recording...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Wastage</span>
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
