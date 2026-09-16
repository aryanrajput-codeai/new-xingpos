import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  RefreshCw,
  Layers,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Boxes,
  TrendingDown,
  Trash2,
  Truck,
  PieChart,
  ChefHat,
  BookOpen,
  ShieldCheck,
  Building2,
  ChevronDown
} from 'lucide-react';
import {
  DateRange,
  DateRangePreset,
  calculateDateRange
} from '../lib/reports';
import {
  InventoryReportsService,
  InventoryKpiData,
  StockOverviewRow,
  LowStockRow,
  MovementRow,
  ConsumptionDetailRow,
  TopConsumedRow,
  WastageReportRow,
  PurchaseReportRow,
  FoodCostAnalysis,
  RecipeProfitabilityRow,
  RecipeAvailabilityRow,
  StockIntegrityRow
} from '../lib/inventoryReportsService';
import {
  Ingredient,
  IngredientCategory,
  InventoryTransaction,
  Purchase,
  WastageRecord,
  OrderInventoryConsumption,
  Recipe
} from '../types/inventory';
import { MenuItem } from '../types';
import { LocalDB, Order } from '../lib/db';
import { IngredientService } from '../lib/ingredientService';
import { PurchaseService } from '../lib/purchaseService';
import { WastageService } from '../lib/wastageService';
import { InventoryConsumptionService } from '../lib/inventoryConsumptionService';
import { RecipeService } from '../lib/recipeService';

import InventoryKpiCards from './inventory-reports/InventoryKpiCards';
import StockOverviewReportView from './inventory-reports/StockOverviewReportView';
import MovementReportView from './inventory-reports/MovementReportView';
import ConsumptionReportView from './inventory-reports/ConsumptionReportView';
import WastageReportView from './inventory-reports/WastageReportView';
import PurchaseReportView from './inventory-reports/PurchaseReportView';
import FoodCostReportView from './inventory-reports/FoodCostReportView';
import RecipeAnalyticsReportView from './inventory-reports/RecipeAnalyticsReportView';
import StockLedgerReportView from './inventory-reports/StockLedgerReportView';
import StockIntegrityReportView from './inventory-reports/StockIntegrityReportView';
import { InventoryDemoEnvironmentBanner } from './InventoryDemoEnvironmentBanner';

export type InventoryReportTab =
  | 'overview'
  | 'low_stock'
  | 'movement'
  | 'consumption'
  | 'wastage'
  | 'purchases'
  | 'food_cost'
  | 'recipes'
  | 'ledger'
  | 'integrity';

interface InventoryReportsDashboardProps {
  initialTab?: InventoryReportTab;
  onNavigateToTab?: (tab: string) => void;
}

