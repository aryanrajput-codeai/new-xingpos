// ====================================================================
// WEBRAJYA POS - POS AUTOMATIC INVENTORY CONSUMPTION SERVICE
// Single Restaurant Architecture - Direct Supabase Source of Truth
// ====================================================================

import {
  OrderInventoryConsumption,
  OrderInventoryConsumptionItem,
  ConsumedIngredientDetail,
  MissingRecipeNotice,
  StockAvailabilityIssue,
  ConsumptionOptions,
  ReversalOptions,
  Ingredient
} from '../types/inventory';
import { Order } from './db';
import { supabase } from './db';
import { IngredientService } from './ingredientService';
import { RecipeService } from './recipeService';
import {
  SupportedUnit,
  isSupportedUnit,
  areUnitsCompatible,
  convertQuantity
} from './unitConversion';
import { RBACService } from './rbac';

export const STORAGE_KEY_CONSUMPTIONS = 'wr_order_consumptions';
export const STORAGE_KEY_MISSING_RECIPES = 'wr_missing_recipes_log';

export class InventoryConsumptionService {
  private static activeOrderLocks = new Set<string>();

  // Legacy stubs for backward compatibility
  public static getCurrentBusinessId(): string {
    return '';
  }

  public static setCurrentBusinessId(_id: string): void {}

  public static enforceTenantIsolation(_entityBusinessId?: string, _requestedBusinessId?: string): void {}

  public static checkViewPermission(): void {
    if (!RBACService.hasPermission('inventory.view')) {
      if (!RBACService.hasPermission('pos.access') && !RBACService.hasPermission('kitchen.view')) {
        throw new Error("Unauthorized: Missing required permission to view inventory consumption.");
      }
    }
  }

  public static async hasOrderBeenConsumed(orderId: string, _businessId?: string): Promise<boolean> {
    const stored = localStorage.getItem(STORAGE_KEY_CONSUMPTIONS);
    if (!stored) return false;

    try {
      const all: OrderInventoryConsumption[] = JSON.parse(stored);
      const existing = all.find((c) => c.orderId === orderId);
      if (existing) {
        return existing.status === 'CONSUMED' || existing.status === 'NO_RECIPES';
      }
    } catch (e) {
      console.warn('[Consumption Service] Error checking consumption:', e);
    }

    try {
      const { data: txs } = await supabase
        .from('inventory_transactions')
        .select('transaction_type')
        .eq('reference_id', orderId);

      if (txs && txs.length > 0) {
        const consumptionCount = txs.filter(t => t.transaction_type === 'ORDER_CONSUMPTION' || t.transaction_type === 'SALE_CONSUMPTION').length;
        const restorationCount = txs.filter(t => t.transaction_type === 'ORDER_RESTORE').length;
        if (consumptionCount > restorationCount) return true;
      }
    } catch (e) {}

    return false;
  }

  public static async getOrderConsumption(orderId: string, _businessId?: string): Promise<OrderInventoryConsumption | null> {
    const stored = localStorage.getItem(STORAGE_KEY_CONSUMPTIONS);
    if (!stored) return null;

    try {
      const all: OrderInventoryConsumption[] = JSON.parse(stored);
      return all.find((c) => c.orderId === orderId) || null;
    } catch (e) {
      return null;
    }
  }

