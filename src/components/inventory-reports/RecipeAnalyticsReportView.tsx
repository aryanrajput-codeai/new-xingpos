import React, { useState } from 'react';
import {
  Search,
  Download,
  Utensils,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChefHat,
  ArrowUpDown
} from 'lucide-react';
import {
  RecipeProfitabilityRow,
  RecipeAvailabilityRow,
  InventoryReportsService
} from '../../lib/inventoryReportsService';

interface RecipeAnalyticsReportViewProps {
  profitabilityRows: RecipeProfitabilityRow[];
  availabilityRows: RecipeAvailabilityRow[];
}

export default function RecipeAnalyticsReportView({
  profitabilityRows,
  availabilityRows
}: RecipeAnalyticsReportViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'profitability' | 'availability'>('profitability');
  const [search, setSearch] = useState('');
  const [marginFilter, setMarginFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [availFilter, setAvailFilter] = useState<'ALL' | 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  const filteredProfitability = profitabilityRows.filter((r) => {
    if (marginFilter !== 'ALL' && r.marginRating !== marginFilter) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return r.dishName.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q);
  });

  const filteredAvailability = availabilityRows.filter((r) => {
    if (availFilter !== 'ALL' && r.status !== availFilter) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.dishName.toLowerCase().includes(q) ||
      r.categoryName.toLowerCase().includes(q) ||
      (r.limitingIngredientName && r.limitingIngredientName.toLowerCase().includes(q))
    );
  });

  const handleExportCSV = () => {
    if (activeSubTab === 'profitability') {
      const headers = [
        'Menu Dish',
        'Category',
        'Selling Price (₹)',
        'Recipe Ingredient Cost (₹)',
        'Labor Cost (₹)',
        'Overhead (₹)',
        'Total Dish Cost (₹)',
        'Gross Profit (₹)',
        'Profit Margin (%)',
        'Margin Rating'
      ];
      const dataRows = filteredProfitability.map((r) => [
        r.dishName,
        r.categoryName,
        r.sellingPrice,
        r.ingredientCost,
        r.laborCost,
        r.overheadCost,
        r.totalCost,
        r.grossProfit,
        r.profitMargin,
        r.marginRating
      ]);
      InventoryReportsService.exportToCSV(headers, dataRows, 'recipe_profitability_report.csv');
    } else {
      const headers = [
        'Menu Dish',
        'Category',
        'Available Servings Right Now',
        'Serving Status',
        'Bottleneck Limiting Ingredient',
        'Current Stock of Limiter',
        'Ingredients Count'
      ];
      const dataRows = filteredAvailability.map((r) => [
        r.dishName,
        r.categoryName,
        r.availableServings,
        r.status,
        r.limitingIngredientName || 'N/A',
        r.limitingIngredientStock !== undefined
          ? `${r.limitingIngredientStock} ${r.limitingIngredientUnit || ''}`
          : 'N/A',
        r.ingredientsCount
      ]);
      InventoryReportsService.exportToCSV(headers, dataRows, 'live_recipe_availability.csv');
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl">
          <button
            onClick={() => setActiveSubTab('profitability')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'profitability'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Recipe Profitability ({profitabilityRows.length})</span>
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab('availability')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'availability'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5 text-amber-600" />
              <span>Live Servings Availability ({availabilityRows.length})</span>
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
              placeholder="Search dish or bottleneck ingredient..."
              className="bg-stone-50 border border-stone-200 pl-9 pr-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-amber-600 font-sans w-48 sm:w-64"
            />
          </div>

          {activeSubTab === 'profitability' ? (
            <select
              value={marginFilter}
              onChange={(e) => setMarginFilter(e.target.value as any)}
              className="bg-stone-50 border border-stone-200 px-3 py-1.5 text-xs rounded-xl focus:outline-none font-sans text-stone-700"
            >
              <option value="ALL">All Margins</option>
              <option value="HIGH">High (&gt;65%)</option>
              <option value="MEDIUM">Medium (50-65%)</option>
              <option value="LOW">Low (&lt;50%)</option>
            </select>
          ) : (
            <select
              value={availFilter}
              onChange={(e) => setAvailFilter(e.target.value as any)}
              className="bg-stone-50 border border-stone-200 px-3 py-1.5 text-xs rounded-xl focus:outline-none font-sans text-stone-700"
            >
              <option value="ALL">All Status</option>
              <option value="AVAILABLE">Available</option>
              <option value="LOW_STOCK">Low Stock (≤10)</option>
              <option value="OUT_OF_STOCK">Sold Out (0)</option>
            </select>
          )}

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'profitability' ? (
        filteredProfitability.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <Utensils className="w-10 h-10 text-stone-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-stone-900">No Configured Recipes</h3>
            <p className="text-xs text-stone-500 mt-1">Add recipes to your dishes to analyze food cost and profit margins.</p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Menu Dish</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Selling Price</th>
                    <th className="py-3 px-4">Raw COGS</th>
                    <th className="py-3 px-4">Labor + OH</th>
                    <th className="py-3 px-4">Total Cost</th>
                    <th className="py-3 px-4 font-bold text-emerald-800">Gross Profit</th>
                    <th className="py-3 px-4 font-bold">Margin %</th>
                    <th className="py-3 px-4">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {filteredProfitability.map((row) => (
                    <tr key={row.recipeId} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-stone-900">{row.dishName}</td>
                      <td className="py-3 px-4 text-stone-500">{row.categoryName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">₹{row.sellingPrice}</td>
                      <td className="py-3 px-4 font-mono text-amber-900">₹{row.ingredientCost}</td>
                      <td className="py-3 px-4 font-mono text-stone-500">₹{(row.laborCost + row.overheadCost).toFixed(2)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-800">₹{row.totalCost}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        ₹{row.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">{row.profitMargin}%</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          row.marginRating === 'HIGH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.marginRating === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {row.marginRating} MARGIN
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
        /* Recipe Live Availability Table */
        filteredAvailability.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <ChefHat className="w-10 h-10 text-stone-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-stone-900">No Availability Data</h3>
            <p className="text-xs text-stone-500 mt-1">No recipes match current filter criteria.</p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Menu Dish</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 font-bold">Servings Can Prepare Now</th>
                    <th className="py-3 px-4">Serving Status</th>
                    <th className="py-3 px-4">Limiting Bottleneck Ingredient</th>
                    <th className="py-3 px-4">Bottleneck Stock</th>
                    <th className="py-3 px-4">Ingredients Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {filteredAvailability.map((row) => (
                    <tr key={row.recipeId} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-stone-900">{row.dishName}</td>
                      <td className="py-3 px-4 text-stone-500">{row.categoryName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-base">
                        <span className={
                          row.status === 'OUT_OF_STOCK'
                            ? 'text-red-700'
                            : row.status === 'LOW_STOCK'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }>
                          {row.availableServings} portions
                        </span>
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
                      <td className="py-3 px-4 text-stone-800 font-medium">
                        {row.limitingIngredientName || 'Balanced stock'}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {row.limitingIngredientStock !== undefined
                          ? `${row.limitingIngredientStock} ${row.limitingIngredientUnit || ''}`
                          : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-500">{row.ingredientsCount} items</td>
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
