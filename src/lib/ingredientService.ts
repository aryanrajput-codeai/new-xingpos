// ====================================================================
// WEBRAJYA POS - INGREDIENT & INVENTORY SERVICE
// Single Restaurant Architecture - Direct Supabase Source of Truth
// ====================================================================

import {
  Ingredient,
  IngredientCategory,
  CreateIngredientDTO,
  UpdateIngredientDTO,
  OpeningStockDTO,
  InventoryTransaction,
  StockStatus
} from '../types/inventory';
import {
  SupportedUnit,
  isSupportedUnit,
  convertQuantity
} from './unitConversion';
import { RBACService } from './rbac';
import { supabase } from './db';
import { ensureSupabaseSession } from './supabaseAuth';

// Re-export DTO types so UI components importing them from this module succeed
export type { CreateIngredientDTO, UpdateIngredientDTO, OpeningStockDTO };

export const STORAGE_KEY_INGREDIENTS = 'wr_ingredients';
export const STORAGE_KEY_CATEGORIES = 'wr_ingredient_categories';
export const STORAGE_KEY_TRANSACTIONS = 'wr_inventory_transactions';

export class IngredientService {
  // Legacy stubs for single restaurant architecture
  public static getCurrentBusinessId(): string {
    return '';
  }

  public static setCurrentBusinessId(_id: string): void {}

  public static enforceTenantIsolation(_entityBusinessId?: string, _requestedBusinessId?: string): void {}

  private static checkPermission(permission: string): void {
    if (!RBACService.hasPermission(permission as any)) {
      throw new Error(`Unauthorized: Missing required permission '${permission}'.`);
    }
  }

