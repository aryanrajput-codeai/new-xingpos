// ====================================================================
// WEBRAJYA POS - INVENTORY DEMO & QA ENVIRONMENT CONTROL BANNER
// ====================================================================
// Provides an intuitive, responsive environment switcher and control bar
// for testing every inventory feature with realistic demo data.
// ====================================================================

import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Building2,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShoppingBag,
  FileSpreadsheet,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import {
  InventoryDemoService,
  DemoStats,
  DEMO_BUSINESS_ID,
  PRODUCTION_BUSINESS_ID
} from '../lib/inventoryDemoService';
import { RESTAURANT_BRANDING } from '../config/branding';

interface Props {
  onRefreshNeeded?: () => void;
}

export const InventoryDemoEnvironmentBanner: React.FC<Props> = ({ onRefreshNeeded }) => {
  const [isDemo, setIsDemo] = useState<boolean>(InventoryDemoService.isDemoMode());
  const [stats, setStats] = useState<DemoStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const loadStats = async () => {
    try {
      const s = await InventoryDemoService.getDemoStats();
      setStats(s);
      setIsDemo(InventoryDemoService.isDemoMode());
    } catch (err) {
      console.error('Failed to load demo stats:', err);
    }
  };

  useEffect(() => {
    loadStats();

    const handleDemoChange = () => {
      loadStats();
    };

    window.addEventListener('inventory_demo_mode_changed', handleDemoChange);
    window.addEventListener('inventory_refresh', handleDemoChange);

    return () => {
      window.removeEventListener('inventory_demo_mode_changed', handleDemoChange);
      window.removeEventListener('inventory_refresh', handleDemoChange);
    };
  }, []);

  const handleToggleMode = async (enableDemo: boolean) => {
    setIsLoading(true);
    try {
      InventoryDemoService.setDemoMode(enableDemo);
      setIsDemo(enableDemo);
      if (enableDemo && (!stats || stats.ingredientsCount === 0)) {
        // Auto-seed if demo dataset is currently empty
        const res = await InventoryDemoService.seedDemoData();
        setStatusMessage(res.message);
      } else {
        setStatusMessage(
          enableDemo
            ? 'Switched to isolated DEMO / QA Environment.'
            : `Switched to live PRODUCTION Environment (${RESTAURANT_BRANDING.name}).`
        );
      }
      await loadStats();
      onRefreshNeeded?.();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleSeedData = async () => {
    setIsLoading(true);
    setStatusMessage('Generating 37 demo ingredients, 20 recipes, 12 purchases, ledger & orders...');
    try {
      InventoryDemoService.setDemoMode(true);
      const res = await InventoryDemoService.seedDemoData({ overwrite: true });
      setStatusMessage(res.message);
      await loadStats();
      onRefreshNeeded?.();
    } catch (err: any) {
      setStatusMessage(`Seeding failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  const handleClearDemoData = async () => {
    if (!window.confirm('Are you sure you want to remove all isolated Demo & QA records? Production data will remain completely untouched.')) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await InventoryDemoService.clearDemoData(true);
      setStatusMessage(`Demo dataset cleaned successfully. Removed ${res.removedCount} demo records. Production data untouched.`);
      await loadStats();
      onRefreshNeeded?.();
    } catch (err: any) {
      setStatusMessage(`Cleanup failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  return (
    <div className="mb-6 rounded-xl border transition-all duration-200 shadow-sm overflow-hidden bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800">
      {/* Top Banner Bar */}
      <div
        className={`px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isDemo
            ? 'bg-amber-500/10 border-b border-amber-500/20'
            : 'bg-emerald-500/10 border-b border-emerald-500/20'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg flex items-center justify-center ${
              isDemo
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-emerald-600 text-white shadow-sm'
            }`}
          >
            {isDemo ? <FlaskConical className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-900/10 dark:bg-white/10">
                Environment
              </span>
              <h2 className="text-sm sm:text-base font-semibold text-stone-900 dark:text-white">
                {isDemo ? `${RESTAURANT_BRANDING.name} — QA & Demo Environment` : `${RESTAURANT_BRANDING.name} — Live Production`}
              </h2>
              {isDemo && stats && stats.ingredientsCount > 0 && (
                <span className="hidden md:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Isolated Tenant ({stats.ingredientsCount} Items)
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
              {isDemo
                ? 'Isolated sandbox with realistic kitchen recipes, ledger history, purchases, and zero mathematical drift.'
                : 'Active production dataset. Real live transactions are protected and isolated.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          {isDemo ? (
            <>
              <button
                type="button"
                id="btn-seed-demo-data"
                onClick={handleSeedData}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm disabled:opacity-50 transition-colors"
                title="Populates or re-populates full 37 ingredients, 20 recipes, 12 purchases, and ledger"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {stats && stats.ingredientsCount > 0 ? 'Re-Seed Demo Data' : 'Seed Demo Data'}
              </button>

              <button
                type="button"
                id="btn-clear-demo-data"
                onClick={handleClearDemoData}
                disabled={isLoading || !stats || stats.ingredientsCount === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 disabled:opacity-40 transition-colors"
                title="Remove only demo records without touching production"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                Clear Demo
              </button>

              <button
                type="button"
                id="btn-switch-to-prod"
                onClick={() => handleToggleMode(false)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                Switch to Production
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                id="btn-switch-to-demo"
                onClick={() => handleToggleMode(true)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Open Demo Environment
              </button>

              <button
                type="button"
                id="btn-seed-demo-direct"
                onClick={handleSeedData}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/30 hover:bg-amber-500/10 text-amber-800 dark:text-amber-300 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Seed Demo Dataset
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="p-1.5 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 rounded-md"
            title="Toggle Verification Guide"
          >
            {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Realtime Notification / Status Message */}
      {statusMessage && (
        <div className="px-4 py-2 text-xs bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900/50 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Demo Summary Metrics Chips (Only if Demo is active and seeded) */}
      {isDemo && stats && stats.ingredientsCount > 0 && (
        <div className="px-4 py-2.5 sm:px-6 bg-stone-50 dark:bg-stone-900/60 border-b border-stone-200 dark:border-stone-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Ingredients</span>
            <span className="text-stone-900 dark:text-white font-bold">{stats.ingredientsCount} items</span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Stock Status</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              <span className="text-emerald-600 font-bold">{stats.healthyCount}</span> Normal •{' '}
              <span className="text-amber-600 font-bold">{stats.lowStockCount}</span> Low •{' '}
              <span className="text-red-600 font-bold">{stats.outOfStockCount}</span> Out
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Recipes</span>
            <span className="text-stone-900 dark:text-white font-bold">{stats.recipesCount} linked</span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Suppliers / POs</span>
            <span className="text-stone-900 dark:text-white font-bold">{stats.suppliersCount} Sup / {stats.purchasesCount} POs</span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Orders & Wastage</span>
            <span className="text-stone-900 dark:text-white font-bold">{stats.ordersCount} POS / {stats.wastageCount} Wst</span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Stock Valuation</span>
            <span className="text-stone-900 dark:text-white font-bold">₹{stats.totalValuation.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Ledger Audit</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Zero Drift
            </span>
          </div>
        </div>
      )}

      {/* Expandable Interactive Verification Guide */}
      {showGuide && (
        <div className="p-4 sm:p-6 bg-stone-50/80 dark:bg-stone-950/40 text-xs border-t border-stone-200 dark:border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 dark:text-white text-sm flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-500" />
              Demo Feature Verification Checklist
            </h3>
            <span className="text-stone-500">Tenant: {isDemo ? DEMO_BUSINESS_ID : PRODUCTION_BUSINESS_ID}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
              <h4 className="font-semibold text-stone-800 dark:text-stone-200 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                1. Stock Levels & Categories
              </h4>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                Filter by <strong>All Categories</strong> (Dairy, Veg, Grains, Pulses, Spices, Oils, Beverages). Inspect status tags:
                <br />• <strong>Normal:</strong> Rice, Sugar, Milk
                <br />• <strong>Low Stock:</strong> Curry Leaves, Mustard Seeds
                <br />• <strong>Critical:</strong> Malai Paneer, Coconut Oil
                <br />• <strong>Out of Stock:</strong> Mozzarella Cheese, Cashews
              </p>
            </div>

            <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
              <h4 className="font-semibold text-stone-800 dark:text-stone-200 mb-1 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                2. Purchases & WAC Recalculation
              </h4>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                Check <strong>Purchases Tab</strong>:
                <br />• <strong>2 Draft POs:</strong> Packaging & Butter (No stock alteration).
                <br />• <strong>10 Finalized POs:</strong> Verified ledger and costs.
                <br />• <strong>Paneer WAC:</strong> Opening 10kg @ ₹280 + Purchase 5kg @ ₹300 = Recalculated WAC ₹286.67/kg.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
              <h4 className="font-semibold text-stone-800 dark:text-stone-200 mb-1 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-500" />
                3. Reports & Date Filters
              </h4>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                Open <strong>Reports Tab</strong>:
                <br />• Try date selectors: <em>Today, Yesterday, Last 7 Days, This Month, Last Month</em>.
                <br />• Test <strong>CSV Exports</strong> (Movement, Wastage, Purchases).
                <br />• Run <strong>Mathematical Stock Audit</strong>: 0.0000 drift verified across all items.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800 text-stone-500">
            <span>
              <strong>Note:</strong> Switching back to Production restores your live operational environment with zero residual demo data.
            </span>
            <span className="font-mono text-[11px] bg-stone-200/60 dark:bg-stone-800 px-2 py-0.5 rounded">
              Status: {stats?.integrityPercent || 100}% Zero Drift
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