  public static async validateOrderStockAvailability(
    order: Order,
    options?: ConsumptionOptions
  ): Promise<{
    isAvailable: boolean;
    issues: StockAvailabilityIssue[];
    missingRecipes: MissingRecipeNotice[];
  }> {
    const ingredients = await IngredientService.getIngredients();
    const ingredientMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

    const missingRecipes: MissingRecipeNotice[] = [];
    const aggregatedRequired = new Map<string, number>();

    for (const item of order.items || []) {
      if (!item.quantity || item.quantity <= 0) continue;

      const recipe = await RecipeService.getRecipeByMenuItemId(item.menuItemId);
      if (!recipe || !recipe.isActive || !recipe.items || recipe.items.length === 0) {
        missingRecipes.push({
          menuItemId: item.menuItemId,
          menuItemName: item.name,
          quantity: item.quantity,
          reason: !recipe ? 'No recipe configured' : !recipe.isActive ? 'Recipe is inactive' : 'Recipe has no ingredients'
        });
        continue;
      }

      for (const rItem of recipe.items) {
        const ing = ingredientMap.get(rItem.ingredientId);
        if (!ing) continue;

        const waste = Math.max(0, rItem.wastagePercent ?? rItem.wastePercentage ?? 0);
        const wasteMultiplier = 1 + waste / 100;
        const effectivePerServing = rItem.quantity * wasteMultiplier;
        const totalEffective = item.quantity * effectivePerServing;

        let normalizedQty = totalEffective;
        if (rItem.unit !== ing.baseUnit && isSupportedUnit(rItem.unit) && isSupportedUnit(ing.baseUnit)) {
          if (areUnitsCompatible(rItem.unit, ing.baseUnit)) {
            normalizedQty = convertQuantity(totalEffective, rItem.unit as SupportedUnit, ing.baseUnit as SupportedUnit);
          }
        }

        const curr = aggregatedRequired.get(ing.id) || 0;
        aggregatedRequired.set(ing.id, Number((curr + normalizedQty).toFixed(4)));
      }
    }

    const issues: StockAvailabilityIssue[] = [];
    for (const [ingredientId, requiredQty] of aggregatedRequired.entries()) {
      const ing = ingredientMap.get(ingredientId);
      if (!ing) continue;

      if (ing.currentStock < requiredQty) {
        issues.push({
          ingredientId: ing.id,
          ingredientName: ing.name,
          requiredQuantity: requiredQty,
          availableStock: ing.currentStock,
          unit: ing.baseUnit,
          shortage: Number((requiredQty - ing.currentStock).toFixed(4))
        });
      }
    }

    return {
      isAvailable: issues.length === 0,
      issues,
      missingRecipes
    };
  }

