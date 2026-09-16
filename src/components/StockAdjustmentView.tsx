// ====================================================================
// WEBRAJYA POS - STOCK ADJUSTMENT VIEW (PHASE 6)
// ====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  User,
  CheckCircle2,
  Calendar,
  X,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Layers,
  Scale
} from 'lucide-react';
import {
  Ingredient,
  StockAdjustmentRecord,
  StockAdjustmentType,
  StockAdjustmentReason
} from '../types/inventory';
import { StockAdjustmentService } from '../lib/stockAdjustmentService';
import { RBACService } from '../lib/rbac';
import StockAdjustmentModal from './StockAdjustmentModal';

interface StockAdjustmentViewProps {
  ingredients: Ingredient[];
  onAdjustmentUpdated?: () => void;
}

export default function StockAdjustmentView({
  ingredients,
  onAdjustmentUpdated
}: StockAdjustmentViewProps) {
  const [adjustments, setAdjustments] = useState<StockAdjustmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | undefined>();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ALL');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string>('ALL');
  const [selectedIngredientFilter, setSelectedIngredientFilter] = useState<string>('ALL');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  const canManage = RBACService.hasPermission('inventory.manage');

  const loadAdjustments = async () => {
    setIsLoading(true);
    try {
      const list = await StockAdjustmentService.getAdjustments();
      setAdjustments(list);
    } catch (err) {
      console.error('Failed to load adjustments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdjustments();

    const handleUpdate = () => {
      loadAdjustments();
      onAdjustmentUpdated?.();
    };

    window.addEventListener('inventory_adjustments_updated', handleUpdate);
    window.addEventListener('ingredients_updated', handleUpdate);
    return () => {
      window.removeEventListener('inventory_adjustments_updated', handleUpdate);
      window.removeEventListener('ingredients_updated', handleUpdate);
    };
  }, []);

  // Distinct staff members
  const staffMembers = useMemo(() => {
    const set = new Set<string>();
    adjustments.forEach((a) => {
      if (a.performedBy) set.add(a.performedBy);
    });
    return Array.from(set);
  }, [adjustments]);

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return adjustments.filter((adj) => {
      // Search
      const matchesSearch =
        searchQuery.trim() === '' ||
        adj.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adj.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (adj.reference && adj.reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (adj.notes && adj.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        adj.performedBy.toLowerCase().includes(searchQuery.toLowerCase());

      // Type
      const matchesType = selectedTypeFilter === 'ALL' || adj.adjustmentType === selectedTypeFilter;

      // Reason
      const matchesReason = selectedReasonFilter === 'ALL' || adj.reason === selectedReasonFilter;

      // Ingredient
      const matchesIngredient =
        selectedIngredientFilter === 'ALL' || adj.ingredientId === selectedIngredientFilter;

      // Staff
      const matchesStaff = selectedStaffFilter === 'ALL' || adj.performedBy === selectedStaffFilter;

      // Date
      let matchesDate = true;
      const recTime = new Date(adj.performedAt).getTime();
      if (selectedDateRange === 'TODAY') {
        matchesDate = recTime >= startOfToday;
      } else if (selectedDateRange === 'WEEK') {
        matchesDate = recTime >= sevenDaysAgo;
      } else if (selectedDateRange === 'MONTH') {
        matchesDate = recTime >= thirtyDaysAgo;
      }

      return matchesSearch && matchesType && matchesReason && matchesIngredient && matchesStaff && matchesDate;
    });
  }, [
    adjustments,
    searchQuery,
    selectedTypeFilter,
    selectedReasonFilter,
    selectedIngredientFilter,
    selectedStaffFilter,
    selectedDateRange
  ]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let inCount = 0;
    let outCount = 0;
    let netValueImpact = 0;

    adjustments.forEach((adj) => {
      if (adj.adjustmentType === 'ADJUSTMENT_IN') {
        inCount++;
        netValueImpact += adj.costImpact;
      } else {
        outCount++;
        netValueImpact -= adj.costImpact;
      }
    });

    return {
      total: adjustments.length,
      inCount,
      outCount,
      netValueImpact
    };
  }, [adjustments]);

  return (
    <div className="space-y-4">
      {/* Header & Metrics Strip */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-mono">
                Stock Adjustments & Reconciliation
              </h2>
              <p className="text-xs text-gray-500">
                Track manual balance corrections, audits, and physical stock counts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadAdjustments}
              title="Refresh adjustments"
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {canManage && (
              <button
                onClick={() => {
                  setSelectedIngredientId(undefined);
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Adjustment</span>
              </button>
            )}
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/60 rounded-xl">
            <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
              <span>Stock IN Additions</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-emerald-900 mt-1 font-mono">
              {metrics.inCount}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">Surplus & found items</div>
          </div>

          <div className="p-3.5 bg-orange-50/60 border border-orange-200/60 rounded-xl">
            <div className="flex items-center justify-between text-orange-700 text-xs font-medium">
              <span>Stock OUT Deductions</span>
              <ArrowDownRight className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-xl font-bold text-orange-900 mt-1 font-mono">
              {metrics.outCount}
            </div>
            <div className="text-[11px] text-orange-700 mt-0.5">Deficit & shrink adjustments</div>
          </div>

          <div className="p-3.5 bg-gray-50 border border-gray-200/70 rounded-xl">
            <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
              <span>Total Audit Events</span>
              <FileSpreadsheet className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-900 mt-1 font-mono">
              {metrics.total}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Logged adjustments</div>
          </div>

          <div className="p-3.5 bg-blue-50/60 border border-blue-200/60 rounded-xl">
            <div className="flex items-center justify-between text-blue-700 text-xs font-medium">
              <span>Net Valuation Impact</span>
              {metrics.netValueImpact >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
            </div>
            <div
              className={`text-base font-bold mt-1 font-mono ${
                metrics.netValueImpact >= 0 ? 'text-emerald-900' : 'text-red-900'
              }`}
            >
              {metrics.netValueImpact >= 0 ? '+' : ''}₹
              {metrics.netValueImpact.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </div>
            <div className="text-[11px] text-blue-700 mt-0.5">Net inventory asset delta</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ingredient, reason, staff, or reference..."
            className="w-full pl-9.5 pr-4 py-2 text-xs sm:text-sm bg-gray-50 hover:bg-gray-100/70 focus:bg-white border border-gray-200 focus:border-blue-500 rounded-xl outline-none transition-all placeholder:text-gray-400 text-gray-800 font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Type Filter (Stock IN vs OUT) */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs text-gray-700">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
              className="bg-transparent border-none text-xs font-medium text-gray-800 focus:ring-0 outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Directions</option>
              <option value="ADJUSTMENT_IN">Stock IN (+)</option>
              <option value="ADJUSTMENT_OUT">Stock OUT (-)</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs text-gray-700">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value as any)}
              className="bg-transparent border-none text-xs font-medium text-gray-800 focus:ring-0 outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>
          </div>

          {/* Reason Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs text-gray-700">
            <select
              value={selectedReasonFilter}
              onChange={(e) => setSelectedReasonFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-gray-800 focus:ring-0 outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Reasons</option>
              <option value="Physical count correction">Physical Count Correction</option>
              <option value="Data-entry correction">Data-entry Correction</option>
              <option value="Initial correction">Initial Correction</option>
              <option value="Stock found">Stock Found</option>
              <option value="Stock missing">Stock Missing</option>
              <option value="Measurement correction">Measurement Correction</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Ingredient Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs text-gray-700">
            <select
              value={selectedIngredientFilter}
              onChange={(e) => setSelectedIngredientFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-gray-800 focus:ring-0 outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Ingredients</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          {/* Staff Filter */}
          {staffMembers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs text-gray-700">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-medium text-gray-800 focus:ring-0 outline-none cursor-pointer pr-1"
              >
                <option value="ALL">All Staff</option>
                {staffMembers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Adjustments Table (Section 21 requirements: Visual distinction between Stock IN and OUT) */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-gray-500 font-mono">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
            Loading stock adjustment ledger...
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="py-16 text-center text-gray-500 px-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3 text-blue-500">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 font-mono">No Adjustments Found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {searchQuery || selectedTypeFilter !== 'ALL' || selectedReasonFilter !== 'ALL'
                ? 'No adjustment records match the active filter criteria.'
                : 'No manual inventory adjustments have been recorded yet.'}
            </p>
            {canManage && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Create First Stock Adjustment
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Date & Time</th>
                  <th className="py-3 px-4 font-semibold">Ingredient</th>
                  <th className="py-3 px-4 font-semibold">Adjustment Type</th>
                  <th className="py-3 px-4 font-semibold">Quantity Delta</th>
                  <th className="py-3 px-4 font-semibold">Stock Movement</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold">Value Impact</th>
                  <th className="py-3 px-4 font-semibold">Adjusted By</th>
                  <th className="py-3 px-4 font-semibold">Reference & Notes</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAdjustments.map((adj) => {
                  const isStockIn = adj.adjustmentType === 'ADJUSTMENT_IN';

                  return (
                    <tr key={adj.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        <div className="font-semibold text-gray-800">
                          {new Date(adj.performedAt).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(adj.performedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Ingredient */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{adj.ingredientName}</div>
                        <div className="text-[10px] text-gray-400">Rate: ₹{adj.costPerUnit}/{adj.unit}</div>
                      </td>

                      {/* Adjustment Type (Clear visual distinction: Stock IN [Emerald] vs Stock OUT [Orange]) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isStockIn ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                            Stock IN (+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-300">
                            <ArrowDownRight className="w-3 h-3 text-orange-600" />
                            Stock OUT (-)
                          </span>
                        )}
                        {adj.isPhysicalCountMode && (
                          <div className="text-[9px] text-blue-600 font-semibold mt-0.5">
                            Physical Audit
                          </div>
                        )}
                      </td>

                      {/* Quantity Delta */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            isStockIn ? 'text-emerald-700' : 'text-orange-700'
                          }`}
                        >
                          {isStockIn ? '+' : '-'}
                          {adj.quantity} {adj.unit}
                        </span>
                        {adj.normalizedQuantity !== adj.quantity && (
                          <div className="text-[10px] text-gray-400">
                            ({isStockIn ? '+' : '-'}{adj.normalizedQuantity})
                          </div>
                        )}
                      </td>

                      {/* Stock Movement: Before -> After */}
                      <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span>{adj.stockBefore}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-bold text-gray-900">{adj.stockAfter}</span>
                          <span className="text-[10px] text-gray-400">{adj.unit}</span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                          {adj.reason}
                        </span>
                      </td>

                      {/* Financial Value Impact */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            isStockIn ? 'text-emerald-700' : 'text-orange-700'
                          }`}
                        >
                          {isStockIn ? '+' : '-'}₹
                          {adj.costImpact.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </td>

                      {/* Adjusted By */}
                      <td className="py-3 px-4 whitespace-nowrap text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-gray-400" />
                          <span>{adj.performedBy}</span>
                        </div>
                      </td>

                      {/* Reference & Notes */}
                      <td className="py-3 px-4 max-w-xs">
                        {adj.reference && (
                          <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] mr-1 font-semibold">
                            {adj.reference}
                          </span>
                        )}
                        <span className="text-gray-600 truncate block text-[11px]">
                          {adj.notes || '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Reconciled
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedIngredientId(undefined);
        }}
        ingredients={ingredients}
        initialIngredientId={selectedIngredientId}
        onAdjustmentRecorded={loadAdjustments}
      />
    </div>
  );
}
