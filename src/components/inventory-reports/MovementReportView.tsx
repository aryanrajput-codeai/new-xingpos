import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  TrendingDown,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import {
  MovementRow,
  InventoryReportsService
} from '../../lib/inventoryReportsService';
import { DateRange } from '../../lib/reports';

interface MovementReportViewProps {
  rows: MovementRow[];
  dateRange: DateRange;
}

export default function MovementReportView({ rows, dateRange }: MovementReportViewProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      r.ingredientName.toLowerCase().includes(q) ||
      r.categoryName.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const summary = useMemo(() => {
    let totalPurchases = 0;
    let totalAdjustmentsIn = 0;
    let totalConsumption = 0;
    let totalWastage = 0;
    let totalAdjustmentsOut = 0;

    for (const r of rows) {
      totalPurchases += (r.purchasesIn * r.unitCost);
      totalAdjustmentsIn += (r.adjustmentsIn * r.unitCost);
      totalConsumption += (r.posConsumption * r.unitCost);
      totalWastage += (r.wastageOut * r.unitCost);
      totalAdjustmentsOut += (r.adjustmentsOut * r.unitCost);
    }

    const totalInflow = totalPurchases + totalAdjustmentsIn;
    const totalOutflow = totalConsumption + totalWastage + totalAdjustmentsOut;

    return {
      totalInflow: Number(totalInflow.toFixed(2)),
      totalOutflow: Number(totalOutflow.toFixed(2)),
      netValue: Number((totalInflow - totalOutflow).toFixed(2))
    };
  }, [rows]);

  const handleExportCSV = () => {
    const headers = [
      'Ingredient Name',
      'Category',
      'Unit',
      'Opening Stock',
      'Purchases In (+)',
      'Adjustments In (+)',
      'POS Consumption (-)',
      'Wastage Out (-)',
      'Adjustments Out (-)',
      'Net Movement',
      'Closing Stock',
      'Unit Cost (₹)',
      'Movement Value (₹)'
    ];

    const dataRows = filtered.map((r) => [
      r.ingredientName,
      r.categoryName,
      r.unit,
      r.openingStock,
      r.purchasesIn,
      r.adjustmentsIn,
      r.posConsumption,
      r.wastageOut,
      r.adjustmentsOut,
      r.netMovement,
      r.closingStock,
      r.unitCost,
      r.movementValue
    ]);

    InventoryReportsService.exportToCSV(headers, dataRows, `inventory_movement_${dateRange.preset}.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Aggregate Inflow / Outflow KPI Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Total Inflow Value (+)
            </span>
            <div className="text-xl font-bold font-mono text-emerald-900 mt-0.5">
              ₹{summary.totalInflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-emerald-700 mt-1">Purchases, Adjustments In & Returns</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
              Total Outflow Value (-)
            </span>
            <div className="text-xl font-bold font-mono text-red-900 mt-0.5">
              ₹{summary.totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-red-700 mt-1">Sales Consumption, Wastage & Adjustments Out</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-red-100 text-red-800 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
              Net Stock Movement
            </span>
            <div className={`text-xl font-bold font-mono mt-0.5 ${summary.netValue >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {summary.netValue >= 0 ? '+' : ''}₹{summary.netValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-stone-500 mt-1">Net capital delta across {dateRange.label}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-stone-200 text-stone-700 flex items-center justify-center">
            <RefreshCw className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Search & Export Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter movement by ingredient or category..."
            className="w-full bg-stone-50 border border-stone-200 pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans"
          />
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-amber-600" />
          <span>Export Movement (.CSV)</span>
        </button>
      </div>

      {/* Movement Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
          <Layers className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-900">No Movement Records</h3>
          <p className="text-xs text-stone-500 mt-1">No stock movements found matching your search in this date range.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Raw Ingredient</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Opening</th>
                  <th className="py-3 px-4 text-emerald-700">Purchases (+)</th>
                  <th className="py-3 px-4 text-emerald-700">Adj In (+)</th>
                  <th className="py-3 px-4 text-blue-700">Consumption (-)</th>
                  <th className="py-3 px-4 text-red-700">Wastage (-)</th>
                  <th className="py-3 px-4 text-red-700">Adj Out (-)</th>
                  <th className="py-3 px-4">Net Change</th>
                  <th className="py-3 px-4 font-bold">Closing Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filtered.map((row) => (
                  <tr key={row.ingredientId} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-stone-900">{row.ingredientName}</td>
                    <td className="py-3 px-4 text-stone-500">{row.categoryName}</td>
                    <td className="py-3 px-4 font-mono text-stone-600">{row.openingStock} {row.unit}</td>
                    <td className="py-3 px-4 font-mono font-medium text-emerald-700">
                      {row.purchasesIn > 0 ? `+${row.purchasesIn} ${row.unit}` : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-600">
                      {row.adjustmentsIn > 0 ? `+${row.adjustmentsIn}` : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-blue-700">
                      {row.posConsumption > 0 ? `-${row.posConsumption} ${row.unit}` : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-red-700">
                      {row.wastageOut > 0 ? `-${row.wastageOut} ${row.unit}` : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-red-600">
                      {row.adjustmentsOut > 0 ? `-${row.adjustmentsOut}` : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      <span className={row.netMovement >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                        {row.netMovement >= 0 ? `+${row.netMovement}` : row.netMovement} {row.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      {row.closingStock} {row.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
