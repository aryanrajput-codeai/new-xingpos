import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Package,
  Layers,
  ArrowUpDown,
  ShoppingBag
} from 'lucide-react';
import {
  StockOverviewRow,
  LowStockRow,
  InventoryReportsService
} from '../../lib/inventoryReportsService';

interface StockOverviewReportViewProps {
  overviewRows: StockOverviewRow[];
  lowStockRows: LowStockRow[];
  categories: { id: string; name: string }[];
  isLowStockOnly?: boolean;
}

export default function StockOverviewReportView({
  overviewRows,
  lowStockRows,
  categories,
  isLowStockOnly = false
}: StockOverviewReportViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortField, setSortField] = useState<'name' | 'currentStock' | 'costPerUnit' | 'stockValue'>('stockValue');
  const [sortAsc, setSortAsc] = useState(false);

  // If viewing low stock only, calculate total estimated restock capital
  const totalRestockCapital = useMemo(() => {
    return lowStockRows.reduce((sum, r) => sum + r.estimatedRestockCost, 0);
  }, [lowStockRows]);

  const filteredOverview = useMemo(() => {
    const q = search.toLowerCase().trim();
    return overviewRows.filter((r) => {
      if (selectedCat !== 'ALL' && r.categoryName !== selectedCat) return false;
      if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
      if (q) {
        const matchName = r.name.toLowerCase().includes(q);
        const matchCode = r.itemCode?.toLowerCase().includes(q);
        const matchCat = r.categoryName.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat) return false;
      }
      return true;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? (valA as string).localeCompare(valB as string) : (valB as string).localeCompare(valA as string);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [overviewRows, search, selectedCat, selectedStatus, sortField, sortAsc]);

  const filteredLowStock = useMemo(() => {
    const q = search.toLowerCase().trim();
    return lowStockRows.filter((r) => {
      if (selectedCat !== 'ALL' && r.categoryName !== selectedCat) return false;
      if (q) {
        const matchName = r.name.toLowerCase().includes(q);
        const matchCode = r.itemCode?.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [lowStockRows, search, selectedCat]);

  const handleExportCSV = () => {
    if (isLowStockOnly) {
      const headers = [
        'Item Code',
        'Ingredient Name',
        'Category',
        'Current Stock',
        'Unit',
        'Min Alert Level',
        'Deficit Quantity',
        'Reorder Quantity',
        'Unit Cost (₹)',
        'Est. Restock Cost (₹)',
        'Status'
      ];
      const rows = filteredLowStock.map((r) => [
        r.itemCode || 'N/A',
        r.name,
        r.categoryName,
        r.currentStock,
        r.unit,
        r.minAlertLevel,
        r.deficit,
        r.reorderQuantity,
        r.costPerUnit,
        r.estimatedRestockCost,
        r.status
      ]);
      InventoryReportsService.exportToCSV(headers, rows, 'low_stock_reorder_report.csv');
    } else {
      const headers = [
        'Item Code',
        'Ingredient Name',
        'Category',
        'Storage Type',
        'Current Stock',
        'Unit',
        'Min Alert Level',
        'Cost Per Unit (₹)',
        'Total Stock Value (₹)',
        'Status',
        'Active'
      ];
      const rows = filteredOverview.map((r) => [
        r.itemCode || 'N/A',
        r.name,
        r.categoryName,
        r.storageType,
        r.currentStock,
        r.unit,
        r.minAlertLevel,
        r.costPerUnit,
        r.stockValue,
        r.status,
        r.isActive ? 'YES' : 'NO'
      ]);
      InventoryReportsService.exportToCSV(headers, rows, 'stock_overview_report.csv');
    }
  };

  return (
    <div className="space-y-4">
      {/* Low Stock Reorder Banner if in Low Stock Mode */}
      {isLowStockOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Low Stock & Reorder Alert
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                {lowStockRows.length} raw ingredients require restocking. Total estimated capital required to replenish:
                <strong className="font-mono text-amber-900 ml-1">
                  ₹{totalRestockCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-xl transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export Reorder List (.CSV)</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ingredient by name or code..."
              className="w-full bg-stone-50 border border-stone-200 pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans"
            />
          </div>

          <div className="relative">
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="bg-stone-50 border border-stone-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans text-stone-700"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {!isLowStockOnly && (
            <div className="relative hidden md:block">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-stone-50 border border-stone-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans text-stone-700"
              >
                <option value="ALL">All Status</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isLowStockOnly && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      {isLowStockOnly ? (
        filteredLowStock.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-stone-900">Inventory Well Stocked</h3>
            <p className="text-xs text-stone-500 mt-1">No ingredients are currently at or below minimum reorder thresholds.</p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Ingredient & Code</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Current Stock</th>
                    <th className="py-3 px-4">Reorder Level</th>
                    <th className="py-3 px-4">Deficit</th>
                    <th className="py-3 px-4">Reorder Qty</th>
                    <th className="py-3 px-4">Cost / Unit</th>
                    <th className="py-3 px-4">Est. Restock Cost</th>
                    <th className="py-3 px-4">Urgency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {filteredLowStock.map((row) => (
                    <tr key={row.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-stone-900">
                        {row.name}
                        {row.itemCode && (
                          <span className="block text-[10px] font-mono text-stone-400 mt-0.5">{row.itemCode}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-600">{row.categoryName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-red-700">
                        {row.currentStock} {row.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {row.minAlertLevel} {row.unit}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-700">
                        {row.deficit > 0 ? `-${row.deficit} ${row.unit}` : '0'}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {row.reorderQuantity} {row.unit}
                      </td>
                      <td className="py-3 px-4 font-mono">₹{row.costPerUnit}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-900">
                        ₹{row.estimatedRestockCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          row.status === 'OUT_OF_STOCK'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {row.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Standard Stock Overview Table */
        filteredOverview.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <Package className="w-10 h-10 text-stone-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-stone-900">No Ingredients Match Filters</h3>
            <p className="text-xs text-stone-500 mt-1">Try adjusting your search query or selecting &quot;All Categories&quot;.</p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortField('name'); setSortAsc(!sortAsc); }}>
                      <div className="flex items-center gap-1.5">
                        <span>Ingredient</span>
                        <ArrowUpDown className="w-3 h-3 text-stone-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Storage</th>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortField('currentStock'); setSortAsc(!sortAsc); }}>
                      <div className="flex items-center gap-1.5">
                        <span>Current Stock</span>
                        <ArrowUpDown className="w-3 h-3 text-stone-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Min Reorder</th>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortField('costPerUnit'); setSortAsc(!sortAsc); }}>
                      <div className="flex items-center gap-1.5">
                        <span>Cost / Unit</span>
                        <ArrowUpDown className="w-3 h-3 text-stone-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortField('stockValue'); setSortAsc(!sortAsc); }}>
                      <div className="flex items-center gap-1.5">
                        <span>Total Stock Value</span>
                        <ArrowUpDown className="w-3 h-3 text-stone-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {filteredOverview.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-stone-900">
                        {row.name}
                        {row.itemCode && (
                          <span className="block text-[10px] font-mono text-stone-400">{row.itemCode}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-600">{row.categoryName}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[10px] font-mono">
                          {row.storageType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">
                        {row.currentStock} {row.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-500">
                        {row.minAlertLevel} {row.unit}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        ₹{row.costPerUnit} / {row.unit}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-900">
                        ₹{row.stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          row.status === 'OUT_OF_STOCK'
                            ? 'bg-red-100 text-red-800'
                            : row.status === 'LOW_STOCK'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {row.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