  public static async consumeOrderInventory(
    order: Order,
    options?: ConsumptionOptions
  ): Promise<OrderInventoryConsumption> {
    const actorName = options?.actorName || (order as any).billedBy || 'POS Cashier';

    if (this.activeOrderLocks.has(order.id)) {
      await new Promise((res) => setTimeout(res, 200));
      const existing = await this.getOrderConsumption(order.id);
      if (existing) return existing;
    }

    this.activeOrderLocks.add(order.id);

    try {
      const alreadyConsumed = await this.hasOrderBeenConsumed(order.id);
      if (alreadyConsumed) {
        const existing = await this.getOrderConsumption(order.id);
        if (existing) return existing;
      }

      const validItems = (order.items || []).filter((i) => i.quantity > 0);
      if (validItems.length === 0) {
        const emptyResult: OrderInventoryConsumption = {
          id: `cons-${Date.now()}-${order.id}`,
          orderId: order.id,
          status: 'NO_RECIPES',
          totalItemsConsumed: 0,
          totalCost: 0,
          consumedAt: new Date().toISOString(),
          items: [],
          transactions: []
        };
        return emptyResult;
      }

      const allIngredients = await IngredientService.getIngredients();
      const ingredientMap = new Map<string, Ingredient>(allIngredients.map((i) => [i.id, i]));

      const consumptionItems: OrderInventoryConsumptionItem[] = [];
      const missingRecipes: MissingRecipeNotice[] = [];

      interface AggregatedRequirement {
        ingredient: Ingredient;
        totalNormalizedQuantity: number;
        lineContributions: {
          menuItemId: string;
          menuItemName: string;
          quantitySold: number;
          unitCost: number;
          lineCost: number;
        }[];
      }

      const requirementMap = new Map<string, AggregatedRequirement>();

      for (const item of validItems) {
        const recipe = await RecipeService.getRecipeByMenuItemId(item.menuItemId);

        if (!recipe || !recipe.isActive || !recipe.items || recipe.items.length === 0) {
          missingRecipes.push({
            menuItemId: item.menuItemId,
            menuItemName: item.name,
            quantity: item.quantity,
            reason: !recipe ? 'No recipe configured' : !recipe.isActive ? 'Recipe inactive' : 'No ingredients'
          });
          continue;
        }

        const consumedIngredientsForThisItem: ConsumedIngredientDetail[] = [];

        for (const rItem of recipe.items) {
          const ingredient = ingredientMap.get(rItem.ingredientId);
          if (!ingredient) continue;

          const waste = Math.max(0, rItem.wastagePercent ?? rItem.wastePercentage ?? 0);
          const wasteMultiplier = 1 + waste / 100;
          const effectivePerServing = rItem.quantity * wasteMultiplier;
          const totalEffective = item.quantity * effectivePerServing;

          let normalizedQty = totalEffective;
          if (rItem.unit !== ingredient.baseUnit && isSupportedUnit(rItem.unit) && isSupportedUnit(ingredient.baseUnit) && areUnitsCompatible(rItem.unit, ingredient.baseUnit)) {
            normalizedQty = convertQuantity(totalEffective, rItem.unit as SupportedUnit, ingredient.baseUnit as SupportedUnit);
          }

          const unitCost = ingredient.averageCostPerUnit || 0;
          const lineCost = Number((normalizedQty * unitCost).toFixed(2));

          if (!requirementMap.has(ingredient.id)) {
            requirementMap.set(ingredient.id, {
              ingredient,
              totalNormalizedQuantity: normalizedQty,
              lineContributions: [
                {
                  menuItemId: item.menuItemId,
                  menuItemName: item.name,
                  quantitySold: item.quantity,
                  unitCost,
                  lineCost
                }
              ]
            });
          } else {
            const req = requirementMap.get(ingredient.id)!;
            req.totalNormalizedQuantity = Number((req.totalNormalizedQuantity + normalizedQty).toFixed(4));
            req.lineContributions.push({
              menuItemId: item.menuItemId,
              menuItemName: item.name,
              quantitySold: item.quantity,
              unitCost,
              lineCost
            });
          }

          consumedIngredientsForThisItem.push({
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            requiredQuantity: rItem.quantity,
            requiredUnit: rItem.unit,
            wastePercentage: waste,
            effectiveQuantity: totalEffective,
            normalizedQuantity: normalizedQty,
            ingredientUnit: ingredient.baseUnit,
            unitCost,
            lineCost,
            stockBefore: ingredient.currentStock,
            stockAfter: ingredient.currentStock,
            transactionId: ''
          });
        }

        consumptionItems.push({
          menuItemId: item.menuItemId,
          menuItemName: item.name,
          quantitySold: item.quantity,
          recipeId: recipe.id,
          ingredients: consumedIngredientsForThisItem
        });
      }

      if (consumptionItems.length === 0 && missingRecipes.length > 0) {
        const noRecipeConsumption: OrderInventoryConsumption = {
          id: `cons-${Date.now()}-${order.id}`,
          orderId: order.id,
          status: 'NO_RECIPES',
          totalItemsConsumed: 0,
          totalCost: 0,
          consumedAt: new Date().toISOString(),
          items: [],
          missingRecipes,
          transactions: []
        };

        this.saveConsumptionRecord(noRecipeConsumption);
        return noRecipeConsumption;
      }

      const allowNegative = options?.allowNegativeStock ?? true;
      for (const [_, req] of requirementMap.entries()) {
        const available = req.ingredient.currentStock;
        const needed = req.totalNormalizedQuantity;

        if (available < needed && !allowNegative) {
          throw new Error(
            `Insufficient stock for ${req.ingredient.name}. Required: ${needed} ${req.ingredient.baseUnit}, Available: ${available} ${req.ingredient.baseUnit}.`
          );
        }
      }

      const now = new Date().toISOString();
      const createdTxIds: string[] = [];
      let totalConsumptionCost = 0;

      for (const [ingredientId, req] of requirementMap.entries()) {
        const stockBefore = req.ingredient.currentStock;
        const consumedQty = req.totalNormalizedQuantity;
        const stockAfter = Number((stockBefore - consumedQty).toFixed(4));
        const unitCost = req.ingredient.averageCostPerUnit;
        const lineTotal = Number((consumedQty * unitCost).toFixed(2));
        totalConsumptionCost += lineTotal;

        const txPayload = {
          ingredient_id: ingredientId,
          transaction_type: 'ORDER_CONSUMPTION',
          quantity: consumedQty,
          unit: req.ingredient.baseUnit,
          unit_cost: unitCost,
          reference_id: order.id,
          reference_type: 'ORDER',
          notes: `POS Sale: Order #${order.id} (${req.lineContributions.map((c) => c.menuItemName).join(', ')})`,
          stock_before: stockBefore,
          stock_after: stockAfter,
          created_by: actorName
        };

        const { data: txRow, error: txErr } = await supabase
          .from('inventory_transactions')
          .insert(txPayload)
          .select()
          .single();

        if (txErr) {
          console.warn('[Consumption Service] Tx record warning:', txErr.message);
        } else if (txRow) {
          createdTxIds.push(txRow.id);
        }

        const { error: updErr } = await supabase
          .from('ingredients')
          .update({
            current_stock: stockAfter,
            updated_at: now
          })
          .eq('id', ingredientId);

        if (updErr) {
          console.error('[Consumption Service] Stock deduction error:', updErr.message);
        }
      }

      const totalItemsCount = consumptionItems.reduce((sum, i) => sum + i.quantitySold, 0);
      const consumptionRecord: OrderInventoryConsumption = {
        id: `cons-${Date.now()}-${order.id}`,
        orderId: order.id,
        status: 'CONSUMED',
        totalItemsConsumed: totalItemsCount,
        totalCost: Number(totalConsumptionCost.toFixed(2)),
        consumedAt: now,
        items: consumptionItems,
        missingRecipes: missingRecipes.length > 0 ? missingRecipes : undefined,
        transactions: createdTxIds
      };

      this.saveConsumptionRecord(consumptionRecord);
      this.dispatchUpdateEvents();

      return consumptionRecord;
    } finally {
      this.activeOrderLocks.delete(order.id);
    }
  }

