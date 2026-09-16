import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Filter,
  Layers,
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  Edit3,
  Power,
  Coins,
  RefreshCw,
  SlidersHorizontal,
  Lock,
  Info,
  X,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
  Boxes,
  ScrollText,
  PackageCheck,
  Trash2,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import {
  Ingredient,
  IngredientCategory,
  IngredientStorageType,
  InventoryTransaction,
  StockStatus
} from '../types/inventory';
import {
  SupportedUnit,
  SUPPORTED_UNITS,
  UNIT_METADATA_MAP,
  formatQuantityDisplay,
  normalizeCostToBaseUnit,
  getBaseUnit
} from '../lib/unitConversion';
import {
  IngredientService,
  CreateIngredientDTO,
  UpdateIngredientDTO
} from '../lib/ingredientService';
import { RBACService } from '../lib/rbac';
import IngredientLedgerModal from './IngredientLedgerModal';
import POSConsumptionsModal from './POSConsumptionsModal';
import AddWastageModal from './AddWastageModal';
import StockAdjustmentModal from './StockAdjustmentModal';
import StockConsistencyModal from './StockConsistencyModal';
import WastageManagementView from './WastageManagementView';
import StockAdjustmentView from './StockAdjustmentView';
import InventoryReportsDashboard from './InventoryReportsDashboard';
import { InventoryDemoEnvironmentBanner } from './InventoryDemoEnvironmentBanner';

interface IngredientManagementTabProps {
  initialSubTab?: 'catalog' | 'wastage' | 'adjustments' | 'reports';
}

