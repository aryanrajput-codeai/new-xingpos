// ====================================================================
// WEBRAJYA POS - WASTAGE MANAGEMENT VIEW (PHASE 6)
// ====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  User,
  FileText,
  Clock,
  ArrowDownRight,
  TrendingDown,
  CheckCircle2,
  X
} from 'lucide-react';
import { Ingredient, WastageRecord, WastageReason } from '../types/inventory';
import { WastageService } from '../lib/wastageService';
import { RBACService } from '../lib/rbac';
import AddWastageModal from './AddWastageModal';

const REASON_COLORS: Record<string, string> = {
  Spoiled: 'bg-red-50 text-red-700 border-red-200',
  Expired: 'bg-orange-50 text-orange-700 border-orange-200',
  Damaged: 'bg-amber-50 text-amber-700 border-amber-200',
  Spillage: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  Burnt: 'bg-stone-100 text-stone-800 border-stone-300',
  'Over-preparation': 'bg-purple-50 text-purple-700 border-purple-200',
  Lost: 'bg-rose-50 text-rose-700 border-rose-200',
  Other: 'bg-gray-50 text-gray-700 border-gray-200',
  SPOILAGE: 'bg-red-50 text-red-700 border-red-200',
  PREPARATION_ERROR: 'bg-purple-50 text-purple-700 border-purple-200',
  EQUIPMENT_FAILURE: 'bg-orange-50 text-orange-700 border-orange-200',
  RETURN_FROM_CUSTOMER: 'bg-blue-50 text-blue-700 border-blue-200'
};

interface WastageManagementViewProps {
  ingredients: Ingredient[];
  onWastageUpdated?: () => void;
}

