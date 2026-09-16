import React, { useState } from 'react';
import {
  Search,
  Download,
  Trash2,
  PieChart as PieIcon,
  AlertCircle,
  Filter,
  User,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';
import {
  WastageReportRow,
  InventoryReportsService
} from '../../lib/inventoryReportsService';
import { DateRange } from '../../lib/reports';

interface WastageReportViewProps {
  rows: WastageReportRow[];
  totalLoss: number;
  reasonBreakdown: { reason: string; count: number; cost: number; percent: number }[];
  dateRange: DateRange;
}

const PIE_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#06B6D4', '#8B5CF6'
];

export default function WastageReportView({
  rows,
  totalLoss,
  reasonBreakdown,
  dateRange
}: WastageReportViewProps) {
  const [search, setSearch] = useState('');
  const [selectedReason, setSelectedReason] = useState('ALL');

  const filtered = rows.filter((r) => {
    if (selectedReason !== 'ALL' && r.reason.toUpperCase() !== selectedReason.toUpperCase()) {
      return false;
    }
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.ingredientName.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      r.reportedBy.toLowerCase().includes(q) ||
      (r.notes && r.notes.toLowerCase().includes(q))
    );
  });

  const handleExportCSV = () => {
    const headers = [
      'Date & Time',
      'Ingredient Name',
      'Wastage Reason',
      'Quantity Lost',
      'Unit',
      'Unit Cost (₹)',
      'Total Financial Loss (₹)',
      'Reported By',
      'Notes'
    ];
    const dataRows = filtered.map((r) => [
      r.date,
      r.ingredientName,
      r.reason,
      r.quantity,
      r.unit,
      r.costPerUnit,
      r.totalLoss,
      r.reportedBy,
      r.notes || ''
    ]);
    InventoryReportsService.exportToCSV(headers, dataRows, `wastage_loss_report_${dateRange.preset}.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Visual Reason Breakdown Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Pie Chart of Spoilage Reasons */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>Wastage Loss Breakdown by Reason</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">Identified root causes of inventory shrinkage in {dateRange.label}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-stone-400">Total Loss (₹)</span>
              <div className="text-lg font-bold font-mono text-red-700">
                ₹{totalLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {reasonBreakdown.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 pt-4">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reasonBreakdown}
                      dataKey="cost"
                      nameKey="reason"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {reasonBreakdown.map((_, index) => (
                        <Cell key={`pie-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Loss']}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E7EB',
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {reasonBreakdown.map((rb, idx) => (
                  <div key={rb.reason} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-stone-50">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="font-semibold text-stone-800">{rb.reason}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-stone-500">{rb.count} logs</span>
                      <span className="font-mono font-bold text-stone-900">₹{rb.cost}</span>
                      <span className="font-mono text-[10px] text-stone-400 w-10 text-right">{rb.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-stone-400">
              No wastage events recorded in this period.
            </div>
          )}
        </div>

        {/* Right Col: Waste Prevention Summary */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-stone-700 font-bold text-xs uppercase tracking-wider mb-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Shrinkage Control</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Tracking wastage enables strict kitchen portioning, freshness verification, and reduced preparation spoilage across shifts.
            </p>

            <div className="mt-4 space-y-2 pt-3 border-t border-stone-200">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500">Recorded Incidents:</span>
                <span className="font-mono font-bold text-stone-900">{rows.length} logs</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500">Primary Cause:</span>
                <span className="font-bold text-red-700">{reasonBreakdown[0]?.reason || 'None'}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-stone-200 text-[11px] text-stone-500">
            All wastage records are permanently logged in the immutable stock ledger.
          </div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ingredient, reported by, or notes..."
              className="w-full bg-stone-50 border border-stone-200 pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans"
            />
          </div>

          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="bg-stone-50 border border-stone-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans text-stone-700"
          >
            <option value="ALL">All Reasons</option>
            <option value="EXPIRED">Expired</option>
            <option value="SPOILED">Spoiled</option>
            <option value="PREPARATION_WASTE">Preparation Waste</option>
            <option value="BURNT_DROPPED">Burnt / Dropped</option>
            <option value="CONTAMINATED">Contaminated</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-amber-600" />
          <span>Export Wastage (.CSV)</span>
        </button>
      </div>

      {/* Wastage Records Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
          <Trash2 className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-900">No Wastage Records</h3>
          <p className="text-xs text-stone-500 mt-1">No recorded wastage entries match this search and date criteria.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Raw Ingredient</th>
                  <th className="py-3 px-4">Wastage Reason</th>
                  <th className="py-3 px-4">Quantity Lost</th>
                  <th className="py-3 px-4">Unit Cost</th>
                  <th className="py-3 px-4 font-bold text-red-700">Total Loss</th>
                  <th className="py-3 px-4">Reported By</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-red-50/20 transition-colors">
                    <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">{row.date}</td>
                    <td className="py-3 px-4 font-semibold text-stone-900">{row.ingredientName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-stone-100 text-stone-700">
                        {row.reason}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-stone-800">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-500">₹{row.costPerUnit}</td>
                    <td className="py-3 px-4 font-mono font-bold text-red-700">
                      ₹{row.totalLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-stone-600">{row.reportedBy}</td>
                    <td className="py-3 px-4 text-stone-400 italic max-w-xs truncate">{row.notes || '-'}</td>
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
