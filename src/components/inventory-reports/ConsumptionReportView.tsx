import React, { useState } from 'react';
import {
  Search,
  Download,
  Utensils,
  TrendingDown,
  BarChart3,
  Layers,
  Award
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
  ConsumptionDetailRow,
  TopConsumedRow,
  InventoryReportsService
} from '../../lib/inventoryReportsService';
import { DateRange } from '../../lib/reports';

interface ConsumptionReportViewProps {
  consumptionRows: ConsumptionDetailRow[];
  topConsumedRows: TopConsumedRow[];
  dateRange: DateRange;
}

const BAR_COLORS = [
  '#C67C4E', '#E09F67', '#D97706', '#F59E0B', '#B45309',
  '#92400E', '#78350F', '#451A03', '#CA8A04', '#A16207'
];

export default function ConsumptionReportView({
  consumptionRows,
  topConsumedRows,
  dateRange
}: ConsumptionReportViewProps) {
  const [activeSubView, setActiveSubView] = useState<'top_ranking' | 'detailed_log'>('top_ranking');
  const [search, setSearch] = useState('');

  const filteredDetailed = consumptionRows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.ingredientName.toLowerCase().includes(q) ||
      r.menuItemName.toLowerCase().includes(q) ||
      r.orderId.toLowerCase().includes(q)
    );
  });

  const filteredTop = topConsumedRows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.ingredientName.toLowerCase().includes(q) ||
      r.categoryName.toLowerCase().includes(q)
    );
  });

  const chartData = topConsumedRows.slice(0, 10).map((r) => ({
    name: r.ingredientName.length > 14 ? r.ingredientName.slice(0, 12) + '...' : r.ingredientName,
    fullName: r.ingredientName,
    cost: r.totalCost,
    quantity: r.totalQuantity,
    unit: r.unit
  }));

  const handleExportCSV = () => {
    if (activeSubView === 'top_ranking') {
      const headers = [
        'Rank',
        'Ingredient Name',
        'Category',
        'Total Quantity Consumed',
        'Unit',
        'Total Cost (₹)',
        'Order Events',
        'Share of Food Cost (%)'
      ];
      const dataRows = filteredTop.map((r, idx) => [
        idx + 1,
        r.ingredientName,
        r.categoryName,
        r.totalQuantity,
        r.unit,
        r.totalCost,
        r.consumptionEvents,
        r.shareOfTotalCostPercent
      ]);
      InventoryReportsService.exportToCSV(headers, dataRows, `top_consumed_ingredients_${dateRange.preset}.csv`);
    } else {
      const headers = [
        'Date & Time',
        'Order ID',
        'Menu Dish / Reason',
        'Ingredient Consumed',
        'Quantity',
        'Unit',
        'Unit Cost (₹)',
        'Total Cost (₹)'
      ];
      const dataRows = filteredDetailed.map((r) => [
        r.date,
        r.orderId,
        r.menuItemName,
        r.ingredientName,
        r.quantity,
        r.unit,
        r.unitCost,
        r.totalCost
      ]);
      InventoryReportsService.exportToCSV(headers, dataRows, `pos_consumption_detailed_${dateRange.preset}.csv`);
    }
  };

  const totalConsumptionValue = topConsumedRows.reduce((sum, r) => sum + r.totalCost, 0);

  return (
    <div className="space-y-4">
      {/* View Switcher & Sub-metrics */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl">
          <button
            onClick={() => setActiveSubView('top_ranking')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubView === 'top_ranking'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>Top Consumed Ranking</span>
            </span>
          </button>
          <button
            onClick={() => setActiveSubView('detailed_log')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubView === 'detailed_log'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-blue-600" />
              <span>Detailed Order Log ({consumptionRows.length})</span>
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ingredient or dish..."
              className="bg-stone-50 border border-stone-200 pl-9 pr-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans w-48 sm:w-64"
            />
          </div>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {activeSubView === 'top_ranking' ? (
        <div className="space-y-4">
          {/* Visual Chart: Top 10 Consumed Raw Materials */}
          {chartData.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-amber-600" />
                    <span>Top Consumed Raw Materials (by Value ₹)</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">Highest ingredient cost drivers in {dateRange.label}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Total Consumption</span>
                  <div className="text-base font-bold font-mono text-stone-900">
                    ₹{totalConsumptionValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <Tooltip
                      formatter={(val: any, name: any, item: any) => [
                        `₹${Number(val).toLocaleString('en-IN')}`,
                        'Total Cost'
                      ]}
                      labelFormatter={(label, payload) => {
                        const it = payload?.[0]?.payload;
                        return it ? `${it.fullName} (${it.quantity} ${it.unit})` : label;
                      }}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E7EB',
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Ranked Ingredients Table */}
          {filteredTop.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
              <TrendingDown className="w-10 h-10 text-stone-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-stone-900">No Consumption Recorded</h3>
              <p className="text-xs text-stone-500 mt-1">No orders or raw material consumption in this date range.</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Ingredient Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Total Consumed</th>
                      <th className="py-3 px-4">Total Value</th>
                      <th className="py-3 px-4">Order Events</th>
                      <th className="py-3 px-4">Share of Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-700">
                    {filteredTop.map((row, idx) => (
                      <tr key={row.ingredientId} className="hover:bg-stone-50/50 transition-colors">
                        <td className="py-3 px-4 text-center font-mono font-bold text-stone-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900">{row.ingredientName}</td>
                        <td className="py-3 px-4 text-stone-500">{row.categoryName}</td>
                        <td className="py-3 px-4 font-mono font-bold text-stone-900">
                          {row.totalQuantity} {row.unit}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-900">
                          ₹{row.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-500">{row.consumptionEvents}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-600 h-full rounded-full"
                                style={{ width: `${Math.min(row.shareOfTotalCostPercent, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-stone-600">{row.shareOfTotalCostPercent}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Detailed Consumption Log */
        filteredDetailed.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <Utensils className="w-10 h-10 text-stone-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-stone-900">No Detailed Logs</h3>
            <p className="text-xs text-stone-500 mt-1">No individual dish ingredient consumptions found matching criteria.</p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Menu Dish</th>
                    <th className="py-3 px-4">Ingredient</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Unit Cost</th>
                    <th className="py-3 px-4 font-bold">Line Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {filteredDetailed.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">{row.date}</td>
                      <td className="py-3 px-4 font-mono font-medium text-stone-800">{row.orderId}</td>
                      <td className="py-3 px-4 font-semibold text-stone-900">{row.menuItemName}</td>
                      <td className="py-3 px-4 text-stone-700">{row.ingredientName}</td>
                      <td className="py-3 px-4 font-mono font-medium">{row.quantity} {row.unit}</td>
                      <td className="py-3 px-4 font-mono text-stone-500">₹{row.unitCost}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-900">₹{row.totalCost}</td>
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
