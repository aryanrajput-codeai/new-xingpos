import React from 'react';
import {
  PieChart as PieIcon,
  TrendingUp,
  Download,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Layers,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  FoodCostAnalysis,
  InventoryReportsService
} from '../../lib/inventoryReportsService';
import { DateRange } from '../../lib/reports';

interface FoodCostReportViewProps {
  analysis: FoodCostAnalysis;
  dateRange: DateRange;
}

export default function FoodCostReportView({ analysis, dateRange }: FoodCostReportViewProps) {
  const fc = analysis.actualFoodCostPercentage;

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Food Sales Revenue (₹)',
      'Raw Material Consumption Cost (₹)',
      'Food Cost %'
    ];
    const dataRows = analysis.dailyTrend.map((d) => [
      d.date,
      d.sales,
      d.consumptionCost,
      d.foodCostPercent !== null ? `${d.foodCostPercent}%` : 'N/A'
    ]);
    InventoryReportsService.exportToCSV(headers, dataRows, `food_cost_analysis_${dateRange.preset}.csv`);
  };

  return (
    <div className="space-y-4">
      {/* KPI & Benchmark Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Total Food Sales
          </span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            ₹{analysis.periodFoodSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-stone-400 mt-1">Net food orders revenue</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Ingredient Consumption Cost
          </span>
          <div className="text-xl font-bold font-mono text-amber-900 mt-1">
            ₹{analysis.periodConsumptionCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-stone-400 mt-1">Direct Cost of Goods Sold (COGS)</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Actual Food Cost %
          </span>
          <div className="text-2xl font-bold font-mono text-purple-700 mt-1">
            {fc !== null ? `${fc}%` : 'N/A'}
          </div>
          <p className="text-[10px] text-stone-400 mt-1">COGS / Sales Ratio</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Benchmark Health
          </span>
          <div>
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${
              analysis.healthRating === 'OPTIMAL'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : analysis.healthRating === 'MODERATE'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : analysis.healthRating === 'CRITICAL'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-stone-100 text-stone-600 border-stone-200'
            }`}>
              {analysis.healthRating === 'OPTIMAL' && 'OPTIMAL (<30%)'}
              {analysis.healthRating === 'MODERATE' && 'MODERATE (30-36%)'}
              {analysis.healthRating === 'CRITICAL' && 'HIGH / LEAK (>36%)'}
              {analysis.healthRating === 'NO_DATA' && 'NO ORDERS DATA'}
            </span>
          </div>
          <p className="text-[10px] text-stone-400 mt-1">Industry Standard: 28% – 35%</p>
        </div>
      </div>

      {/* Daily Sales vs Food Cost Area Trend Chart */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 mb-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span>Revenue vs Raw Material Consumption Trend</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">Tracking daily ingredient cost correlation against bill revenue across {dateRange.label}</p>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span>Export Trend (.CSV)</span>
          </button>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analysis.dailyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                formatter={(val: any, name: any) => [
                  `₹${Number(val).toLocaleString('en-IN')}`,
                  name === 'sales' ? 'Food Sales' : 'Ingredient Cost'
                ]}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5E7EB',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(v) => (v === 'sales' ? 'Food Sales Revenue (₹)' : 'Raw Material COGS (₹)')}
              />
              <Area type="monotone" dataKey="sales" stroke="#10B981" strokeWidth={2} fill="url(#salesGrad)" />
              <Area type="monotone" dataKey="consumptionCost" stroke="#8B5CF6" strokeWidth={2} fill="url(#costGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category-Wise Cost Breakdown */}
      {analysis.categoryBreakdown.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-stone-600" />
            <span>Raw Material Cost by Category</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {analysis.categoryBreakdown.map((cat) => (
              <div key={cat.category} className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <span className="text-xs font-bold text-stone-800 block truncate">{cat.category}</span>
                <div className="text-base font-bold font-mono text-stone-900 mt-1">
                  ₹{cat.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="w-full bg-stone-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className="bg-purple-600 h-full rounded-full" style={{ width: `${Math.min(cat.percent, 100)}%` }} />
                </div>
                <span className="text-[10px] text-stone-500 font-mono mt-1 block">{cat.percent}% of total food cost</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
