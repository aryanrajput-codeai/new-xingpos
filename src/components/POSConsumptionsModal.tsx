import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  PackageCheck,
  RotateCcw,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Layers,
  Scale,
  Calendar,
  UtensilsCrossed,
  FileSpreadsheet,
  Coins
} from 'lucide-react';
import {
  OrderInventoryConsumption,
  MissingRecipeNotice
} from '../types/inventory';
import { InventoryConsumptionService } from '../lib/inventoryConsumptionService';

interface POSConsumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function POSConsumptionsModal({
  isOpen,
  onClose
}: POSConsumptionsModalProps) {
  const [consumptions, setConsumptions] = useState<OrderInventoryConsumption[]>([]);
  const [missingLogs, setMissingLogs] = useState<MissingRecipeNotice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'CONSUMPTIONS' | 'MISSING_RECIPES'>('CONSUMPTIONS');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [history, missing] = await Promise.all([
          InventoryConsumptionService.getConsumptionHistory(),
          InventoryConsumptionService.getMissingRecipeLogs()
        ]);
        if (isMounted) {
          setConsumptions(history);
          setMissingLogs(missing);
        }
      } catch (err) {
        console.error('Failed to load consumption history:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('order_inventory_consumed', handleUpdate);
    window.addEventListener('inventory_transactions_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('order_inventory_consumed', handleUpdate);
      window.removeEventListener('inventory_transactions_updated', handleUpdate);
    };
  }, [isOpen]);

  const metrics = useMemo(() => {
    let totalCogs = 0;
    let totalItems = 0;
    let consumedCount = 0;
    let reversedCount = 0;

    consumptions.forEach((c) => {
      if (c.status === 'CONSUMED') {
        totalCogs += c.totalCost || 0;
        totalItems += c.totalItemsConsumed || 0;
        consumedCount++;
      } else if (c.status === 'REVERSED') {
        reversedCount++;
      }
    });

    return {
      totalCogs,
      totalItems,
      consumedCount,
      reversedCount,
      missingCount: missingLogs.length
    };
  }, [consumptions, missingLogs]);

  const filteredConsumptions = useMemo(() => {
    return consumptions.filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchOrderId = c.orderId.toLowerCase().includes(q);
      const matchItems = c.items?.some((i) => i.menuItemName.toLowerCase().includes(q));
      return matchOrderId || matchItems;
    });
  }, [consumptions, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-stone-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100/80 text-emerald-800 rounded-xl">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                  POS Automatic Inventory Consumptions
                </h3>
                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Phase 5 Live
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Audit trail of ingredients consumed automatically per POS finalized order
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-gray-50/50 border-b border-gray-100 shrink-0">
          <div className="bg-white p-3 rounded-xl border border-gray-200/80">
            <div className="text-[11px] font-mono text-gray-400 uppercase">Total COGS Consumed</div>
            <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
              ₹{metrics.totalCogs.toFixed(2)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Calculated recipe cost</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200/80">
            <div className="text-[11px] font-mono text-gray-400 uppercase">Orders Consumed</div>
            <div className="text-lg font-bold text-gray-900 font-mono mt-0.5">
              {metrics.consumedCount}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{metrics.totalItems} menu items</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200/80">
            <div className="text-[11px] font-mono text-gray-400 uppercase">Order Reversals</div>
            <div className="text-lg font-bold text-purple-700 font-mono mt-0.5">
              {metrics.reversedCount}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Cancelled / Voided orders</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200/80">
            <div className="text-[11px] font-mono text-gray-400 uppercase">Missing Recipes</div>
            <div className="text-lg font-bold text-amber-600 font-mono mt-0.5">
              {metrics.missingCount}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Orders with unmapped items</div>
          </div>
        </div>

        {/* View Selection Tabs & Search */}
        <div className="p-3 sm:p-4 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('CONSUMPTIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === 'CONSUMPTIONS'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Orders ({consumptions.length})
            </button>
            <button
              onClick={() => setActiveTab('MISSING_RECIPES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'MISSING_RECIPES'
                  ? 'bg-white text-amber-700 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>Missing Recipes</span>
              {missingLogs.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {missingLogs.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'CONSUMPTIONS' && (
            <div className="relative flex-1 max-w-xs min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order # or item name..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white rounded-xl outline-none font-mono"
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-gray-400 font-mono">
              Loading consumption logs...
            </div>
          ) : activeTab === 'MISSING_RECIPES' ? (
            missingLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400 font-mono">
                No missing recipe alerts logged. All ordered items have valid active recipes!
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 font-mono flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Missing Recipes Alert:</span> The items below were
                    ordered in the POS but do not have an active recipe configured. No stock was
                    deducted. Go to <strong>Recipe Management</strong> to configure recipes for them.
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Menu Item</th>
                        <th className="py-2.5 px-3 font-semibold">Quantity Sold</th>
                        <th className="py-2.5 px-3 font-semibold">Reason</th>
                        <th className="py-2.5 px-3 font-semibold">Order Reference</th>
                        <th className="py-2.5 px-3 font-semibold">Logged At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {missingLogs.map((log: any, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 font-bold text-gray-900">{log.menuItemName}</td>
                          <td className="py-2.5 px-3 text-gray-700">{log.quantity}</td>
                          <td className="py-2.5 px-3 text-amber-700">{log.reason}</td>
                          <td className="py-2.5 px-3 text-gray-600 font-medium">
                            Order #{log.orderId || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-400">
                            {log.loggedAt ? new Date(log.loggedAt).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : filteredConsumptions.length === 0 ? (
            <div className="py-16 text-center text-xs text-gray-400 font-mono">
              No consumption records recorded yet. Complete an order in the POS to see automatic stock
              deductions.
            </div>
          ) : (
            filteredConsumptions.map((record) => {
              const isExpanded = expandedOrderId === record.id;

              return (
                <div
                  key={record.id}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all"
                >
                  <div
                    onClick={() => setExpandedOrderId(isExpanded ? null : record.id)}
                    className="p-3.5 bg-stone-50/50 hover:bg-stone-50 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-xl ${
                          record.status === 'CONSUMED'
                            ? 'bg-emerald-100/80 text-emerald-800'
                            : record.status === 'REVERSED'
                            ? 'bg-purple-100/80 text-purple-800'
                            : 'bg-amber-100/80 text-amber-800'
                        }`}
                      >
                        {record.status === 'CONSUMED' ? (
                          <PackageCheck className="w-4 h-4" />
                        ) : record.status === 'REVERSED' ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-gray-900">
                            Order #{record.orderId}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              record.status === 'CONSUMED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : record.status === 'REVERSED'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {record.status}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-gray-500 mt-0.5 flex items-center gap-2">
                          <span>
                            Consumed:{' '}
                            {new Date(record.consumedAt).toLocaleDateString()}{' '}
                            {new Date(record.consumedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span>•</span>
                          <span>{record.totalItemsConsumed} item(s)</span>
                          {record.status === 'REVERSED' && record.reversalReason && (
                            <>
                              <span>•</span>
                              <span className="text-purple-700 font-medium">
                                Reversal: {record.reversalReason}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-gray-900">
                          ₹{record.totalCost.toFixed(2)}
                        </div>
                        <div className="text-[10px] font-mono text-gray-400">Total Food Cost</div>
                      </div>
                      <div className="text-gray-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-100 bg-white space-y-3">
                      {record.items && record.items.length > 0 ? (
                        record.items.map((item, iIdx) => (
                          <div key={iIdx} className="rounded-xl border border-gray-100 bg-gray-50/40 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-gray-900 font-mono">
                                {item.quantitySold}x {item.menuItemName}
                              </span>
                              <span className="text-xs font-mono font-bold text-gray-700">
                                Line Cost: ₹
                                {item.ingredients
                                  .reduce((sum, ing) => sum + ing.lineCost, 0)
                                  .toFixed(2)}
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs font-mono">
                                <thead className="text-[10px] text-gray-400 uppercase border-b border-gray-200/60">
                                  <tr>
                                    <th className="pb-1.5 font-medium">Ingredient</th>
                                    <th className="pb-1.5 font-medium">Required / Serving</th>
                                    <th className="pb-1.5 font-medium">Waste %</th>
                                    <th className="pb-1.5 font-medium">Deducted</th>
                                    <th className="pb-1.5 font-medium">Unit Cost</th>
                                    <th className="pb-1.5 font-medium text-right">Cost</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {item.ingredients.map((ing, ingIdx) => (
                                    <tr key={ingIdx} className="text-gray-700">
                                      <td className="py-1.5 font-semibold text-gray-900">
                                        {ing.ingredientName}
                                      </td>
                                      <td className="py-1.5 text-gray-600">
                                        {ing.requiredQuantity} {ing.requiredUnit}
                                      </td>
                                      <td className="py-1.5 text-gray-500">{ing.wastePercentage}%</td>
                                      <td className="py-1.5 font-bold text-gray-900">
                                        -{ing.normalizedQuantity} {ing.ingredientUnit}
                                      </td>
                                      <td className="py-1.5 text-gray-600">
                                        ₹{ing.unitCost.toFixed(2)}
                                      </td>
                                      <td className="py-1.5 font-bold text-gray-900 text-right">
                                        ₹{ing.lineCost.toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 font-mono text-center py-3">
                          No ingredient item records for this order.
                        </div>
                      )}

                      {record.missingRecipes && record.missingRecipes.length > 0 && (
                        <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-mono flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Unmapped recipes: {record.missingRecipes.map((m) => m.menuItemName).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 text-right bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
