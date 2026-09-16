import React, { useState } from 'react';
import {
  Search,
  Download,
  Truck,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  Package
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  PurchaseReportRow,
  InventoryReportsService
} from '../../lib/inventoryReportsService';
import { DateRange } from '../../lib/reports';

interface PurchaseReportViewProps {
  rows: PurchaseReportRow[];
  totalSpend: number;
  supplierSpend: { supplierName: string; count: number; spend: number }[];
  dateRange: DateRange;
}

const SUPPLIER_COLORS = ['#059669', '#10B981', '#34D399', '#6EE7B7', '#047857'];

export default function PurchaseReportView({
  rows,
  totalSpend,
  supplierSpend,
  dateRange
}: PurchaseReportViewProps) {
  const [search, setSearch] = useState('');

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.invoiceNumber.toLowerCase().includes(q) ||
      r.supplierName.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q) ||
      r.paymentMethod.toLowerCase().includes(q)
    );
  });

  const handleExportCSV = () => {
    const headers = [
      'PO / Invoice #',
      'Supplier / Vendor',
      'Purchase Date',
      'Items Count',
      'Total Amount (₹)',
      'Delivery Status',
      'Payment Status',
      'Payment Mode'
    ];
    const dataRows = filtered.map((r) => [
      r.invoiceNumber,
      r.supplierName,
      r.date,
      r.itemsCount,
      r.totalAmount,
      r.status,
      r.paymentStatus,
      r.paymentMethod
    ]);
    InventoryReportsService.exportToCSV(headers, dataRows, `purchase_procurement_${dateRange.preset}.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Top Suppliers Spend Chart */}
      {supplierSpend.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>Vendor Spend Distribution</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">Top supplier procurement volume in {dateRange.label}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-stone-400">Total Procurement</span>
              <div className="text-lg font-bold font-mono text-emerald-800">
                ₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierSpend.slice(0, 8)} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="supplierName" tick={{ fill: '#6B7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Spend']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7EB',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar dataKey="spend" radius={[6, 6, 0, 0]}>
                  {supplierSpend.slice(0, 8).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={SUPPLIER_COLORS[index % SUPPLIER_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number, supplier or payment..."
            className="w-full bg-stone-50 border border-stone-200 pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-600 font-sans"
          />
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Export Purchases (.CSV)</span>
        </button>
      </div>

      {/* Purchases Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
          <Truck className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-900">No Purchase Records</h3>
          <p className="text-xs text-stone-500 mt-1">No supplier purchase orders or bills found for this period.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Invoice / PO #</th>
                  <th className="py-3 px-4">Supplier / Vendor</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4 font-bold">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-stone-900">{row.invoiceNumber}</td>
                    <td className="py-3 px-4 text-stone-800 font-medium">{row.supplierName}</td>
                    <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">{row.date}</td>
                    <td className="py-3 px-4 font-mono">{row.itemsCount} lines</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                      ₹{row.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        row.status === 'RECEIVED' || row.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-mono text-stone-600">{row.paymentStatus}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-mono uppercase text-stone-500">{row.paymentMethod}</span>
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