export default function IngredientManagementTab({
  initialSubTab = 'catalog'
}: IngredientManagementTabProps = {}) {
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'wastage' | 'adjustments' | 'reports'>(initialSubTab);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [openingStockMap, setOpeningStockMap] = useState<Record<string, InventoryTransaction | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Permission checks
  const canManage = RBACService.hasPermission('inventory.manage');
  const canView = RBACService.hasPermission('inventory.view');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [openingStockTarget, setOpeningStockTarget] = useState<Ingredient | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedLedgerIngredient, setSelectedLedgerIngredient] = useState<Ingredient | null>(null);
  const [showConsumptionsModal, setShowConsumptionsModal] = useState(false);

  // Phase 6 Modals: Wastage, Stock Adjustment, Consistency Audit
  const [showAddWastageModal, setShowAddWastageModal] = useState(false);
  const [selectedWastageIngredientId, setSelectedWastageIngredientId] = useState<string | undefined>();
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedAdjustmentIngredientId, setSelectedAdjustmentIngredientId] = useState<string | undefined>();
  const [selectedConsistencyIngredient, setSelectedConsistencyIngredient] = useState<Ingredient | null>(null);

  // Synchronize activeSubTab if initialSubTab prop changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Toast / Feedback state
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Press '/' to focus search, 'Esc' to clear modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (showAddModal) setShowAddModal(false);
        if (editingIngredient) setEditingIngredient(null);
        if (openingStockTarget) setOpeningStockTarget(null);
        if (showCategoryModal) setShowCategoryModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddModal, editingIngredient, openingStockTarget, showCategoryModal]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Data
  const loadData = async () => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [ingList, catList] = await Promise.all([
        IngredientService.getIngredients(),
        IngredientService.getCategories()
      ]);
      setIngredients(ingList);
      setCategories(catList);

      // Check opening stock status for each ingredient
      const opMap: Record<string, InventoryTransaction | null> = {};
      await Promise.all(
        ingList.map(async (ing) => {
          opMap[ing.id] = await IngredientService.getOpeningStockTransaction(ing.id);
        })
      );
      setOpeningStockMap(opMap);
    } catch (err: any) {
      showToast(err.message || 'Failed to load ingredients', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('ingredients_updated', handleUpdate);
    window.addEventListener('categories_updated', handleUpdate);
    window.addEventListener('wastage_recorded', handleUpdate);
    window.addEventListener('inventory_adjustments_updated', handleUpdate);
    return () => {
      window.removeEventListener('ingredients_updated', handleUpdate);
      window.removeEventListener('categories_updated', handleUpdate);
      window.removeEventListener('wastage_recorded', handleUpdate);
      window.removeEventListener('inventory_adjustments_updated', handleUpdate);
    };
  }, []);

  // Filter & Search Logic
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.itemCode && item.itemCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'ALL' || item.categoryId === selectedCategory;

      const status = IngredientService.calculateStockStatus(item);
      const matchesStatus =
        selectedStatus === 'ALL' || status === selectedStatus;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [ingredients, searchQuery, selectedCategory, selectedStatus]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalItems = ingredients.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockValue = 0;

    ingredients.forEach((ing) => {
      const status = IngredientService.calculateStockStatus(ing);
      if (status === 'LOW_STOCK') lowStockCount++;
      if (status === 'OUT_OF_STOCK') outOfStockCount++;
      totalStockValue += (ing.currentStock || 0) * (ing.costPerUnit || 0);
    });

    return { totalItems, lowStockCount, outOfStockCount, totalStockValue };
  }, [ingredients]);

  // Toggle Ingredient Active Status
  const handleToggleActive = async (ingredient: Ingredient) => {
    if (!canManage) {
      showToast('Unauthorized: You need inventory management privileges.', 'error');
      return;
    }
    try {
      const updated = await IngredientService.toggleIngredientActive(ingredient.id);
      showToast(
        `Ingredient '${updated.name}' ${updated.isActive ? 'activated' : 'deactivated'}.`
      );
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update ingredient status', 'error');
    }
  };

  // Status Badge Component
  const renderStatusBadge = (ingredient: Ingredient) => {
    const status = IngredientService.calculateStockStatus(ingredient);

    switch (status) {
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <XCircle className="w-3 h-3 text-gray-500" />
            Inactive
          </span>
        );
      case 'OUT_OF_STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Out of Stock
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <TrendingDown className="w-3 h-3 text-amber-600" />
            Low Stock
          </span>
        );
      case 'OVERSTOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <TrendingUp className="w-3 h-3 text-purple-600" />
            Overstocked
          </span>
        );
      case 'IN_STOCK':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            In Stock
          </span>
        );
    }
  };

  if (!canView) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          Your staff role lacks the <span className="font-semibold text-gray-800">inventory.view</span> permission. Please consult your restaurant owner or general manager.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Isolated Demo & QA Environment Control Banner */}
      <InventoryDemoEnvironmentBanner onRefreshNeeded={loadData} />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs: Raw Catalog, Wastage, Stock Adjustments */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl p-2.5 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'catalog'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Raw Catalog & Master</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeSubTab === 'catalog'
                  ? 'bg-amber-700/70 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {ingredients.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('wastage')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'wastage'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Wastage & Loss Ledger</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('adjustments')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'adjustments'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Stock Adjustments & Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('reports')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'reports'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Reports & Analytics</span>
          </button>
        </div>

        {activeSubTab === 'catalog' && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 font-mono">
            <span>Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] text-gray-700 font-bold">/</kbd> to search</span>
          </div>
        )}
      </div>

      {activeSubTab === 'reports' && (
        <InventoryReportsDashboard />
      )}

      {activeSubTab === 'wastage' && (
        <WastageManagementView ingredients={ingredients} onWastageUpdated={loadData} />
      )}

      {activeSubTab === 'adjustments' && (
        <StockAdjustmentView ingredients={ingredients} onAdjustmentUpdated={loadData} />
      )}

      {activeSubTab === 'catalog' && (
        <>
          {/* Header & Metrics Overview */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200/60">
                <Scale className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                  Ingredient Catalog
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Raw materials master, stock levels, normalized base units & opening balances
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowConsumptionsModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>POS Consumptions</span>
            </button>

            <button
              onClick={() => setShowCategoryModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-xl transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-gray-500" />
              <span>Categories</span>
            </button>

            {canManage && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Ingredient</span>
              </button>
            )}
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="p-3.5 bg-gray-50/80 border border-gray-200/70 rounded-xl">
            <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
              <span>Total Catalog</span>
              <Boxes className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-900 mt-1">
              {metrics.totalItems}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Tracked ingredients</div>
          </div>

          <div className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-xl">
            <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
              <span>Low Stock Alerts</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-amber-900 mt-1">
              {metrics.lowStockCount}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">At or below alert level</div>
          </div>

          <div className="p-3.5 bg-red-50/50 border border-red-200/60 rounded-xl">
            <div className="flex items-center justify-between text-red-700 text-xs font-medium">
              <span>Out of Stock</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-xl font-bold text-red-900 mt-1">
              {metrics.outOfStockCount}
            </div>
            <div className="text-[11px] text-red-700 mt-0.5">Zero stock items</div>
          </div>

          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/60 rounded-xl">
            <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
              <span>Total Inventory Value</span>
              <Coins className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-emerald-900 mt-1">
              ₹{metrics.totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">Estimated raw material cost</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ingredients by name, code or description... (Press / to focus)"
            className="w-full pl-9.5 pr-4 py-2 text-sm bg-gray-50 hover:bg-gray-100/70 focus:bg-white border border-gray-200 focus:border-amber-500 rounded-xl outline-none transition-all placeholder:text-gray-400 text-gray-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 md:pb-0">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-sm text-gray-700">
            <Layers className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent border-none text-xs sm:text-sm font-medium text-gray-800 focus:ring-0 outline-none cursor-pointer pr-2"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-sm text-gray-700">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent border-none text-xs sm:text-sm font-medium text-gray-800 focus:ring-0 outline-none cursor-pointer pr-2"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="OVERSTOCKED">Overstocked</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <button
            onClick={loadData}
            title="Refresh list"
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer border border-gray-200"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Loading ingredient catalog...</p>
        </div>
      ) : filteredIngredients.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {searchQuery || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'
              ? 'No matching ingredients found'
              : 'No ingredients added yet'}
          </h3>
          <p className="text-gray-500 text-sm mb-5">
            {searchQuery || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'
              ? 'Try changing your search terms or clearing the active filters.'
              : 'Start by creating your first raw material item (e.g. Paneer, Rice, Milk) with standard units and alert thresholds.'}
          </p>
          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Ingredient</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[12px] font-semibold text-gray-600 tracking-wider uppercase">
                  <th className="py-3.5 px-4">Ingredient & Code</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Current Stock</th>
                  <th className="py-3.5 px-4">Cost / Unit</th>
                  <th className="py-3.5 px-4">Stock Limits (Min / Max)</th>
                  <th className="py-3.5 px-4">Stock Status</th>
                  <th className="py-3.5 px-4">Opening Stock</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {filteredIngredients.map((item) => {
                  const qtyInfo = formatQuantityDisplay(item.currentStock, item.unit as SupportedUnit);
                  const normCost = normalizeCostToBaseUnit(item.costPerUnit, item.unit as SupportedUnit);
                  const hasOpening = Boolean(openingStockMap[item.id]);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/60 transition-colors ${
                        !item.isActive ? 'opacity-60 bg-gray-50/30' : ''
                      }`}
                    >
                      {/* Name & Code */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{item.name}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          {item.itemCode && (
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-600">
                              {item.itemCode}
                            </span>
                          )}
                          <span className="capitalize">{item.storageType.toLowerCase()} storage</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        {item.category ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            {item.category.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Unassigned</span>
                        )}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 text-base">
                          {qtyInfo.display}
                        </div>
                        {item.unit !== getBaseUnit(item.unit as SupportedUnit) && (
                          <div className="text-[11px] text-gray-500 font-mono">
                            ≈ {qtyInfo.normalizedStr}
                          </div>
                        )}
                      </td>

                      {/* Cost */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">
                          ₹{item.costPerUnit.toFixed(2)} / {item.unit}
                        </div>
                        {item.unit !== getBaseUnit(item.unit as SupportedUnit) && (
                          <div className="text-[11px] text-gray-500">
                            ₹{normCost.costPerBaseUnit.toFixed(2)} / {normCost.baseUnit}
                          </div>
                        )}
                      </td>

                      {/* Limits */}
                      <td className="py-3 px-4">
                        <div className="text-xs text-gray-600">
                          <span className="font-medium text-amber-700">Min:</span> {item.minAlertLevel} {item.unit}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          <span className="font-medium text-purple-700">Max:</span>{' '}
                          {item.maxStockLevel !== null && item.maxStockLevel !== undefined
                            ? `${item.maxStockLevel} ${item.unit}`
                            : 'No limit'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">{renderStatusBadge(item)}</td>

                      {/* Opening Stock Status */}
                      <td className="py-3 px-4">
                        {hasOpening ? (
                          <div className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Recorded</span>
                          </div>
                        ) : canManage ? (
                          <button
                            onClick={() => setOpeningStockTarget(item)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 transition-colors cursor-pointer"
                          >
                            <Coins className="w-3 h-3" />
                            <span>Set Opening Stock</span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Not set</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedWastageIngredientId(item.id);
                                  setShowAddWastageModal(true);
                                }}
                                title="Log Wastage / Spoilage"
                                className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAdjustmentIngredientId(item.id);
                                  setShowAdjustmentModal(true);
                                }}
                                title="Adjust Stock (Balance Correction / Audit)"
                                className="p-1.5 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedConsistencyIngredient(item)}
                            title="Ledger Mathematical Integrity Audit"
                            className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedLedgerIngredient(item)}
                            title="View Stock Ledger & Movements"
                            className="p-1.5 text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <ScrollText className="w-4 h-4" />
                          </button>

                          {canManage && (
                            <>
                              <button
                                onClick={() => setEditingIngredient(item)}
                                title="Edit Ingredient"
                                className="p-1.5 text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleActive(item)}
                                title={item.isActive ? 'Deactivate' : 'Activate'}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  item.isActive
                                    ? 'text-gray-400 hover:text-red-700 hover:bg-red-50'
                                    : 'text-gray-400 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Grid View */}
          <div className="lg:hidden divide-y divide-gray-200">
            {filteredIngredients.map((item) => {
              const qtyInfo = formatQuantityDisplay(item.currentStock, item.unit as SupportedUnit);
              const hasOpening = Boolean(openingStockMap[item.id]);

              return (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-gray-900 text-base">{item.name}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        {item.itemCode && (
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                            {item.itemCode}
                          </span>
                        )}
                        <span>{item.category?.name || 'Unassigned'}</span>
                      </div>
                    </div>
                    <div>{renderStatusBadge(item)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl text-xs">
                    <div>
                      <div className="text-gray-500">Current Stock</div>
                      <div className="text-base font-bold text-gray-900 mt-0.5">
                        {qtyInfo.display}
                      </div>
                      {item.unit !== getBaseUnit(item.unit as SupportedUnit) && (
                        <div className="text-[10px] text-gray-400 font-mono">
                          ≈ {qtyInfo.normalizedStr}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-500">Unit Cost</div>
                      <div className="text-base font-semibold text-gray-900 mt-0.5">
                        ₹{item.costPerUnit.toFixed(2)} / {item.unit}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Alert at: {item.minAlertLevel} {item.unit}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      {hasOpening ? (
                        <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Opening stock recorded
                        </span>
                      ) : canManage ? (
                        <button
                          onClick={() => setOpeningStockTarget(item)}
                          className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg"
                        >
                          Set Opening Stock
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400">Opening stock not set</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {canManage && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedWastageIngredientId(item.id);
                              setShowAddWastageModal(true);
                            }}
                            title="Log Wastage"
                            className="p-1.5 text-gray-500 hover:text-red-700 border border-gray-200 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedAdjustmentIngredientId(item.id);
                              setShowAdjustmentModal(true);
                            }}
                            title="Stock Adjustment"
                            className="p-1.5 text-gray-500 hover:text-blue-700 border border-gray-200 rounded-lg"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedConsistencyIngredient(item)}
                        title="Ledger Audit"
                        className="p-1.5 text-gray-500 hover:text-emerald-700 border border-gray-200 rounded-lg"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSelectedLedgerIngredient(item)}
                        title="View Ledger"
                        className="p-1.5 text-gray-600 hover:text-indigo-700 border border-gray-200 rounded-lg"
                      >
                        <ScrollText className="w-3.5 h-3.5" />
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => setEditingIngredient(item)}
                            className="p-1.5 text-gray-600 hover:text-amber-700 border border-gray-200 rounded-lg"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`p-1.5 border border-gray-200 rounded-lg ${
                              item.isActive ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}

      {/* MODAL: ADD INGREDIENT */}
      {showAddModal && (
        <AddIngredientModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSuccess={(msg) => {
            setShowAddModal(false);
            showToast(msg);
            loadData();
          }}
        />
      )}

      {/* MODAL: EDIT INGREDIENT */}
      {editingIngredient && (
        <EditIngredientModal
          ingredient={editingIngredient}
          categories={categories}
          onClose={() => setEditingIngredient(null)}
          onSuccess={(msg) => {
            setEditingIngredient(null);
            showToast(msg);
            loadData();
          }}
        />
      )}

      {/* MODAL: OPENING STOCK ENTRY */}
      {openingStockTarget && (
        <OpeningStockModal
          ingredient={openingStockTarget}
          onClose={() => setOpeningStockTarget(null)}
          onSuccess={(msg) => {
            setOpeningStockTarget(null);
            showToast(msg);
            loadData();
          }}
        />
      )}

      {/* MODAL: MANAGE CATEGORIES */}
      {showCategoryModal && (
        <CategoriesModal
          categories={categories}
          canManage={canManage}
          onClose={() => setShowCategoryModal(false)}
          onSuccess={(msg) => {
            showToast(msg);
            loadData();
          }}
        />
      )}

      {/* MODAL: INGREDIENT STOCK LEDGER & MOVEMENT HISTORY */}
      {selectedLedgerIngredient && (
        <IngredientLedgerModal
          isOpen={Boolean(selectedLedgerIngredient)}
          ingredient={selectedLedgerIngredient}
          onClose={() => setSelectedLedgerIngredient(null)}
        />
      )}

      {/* MODAL: POS AUTOMATIC INVENTORY CONSUMPTIONS */}
      {showConsumptionsModal && (
        <POSConsumptionsModal
          isOpen={showConsumptionsModal}
          onClose={() => setShowConsumptionsModal(false)}
        />
      )}

      {/* MODAL: LOG WASTAGE & LOSS */}
      {showAddWastageModal && (
        <AddWastageModal
          isOpen={showAddWastageModal}
          onClose={() => {
            setShowAddWastageModal(false);
            setSelectedWastageIngredientId(undefined);
          }}
          ingredients={ingredients}
          initialIngredientId={selectedWastageIngredientId}
          onWastageRecorded={loadData}
        />
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {showAdjustmentModal && (
        <StockAdjustmentModal
          isOpen={showAdjustmentModal}
          onClose={() => {
            setShowAdjustmentModal(false);
            setSelectedAdjustmentIngredientId(undefined);
          }}
          ingredients={ingredients}
          initialIngredientId={selectedAdjustmentIngredientId}
          onAdjustmentRecorded={loadData}
        />
      )}

      {/* MODAL: LEDGER CONSISTENCY AUDIT */}
      {selectedConsistencyIngredient && (
        <StockConsistencyModal
          isOpen={Boolean(selectedConsistencyIngredient)}
          ingredient={selectedConsistencyIngredient}
          onClose={() => setSelectedConsistencyIngredient(null)}
        />
      )}
    </div>
  );
}

// ====================================================================
// SUB-COMPONENT: ADD INGREDIENT MODAL
// ====================================================================
interface AddIngredientModalProps {
  categories: IngredientCategory[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function AddIngredientModal({ categories, onClose, onSuccess }: AddIngredientModalProps) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<SupportedUnit>('kg');
  const [minAlertLevel, setMinAlertLevel] = useState<number>(5);
  const [maxStockLevel, setMaxStockLevel] = useState<string>('50');
  const [costPerUnit, setCostPerUnit] = useState<number>(0);
  const [storageType, setStorageType] = useState<IngredientStorageType>('DRY');

  // Optional initial opening stock
  const [enableOpeningStock, setEnableOpeningStock] = useState(false);
  const [openingQty, setOpeningQty] = useState<number>(10);
  const [openingCost, setOpeningCost] = useState<number>(0);
  const [openingNotes, setOpeningNotes] = useState('Initial verified physical balance');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync opening cost default with costPerUnit
  const handleCostChange = (val: number) => {
    setCostPerUnit(val);
    if (!enableOpeningStock) {
      setOpeningCost(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Form client-side pre-validations
    if (!name.trim()) {
      setErrorMsg('Ingredient name is required.');
      return;
    }
    if (minAlertLevel < 0) {
      setErrorMsg('Minimum alert level cannot be negative.');
      return;
    }
    const maxVal = maxStockLevel.trim() ? Number(maxStockLevel) : null;
    if (maxVal !== null) {
      if (maxVal < 0) {
        setErrorMsg('Maximum stock level cannot be negative.');
        return;
      }
      if (maxVal < minAlertLevel) {
        setErrorMsg('Maximum stock level cannot be lower than the minimum alert level.');
        return;
      }
    }
    if (costPerUnit < 0) {
      setErrorMsg('Cost per unit cannot be negative.');
      return;
    }

    if (enableOpeningStock) {
      if (openingQty <= 0) {
        setErrorMsg('Opening stock quantity must be strictly greater than 0.');
        return;
      }
      if (openingCost < 0) {
        setErrorMsg('Opening stock cost cannot be negative.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const dto: CreateIngredientDTO = {
        name: name.trim(),
        categoryId: categoryId || null,
        itemCode: itemCode.trim() || undefined,
        description: description.trim() || undefined,
        unit,
        minAlertLevel: Number(minAlertLevel),
        maxStockLevel: maxVal,
        costPerUnit: Number(costPerUnit),
        storageType,
        openingStock: enableOpeningStock
          ? {
              quantity: Number(openingQty),
              unit,
              unitCost: Number(openingCost),
              notes: openingNotes
            }
          : undefined
      };

      const result = await IngredientService.createIngredient(dto);
      const msg = result.openingStockTx
        ? `Created ingredient '${result.ingredient.name}' with ${result.openingStockTx.quantity} ${result.openingStockTx.unit} opening stock posted.`
        : `Created ingredient '${result.ingredient.name}'.`;
      onSuccess(msg);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create ingredient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Plus className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-gray-900 text-lg">Add New Ingredient</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Ingredient Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Paneer, Basmati Rice, Amul Butter"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Item Code / SKU (Optional)
              </label>
              <input
                type="text"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="e.g. PAN-01, RIC-10"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none uppercase font-mono"
              />
            </div>
          </div>

          {/* Unit & Unit Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Base Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => {
                  const u = e.target.value as SupportedUnit;
                  setUnit(u);
                }}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none font-semibold text-gray-800"
              >
                {SUPPORTED_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_METADATA_MAP[u].label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Dimension: {UNIT_METADATA_MAP[unit].dimension}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Standard Cost (₹ / {unit})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={costPerUnit}
                onChange={(e) => handleCostChange(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Storage Type
              </label>
              <select
                value={storageType}
                onChange={(e) => setStorageType(e.target.value as IngredientStorageType)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              >
                <option value="DRY">Dry Storage</option>
                <option value="CHILLED">Chilled (Refrigerated)</option>
                <option value="FROZEN">Deep Freeze</option>
                <option value="AMBIENT">Ambient Kitchen</option>
              </select>
            </div>
          </div>

          {/* Stock Thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Minimum Stock Alert Level ({unit})
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={minAlertLevel}
                onChange={(e) => setMinAlertLevel(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Alerts triggered when stock falls to this amount
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Maximum Stock Capacity ({unit})
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={maxStockLevel}
                onChange={(e) => setMaxStockLevel(e.target.value)}
                placeholder="Leave blank for unlimited"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Prevents over-purchasing and waste
              </p>
            </div>
          </div>

          {/* OPENING STOCK OPTION */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="enableOpeningStockCheck"
                  checked={enableOpeningStock}
                  onChange={(e) => setEnableOpeningStock(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                />
                <label
                  htmlFor="enableOpeningStockCheck"
                  className="text-xs sm:text-sm font-semibold text-amber-900 cursor-pointer"
                >
                  Record Initial Opening Stock Balance
                </label>
              </div>
              <span className="text-[11px] font-mono text-amber-700 bg-white/70 px-2 py-0.5 rounded border border-amber-200">
                OPENING_STOCK Transaction
              </span>
            </div>

            {enableOpeningStock && (
              <div className="mt-3 p-4 bg-amber-50/40 border border-amber-200/60 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Opening Quantity ({unit}) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                      value={openingQty}
                      onChange={(e) => setOpeningQty(parseFloat(e.target.value) || 0)}
                      placeholder="e.g. 10"
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 focus:border-amber-500 rounded-xl outline-none font-bold text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Unit Cost (₹ / {unit}) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={openingCost}
                      onChange={(e) => setOpeningCost(parseFloat(e.target.value) || 0)}
                      placeholder="e.g. 280"
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 focus:border-amber-500 rounded-xl outline-none font-semibold text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-amber-200/60 text-xs">
                  <span className="text-gray-500">Initial Asset Value:</span>
                  <span className="font-bold text-gray-900 text-sm">
                    ₹{(openingQty * openingCost).toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Audit Notes
                  </label>
                  <input
                    type="text"
                    value={openingNotes}
                    onChange={(e) => setOpeningNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Ingredient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ====================================================================
// SUB-COMPONENT: EDIT INGREDIENT MODAL
// ====================================================================
interface EditIngredientModalProps {
  ingredient: Ingredient;
  categories: IngredientCategory[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function EditIngredientModal({ ingredient, categories, onClose, onSuccess }: EditIngredientModalProps) {
  const [name, setName] = useState(ingredient.name);
  const [categoryId, setCategoryId] = useState(ingredient.categoryId || '');
  const [itemCode, setItemCode] = useState(ingredient.itemCode || '');
  const [description, setDescription] = useState(ingredient.description || '');
  const [minAlertLevel, setMinAlertLevel] = useState(ingredient.minAlertLevel);
  const [maxStockLevel, setMaxStockLevel] = useState<string>(
    ingredient.maxStockLevel !== null && ingredient.maxStockLevel !== undefined
      ? String(ingredient.maxStockLevel)
      : ''
  );
  const [costPerUnit, setCostPerUnit] = useState(ingredient.costPerUnit);
  const [storageType, setStorageType] = useState<IngredientStorageType>(ingredient.storageType);
  const [isActive, setIsActive] = useState(ingredient.isActive);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Ingredient name is required.');
      return;
    }
    if (minAlertLevel < 0) {
      setErrorMsg('Minimum alert level cannot be negative.');
      return;
    }
    const maxVal = maxStockLevel.trim() ? Number(maxStockLevel) : null;
    if (maxVal !== null) {
      if (maxVal < 0) {
        setErrorMsg('Maximum stock cannot be negative.');
        return;
      }
      if (maxVal < minAlertLevel) {
        setErrorMsg('Maximum stock cannot be less than minimum alert level.');
        return;
      }
    }
    if (costPerUnit < 0) {
      setErrorMsg('Cost per unit cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const dto: UpdateIngredientDTO = {
        name: name.trim(),
        categoryId: categoryId || null,
        itemCode: itemCode.trim() || undefined,
        description: description.trim() || undefined,
        minAlertLevel: Number(minAlertLevel),
        maxStockLevel: maxVal,
        costPerUnit: Number(costPerUnit),
        storageType,
        isActive
      };

      await IngredientService.updateIngredient(ingredient.id, dto);
      onSuccess(`Updated ingredient '${name}'.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update ingredient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Edit3 className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-gray-900 text-lg">Edit Ingredient</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Ingredient Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Item Code / SKU
              </label>
              <input
                type="text"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none uppercase font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Base Unit (Locked)
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={`${ingredient.unit} (${UNIT_METADATA_MAP[ingredient.unit as SupportedUnit]?.label || ingredient.unit})`}
                className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-xl font-medium text-gray-500 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400 mt-1">Locked to preserve transaction ledger</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Standard Cost (₹ / {ingredient.unit})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Storage Type
              </label>
              <select
                value={storageType}
                onChange={(e) => setStorageType(e.target.value as IngredientStorageType)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              >
                <option value="DRY">Dry Storage</option>
                <option value="CHILLED">Chilled</option>
                <option value="FROZEN">Deep Freeze</option>
                <option value="AMBIENT">Ambient Kitchen</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Minimum Stock Alert ({ingredient.unit})
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={minAlertLevel}
                onChange={(e) => setMinAlertLevel(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Maximum Stock ({ingredient.unit})
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={maxStockLevel}
                onChange={(e) => setMaxStockLevel(e.target.value)}
                placeholder="Leave blank for unlimited"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="isActiveCheck" className="text-xs font-semibold text-gray-700 cursor-pointer">
              Active for recipe consumption & procurement
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Update Ingredient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ====================================================================
// SUB-COMPONENT: OPENING STOCK ENTRY MODAL
// ====================================================================
interface OpeningStockModalProps {
  ingredient: Ingredient;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function OpeningStockModal({ ingredient, onClose, onSuccess }: OpeningStockModalProps) {
  const [quantity, setQuantity] = useState<number>(10);
  const [unit, setUnit] = useState<SupportedUnit>(ingredient.unit as SupportedUnit);
  const [unitCost, setUnitCost] = useState<number>(ingredient.costPerUnit || 280);
  const [notes, setNotes] = useState('Opening stock balance audit');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalCost = Number((quantity * unitCost).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (quantity <= 0) {
      setErrorMsg('Opening stock quantity must be strictly greater than 0.');
      return;
    }
    if (unitCost < 0) {
      setErrorMsg('Unit cost cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const tx = await IngredientService.postOpeningStock(ingredient.id, {
        quantity: Number(quantity),
        unit,
        unitCost: Number(unitCost),
        notes
      });
      onSuccess(
        `Opening stock finalized for '${ingredient.name}': +${tx.quantity} ${tx.unit} @ ₹${tx.unitCost}/${tx.unit} (₹${tx.totalCost}).`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post opening stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Coins className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Record Opening Stock</h3>
              <p className="text-xs text-gray-500">{ingredient.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Finalizing opening stock writes an immutable <strong>OPENING_STOCK</strong> ledger entry.
              Accidental duplicate posting is strictly prevented.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                placeholder="10"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none font-bold text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as SupportedUnit)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none font-semibold text-gray-800"
              >
                {SUPPORTED_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u} ({UNIT_METADATA_MAP[u].dimension})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Cost per Unit (₹ / {unit}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={unitCost}
              onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
              placeholder="280.00"
              className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none font-semibold text-gray-900"
            />
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-gray-500">Total Opening Value:</span>
            <span className="text-base font-bold text-gray-900">₹{totalCost.toFixed(2)}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Ledger Audit Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Finalize Opening Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ====================================================================
// SUB-COMPONENT: CATEGORIES MANAGEMENT MODAL
// ====================================================================
interface CategoriesModalProps {
  categories: IngredientCategory[];
  canManage: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function CategoriesModal({ categories, canManage, onClose, onSuccess }: CategoriesModalProps) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newCatName.trim()) {
      setErrorMsg('Category name cannot be blank.');
      return;
    }

    setIsSubmitting(true);
    try {
      await IngredientService.createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined
      });
      setNewCatName('');
      setNewCatDesc('');
      onSuccess(`Created category '${newCatName.trim()}'.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-gray-900 text-base">Ingredient Categories</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {canManage && (
            <form onSubmit={handleAddCategory} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Create New Category
              </h4>
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Seafood, Bakery & Buns, Syrups"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 focus:border-amber-500 rounded-lg outline-none"
                />
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Short description (optional)"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 focus:border-amber-500 rounded-lg outline-none"
                />
              </div>
              <div className="text-right">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          )}

          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Existing Categories ({categories.length})
            </h4>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
              {categories.map((cat) => (
                <div key={cat.id} className="p-3 bg-white flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{cat.name}</div>
                    {cat.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{cat.description}</div>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 shrink-0">
                    {cat.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 text-right bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
