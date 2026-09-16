import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  HelpCircle
} from 'lucide-react';
import {
  StockIntegrityRow,
  InventoryReportsService
} from '../../lib/inventoryReportsService';

interface StockIntegrityReportViewProps {
  integrityData: {
    rows: StockIntegrityRow[];
    totalAudited: number;
    consistentCount: number;
    discrepancyCount: number;
    integrityPercentage: number;
  };
  onRefreshAudit: () => Promise<void>;
  isLoading?: boolean;
}

export default function StockIntegrityReportView({
  integrityData,
  onRefreshAudit,
  isLoading = false
}: StockIntegrityReportViewProps) {
  const [search, setSearch] = useState('');
  const [filterDiscrepanciesOnly, setFilterDiscrepanciesOnly] = useState(false);

  const filtered = integrityData.rows.filter((r) => {
    if (filterDiscrepanciesOnly && r.isConsistent) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return r.ingredientName.toLowerCase().includes(q);
  });

  const handleExportCSV = () => {
    const headers = [
      'Ingredient Name',
      'Unit',
      'Current Stock',
      'Calculated Stock from Ledger',
      'Drift Delta',
      'Is Consistent',
      'Opening Stock',
      'Purchases (+)',
      'Adjustments In (+)',
      'Returns (+)',
      'Sale Consumption (-)',
      'Wastage (-)',
      'Adjustments Out (-)',
      'Total Transactions'
    ];

    const dataRows = filtered.map((r) => [
      r.ingredientName,
      r.unit,
      r.currentStock,
      r.calculatedStock,
      r.drift,
      r.isConsistent ? 'YES' : 'NO',
      r.breakdown.openingStock,
      r.breakdown.purchases,
      r.breakdown.adjustmentsIn,
      r.breakdown.returns,
      r.breakdown.saleConsumption,
      r.breakdown.wastage,
      r.breakdown.adjustmentsOut,
      r.transactionCount
    ]);

    InventoryReportsService.exportToCSV(headers, dataRows, 'mathematical_stock_integrity_audit.csv');
  };

  return (
    <div className="space-y-4">
      {/* Integrity Summary Header Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Total Ingredients Audited
          </span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            {integrityData.totalAudited} Raw Items
          </div>
          <p className="text-[10px] text-stone-400 mt-1">100% coverage of active stock</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Mathematically Verified
          </span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{integrityData.consistentCount} Consistent</span>
          </div>
          <p className="text-[10px] text-emerald-600 mt-1">Formula matches cached balance</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Discrepancies / Drift
          </span>
          <div className={`text-xl font-bold font-mono mt-1 flex items-center gap-2 ${
            integrityData.discrepancyCount > 0 ? 'text-red-700' : 'text-stone-400'
          }`}>
            {integrityData.discrepancyCount > 0 ? (
              <>
                <AlertTriangle className="w-5 h-5" />
                <span>{integrityData.discrepancyCount} Drift Found</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>0 Drift</span>
              </>
            )}
          </div>
          <p className="text-[10px] text-stone-400 mt-1">Drift threshold &gt; 0.0001</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            System Integrity Score
          </span>
          <div>
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${
              integrityData.integrityPercentage === 100
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {integrityData.integrityPercentage}% ACCURACY
            </span>
          </div>
          <p className="text-[10px] text-stone-400 mt-1">Immutable ledger verification</p>
        </div>
      </div>

      {/* Explanatory Formula Callout */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-600">
        <div className="flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-stone-800">Mathematical Stock Invariant Formula:</span>
            <p className="font-mono text-[11px] text-stone-600 mt-0.5">
              Calculated = Opening + (Purchases + Adjustments In + Returns) - (Consumption + Wastage + Adjustments Out)
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshAudit}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Auditing Ledger...' : 'Run Audit Verification'}</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ingredient to audit..."
              className="w-full bg-stone-50 border border-stone-200 pl-9 pr-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterDiscrepanciesOnly}
              onChange={(e) => setFilterDiscrepanciesOnly(e.target.checked)}
              className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <span>Show Discrepancies Only</span>
          </label>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-amber-600" />
          <span>Export Audit (.CSV)</span>
        </button>
      </div>

      {/* Integrity Audit Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-900">All Audited Items Are Consistent</h3>
          <p className="text-xs text-stone-500 mt-1">Zero discrepancies found matching your filter.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Ingredient</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">Calculated Stock</th>
                  <th className="py-3 px-4">Drift Delta</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Opening</th>
                  <th className="py-3 px-4 text-emerald-700">Inflows (+)</th>
                  <th className="py-3 px-4 text-red-700">Outflows (-)</th>
                  <th className="py-3 px-4">Ledger Tx Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filtered.map((row) => {
                  const inflows = row.breakdown.purchases + row.breakdown.adjustmentsIn + row.breakdown.returns;
                  const outflows = row.breakdown.saleConsumption + row.breakdown.wastage + row.breakdown.adjustmentsOut;

                  return (
                    <tr key={row.ingredientId} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-stone-900">{row.ingredientName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">
                        {row.currentStock} {row.unit}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-800">
                        {row.calculatedStock} {row.unit}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {row.drift > 0.0001 ? (
                          <span className="text-red-700">Δ {row.drift.toFixed(3)}</span>
                        ) : (
                          <span className="text-emerald-700 font-normal">0.000</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {row.isConsistent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>100% MATCH</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3" />
                            <span>DISCREPANCY</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-500">{row.breakdown.openingStock}</td>
                      <td className="py-3 px-4 font-mono text-emerald-700">+{inflows}</td>
                      <td className="py-3 px-4 font-mono text-red-700">-{outflows}</td>
                      <td className="py-3 px-4 font-mono text-stone-600">{row.transactionCount} events</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
