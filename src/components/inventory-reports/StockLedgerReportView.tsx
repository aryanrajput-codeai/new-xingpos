import React, { useState } from 'react';
import {
  Search,
  Download,
  BookOpen,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  User,
  ShieldCheck
} from 'lucide-react';
import {
  InventoryTransaction,
  Ingredient
} from '../../types/inventory';
import {
  InventoryReportsService
} from '../../lib/inventoryReportsService';
import { DateRange } from '../../lib/reports';

interface StockLedgerReportViewProps {
  transactions: InventoryTransaction[];
  ingredients: Ingredient[];
  dateRange: DateRange;
}

export default function StockLedgerReportView({
  transactions,
  ingredients,
  dateRange
}: StockLedgerReportViewProps) {
  const [search, setSearch] = useState('');
  const [selectedTxType, setSelectedTxType] = useState('ALL');
  const [selectedIngId, setSelectedIngId] = useState('ALL');

  const filtered = InventoryReportsService.computeStockLedger(
    transactions,
    ingredients,
    {
      ingredientId: selectedIngId !== 'ALL' ? selectedIngId : undefined,
      transactionType: selectedTxType !== 'ALL' ? selectedTxType : undefined,
      dateRange,
      searchQuery: search
    }
  );

  const handleExportCSV = () => {
    const headers = [
      'Date & Time',
      'Transaction ID',
      'Ingredient Name',
      'Transaction Type',
      'Quantity Delta',
      'Unit',
      'Unit Cost (₹)',
      'Total Cost (₹)',
      'Balance Before',
      'Balance After',
      'Performed By',
      'Reference ID / Source',
      'Notes'
    ];

    const dataRows = filtered.map((tx) => [
      new Date(tx.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      tx.id,
      tx.ingredient?.name || 'Ingredient',
      tx.transactionType,
      tx.quantity,
      tx.unit,
      tx.unitCost,
      tx.totalCost || (tx.quantity * tx.unitCost),
      tx.stockBefore,
      tx.stockAfter,
      tx.performedBy || 'System',
      tx.referenceId || '',
      tx.notes || ''
    ]);

    InventoryReportsService.exportToCSV(headers, dataRows, `authoritative_stock_ledger_${dateRange.preset}.csv`);
  };

  const getTxBadge = (type: string) => {
    switch (type) {
      case 'OPENING_STOCK':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-stone-100 text-stone-700">OPENING</span>;
      case 'PURCHASE':
      case 'PURCHASE_RECEIPT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">PURCHASE (+)</span>;
      case 'SALE_CONSUMPTION':
      case 'ORDER_CONSUMPTION':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-100 text-blue-800">CONSUMPTION (-)</span>;
      case 'WASTAGE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-red-100 text-red-800">WASTAGE (-)</span>;
      case 'ADJUSTMENT_IN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-teal-100 text-teal-800">ADJ IN (+)</span>;
      case 'ADJUSTMENT_OUT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-100 text-rose-800">ADJ OUT (-)</span>;
      case 'SALE_REVERSAL':
      case 'ORDER_RESTORE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-indigo-100 text-indigo-800">REVERSAL (+)</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-stone-100 text-stone-700">{type}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Ledger Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ledger by notes, ref, user..."
              className="w-full bg-stone-50 border border-stone-200 pl-9 pr-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans"
            />
          </div>

          <select
            value={selectedTxType}
            onChange={(e) => setSelectedTxType(e.target.value)}
            className="bg-stone-50 border border-stone-200 px-3 py-1.5 text-xs rounded-xl focus:outline-none font-sans text-stone-700"
          >
            <option value="ALL">All Transaction Types</option>
            <option value="PURCHASE">Purchases (+)</option>
            <option value="SALE_CONSUMPTION">Order Consumption (-)</option>
            <option value="WASTAGE">Wastage (-)</option>
            <option value="ADJUSTMENT_IN">Adjustment In (+)</option>
            <option value="ADJUSTMENT_OUT">Adjustment Out (-)</option>
            <option value="OPENING_STOCK">Opening Stock</option>
            <option value="SALE_REVERSAL">Sale Reversal (+)</option>
          </select>

          <select
            value={selectedIngId}
            onChange={(e) => setSelectedIngId(e.target.value)}
            className="bg-stone-50 border border-stone-200 px-3 py-1.5 text-xs rounded-xl focus:outline-none font-sans text-stone-700 max-w-xs truncate"
          >
            <option value="ALL">All Raw Ingredients</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>{ing.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>Export Ledger (.CSV)</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-900">No Ledger Entries Found</h3>
          <p className="text-xs text-stone-500 mt-1">No transaction events match this search, type, and date filter.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Raw Ingredient</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Unit Cost</th>
                  <th className="py-3 px-4">Total Value</th>
                  <th className="py-3 px-4">Stock Before</th>
                  <th className="py-3 px-4 font-bold text-stone-900">Stock After</th>
                  <th className="py-3 px-4">Source / Ref</th>
                  <th className="py-3 px-4">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-4 text-stone-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900">{tx.ingredient?.name || 'Raw Item'}</td>
                    <td className="py-3 px-4">{getTxBadge(tx.transactionType)}</td>
                    <td className="py-3 px-4 font-mono font-medium">
                      <span className={tx.stockAfter >= tx.stockBefore ? 'text-emerald-700' : 'text-red-700'}>
                        {tx.stockAfter >= tx.stockBefore ? '+' : '-'}{tx.quantity} {tx.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-500">₹{tx.unitCost}</td>
                    <td className="py-3 px-4 font-mono font-bold text-stone-800">
                      ₹{tx.totalCost ? Number(tx.totalCost).toFixed(2) : (tx.quantity * tx.unitCost).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-400">{tx.stockBefore}</td>
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">{tx.stockAfter}</td>
                    <td className="py-3 px-4 text-stone-600 font-mono text-[11px] truncate max-w-[140px]" title={tx.referenceId || tx.notes || ''}>
                      {tx.referenceId || tx.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-stone-500">{tx.performedBy || 'System'}</td>
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