  public static async reverseOrderInventory(
    orderId: string,
    options?: ReversalOptions
  ): Promise<OrderInventoryConsumption | null> {
    const actorName = options?.actorName || 'POS System';
    const reason = options?.reason || 'Order cancelled/voided';

    const consumption = await this.getOrderConsumption(orderId);
    if (!consumption) return null;
    if (consumption.status === 'REVERSED') return consumption;

    const now = new Date().toISOString();

    for (const cItem of consumption.items) {
      for (const ingDetail of cItem.ingredients) {
        const ingredient = await IngredientService.getIngredientById(ingDetail.ingredientId);
        if (!ingredient) continue;

        const stockBefore = ingredient.currentStock;
        const restoredQty = ingDetail.normalizedQuantity;
        const stockAfter = Number((stockBefore + restoredQty).toFixed(4));

        const txPayload = {
          ingredient_id: ingDetail.ingredientId,
          transaction_type: 'ORDER_RESTORE',
          quantity: restoredQty,
          unit: ingredient.baseUnit,
          unit_cost: ingDetail.unitCost,
          reference_id: orderId,
          reference_type: 'ORDER_CANCEL',
          notes: `Reversal for Order #${orderId}: ${reason}`,
          stock_before: stockBefore,
          stock_after: stockAfter,
          created_by: actorName
        };

        await supabase.from('inventory_transactions').insert(txPayload);

        await supabase
          .from('ingredients')
          .update({
            current_stock: stockAfter,
            updated_at: now
          })
          .eq('id', ingDetail.ingredientId);
      }
    }

    consumption.status = 'REVERSED';
    consumption.reversalReason = reason;
    consumption.reversedAt = now;
    consumption.reversedBy = actorName;

    this.updateConsumptionRecord(consumption);
    this.dispatchUpdateEvents();

    return consumption;
  }

  public static async getOrderConsumptions(_businessId?: string): Promise<OrderInventoryConsumption[]> {
    const stored = localStorage.getItem(STORAGE_KEY_CONSUMPTIONS);
    return stored ? JSON.parse(stored) : [];
  }

  public static async getConsumptionHistory(orderIdOrBusinessId?: string, _businessId?: string): Promise<OrderInventoryConsumption[]> {
    const all = await this.getOrderConsumptions();
    if (orderIdOrBusinessId) {
      const match = all.filter((c) => c.orderId === orderIdOrBusinessId);
      if (match.length > 0) return match;
    }
    return all;
  }

  public static async getMissingRecipeLogs(_businessId?: string): Promise<MissingRecipeNotice[]> {
    const stored = localStorage.getItem(STORAGE_KEY_MISSING_RECIPES);
    return stored ? JSON.parse(stored) : [];
  }

  private static saveConsumptionRecord(record: OrderInventoryConsumption): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONSUMPTIONS);
      const all: OrderInventoryConsumption[] = stored ? JSON.parse(stored) : [];
      all.unshift(record);
      localStorage.setItem(STORAGE_KEY_CONSUMPTIONS, JSON.stringify(all));
    } catch (e) {}
  }

  private static updateConsumptionRecord(record: OrderInventoryConsumption): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONSUMPTIONS);
      const all: OrderInventoryConsumption[] = stored ? JSON.parse(stored) : [];
      const idx = all.findIndex((c) => c.id === record.id);
      if (idx !== -1) {
        all[idx] = record;
        localStorage.setItem(STORAGE_KEY_CONSUMPTIONS, JSON.stringify(all));
      }
    } catch (e) {}
  }

  private static dispatchUpdateEvents(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('inventory_transactions_updated'));
      window.dispatchEvent(new Event('ingredients_updated'));
      window.dispatchEvent(new Event('order_inventory_consumed'));
      window.dispatchEvent(new Event('storage'));
    }
  }
}
