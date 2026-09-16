import React from 'react';
import {
  DollarSign,
  AlertTriangle,
  XCircle,
  TrendingDown,
  Trash2,
  Truck,
  PieChart,
  Boxes,
  ArrowUpRight,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { InventoryKpiData } from '../../lib/inventoryReportsService';

interface InventoryKpiCardsProps {
  kpi: InventoryKpiData;
  onSelectReport?: (reportId: string) => void;
}

export default function InventoryKpiCards({ kpi, onSelectReport }: InventoryKpiCardsProps) {
  // Food cost status badge
  const fc = kpi.periodFoodCostPercentage;
  let fcStatusText = 'No Sales';
  let fcStatusClass = 'bg-stone-100 text-stone-600 border-stone-200';
  if (fc !== null) {
    if (fc <= 30) {
      fcStatusText = 'Healthy (<30%)';
      fcStatusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (fc <= 36) {
      fcStatusText = 'Standard (30-36%)';
      fcStatusClass = 'bg-amber-50 text-amber-700 border-amber-200';
    } else {
      fcStatusText = 'High (>36%)';
      fcStatusClass = 'bg-red-50 text-red-700 border-red-200';
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {/* 1. Total Stock Value */}
      <div
        onClick={() => onSelectReport?.('overview')}
        className="bg-white border border-stone-200 hover:border-amber-400 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Total Stock Value
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 group-hover:scale-105 transition-transform">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-stone-900">
            ₹{kpi.totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-1">
            <Boxes className="w-3 h-3 text-stone-400" />
            <span>{kpi.totalItemsCount} Active Raw Items</span>
          </div>
        </div>
      </div>

      {/* 2. Low Stock Items */}
      <div
        onClick={() => onSelectReport?.('low_stock')}
        className="bg-white border border-stone-200 hover:border-amber-400 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Low Stock Items
          </span>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border group-hover:scale-105 transition-transform ${
            kpi.lowStockCount > 0
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-stone-50 text-stone-400 border-stone-200'
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-stone-900">
            {kpi.lowStockCount}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] mt-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
              kpi.lowStockCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {kpi.lowStockCount > 0 ? 'Reorder Needed' : 'Inventory Optimal'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Out of Stock Items */}
      <div
        onClick={() => onSelectReport?.('low_stock')}
        className="bg-white border border-stone-200 hover:border-red-300 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Out of Stock
          </span>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border group-hover:scale-105 transition-transform ${
            kpi.outOfStockCount > 0
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-stone-50 text-stone-400 border-stone-200'
          }`}>
            <XCircle className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-stone-900">
            {kpi.outOfStockCount}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] mt-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
              kpi.outOfStockCount > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {kpi.outOfStockCount > 0 ? 'Bottleneck Alert' : 'None Depleted'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Today's Consumption */}
      <div
        onClick={() => onSelectReport?.('consumption')}
        className="bg-white border border-stone-200 hover:border-blue-400 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Today&apos;s Consumption
          </span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 group-hover:scale-105 transition-transform">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-stone-900">
            ₹{kpi.todayConsumptionCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-1">
            <span>{kpi.todayConsumptionEvents} Order Deductions</span>
          </div>
        </div>
      </div>

      {/* 5. Today's Wastage */}
      <div
        onClick={() => onSelectReport?.('wastage')}
        className="bg-white border border-stone-200 hover:border-red-400 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Today&apos;s Wastage
          </span>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border group-hover:scale-105 transition-transform ${
            kpi.todayWastageCost > 0
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-stone-50 text-stone-400 border-stone-200'
          }`}>
            <Trash2 className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-stone-900">
            ₹{kpi.todayWastageCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-1">
            <span>{kpi.todayWastageEvents} Spoilage Events</span>
          </div>
        </div>
      </div>

      {/* 6. Today's Purchases */}
      <div
        onClick={() => onSelectReport?.('purchases')}
        className="bg-white border border-stone-200 hover:border-emerald-400 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Today&apos;s Purchases
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 group-hover:scale-105 transition-transform">
            <Truck className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-stone-900">
            ₹{kpi.todayPurchasesSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-1">
            <span>{kpi.todayPurchasesCount} Procurement Shipments</span>
          </div>
        </div>
      </div>

      {/* 7. Period Food Cost % */}
      <div
        onClick={() => onSelectReport?.('food_cost')}
        className="bg-white border border-stone-200 hover:border-purple-400 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Food Cost
          </span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 group-hover:scale-105 transition-transform">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-stone-900">
            {fc !== null ? `${fc}%` : 'N/A'}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] mt-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${fcStatusClass}`}>
              {fcStatusText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
