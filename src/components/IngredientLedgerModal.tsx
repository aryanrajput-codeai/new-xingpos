import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ScrollText,
  Calendar,
  User,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Coins,
  ShoppingCart,
  Layers,
  Scale,
  Search,
  Filter,
  Package
} from 'lucide-react';
import { Ingredient, InventoryTransaction, InventoryTransactionType } from '../types/inventory';
import { IngredientService } from '../lib/ingredientService';

interface IngredientLedgerModalProps {
  isOpen: boolean;
  ingredient: Ingredient | null;
  onClose: () => void;
}

export default function IngredientLedgerModal({
  isOpen,
  ingredient,
  onClose
}: IngredientLedgerModalProps) {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  useEffect(() => {
    if (!isOpen || !ingredient) {
      setTransactions([]);
      return;
    }

    let isMounted = true;
    const fetchTransactions = async () => {
      setIsLoading(true);
      try {
        const list = await IngredientService.getTransactions(ingredient.id);
        if (isMounted) {
          setTransactions(list);
        }
      } catch (err) {
        console.error('Failed to load ingredient transactions:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTransactions();

    const handleUpdate = () => fetchTransactions();
    window.addEventListener('inventory_transactions_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('inventory_transactions_updated', handleUpdate);
    };
  }, [isOpen, ingredient]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        (t.referenceId && t.referenceId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.performedBy && t.performedBy.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = selectedType === 'ALL' || t.transactionType === selectedType;

      return matchesSearch && matchesType;
    });
  }, [transactions, searchQuery, selectedType]);

  if (!isOpen || !ingredient) return null;

  const getBadgeStyle = (type: InventoryTransactionType) => {
    switch (type) {
      case 'OPENING_STOCK':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'PURCHASE':
      case 'PURCHASE_RECEIPT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'SALE_CONSUMPTION':
      case 'ORDER_CONSUMPTION':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'RETURN':
      case 'SALE_REVERSAL':
      case 'ORDER_RESTORE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'WASTAGE':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'ADJUSTMENT_IN':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'ADJUSTMENT_OUT':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'TRANSFER_IN':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'TRANSFER_OUT':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100/70 text-amber-800 rounded-xl">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                  {ingredient.name}
                </h3>
                {ingredient.itemCode && (
                  <span className="text-[11px] font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {ingredient.itemCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Immutable stock movement ledger and transaction history
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

        {/* Ingredient Quick Summary KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-gray-50/50 border-b border-gray-100 shrink-0">
          <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
            <div className="text-[11px] font-mono text-gray-400 uppercase">Current Stock</div>
            <div className="text-base font-bold text-gray-900 font-mono mt-0.5">
              {ingredient.currentStock} {ingredient.unit}
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
            <div className="text-[11px] font-mono text-gray-400 uppercase">Cost / Unit</div>
            <div className="text-base font-bold text-gray-900 font-mono mt-0.5">
              ₹{ingredient.costPerUnit.toFixed(2)}
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
            <div className="text-[11px] font-mono text-gray-400 uppercase">Total Value</div>
            <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
              ₹{(ingredient.currentStock * ingredient.costPerUnit).toFixed(2)}
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-gray-200/80">
            <div className="text-[11px] font-mono text-gray-400 uppercase">Ledger Entries</div>
            <div className="text-base font-bold text-indigo-700 font-mono mt-0.5">
              {transactions.length}
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 sm:p-4 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, notes, or staff..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 focus:border-amber-500 focus:bg-white rounded-xl outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 focus:border-amber-500 rounded-xl outline-none font-mono text-gray-700"
            >
              <option value="ALL">All Types</option>
              <option value="SALE_CONSUMPTION">Sale Consumptions</option>
              <option value="RETURN">Returns / Reversals</option>
              <option value="PURCHASE">Purchases</option>
              <option value="OPENING_STOCK">Opening Stock</option>
              <option value="WASTAGE">Wastage</option>
              <option value="ADJUSTMENT_IN">Adjustments In (+)</option>
              <option value="ADJUSTMENT_OUT">Adjustments Out (-)</option>
              <option value="MANUAL_ADJUSTMENT">Legacy Adjustments</option>
            </select>
          </div>
        </div>

        {/* Scrollable Transaction Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-gray-400 font-mono">
              Loading ledger entries...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 font-mono">
              No transactions match your search filter.
            </div>
          ) : (
            <div className="border border-gray-200/80 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                    <th className="py-2.5 px-3 font-semibold">Type</th>
                    <th className="py-2.5 px-3 font-semibold">Quantity</th>
                    <th className="py-2.5 px-3 font-semibold">Stock Impact</th>
                    <th className="py-2.5 px-3 font-semibold">Cost Impact</th>
                    <th className="py-2.5 px-3 font-semibold">Reference</th>
                    <th className="py-2.5 px-3 font-semibold">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.map((tx) => {
                    const isDeduction =
                      tx.transactionType === 'SALE_CONSUMPTION' ||
                      tx.transactionType === 'ORDER_CONSUMPTION' ||
                      tx.transactionType === 'WASTAGE' ||
                      tx.transactionType === 'ADJUSTMENT_OUT' ||
                      tx.transactionType === 'TRANSFER_OUT' ||
                      tx.transactionType === 'PURCHASE_REVERSAL' ||
                      (tx.transactionType === 'MANUAL_ADJUSTMENT' && tx.stockAfter < tx.stockBefore);

                    return (
                      <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleDateString()}{' '}
                          <span className="text-gray-400">
                            {new Date(tx.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(
                              tx.transactionType
                            )}`}
                          >
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                          <span className={isDeduction ? 'text-amber-700' : 'text-emerald-700'}>
                            {isDeduction ? '-' : '+'}
                            {tx.quantity} {tx.unit}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-gray-600">
                          <span>{tx.stockBefore}</span>
                          <span className="mx-1 text-gray-400">→</span>
                          <span className="font-bold text-gray-900">{tx.stockAfter}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">
                            ₹{tx.totalCost.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            ₹{tx.unitCost.toFixed(2)}/{tx.unit}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-700">
                          {tx.referenceId ? (
                            <div className="font-medium text-gray-900">{tx.referenceId}</div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                          {tx.notes && (
                            <div className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                              {tx.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                          {tx.performedBy || 'System'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
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