  /**
   * Helper utility for calculating stock status
   */
  public static calculateStockStatus(
    ingredientOrStock: Ingredient | number,
    minStock?: number,
    maxStock?: number | null
  ): 'INACTIVE' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVER_STOCK' | 'OVERSTOCKED' | 'IN_STOCK' {
    if (typeof ingredientOrStock === 'object' && ingredientOrStock !== null) {
      if (ingredientOrStock.isActive === false) return 'INACTIVE';
      const curr = ingredientOrStock.currentStock ?? 0;
      const min = ingredientOrStock.minimumStock ?? ingredientOrStock.minAlertLevel ?? 0;
      const max = ingredientOrStock.maximumStock ?? ingredientOrStock.maxStockLevel;
      if (curr <= 0) return 'OUT_OF_STOCK';
      if (curr <= min) return 'LOW_STOCK';
      if (max !== null && max !== undefined && max > 0 && curr >= max) return 'OVERSTOCKED';
      return 'IN_STOCK';
    }
    const curr = Number(ingredientOrStock);
    const min = Number(minStock ?? 0);
    if (curr <= 0) return 'OUT_OF_STOCK';
    if (curr <= min) return 'LOW_STOCK';
    if (maxStock !== null && maxStock !== undefined && maxStock > 0 && curr >= maxStock) {
      return 'OVER_STOCK';
    }
    return 'IN_STOCK';
  }

  // ====================================================================
  // DATABASE MAPPERS (Exact 11 columns for ingredients, 6 for categories)
  // ====================================================================

  public static mapDatabaseIngredient(row: any): Ingredient {
    const baseUnit = (row.base_unit || 'kg') as SupportedUnit;
    const currentStock = Number(row.current_stock ?? 0);
    const minStock = Number(row.minimum_stock ?? 0);
    const maxStock = row.maximum_stock !== null && row.maximum_stock !== undefined ? Number(row.maximum_stock) : null;
    const avgCost = Number(row.average_cost_per_unit ?? 0);

    return {
      id: row.id,
      name: row.name || 'Unnamed Ingredient',
      categoryId: row.category_id || null,
      category_id: row.category_id || null,
      baseUnit,
      base_unit: baseUnit,
      unit: baseUnit,
      currentStock,
      current_stock: currentStock,
      minimumStock: minStock,
      minimum_stock: minStock,
      maximumStock: maxStock,
      maximum_stock: maxStock,
      averageCostPerUnit: avgCost,
      average_cost_per_unit: avgCost,
      costPerUnit: avgCost,
      minAlertLevel: minStock,
      maxStockLevel: maxStock,
      reorderQuantity: minStock,
      yieldPercentage: 100,
      storageType: 'DRY',
      isActive: row.is_active ?? true,
      is_active: row.is_active ?? true,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    };
  }

  public static mapDatabaseCategory(row: any): IngredientCategory {
    return {
      id: row.id,
      name: row.name || 'General',
      description: row.description || '',
      isActive: row.is_active ?? true,
      is_active: row.is_active ?? true,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    };
  }

  public static mapDatabaseTransaction(row: any): InventoryTransaction {
    const qty = Number(row.quantity ?? 0);
    const cost = Number(row.unit_cost ?? 0);
    const sBefore = Number(row.stock_before ?? 0);
    const sAfter = Number(row.stock_after ?? 0);

    return {
      id: row.id,
      ingredientId: row.ingredient_id,
      ingredient_id: row.ingredient_id,
      transactionType: row.transaction_type,
      transaction_type: row.transaction_type,
      quantity: qty,
      unit: row.unit,
      unitCost: cost,
      unit_cost: cost,
      totalCost: Number((qty * cost).toFixed(2)),
      referenceId: row.reference_id,
      reference_id: row.reference_id,
      referenceType: row.reference_type,
      reference_type: row.reference_type,
      notes: row.notes || '',
      stockBefore: sBefore,
      stock_before: sBefore,
      stockAfter: sAfter,
      stock_after: sAfter,
      createdBy: row.created_by || 'Staff',
      created_by: row.created_by || 'Staff',
      performedBy: row.created_by || 'Staff',
      createdAt: row.created_at || new Date().toISOString(),
      created_at: row.created_at || new Date().toISOString()
    };
  }

  // ====================================================================
  // CATEGORIES CRUD
  // ====================================================================

  public static async getCategories(_businessId?: string): Promise<IngredientCategory[]> {
    this.checkPermission('inventory.view');

    try {
      const { data, error } = await supabase
        .from('ingredient_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('[IngredientService] Failed to fetch categories from Supabase:', error.message);
        const cached = localStorage.getItem(STORAGE_KEY_CATEGORIES);
        return cached ? JSON.parse(cached) : [];
      }

      const categories = (data || []).map(this.mapDatabaseCategory);
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
      return categories;
    } catch (e: any) {
      console.error('[IngredientService] getCategories exception:', e);
      const cached = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      return cached ? JSON.parse(cached) : [];
    }
  }

  public static async createCategory(
    nameOrDto: string | { name: string; description?: string; isActive?: boolean },
    description?: string,
    _businessId?: string
  ): Promise<IngredientCategory> {
    this.checkPermission('inventory.manage');

    let name = '';
    let desc = description;
    let isActive = true;

    if (typeof nameOrDto === 'object') {
      name = nameOrDto.name?.trim() || '';
      desc = nameOrDto.description?.trim() || desc;
      if (nameOrDto.isActive !== undefined) isActive = nameOrDto.isActive;
    } else {
      name = nameOrDto?.trim() || '';
    }

    if (!name) {
      throw new Error('Category name cannot be empty.');
    }

    await ensureSupabaseSession();

    const payload = {
      name,
      description: desc?.trim() || null,
      is_active: isActive
    };

    const { data, error } = await supabase
      .from('ingredient_categories')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[IngredientService] createCategory error:', error);
      throw new Error(`Database error creating category: ${error.message}`);
    }

    const created = this.mapDatabaseCategory(data);
    this.dispatchUpdateEvent('categories_updated');
    return created;
  }

  public static async updateCategory(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean }
  ): Promise<IngredientCategory> {
    this.checkPermission('inventory.manage');
    await ensureSupabaseSession();

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.description !== undefined) payload.description = data.description.trim() || null;
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const { data: row, error } = await supabase
      .from('ingredient_categories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[IngredientService] updateCategory error:', error);
      throw new Error(`Database error updating category: ${error.message}`);
    }

    const updated = this.mapDatabaseCategory(row);
    this.dispatchUpdateEvent('categories_updated');
    return updated;
  }

  public static async deleteCategory(id: string): Promise<void> {
    this.checkPermission('inventory.manage');
    await ensureSupabaseSession();

    const { error } = await supabase
      .from('ingredient_categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[IngredientService] deleteCategory error:', error);
      throw new Error(`Database error deleting category: ${error.message}`);
    }
    this.dispatchUpdateEvent('categories_updated');
  }

  // ====================================================================
  // INGREDIENTS CRUD
  // ====================================================================

  public static async getIngredients(_businessId?: string): Promise<Ingredient[]> {
    this.checkPermission('inventory.view');

    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('[IngredientService] Supabase getIngredients error:', error.message);
        const cached = localStorage.getItem(STORAGE_KEY_INGREDIENTS);
        return cached ? JSON.parse(cached) : [];
      }

      const categories = await this.getCategories();
      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      const ingredients = (data || []).map((row) => {
        const item = this.mapDatabaseIngredient(row);
        if (item.categoryId && categoryMap.has(item.categoryId)) {
          item.category = categoryMap.get(item.categoryId);
        }
        return item;
      });

      localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(ingredients));
      return ingredients;
    } catch (e: any) {
      console.error('[IngredientService] getIngredients exception:', e);
      const cached = localStorage.getItem(STORAGE_KEY_INGREDIENTS);
      return cached ? JSON.parse(cached) : [];
    }
  }

  public static async getIngredientById(id: string, _businessId?: string): Promise<Ingredient | null> {
    this.checkPermission('inventory.view');

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[IngredientService] getIngredientById error:', error);
      throw new Error(`Failed to fetch ingredient: ${error.message}`);
    }

    if (!data) return null;
    return this.mapDatabaseIngredient(data);
  }

  public static async createIngredient(
    data: CreateIngredientDTO,
    actorName = 'Store Manager',
    _businessId?: string
  ): Promise<{ ingredient: Ingredient; openingStockTx?: InventoryTransaction }> {
    this.checkPermission('inventory.manage');
    await ensureSupabaseSession();

    const name = data.name.trim();
    if (!name) {
      throw new Error('Ingredient name is required.');
    }

    const unit = data.baseUnit || data.unit;
    if (!unit || !isSupportedUnit(unit)) {
      throw new Error(`Invalid unit '${unit}'. Supported units: kg, g, l, ml, pcs, etc.`);
    }

    const minStock = Math.max(0, Number(data.minAlertLevel ?? 0));
    const maxStock = data.maxStockLevel !== undefined && data.maxStockLevel !== null ? Number(data.maxStockLevel) : null;
    const avgCost = Math.max(0, Number(data.costPerUnit ?? 0));

    let openingQty = 0;
    let openingUnitCost = avgCost;
    if (data.openingStock) {
      if (data.openingStock.quantity < 0) {
        throw new Error('Opening stock quantity cannot be negative.');
      }
      if (data.openingStock.unitCost < 0) {
        throw new Error('Opening stock unit cost cannot be negative.');
      }
      openingQty = data.openingStock.quantity;
      openingUnitCost = data.openingStock.unitCost;
    }

    const insertPayload = {
      name,
      category_id: data.categoryId || null,
      base_unit: unit,
      current_stock: openingQty,
      minimum_stock: minStock,
      maximum_stock: maxStock,
      average_cost_per_unit: openingUnitCost,
      is_active: data.isActive !== undefined ? data.isActive : true
    };

    const { data: createdRow, error: insertError } = await supabase
      .from('ingredients')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[IngredientService] createIngredient insert error:', insertError);
      throw new Error(`Database error creating ingredient: ${insertError.message}`);
    }

    const newIngredient = this.mapDatabaseIngredient(createdRow);

    let openingStockTx: InventoryTransaction | undefined;
    if (openingQty > 0) {
      const txPayload = {
        ingredient_id: newIngredient.id,
        transaction_type: 'OPENING_STOCK',
        quantity: openingQty,
        unit,
        unit_cost: openingUnitCost,
        reference_id: 'OPENING_STOCK_INIT',
        reference_type: 'INITIAL_STOCK',
        notes: data.openingStock?.notes || `Opening stock initial entry: ${openingQty} ${unit} @ ₹${openingUnitCost}`,
        stock_before: 0,
        stock_after: openingQty,
        created_by: actorName
      };

      const { data: txRow, error: txError } = await supabase
        .from('inventory_transactions')
        .insert(txPayload)
        .select()
        .single();

      if (txError) {
        console.warn('[IngredientService] Opening stock transaction record warning:', txError.message);
      } else if (txRow) {
        openingStockTx = this.mapDatabaseTransaction(txRow);
      }
    }

    this.dispatchUpdateEvent('ingredients_updated');
    return { ingredient: newIngredient, openingStockTx };
  }

  public static async updateIngredient(
    id: string,
    data: UpdateIngredientDTO,
    _businessId?: string
  ): Promise<Ingredient> {
    this.checkPermission('inventory.manage');
    await ensureSupabaseSession();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new Error('Ingredient name cannot be empty.');
      updatePayload.name = name;
    }

    if (data.unit !== undefined || data.baseUnit !== undefined) {
      const unit = data.baseUnit || data.unit;
      if (unit && !isSupportedUnit(unit)) throw new Error(`Invalid unit '${unit}'.`);
      updatePayload.base_unit = unit;
    }

    if (data.categoryId !== undefined) {
      updatePayload.category_id = data.categoryId || null;
    }

    if (data.minAlertLevel !== undefined) {
      updatePayload.minimum_stock = Math.max(0, Number(data.minAlertLevel));
    }

    if (data.maxStockLevel !== undefined) {
      updatePayload.maximum_stock = data.maxStockLevel !== null ? Number(data.maxStockLevel) : null;
    }

    if (data.costPerUnit !== undefined) {
      updatePayload.average_cost_per_unit = Math.max(0, Number(data.costPerUnit));
    }

    if (data.isActive !== undefined) {
      updatePayload.is_active = !!data.isActive;
    }

    const { data: updatedRow, error } = await supabase
      .from('ingredients')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[IngredientService] updateIngredient error:', error);
      throw new Error(`Database error updating ingredient: ${error.message}`);
    }

    const updated = this.mapDatabaseIngredient(updatedRow);
    this.dispatchUpdateEvent('ingredients_updated');
    return updated;
  }

  public static async deleteIngredient(id: string, _businessId?: string): Promise<void> {
    this.checkPermission('inventory.manage');
    await ensureSupabaseSession();

    const { count, error: countError } = await supabase
      .from('inventory_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('ingredient_id', id);

    if (countError) {
      console.warn('[IngredientService] delete check transactions error:', countError.message);
    }

    if (count && count > 0) {
      throw new Error(`Cannot delete ingredient because ${count} inventory transaction(s) exist. Deactivate it instead.`);
    }

    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[IngredientService] deleteIngredient error:', error);
      throw new Error(`Database error deleting ingredient: ${error.message}`);
    }

    this.dispatchUpdateEvent('ingredients_updated');
  }

  public static async toggleIngredientActive(id: string, _businessId?: string): Promise<Ingredient> {
    const current = await this.getIngredientById(id);
    if (!current) throw new Error(`Ingredient '${id}' not found.`);
    return this.updateIngredient(id, { isActive: !current.isActive });
  }

  // ====================================================================
  // OPENING STOCK & AUDIT LEDGER
  // ====================================================================

  public static async hasOpeningStockPosted(ingredientId: string, _businessId?: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('inventory_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('ingredient_id', ingredientId)
      .eq('transaction_type', 'OPENING_STOCK');

    if (error) {
      console.warn('[IngredientService] hasOpeningStockPosted error:', error.message);
      return false;
    }

    return (count ?? 0) > 0;
  }

  public static async getOpeningStockTransaction(ingredientId: string, _businessId?: string): Promise<InventoryTransaction | null> {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('ingredient_id', ingredientId)
      .eq('transaction_type', 'OPENING_STOCK')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapDatabaseTransaction(data);
  }

  public static async postOpeningStock(
    ingredientId: string,
    data: OpeningStockDTO,
    actorName = 'Store Manager',
    _businessId?: string
  ): Promise<InventoryTransaction> {
    this.checkPermission('inventory.manage');
    await ensureSupabaseSession();

    const ingredient = await this.getIngredientById(ingredientId);
    if (!ingredient) {
      throw new Error(`Ingredient with id '${ingredientId}' not found.`);
    }

    const alreadyPosted = await this.hasOpeningStockPosted(ingredientId);
    if (alreadyPosted) {
      throw new Error(`Opening stock has already been posted for ingredient '${ingredient.name}'. Accidental duplicate posting prevented.`);
    }

    if (data.quantity <= 0) {
      throw new Error('Opening stock quantity must be strictly greater than 0.');
    }
    if (data.unitCost < 0) {
      throw new Error('Opening stock unit cost cannot be negative.');
    }
    if (!isSupportedUnit(data.unit)) {
      throw new Error(`Invalid unit '${data.unit}'.`);
    }

    let normalizedQty = data.quantity;
    let normalizedUnitCost = data.unitCost;
    if (data.unit !== ingredient.baseUnit) {
      normalizedQty = convertQuantity(data.quantity, data.unit, ingredient.baseUnit as SupportedUnit);
      const factor = normalizedQty / data.quantity;
      normalizedUnitCost = data.unitCost / factor;
    }

    const stockBefore = ingredient.currentStock;
    const stockAfter = Number((stockBefore + normalizedQty).toFixed(4));

    const txPayload = {
      ingredient_id: ingredientId,
      transaction_type: 'OPENING_STOCK',
      quantity: normalizedQty,
      unit: ingredient.baseUnit,
      unit_cost: normalizedUnitCost,
      reference_id: 'OPENING_STOCK_INIT',
      reference_type: 'INITIAL_STOCK',
      notes: data.notes?.trim() || `Opening stock entry: ${normalizedQty} ${ingredient.baseUnit} @ ₹${normalizedUnitCost}`,
      stock_before: stockBefore,
      stock_after: stockAfter,
      created_by: actorName
    };

    const { data: txRow, error: txError } = await supabase
      .from('inventory_transactions')
      .insert(txPayload)
      .select()
      .single();

    if (txError) {
      console.error('[IngredientService] postOpeningStock tx error:', txError);
      throw new Error(`Database error recording transaction: ${txError.message}`);
    }

    const { error: updError } = await supabase
      .from('ingredients')
      .update({
        current_stock: stockAfter,
        average_cost_per_unit: normalizedUnitCost,
        updated_at: new Date().toISOString()
      })
      .eq('id', ingredientId);

    if (updError) {
      console.error('[IngredientService] postOpeningStock update error:', updError);
      throw new Error(`Failed to update ingredient stock: ${updError.message}`);
    }

    this.dispatchUpdateEvent('inventory_transactions_updated');
    this.dispatchUpdateEvent('ingredients_updated');

    return this.mapDatabaseTransaction(txRow);
  }

  public static async getTransactions(ingredientId?: string, _businessId?: string): Promise<InventoryTransaction[]> {
    this.checkPermission('inventory.view');

    try {
      let query = supabase
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (ingredientId) {
        query = query.eq('ingredient_id', ingredientId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[IngredientService] getTransactions error:', error.message);
        const cached = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
        return cached ? JSON.parse(cached) : [];
      }

      const transactions = (data || []).map(this.mapDatabaseTransaction);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
      return transactions;
    } catch (e: any) {
      console.error('[IngredientService] getTransactions exception:', e);
      return [];
    }
  }

  public static async verifyStockConsistency(ingredientId: string, _businessId?: string): Promise<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    currentStock: number;
    calculatedStock: number;
    drift: number;
    isConsistent: boolean;
    transactionCount: number;
    breakdown: {
      openingStock: number;
      purchases: number;
      adjustmentsIn: number;
      returns: number;
      transfersIn: number;
      saleConsumption: number;
      wastage: number;
      adjustmentsOut: number;
      transfersOut: number;
    };
  }> {
    const ingredient = await this.getIngredientById(ingredientId);
    if (!ingredient) {
      throw new Error(`Ingredient with ID '${ingredientId}' not found.`);
    }

    const transactions = await this.getTransactions(ingredientId);

    const breakdown = {
      openingStock: 0,
      purchases: 0,
      adjustmentsIn: 0,
      returns: 0,
      transfersIn: 0,
      saleConsumption: 0,
      wastage: 0,
      adjustmentsOut: 0,
      transfersOut: 0
    };

    for (const tx of transactions) {
      const qty = tx.quantity;
      switch (tx.transactionType) {
        case 'OPENING_STOCK':
          breakdown.openingStock += qty;
          break;
        case 'PURCHASE':
        case 'PURCHASE_RECEIPT':
          breakdown.purchases += qty;
          break;
        case 'PURCHASE_REVERSAL':
          breakdown.purchases -= qty;
          break;
        case 'ADJUSTMENT_IN':
          breakdown.adjustmentsIn += qty;
          break;
        case 'RETURN':
          breakdown.returns += qty;
          break;
        case 'TRANSFER_IN':
          breakdown.transfersIn += qty;
          break;
        case 'ORDER_CONSUMPTION':
        case 'SALE_CONSUMPTION':
          breakdown.saleConsumption += qty;
          break;
        case 'ORDER_RESTORE':
        case 'SALE_REVERSAL':
          breakdown.saleConsumption -= qty;
          break;
        case 'WASTAGE':
          breakdown.wastage += qty;
          break;
        case 'ADJUSTMENT_OUT':
          breakdown.adjustmentsOut += qty;
          break;
        case 'TRANSFER_OUT':
          breakdown.transfersOut += qty;
          break;
        case 'MANUAL_ADJUSTMENT':
        case 'STOCKTAKE_RECONCILE':
          if (tx.stockAfter > tx.stockBefore) {
            breakdown.adjustmentsIn += (tx.stockAfter - tx.stockBefore);
          } else {
            breakdown.adjustmentsOut += (tx.stockBefore - tx.stockAfter);
          }
          break;
      }
    }

    const totalIn =
      breakdown.openingStock +
      breakdown.purchases +
      breakdown.adjustmentsIn +
      breakdown.returns +
      breakdown.transfersIn;

    const totalOut =
      breakdown.saleConsumption +
      breakdown.wastage +
      breakdown.adjustmentsOut +
      breakdown.transfersOut;

    const calculatedStock = Number((totalIn - totalOut).toFixed(4));
    const currentStock = Number(ingredient.currentStock.toFixed(4));
    const drift = Number(Math.abs(calculatedStock - currentStock).toFixed(4));
    const isConsistent = drift < 0.0001;

    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      unit: ingredient.baseUnit,
      currentStock,
      calculatedStock,
      drift,
      isConsistent,
      transactionCount: transactions.length,
      breakdown
    };
  }

  private static dispatchUpdateEvent(name: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(name));
      window.dispatchEvent(new Event('storage'));
    }
  }
}
