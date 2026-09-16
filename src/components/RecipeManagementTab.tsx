// ====================================================================
// WEBRAJYA POS - RECIPE MANAGEMENT & COSTING TAB
// ====================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Filter,
  BookOpen,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit3,
  Trash2,
  Power,
  RefreshCw,
  Info,
  X,
  TrendingDown,
  TrendingUp,
  Boxes,
  PieChart,
  ChefHat,
  ChevronRight,
  Eye,
  Utensils
} from 'lucide-react';
import {
  Recipe,
  RecipeItem,
  RecipeItemDTO,
  Ingredient,
  RecipeCostBreakdown,
  RecipeAvailability
} from '../types/inventory';
import { MenuItem } from '../types';
import {
  SupportedUnit,
  SUPPORTED_UNITS,
  UNIT_METADATA_MAP,
  isSupportedUnit,
  areUnitsCompatible
} from '../lib/unitConversion';
import { RecipeService } from '../lib/recipeService';
import { IngredientService } from '../lib/ingredientService';
import { LocalDB } from '../lib/db';
import { RBACService } from '../lib/rbac';
import {
  calculateIngredientCost,
  calculateRecipeCost,
  calculateRecipeAvailability
} from '../lib/recipeCosting';
import { InventoryDemoEnvironmentBanner } from './InventoryDemoEnvironmentBanner';

interface MenuRecipeItemOverview {
  menuItem: MenuItem;
  recipe: Recipe | null;
  costBreakdown: RecipeCostBreakdown | null;
  availability: RecipeAvailability | null;
}