export default function WastageManagementView({
  ingredients,
  onWastageUpdated
}: WastageManagementViewProps) {
  const [wastageRecords, setWastageRecords] = useState<WastageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | undefined>();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReason, setSelectedReason] = useState<string>('ALL');
  const [selectedIngredientFilter, setSelectedIngredientFilter] = useState<string>('ALL');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  const canManage = RBACService.hasPermission('inventory.manage');

  const loadWastageData = async () => {
    setIsLoading(true);
    try {
      const records = await WastageService.getWastageRecords();
      setWastageRecords(records);
    } catch (err) {
      console.error('Failed to load wastage records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWastageData();

    const handleUpdate = () => {
      loadWastageData();
      onWastageUpdated?.();
    };

    window.addEventListener('inventory_wastage_updated', handleUpdate);
    window.addEventListener('ingredients_updated', handleUpdate);
    return () => {
      window.removeEventListener('inventory_wastage_updated', handleUpdate);
      window.removeEventListener('ingredients_updated', handleUpdate);
    };
  }, []);

  // Distinct staff members from records
  const staffMembers = useMemo(() => {
    const set = new Set<string>();
    wastageRecords.forEach((r) => {
      if (r.reportedBy) set.add(r.reportedBy);
    });
    return Array.from(set);
  }, [wastageRecords]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return wastageRecords.filter((rec) => {
      // Search
      const matchesSearch =
        searchQuery.trim() === '' ||
        rec.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.reference && rec.reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (rec.notes && rec.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        rec.reportedBy.toLowerCase().includes(searchQuery.toLowerCase());

      // Reason
      const matchesReason = selectedReason === 'ALL' || rec.reason === selectedReason;

      // Ingredient
      const matchesIngredient =
        selectedIngredientFilter === 'ALL' || rec.ingredientId === selectedIngredientFilter;

      // Staff
      const matchesStaff = selectedStaffFilter === 'ALL' || rec.reportedBy === selectedStaffFilter;

      // Date
      let matchesDate = true;
      const recTime = new Date(rec.recordedAt).getTime();
      if (selectedDateRange === 'TODAY') {
        matchesDate = recTime >= startOfToday;
      } else if (selectedDateRange === 'WEEK') {
        matchesDate = recTime >= sevenDaysAgo;
      } else if (selectedDateRange === 'MONTH') {
        matchesDate = recTime >= thirtyDaysAgo;
      }

      return matchesSearch && matchesReason && matchesIngredient && matchesStaff && matchesDate;
    });
  }, [
    wastageRecords,
    searchQuery,
    selectedReason,
    selectedIngredientFilter,
    selectedStaffFilter,
    selectedDateRange
  ]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalLoss = 0;
    const reasonCounts: Record<string, number> = {};
    const ingredientLossMap: Record<string, { name: string; loss: number }> = {};

    wastageRecords.forEach((r) => {
      totalLoss += r.totalLoss;
      reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
      if (!ingredientLossMap[r.ingredientId]) {
        ingredientLossMap[r.ingredientId] = { name: r.ingredientName, loss: 0 };
      }
      ingredientLossMap[r.ingredientId].loss += r.totalLoss;
    });

    // Top reason
    let topReason = 'None';
    let maxReasonCount = 0;
    Object.entries(reasonCounts).forEach(([r, count]) => {
      if (count > maxReasonCount) {
        maxReasonCount = count;
        topReason = r;
      }
    });

    // Top wasted ingredient
    let topIngredient = 'None';
    let maxIngLoss = 0;
    Object.values(ingredientLossMap).forEach((item) => {
      if (item.loss > maxIngLoss) {
        maxIngLoss = item.loss;
        topIngredient = item.name;
      }
    });

    return {
      totalIncidents: wastageRecords.length,
      totalLoss,
      topReason,
      topIngredient
    };
  }, [wastageRecords]);

  return (
    <div className="space-y-4">
      {/* Header & Metric Cards */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-mono">
                Kitchen Wastage Management
              </h2>
              <p className="text-xs text-gray-500">
                Monitor spoilage, expiry, prep losses, and inventory write-offs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadWastageData}
              title="Refresh logs"
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {canManage && (
              <button
                onClick={() => {
                  setSelectedIngredientId(undefined);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record Wastage</span>
              </button>
            )}
          </div>
        </div>

        {/* Aggregate Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="p-3.5 bg-red-50/60 border border-red-200/60 rounded-xl">
            <div className="flex items-center justify-between text-red-700 text-xs font-medium">
              <span>Total Wastage Loss</span>
              <DollarSign className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-xl font-bold text-red-900 mt-1 font-mono">
              ₹{metrics.totalLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-red-700 mt-0.5">Cumulative write-off cost</div>
          </div>

          <div className="p-3.5 bg-gray-50 border border-gray-200/70 rounded-xl">
            <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
              <span>Total Incidents</span>
              <FileText className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-900 mt-1 font-mono">
              {metrics.totalIncidents}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Recorded log entries</div>
          </div>

          <div className="p-3.5 bg-amber-50/60 border border-amber-200/60 rounded-xl">
            <div className="flex items-center justify-between text-amber-800 text-xs font-medium">
              <span>Primary Reason</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-base font-bold text-amber-950 mt-1 truncate">
              {metrics.topReason}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">Highest occurrence cause</div>
          </div>

          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl">
            <div className="flex items-center justify-between text-stone-600 text-xs font-medium">
              <span>Top Loss Item</span>
              <TrendingDown className="w-4 h-4 text-stone-500" />
            </div>
            <div className="text-base font-bold text-stone-900 mt-1 truncate">
              {metrics.topIngredient}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">Highest financial impact</div>
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
            className="w-full pl-9.5 pr-4 py-2 text-xs sm:text-sm bg-gray-50 hover:bg-gray-100/70 focus:bg-white border border-gray-200 focus:border-red-500 rounded-xl outline-none transition-all placeholder:text-gray-400 text-gray-800 font-mono"
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
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-gray-800 focus:ring-0 outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Reasons</option>
              <option value="Spoiled">Spoiled</option>
              <option value="Expired">Expired</option>
              <option value="Damaged">Damaged</option>
              <option value="Spillage">Spillage</option>
              <option value="Burnt">Burnt</option>
              <option value="Over-preparation">Over-preparation</option>
              <option value="Lost">Lost</option>
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

      {/* Wastage Table (Section 19 requirements) */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-gray-500 font-mono">
            <RefreshCw className="w-6 h-6 text-red-500 animate-spin mx-auto mb-2" />
            Loading wastage audit log...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-gray-500 px-4">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-3 text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 font-mono">No Wastage Records Found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {searchQuery || selectedReason !== 'ALL' || selectedIngredientFilter !== 'ALL'
                ? 'No wastage entries match the current filter selection.'
                : 'No inventory wastage has been logged yet for this business.'}
            </p>
            {canManage && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Log First Wastage Entry
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
                  <th className="py-3 px-4 font-semibold">Wasted Quantity</th>
                  <th className="py-3 px-4 font-semibold">Stock Impact</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold">Wastage Value</th>
                  <th className="py-3 px-4 font-semibold">Reported By</th>
                  <th className="py-3 px-4 font-semibold">Reference & Notes</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((rec) => {
                  const badgeClass =
                    REASON_COLORS[rec.reason as WastageReason] || 'bg-gray-50 text-gray-700 border-gray-200';

                  return (
                    <tr key={rec.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        <div className="font-semibold text-gray-800">
                          {new Date(rec.recordedAt).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(rec.recordedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Ingredient */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{rec.ingredientName}</div>
                        <div className="text-[10px] text-gray-400">Rate: ₹{rec.costPerUnit}/{rec.unit}</div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-red-700">
                          -{rec.quantity} {rec.unit}
                        </span>
                        {rec.normalizedQuantity !== rec.quantity && (
                          <div className="text-[10px] text-gray-400">
                            (-{rec.normalizedQuantity})
                          </div>
                        )}
                      </td>

                      {/* Stock Impact */}
                      <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span>{rec.stockBefore}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-bold text-gray-900">{rec.stockAfter}</span>
                          <span className="text-[10px] text-gray-400">{rec.unit}</span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                        >
                          {rec.reason}
                        </span>
                      </td>

                      {/* Wastage Value */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-red-700">
                          ₹{rec.totalLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Reported By */}
                      <td className="py-3 px-4 whitespace-nowrap text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-gray-400" />
                          <span>{rec.reportedBy}</span>
                        </div>
                      </td>

                      {/* Reference & Notes */}
                      <td className="py-3 px-4 max-w-xs">
                        {rec.reference && (
                          <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] mr-1.5 font-semibold">
                            {rec.reference}
                          </span>
                        )}
                        <span className="text-gray-600 truncate block text-[11px]">
                          {rec.notes || '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Posted
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

      {/* Add Wastage Modal */}
      <AddWastageModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedIngredientId(undefined);
        }}
        ingredients={ingredients}
        initialIngredientId={selectedIngredientId}
        onWastageRecorded={loadWastageData}
      />
    </div>
  );
}