export default function InventoryReportsDashboard({
  initialTab = 'overview',
  onNavigateToTab
}: InventoryReportsDashboardProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<InventoryReportTab>(initialTab);

  // Date Filtering
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>(() => calculateDateRange('this_month'));

  // Multi-tenant info
  const [businessId, setBusinessId] = useState<string>('');

  // Raw Models
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [wastageRecords, setWastageRecords] = useState<WastageRecord[]>([]);
  const [consumptions, setConsumptions] = useState<OrderInventoryConsumption[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Integrity Data
  const [integrityData, setIntegrityData] = useState<{
    rows: StockIntegrityRow[];
    totalAudited: number;
    consistentCount: number;
    discrepancyCount: number;
    integrityPercentage: number;
  }>({
    rows: [],
    totalAudited: 0,
    consistentCount: 0,
    discrepancyCount: 0,
    integrityPercentage: 100
  });
  const [isAuditing, setIsAuditing] = useState(false);

  // Synchronize date range on change
  const handleDatePresetChange = (preset: DateRangePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = calculateDateRange(preset);
      setDateRange(range);
    }
  };

  const handleApplyCustomDate = () => {
    if (customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      setDateRange({
        preset: 'custom',
        startDate: start,
        endDate: end,
        label: `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      });
    }
  };

  // Load authoritative data
  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const curBusinessId = InventoryReportsService.getCurrentBusinessId();
      setBusinessId(curBusinessId);

      const [
        loadedIngredients,
        loadedCategories,
        loadedTransactions,
        loadedPurchases,
        loadedWastage,
        loadedConsumptions,
        loadedRecipes,
        loadedMenuItems,
        loadedOrders
      ] = await Promise.all([
        IngredientService.getIngredients(curBusinessId),
        IngredientService.getCategories(curBusinessId),
        IngredientService.getTransactions(undefined, curBusinessId),
        PurchaseService.getPurchases(undefined, curBusinessId),
        WastageService.getWastageRecords(curBusinessId),
        InventoryConsumptionService.getConsumptionHistory(curBusinessId),
        RecipeService.getRecipes(curBusinessId),
        LocalDB.getMenuItems(),
        LocalDB.getOrders()
      ]);

      setIngredients(loadedIngredients || []);
      setCategories(loadedCategories || []);
      setTransactions(loadedTransactions || []);
      setPurchases(loadedPurchases || []);
      setWastageRecords(loadedWastage || []);
      setConsumptions(loadedConsumptions || []);
      setRecipes(loadedRecipes || []);
      setMenuItems(loadedMenuItems || []);
      setOrders(loadedOrders || []);
    } catch (err) {
      console.error('Failed to load inventory reports data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Run integrity audit
  const runIntegrityAudit = useCallback(async () => {
    if (ingredients.length === 0) return;
    try {
      setIsAuditing(true);
      const curBusinessId = businessId || InventoryReportsService.getCurrentBusinessId();
      const auditResult = await InventoryReportsService.computeStockIntegrity(ingredients, curBusinessId);
      setIntegrityData(auditResult);
    } catch (e) {
      console.error('Integrity audit error:', e);
    } finally {
      setIsAuditing(false);
    }
  }, [ingredients, businessId]);

  // Trigger integrity audit automatically when tab is opened
  useEffect(() => {
    if (activeTab === 'integrity' && integrityData.rows.length === 0 && ingredients.length > 0) {
      runIntegrityAudit();
    }
  }, [activeTab, integrityData.rows.length, ingredients.length, runIntegrityAudit]);

  // Derived KPI metrics
  const kpis: InventoryKpiData = useMemo(() => {
    return InventoryReportsService.computeKPIs(
      ingredients,
      transactions,
      purchases,
      wastageRecords,
      consumptions,
      orders,
      dateRange
    );
  }, [ingredients, transactions, purchases, wastageRecords, consumptions, orders, dateRange]);

  // Derived Reports Data
  const stockOverviewRows: StockOverviewRow[] = useMemo(() => {
    return InventoryReportsService.computeStockOverview(ingredients, categories);
  }, [ingredients, categories]);

  const lowStockRows: LowStockRow[] = useMemo(() => {
    return InventoryReportsService.computeLowStockReport(ingredients, categories);
  }, [ingredients, categories]);

  const movementRows: MovementRow[] = useMemo(() => {
    return InventoryReportsService.computeMovementReport(ingredients, transactions, categories, dateRange);
  }, [ingredients, transactions, categories, dateRange]);

  const consumptionRows: ConsumptionDetailRow[] = useMemo(() => {
    return InventoryReportsService.computeConsumptionReport(consumptions, transactions, dateRange);
  }, [consumptions, transactions, dateRange]);

  const topConsumedRows: TopConsumedRow[] = useMemo(() => {
    return InventoryReportsService.computeTopConsumed(ingredients, consumptions, transactions, categories, dateRange);
  }, [ingredients, consumptions, transactions, categories, dateRange]);

  const wastageReportData = useMemo(() => {
    return InventoryReportsService.computeWastageReport(wastageRecords, dateRange);
  }, [wastageRecords, dateRange]);

  const purchaseReportData = useMemo(() => {
    return InventoryReportsService.computePurchaseReport(purchases, dateRange);
  }, [purchases, dateRange]);

  const foodCostAnalysis = useMemo(() => {
    return InventoryReportsService.computeFoodCostAnalysis(
      orders,
      consumptions,
      transactions,
      ingredients,
      categories,
      dateRange
    );
  }, [orders, consumptions, transactions, ingredients, categories, dateRange]);

  const recipeProfitabilityRows: RecipeProfitabilityRow[] = useMemo(() => {
    return InventoryReportsService.computeRecipeProfitability(recipes, menuItems, ingredients);
  }, [recipes, menuItems, ingredients]);

  const recipeAvailabilityRows: RecipeAvailabilityRow[] = useMemo(() => {
    return InventoryReportsService.computeRecipeAvailability(recipes, menuItems, ingredients);
  }, [recipes, menuItems, ingredients]);

  return (
    <div className="space-y-5">
      {/* Isolated Demo & QA Environment Control Banner */}
      <InventoryDemoEnvironmentBanner onRefreshNeeded={loadAllData} />

      {/* Top Header & Date Range Selection Bar */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Inventory Analytics &amp; Reports
              </h2>
              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                <span>Phase 7 Authoritative Intelligence</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-stone-600">
                  <Building2 className="w-3 h-3 text-stone-400" />
                  <span>Tenant: {businessId || 'Default Business'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-stone-100 p-1 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-stone-500 ml-2 mr-1 shrink-0" />
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value as DateRangePreset)}
              className="bg-transparent text-xs font-semibold text-stone-800 pr-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-2 py-1 rounded-xl">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs bg-transparent border-0 focus:outline-none text-stone-700"
              />
              <span className="text-stone-400 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs bg-transparent border-0 focus:outline-none text-stone-700"
              />
              <button
                onClick={handleApplyCustomDate}
                className="px-2 py-0.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-[11px] font-bold"
              >
                Apply
              </button>
            </div>
          )}

          <button
            onClick={loadAllData}
            disabled={loading}
            title="Refresh All Inventory Data"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 7 Core KPI Cards */}
      <InventoryKpiCards
        kpi={kpis}
        onSelectReport={(reportId) => setActiveTab(reportId as InventoryReportTab)}
      />

      {/* Report Navigation Tabs */}
      <div className="border-b border-stone-200 bg-white rounded-2xl p-1.5 shadow-xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>1. Stock Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('low_stock')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'low_stock'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>2. Low Stock &amp; Reorder</span>
            {kpis.lowStockCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'low_stock' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {kpis.lowStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('movement')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'movement'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Stock Movement</span>
          </button>

          <button
            onClick={() => setActiveTab('consumption')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'consumption'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>4 &amp; 5. Consumption &amp; Top Items</span>
          </button>

          <button
            onClick={() => setActiveTab('wastage')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'wastage'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>6. Wastage Report</span>
          </button>

          <button
            onClick={() => setActiveTab('purchases')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'purchases'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>7. Purchases</span>
          </button>

          <button
            onClick={() => setActiveTab('food_cost')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'food_cost'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>8. Food Cost %</span>
          </button>

          <button
            onClick={() => setActiveTab('recipes')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'recipes'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>9 &amp; 10. Recipe Profitability</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>11. Authoritative Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('integrity')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'integrity'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>12. Mathematical Audit</span>
          </button>
        </div>
      </div>

      {/* Main Report View Content Area */}
      {loading ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-bold text-stone-900">Loading Authoritative Inventory Data</h3>
          <p className="text-xs text-stone-500 mt-1">Aggregating stocks, receipts, wastage, and consumption logs...</p>
        </div>
      ) : (
        <div>
          {activeTab === 'overview' && (
            <StockOverviewReportView
              overviewRows={stockOverviewRows}
              lowStockRows={lowStockRows}
              categories={categories}
              isLowStockOnly={false}
            />
          )}

          {activeTab === 'low_stock' && (
            <StockOverviewReportView
              overviewRows={stockOverviewRows}
              lowStockRows={lowStockRows}
              categories={categories}
              isLowStockOnly={true}
            />
          )}

          {activeTab === 'movement' && (
            <MovementReportView
              rows={movementRows}
              dateRange={dateRange}
            />
          )}

          {activeTab === 'consumption' && (
            <ConsumptionReportView
              consumptionRows={consumptionRows}
              topConsumedRows={topConsumedRows}
              dateRange={dateRange}
            />
          )}

          {activeTab === 'wastage' && (
            <WastageReportView
              rows={wastageReportData.rows}
              totalLoss={wastageReportData.totalLoss}
              reasonBreakdown={wastageReportData.reasonBreakdown}
              dateRange={dateRange}
            />
          )}

          {activeTab === 'purchases' && (
            <PurchaseReportView
              rows={purchaseReportData.rows}
              totalSpend={purchaseReportData.totalSpend}
              supplierSpend={purchaseReportData.supplierSpend}
              dateRange={dateRange}
            />
          )}

          {activeTab === 'food_cost' && (
            <FoodCostReportView
              analysis={foodCostAnalysis}
              dateRange={dateRange}
            />
          )}

          {activeTab === 'recipes' && (
            <RecipeAnalyticsReportView
              profitabilityRows={recipeProfitabilityRows}
              availabilityRows={recipeAvailabilityRows}
            />
          )}

          {activeTab === 'ledger' && (
            <StockLedgerReportView
              transactions={transactions}
              ingredients={ingredients}
              dateRange={dateRange}
            />
          )}

          {activeTab === 'integrity' && (
            <StockIntegrityReportView
              integrityData={integrityData}
              onRefreshAudit={runIntegrityAudit}
              isLoading={isAuditing}
            />
          )}
        </div>
      )}
    </div>
  );
}