export default function RecipeManagementTab() {
  const [overviewData, setOverviewData] = useState<MenuRecipeItemOverview[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Permissions
  const canManage = RBACService.hasPermission('inventory.manage') || RBACService.hasPermission('menu.edit');
  const canView = RBACService.hasPermission('inventory.view') || RBACService.hasPermission('menu.view');

  // Modals
  const [editingTargetMenuItem, setEditingTargetMenuItem] = useState<MenuItem | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewingCostBreakdown, setViewingCostBreakdown] = useState<MenuRecipeItemOverview | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Recipe | null>(null);

  // Toast / Feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load all recipes, menu items, and ingredients
  const loadData = async () => {
    setIsLoading(true);
    try {
      const bId = RecipeService.getCurrentBusinessId();
      const overview = await RecipeService.getMenuRecipeOverview(bId);
      const ingList = await IngredientService.getIngredients(bId);

      setOverviewData(overview);
      setIngredients(ingList);

      // Extract unique categories from menu items
      const uniqueCats = Array.from(new Set(overview.map((o) => o.menuItem.category))).filter(Boolean);
      setCategories(uniqueCats);
    } catch (err: any) {
      console.error('Failed to load recipe overview:', err);
      showToast('error', err.message || 'Failed to load recipe catalog');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('recipes_updated', handleUpdate);
    window.addEventListener('ingredients_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('recipes_updated', handleUpdate);
      window.removeEventListener('ingredients_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Keyboard shortcut listener: Press '/' to focus search, 'Esc' to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (editingTargetMenuItem) {
          setEditingTargetMenuItem(null);
          setEditingRecipe(null);
        } else if (viewingCostBreakdown) {
          setViewingCostBreakdown(null);
        } else if (deleteConfirmTarget) {
          setDeleteConfirmTarget(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTargetMenuItem, viewingCostBreakdown, deleteConfirmTarget]);

  // Filtered menu items
  const filteredData = useMemo(() => {
    return overviewData.filter((item) => {
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = item.menuItem.name.toLowerCase().includes(query);
        const matchesCode = (item.menuItem.itemCode || '').toLowerCase().includes(query);
        const matchesRecipeName = item.recipe?.recipeName?.toLowerCase().includes(query) || false;
        if (!matchesName && !matchesCode && !matchesRecipeName) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'ALL' && item.menuItem.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (selectedStatus === 'CONFIGURED') {
        return item.recipe !== null;
      }
      if (selectedStatus === 'NEEDS_RECIPE') {
        return item.recipe === null;
      }
      if (selectedStatus === 'IN_STOCK') {
        return item.availability !== null && item.availability.isAvailable;
      }
      if (selectedStatus === 'OUT_OF_STOCK') {
        return item.availability !== null && !item.availability.isAvailable;
      }

      return true;
    });
  }, [overviewData, searchQuery, selectedCategory, selectedStatus]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalMenuItems = overviewData.length;
    const configuredRecipes = overviewData.filter((o) => o.recipe !== null).length;
    const configuredItems = overviewData.filter((o) => o.costBreakdown && o.costBreakdown.foodCostPercentage !== undefined);
    
    const avgFoodCost = configuredItems.length > 0
      ? configuredItems.reduce((acc, curr) => acc + (curr.costBreakdown?.foodCostPercentage || 0), 0) / configuredItems.length
      : 0;

    const inStockCount = overviewData.filter((o) => o.availability?.isAvailable).length;
    const outOfStockCount = overviewData.filter((o) => o.recipe && (!o.availability || !o.availability.isAvailable)).length;

    return {
      totalMenuItems,
      configuredRecipes,
      avgFoodCost,
      inStockCount,
      outOfStockCount
    };
  }, [overviewData]);

  // Open recipe editor for a menu item
  const handleOpenEditor = (menuItem: MenuItem, recipe: Recipe | null) => {
    if (!canManage) {
      showToast('error', 'You do not have permission to manage recipes.');
      return;
    }
    setEditingTargetMenuItem(menuItem);
    setEditingRecipe(recipe);
  };

  // Toggle recipe active status
  const handleToggleActive = async (recipe: Recipe) => {
    if (!canManage) {
      showToast('error', 'You do not have permission to manage recipes.');
      return;
    }
    try {
      const updated = await RecipeService.toggleRecipeActive(recipe.id);
      showToast('success', `Recipe '${recipe.recipeName}' marked as ${updated.isActive ? 'Active' : 'Inactive'}.`);
      await loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to toggle recipe status');
    }
  };

  // Delete recipe
  const handleDeleteRecipe = async () => {
    if (!deleteConfirmTarget) return;
    try {
      await RecipeService.deleteRecipe(deleteConfirmTarget.id);
      showToast('success', `Recipe '${deleteConfirmTarget.recipeName}' deleted successfully.`);
      setDeleteConfirmTarget(null);
      await loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete recipe');
    }
  };

  return (
    <div id="recipe-management-tab" className="flex flex-col h-full bg-slate-50 text-slate-900">
      {/* Toast notification banner */}
      {toastMessage && (
        <div
          id="recipe-toast-banner"
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all transform animate-in fade-in duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Isolated Demo & QA Environment Control Banner */}
        <InventoryDemoEnvironmentBanner onRefreshNeeded={loadData} />

        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shadow-sm">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Recipe Book & Costing
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Connect POS menu items to raw ingredients with automated costing and live servings availability.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="recipe-refresh-btn"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium rounded-lg shadow-sm transition-colors"
              title="Refresh recipe data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-orange-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Dishes in Menu</span>
              <Utensils className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{metrics.totalMenuItems}</span>
              <span className="text-xs text-slate-500">POS items</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {metrics.configuredRecipes} configured with recipes ({Math.round((metrics.configuredRecipes / (metrics.totalMenuItems || 1)) * 100)}%)
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Recipes Configured</span>
              <BookOpen className="w-4 h-4 text-orange-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-orange-600">{metrics.configuredRecipes}</span>
              <span className="text-xs text-slate-500">/ {metrics.totalMenuItems} dishes</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {metrics.totalMenuItems - metrics.configuredRecipes} items awaiting recipe mapping
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Avg Food Cost %</span>
              <PieChart className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {metrics.avgFoodCost > 0 ? `${metrics.avgFoodCost.toFixed(1)}%` : '—'}
              </span>
              <span className="text-xs text-emerald-600 font-medium">Optimal: 28-35%</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Calculated dynamically from current raw ingredient costs
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Live Servings Stock</span>
              <Boxes className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600">{metrics.inStockCount}</span>
              <span className="text-xs text-slate-500">in stock</span>
              {metrics.outOfStockCount > 0 && (
                <span className="text-xs text-rose-600 font-semibold ml-1">
                  ({metrics.outOfStockCount} out of stock)
                </span>
              )}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Based on the limiting ingredient in current storage
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                id="recipe-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dish name, recipe title, or item code... (Press '/' to focus)"
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                id="recipe-category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium self-start md:self-auto overflow-x-auto">
              <button
                onClick={() => setSelectedStatus('ALL')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  selectedStatus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({overviewData.length})
              </button>
              <button
                onClick={() => setSelectedStatus('CONFIGURED')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  selectedStatus === 'CONFIGURED'
                    ? 'bg-white text-orange-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                With Recipe ({metrics.configuredRecipes})
              </button>
              <button
                onClick={() => setSelectedStatus('NEEDS_RECIPE')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  selectedStatus === 'NEEDS_RECIPE'
                    ? 'bg-white text-amber-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Needs Recipe ({metrics.totalMenuItems - metrics.configuredRecipes})
              </button>
              <button
                onClick={() => setSelectedStatus('IN_STOCK')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  selectedStatus === 'IN_STOCK'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                In Stock ({metrics.inStockCount})
              </button>
            </div>
          </div>
        </div>

        {/* Menu Items & Recipes List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-orange-600 mb-3" />
              <p className="text-sm font-medium">Loading recipe catalog & live ingredient costs...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <ChefHat className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-base font-semibold text-slate-700">No matching menu dishes found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
                Try adjusting your search query, clearing filters, or create a recipe for an existing POS menu item.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Menu Dish</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4">Recipe Status</th>
                    <th className="py-3 px-4">Ingredients</th>
                    <th className="py-3 px-4 text-right">Recipe Cost</th>
                    <th className="py-3 px-4 text-center">Food Cost %</th>
                    <th className="py-3 px-4">Live Servings</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredData.map((item) => {
                    const { menuItem, recipe, costBreakdown, availability } = item;
                    const hasRecipe = recipe !== null;
                    const isVeg = menuItem.isVeg;

                    return (
                      <tr
                        key={menuItem.id}
                        id={`recipe-row-${menuItem.id}`}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Menu Dish details */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 flex items-center justify-center">
                              {menuItem.imageUrl ? (
                                <img
                                  src={menuItem.imageUrl}
                                  alt={menuItem.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Utensils className="w-5 h-5 text-slate-400" />
                              )}
                              <span
                                className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                  isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                                title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">
                                {menuItem.name}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="capitalize">{menuItem.category}</span>
                                {menuItem.itemCode && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-slate-400 text-[11px]">
                                      {menuItem.itemCode}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Selling Price */}
                        <td className="py-3 px-4 text-right font-medium text-slate-900">
                          ₹{menuItem.price.toFixed(2)}
                        </td>

                        {/* Recipe Status */}
                        <td className="py-3 px-4">
                          {!hasRecipe ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Needs Recipe
                            </span>
                          ) : recipe.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active Recipe
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Ingredients count & summary */}
                        <td className="py-3 px-4 text-slate-600 text-xs">
                          {hasRecipe && recipe.items && recipe.items.length > 0 ? (
                            <div>
                              <span className="font-semibold text-slate-900">
                                {recipe.items.length} {recipe.items.length === 1 ? 'ingredient' : 'ingredients'}
                              </span>
                              <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                {recipe.items
                                  .map((it) => it.ingredient?.name || 'Raw item')
                                  .slice(0, 3)
                                  .join(', ')}
                                {recipe.items.length > 3 && ` +${recipe.items.length - 3} more`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No ingredients mapped</span>
                          )}
                        </td>

                        {/* Recipe Cost */}
                        <td className="py-3 px-4 text-right">
                          {costBreakdown ? (
                            <div>
                              <div className="font-semibold text-slate-900">
                                ₹{costBreakdown.costPerServing.toFixed(2)}
                              </div>
                              <div className="text-[11px] text-emerald-700 font-medium">
                                Margin: ₹{(costBreakdown.grossMargin || 0).toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Food Cost % */}
                        <td className="py-3 px-4 text-center">
                          {costBreakdown && costBreakdown.foodCostPercentage !== undefined ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                costBreakdown.foodCostPercentage <= 30
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : costBreakdown.foodCostPercentage <= 38
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                              title={`Raw food cost: ${costBreakdown.foodCostPercentage}% of selling price`}
                            >
                              {costBreakdown.foodCostPercentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Live Servings Availability */}
                        <td className="py-3 px-4">
                          {availability ? (
                            <div>
                              {availability.isAvailable ? (
                                <div className="flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>{availability.availableServings} servings</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-rose-600 font-semibold text-xs">
                                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>Unavailable (0)</span>
                                </div>
                              )}

                              {availability.limitingIngredientName && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[170px]" title={`Bottleneck ingredient: ${availability.limitingIngredientName}`}>
                                  Limited by: {availability.limitingIngredientName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {!hasRecipe ? (
                            <button
                              id={`create-recipe-btn-${menuItem.id}`}
                              onClick={() => handleOpenEditor(menuItem, null)}
                              disabled={!canManage}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Create Recipe</span>
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              {/* Cost Breakdown button */}
                              <button
                                id={`view-cost-btn-${menuItem.id}`}
                                onClick={() => setViewingCostBreakdown(item)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                title="View Cost & Inventory Breakdown"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Edit Recipe button */}
                              <button
                                id={`edit-recipe-btn-${menuItem.id}`}
                                onClick={() => handleOpenEditor(menuItem, recipe)}
                                disabled={!canManage}
                                className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors disabled:opacity-50"
                                title="Edit Recipe"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Toggle active button */}
                              <button
                                id={`toggle-recipe-btn-${menuItem.id}`}
                                onClick={() => handleToggleActive(recipe)}
                                disabled={!canManage}
                                className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${
                                  recipe.isActive
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-slate-400 hover:bg-slate-100'
                                }`}
                                title={recipe.isActive ? 'Deactivate Recipe' : 'Activate Recipe'}
                              >
                                <Power className="w-4 h-4" />
                              </button>

                              {/* Delete button */}
                              <button
                                id={`delete-recipe-btn-${menuItem.id}`}
                                onClick={() => setDeleteConfirmTarget(recipe)}
                                disabled={!canManage}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
                                title="Delete Recipe"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* RECIPE EDITOR MODAL */}
      {editingTargetMenuItem && (
        <RecipeEditorModal
          menuItem={editingTargetMenuItem}
          existingRecipe={editingRecipe}
          availableIngredients={ingredients}
          onClose={() => {
            setEditingTargetMenuItem(null);
            setEditingRecipe(null);
          }}
          onSaved={async () => {
            setEditingTargetMenuItem(null);
            setEditingRecipe(null);
            showToast(
              'success',
              editingRecipe ? 'Recipe updated successfully.' : 'Recipe created successfully.'
            );
            await loadData();
          }}
        />
      )}

      {/* RECIPE COST & INVENTORY BREAKDOWN MODAL */}
      {viewingCostBreakdown && (
        <RecipeCostBreakdownModal
          item={viewingCostBreakdown}
          onClose={() => setViewingCostBreakdown(null)}
          onEdit={() => {
            const mItem = viewingCostBreakdown.menuItem;
            const rec = viewingCostBreakdown.recipe;
            setViewingCostBreakdown(null);
            setEditingTargetMenuItem(mItem);
            setEditingRecipe(rec);
          }}
        />
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Delete Recipe?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete the recipe for{' '}
              <span className="font-semibold text-slate-900">
                '{deleteConfirmTarget.recipeName}'
              </span>
              ? This will remove all ingredient associations and costing calculations.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRecipe}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg shadow-sm"
              >
                Delete Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// SUB-COMPONENT: RECIPE EDITOR MODAL
// ====================================================================

interface RecipeEditorModalProps {
  menuItem: MenuItem;
  existingRecipe: Recipe | null;
  availableIngredients: Ingredient[];
  onClose: () => void;
  onSaved: () => void;
}

interface DraftIngredientRow {
  ingredientId: string;
  quantity: string;
  unit: SupportedUnit;
  wastePercentage: string;
  notes: string;
}

function RecipeEditorModal({
  menuItem,
  existingRecipe,
  availableIngredients,
  onClose,
  onSaved
}: RecipeEditorModalProps) {
  const [recipeName, setRecipeName] = useState(
    existingRecipe?.recipeName || `${menuItem.name} Recipe`
  );
  const [portionSize, setPortionSize] = useState<string>(
    existingRecipe?.portionSize?.toString() || '1'
  );
  const [servingUnit, setServingUnit] = useState<string>(
    existingRecipe?.servingUnit || 'portion'
  );
  const [preparationNotes, setPreparationNotes] = useState(
    existingRecipe?.preparationNotes || ''
  );
  const [laborCost, setLaborCost] = useState<string>(
    existingRecipe?.laborCost?.toString() || '0'
  );
  const [overheadCost, setOverheadCost] = useState<string>(
    existingRecipe?.overheadCost?.toString() || '0'
  );
  const [isActive, setIsActive] = useState<boolean>(
    existingRecipe?.isActive !== undefined ? existingRecipe.isActive : true
  );

  // Draft ingredient rows
  const [rows, setRows] = useState<DraftIngredientRow[]>(() => {
    if (existingRecipe?.items && existingRecipe.items.length > 0) {
      return existingRecipe.items.map((it) => ({
        ingredientId: it.ingredientId,
        quantity: it.quantity.toString(),
        unit: it.unit as SupportedUnit,
        wastePercentage: it.wastePercentage ? it.wastePercentage.toString() : '0',
        notes: it.notes || ''
      }));
    }
    // Default 1 blank row
    return [
      {
        ingredientId: availableIngredients[0]?.id || '',
        quantity: '100',
        unit: (availableIngredients[0]?.unit as SupportedUnit) || 'g',
        wastePercentage: '0',
        notes: ''
      }
    ];
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Map of ingredients for fast lookup
  const ingredientMap = useMemo(() => {
    return new Map(availableIngredients.map((i) => [i.id, i]));
  }, [availableIngredients]);

  // Add ingredient row
  const handleAddRow = () => {
    // Pick an ingredient not yet in rows
    const usedIds = new Set(rows.map((r) => r.ingredientId));
    const nextAvailable = availableIngredients.find((i) => !usedIds.has(i.id)) || availableIngredients[0];

    const newUnit: SupportedUnit = nextAvailable ? (nextAvailable.unit as SupportedUnit) : 'g';

    setRows([
      ...rows,
      {
        ingredientId: nextAvailable ? nextAvailable.id : '',
        quantity: '50',
        unit: newUnit,
        wastePercentage: '0',
        notes: ''
      }
    ]);
  };

  // Remove ingredient row
  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      setValidationError('A recipe must have at least one ingredient.');
      return;
    }
    setRows(rows.filter((_, idx) => idx !== index));
  };

  // Update ingredient row field
  const handleRowChange = (
    index: number,
    field: keyof DraftIngredientRow,
    value: string
  ) => {
    setValidationError(null);
    const updated = [...rows];
    const currentRow = { ...updated[index], [field]: value };

    // If ingredientId changed, automatically adjust unit to compatible unit
    if (field === 'ingredientId') {
      const selectedIng = ingredientMap.get(value);
      if (selectedIng) {
        currentRow.unit = selectedIng.unit as SupportedUnit;
      }
    }

    updated[index] = currentRow;
    setRows(updated);
  };

  // Live real-time calculations
  const liveCalculation = useMemo(() => {
    const validItems: RecipeItemDTO[] = [];
    for (const r of rows) {
      const q = parseFloat(r.quantity);
      const w = parseFloat(r.wastePercentage);
      if (r.ingredientId && !isNaN(q) && q > 0) {
        validItems.push({
          ingredientId: r.ingredientId,
          quantity: q,
          unit: r.unit,
          wastePercentage: !isNaN(w) ? w : 0,
          notes: r.notes
        });
      }
    }

    const pSize = parseFloat(portionSize);
    const lCost = parseFloat(laborCost);
    const oCost = parseFloat(overheadCost);

    const draftRecipe: Omit<Partial<Recipe>, 'items'> & { items: RecipeItemDTO[] } = {
      menuItemId: menuItem.id,
      portionSize: !isNaN(pSize) && pSize > 0 ? pSize : 1,
      laborCost: !isNaN(lCost) ? lCost : 0,
      overheadCost: !isNaN(oCost) ? oCost : 0,
      items: validItems
    };

    const costBreakdown = calculateRecipeCost(draftRecipe, availableIngredients, menuItem);
    const availability = calculateRecipeAvailability(draftRecipe, availableIngredients);

    return {
      costBreakdown,
      availability
    };
  }, [rows, portionSize, laborCost, overheadCost, menuItem, availableIngredients]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // 1. Basic validation
    if (!recipeName.trim()) {
      setValidationError('Recipe name is required.');
      return;
    }

    const pSize = parseFloat(portionSize);
    if (isNaN(pSize) || pSize <= 0) {
      setValidationError('Portion size must be a positive number greater than 0.');
      return;
    }

    if (rows.length === 0) {
      setValidationError('A recipe must have at least one ingredient.');
      return;
    }

    // 2. Ingredient rows validation
    const parsedItems: RecipeItemDTO[] = [];
    const usedIngredientIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.ingredientId) {
        setValidationError(`Row ${i + 1}: Please select an ingredient.`);
        return;
      }

      if (usedIngredientIds.has(row.ingredientId)) {
        const ingName = ingredientMap.get(row.ingredientId)?.name || 'Selected ingredient';
        setValidationError(
          `Duplicate ingredient '${ingName}' in row ${i + 1}. Each ingredient can only be added once per recipe.`
        );
        return;
      }
      usedIngredientIds.add(row.ingredientId);

      const qty = parseFloat(row.quantity);
      if (isNaN(qty) || qty <= 0) {
        setValidationError(`Row ${i + 1}: Quantity must be a positive number greater than 0.`);
        return;
      }

      const waste = parseFloat(row.wastePercentage || '0');
      if (isNaN(waste) || waste < 0 || waste >= 100) {
        setValidationError(`Row ${i + 1}: Wastage percentage must be between 0% and 99%.`);
        return;
      }

      const ing = ingredientMap.get(row.ingredientId);
      if (!ing) {
        setValidationError(`Row ${i + 1}: Selected ingredient is invalid or belongs to another business.`);
        return;
      }

      if (!areUnitsCompatible(row.unit, ing.unit)) {
        setValidationError(
          `Row ${i + 1}: Incompatible unit '${row.unit}' for '${ing.name}' which is measured in '${ing.unit}'.`
        );
        return;
      }

      parsedItems.push({
        ingredientId: row.ingredientId,
        quantity: qty,
        unit: row.unit,
        wastePercentage: waste,
        notes: row.notes.trim()
      });
    }

    setIsSaving(true);
    try {
      if (existingRecipe) {
        // Update
        await RecipeService.updateRecipe(existingRecipe.id, {
          recipeName: recipeName.trim(),
          portionSize: pSize,
          servingUnit: servingUnit.trim() || 'portion',
          preparationNotes: preparationNotes.trim(),
          laborCost: parseFloat(laborCost) || 0,
          overheadCost: parseFloat(overheadCost) || 0,
          isActive,
          items: parsedItems
        });
      } else {
        // Create
        await RecipeService.createRecipe({
          menuItemId: menuItem.id,
          recipeName: recipeName.trim(),
          portionSize: pSize,
          servingUnit: servingUnit.trim() || 'portion',
          preparationNotes: preparationNotes.trim(),
          laborCost: parseFloat(laborCost) || 0,
          overheadCost: parseFloat(overheadCost) || 0,
          isActive,
          items: parsedItems
        });
      }

      onSaved();
    } catch (err: any) {
      console.error('Recipe save error:', err);
      setValidationError(err.message || 'Failed to save recipe. Please check all fields.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="recipe-editor-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-auto border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 flex-shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {existingRecipe ? 'Edit Dish Recipe' : 'Create Dish Recipe'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{menuItem.name}</span>
                <span>•</span>
                <span>Selling Price: ₹{menuItem.price.toFixed(2)}</span>
                <span>•</span>
                <span className="capitalize">{menuItem.category}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <div className="flex-1 font-medium">{validationError}</div>
              <button
                type="button"
                onClick={() => setValidationError(null)}
                className="text-rose-500 hover:text-rose-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Recipe Metadata Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Recipe Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="e.g. Nagpur Tarri Butter Masala Dosa Recipe"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Batch Yield / Portion Size <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={portionSize}
                  onChange={(e) => setPortionSize(e.target.value)}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                  required
                />
                <input
                  type="text"
                  value={servingUnit}
                  onChange={(e) => setServingUnit(e.target.value)}
                  placeholder="e.g. portion, plate"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Ingredients Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Recipe Ingredients ({rows.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Select raw ingredients from current storage. Wastage accounts for peeling/cooking loss.
                </p>
              </div>

              <button
                type="button"
                id="recipe-add-ingredient-btn"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ingredient</span>
              </button>
            </div>

            {/* Ingredients Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Ingredient</th>
                    <th className="py-2.5 px-3 w-28">Quantity</th>
                    <th className="py-2.5 px-3 w-24">Unit</th>
                    <th className="py-2.5 px-3 w-24" title="Cooking or trimming loss percentage">
                      Waste %
                    </th>
                    <th className="py-2.5 px-3 w-28 text-right">Row Cost</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => {
                    const selectedIng = ingredientMap.get(row.ingredientId);
                    // Available units: only units sharing the dimension with selected ingredient!
                    const compatibleUnits: SupportedUnit[] = selectedIng
                      ? (SUPPORTED_UNITS.filter((u) =>
                          areUnitsCompatible(u, selectedIng.unit)
                        ) as SupportedUnit[])
                      : ['g', 'kg'];

                    // Row dynamic cost
                    let rowCost = 0;
                    if (selectedIng) {
                      const qty = parseFloat(row.quantity);
                      const waste = parseFloat(row.wastePercentage);
                      if (!isNaN(qty) && qty > 0) {
                        try {
                          const c = calculateIngredientCost(
                            {
                              ingredientId: selectedIng.id,
                              quantity: qty,
                              unit: row.unit,
                              wastePercentage: !isNaN(waste) ? waste : 0
                            },
                            selectedIng
                          );
                          rowCost = c.calculatedCost;
                        } catch (e) {
                          rowCost = 0;
                        }
                      }
                    }

                    return (
                      <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                        {/* Ingredient Dropdown */}
                        <td className="py-2 px-3">
                          <select
                            value={row.ingredientId}
                            onChange={(e) => handleRowChange(index, 'ingredientId', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium"
                          >
                            {availableIngredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} (Stock: {ing.currentStock} {ing.unit} @ ₹{ing.costPerUnit}/{ing.unit})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity input */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(index, 'quantity', e.target.value)}
                            placeholder="Qty"
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono text-right"
                          />
                        </td>

                        {/* Unit selector */}
                        <td className="py-2 px-3">
                          <select
                            value={row.unit}
                            onChange={(e) => handleRowChange(index, 'unit', e.target.value as SupportedUnit)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium"
                          >
                            {compatibleUnits.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Wastage % */}
                        <td className="py-2 px-3">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="99"
                              step="any"
                              value={row.wastePercentage}
                              onChange={(e) => handleRowChange(index, 'wastePercentage', e.target.value)}
                              className="w-full pl-2 pr-5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono text-right"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">
                              %
                            </span>
                          </div>
                        </td>

                        {/* Row Cost */}
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                          ₹{rowCost.toFixed(2)}
                        </td>

                        {/* Remove button */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                            title="Remove ingredient"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-time Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200/80 pb-2">
              <span className="flex items-center gap-1.5 text-slate-900">
                <ChefHat className="w-4 h-4 text-orange-600" />
                Live Costing & Availability Summary
              </span>
              <span className="text-slate-500 font-normal">
                Updated in real time
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[11px] text-slate-500 uppercase tracking-wider">Raw Material Cost</div>
                <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                  ₹{liveCalculation.costBreakdown.totalRecipeCost.toFixed(2)}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[11px] text-slate-500 uppercase tracking-wider">Food Cost %</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    (liveCalculation.costBreakdown.foodCostPercentage || 0) <= 30
                      ? 'text-emerald-600'
                      : (liveCalculation.costBreakdown.foodCostPercentage || 0) <= 38
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {liveCalculation.costBreakdown.foodCostPercentage !== undefined
                    ? `${liveCalculation.costBreakdown.foodCostPercentage.toFixed(1)}%`
                    : '—'}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[11px] text-slate-500 uppercase tracking-wider">Gross Profit Margin</div>
                <div className="text-base font-bold text-emerald-600 font-mono mt-0.5">
                  ₹{(liveCalculation.costBreakdown.grossMargin || 0).toFixed(2)}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[11px] text-slate-500 uppercase tracking-wider">Live Servings</div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    liveCalculation.availability.isAvailable
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {liveCalculation.availability.availableServings} servings
                </div>
              </div>
            </div>

            {liveCalculation.availability.limitingIngredientName && (
              <div className="mt-2.5 text-xs text-slate-600 flex items-center justify-between px-1">
                <span>
                  <strong className="text-slate-800">Bottleneck:</strong>{' '}
                  {liveCalculation.availability.limitingIngredientName} (current stock limits production to{' '}
                  {liveCalculation.availability.availableServings} servings)
                </span>
              </div>
            )}
          </div>

          {/* Culinary Prep Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Preparation Notes & Cooking Instructions
            </label>
            <textarea
              rows={3}
              value={preparationNotes}
              onChange={(e) => setPreparationNotes(e.target.value)}
              placeholder="e.g. Ferment batter overnight at 30°C. Cook on medium-high tawa with pure ghee..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-slate-100">
            <div>
              <span className="text-sm font-semibold text-slate-900">Active Recipe</span>
              <p className="text-xs text-slate-500">
                Active recipes automatically calculate live menu item availability and food costs.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Recipe...</span>
              </>
            ) : (
              <span>Save Recipe</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// SUB-COMPONENT: RECIPE COST BREAKDOWN MODAL
// ====================================================================

interface RecipeCostBreakdownModalProps {
  item: MenuRecipeItemOverview;
  onClose: () => void;
  onEdit: () => void;
}

function RecipeCostBreakdownModal({ item, onClose, onEdit }: RecipeCostBreakdownModalProps) {
  const { menuItem, recipe, costBreakdown, availability } = item;

  return (
    <div
      id="recipe-cost-breakdown-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-auto border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Recipe Costing & Inventory Audit
              </h2>
              <p className="text-xs text-slate-500">
                {menuItem.name} • Selling Price: ₹{menuItem.price.toFixed(2)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Level Financial Summary */}
          {costBreakdown && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Selling Price</div>
                <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                  ₹{menuItem.price.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Total Raw Cost</div>
                <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                  ₹{costBreakdown.totalRecipeCost.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Food Cost Ratio</div>
                <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">
                  {costBreakdown.foodCostPercentage?.toFixed(1)}%
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Gross Profit Margin</div>
                <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">
                  ₹{costBreakdown.grossMargin?.toFixed(2)} ({costBreakdown.grossMarginPercentage?.toFixed(1)}%)
                </div>
              </div>
            </div>
          )}

          {/* Ingredient-by-Ingredient Cost Breakdown */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Ingredient Cost Allocation
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Ingredient</th>
                    <th className="py-2.5 px-3">Recipe Qty</th>
                    <th className="py-2.5 px-3">Wastage</th>
                    <th className="py-2.5 px-3">Effective Raw Qty</th>
                    <th className="py-2.5 px-3 text-right">Base Cost</th>
                    <th className="py-2.5 px-3 text-right">Extended Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costBreakdown?.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {it.ingredientName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {it.specifiedQuantity} {it.specifiedUnit}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {it.wastePercentage > 0 ? `${it.wastePercentage}%` : '0%'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {it.effectiveQuantity} {it.specifiedUnit} ({it.normalizedBaseQuantity} {it.baseUnit})
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        ₹{it.costPerBaseUnit}/{it.baseUnit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{it.calculatedCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Inventory Servings Bottleneck Table */}
          {availability && availability.ingredientAvailabilities.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Live Inventory Capacity & Bottlenecks
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Ingredient</th>
                      <th className="py-2.5 px-3">Available Stock</th>
                      <th className="py-2.5 px-3">Required / Serving</th>
                      <th className="py-2.5 px-3 text-right">Max Servings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {availability.ingredientAvailabilities.map((avail, idx) => {
                      const isBottleneck =
                        avail.ingredientId === availability.limitingIngredientId;

                      return (
                        <tr
                          key={idx}
                          className={isBottleneck ? 'bg-amber-50/50' : 'hover:bg-slate-50/60'}
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900">
                              {avail.ingredientName}
                            </span>
                            {isBottleneck && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-200 text-amber-900 uppercase tracking-wider">
                                Bottleneck
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {avail.currentStock} {avail.stockUnit}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {avail.effectiveRequiredPerServing} {avail.requiredUnit}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold ${
                              avail.maxServings === 0
                                ? 'text-rose-600'
                                : isBottleneck
                                ? 'text-amber-800'
                                : 'text-slate-800'
                            }`}
                          >
                            {avail.maxServings === 999999 ? 'Unlimited' : avail.maxServings}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {recipe?.preparationNotes && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Culinary Instructions
              </span>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                {recipe.preparationNotes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-lg"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Recipe</span>
          </button>
        </div>
      </div>
    </div>
  );
}
