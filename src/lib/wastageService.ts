// ====================================================================
// WEBRAJYA POS - WASTAGE MANAGEMENT SERVICE
// Single Restaurant Architecture - Direct Supabase Source of Truth
// ====================================================================

import {
  WastageRecord,
  CreateWastageDTO,
  WastageReason,
  InventoryTransaction,
  Ingredient
} from '../types/inventory';
import {
  SupportedUnit,
  isSupportedUnit,
  convertQuantity
} from './unitConversion';
import { RBACService } from './rbac';
import { supabase } from './db';
import { IngredientService } from './ingredientService';

export const STORAGE_KEY_WASTAGE = 'wr_wastage_records';

export class WastageService {
  // Legacy stubs for backward compatibility
  public static getCurrentBusinessId(): string {
    return '';
  }

  public static setCurrentBusinessId(_id: string): void {}

  public static enforceTenantIsolation(_entityBusinessId?: string, _requestedBusinessId?: string): void {}

  private static checkManagePermission(): void {
    if (!RBACService.hasPermission('inventory.manage')) {
      throw new Error("Unauthorized: Missing required permission 'inventory.manage' to record wastage.");
    }
  }

  // ====================================================================
  // DATABASE MAPPER (Exact 10 columns for wastage table)
  // ====================================================================

  public static mapDatabaseWastage(row: any, ingredient?: Ingredient): WastageRecord {
    const qty = Number(row.quantity ?? 0);
    const cpu = Number(row.cost_per_unit ?? 0);
    const loss = Number(row.total_loss ?? qty * cpu);

    return {
      id: row.id,
      ingredientId: row.ingredient_id,
      ingredient_id: row.ingredient_id,
      ingredientName: ingredient?.name || 'Unknown Ingredient',
      quantity: qty,
      unit: row.unit || 'kg',
      reason: (row.reason || 'Spoiled') as WastageReason,
      notes: row.notes || '',
      costPerUnit: cpu,
      cost_per_unit: cpu,
      unitCost: cpu,
      totalLoss: loss,
      total_loss: loss,
      createdBy: row.created_by || 'Staff',
      created_by: row.created_by || 'Staff',
      reportedBy: row.created_by || 'Staff',
      status: 'FINALIZED',
      createdAt: row.created_at || new Date().toISOString(),
      ingredient
    };
  }

  // ====================================================================
  // ESTIMATION
  // ====================================================================

  public static estimateWastage(
    ingredient: Ingredient,
    quantity: number,
    unit: string
  ): {
    normalizedQuantity: number;
    remainingStock: number;
    costPerUnit: number;
    totalLoss: number;
    isOverStock: boolean;
  } {
    let normalizedQty = quantity;
    if (unit !== ingredient.baseUnit && isSupportedUnit(unit) && isSupportedUnit(ingredient.baseUnit)) {
      normalizedQty = convertQuantity(quantity, unit as SupportedUnit, ingredient.baseUnit as SupportedUnit);
    }

    const remainingStock = Number((ingredient.currentStock - normalizedQty).toFixed(4));
    const costPerUnit = ingredient.averageCostPerUnit;
    const totalLoss = Number((normalizedQty * costPerUnit).toFixed(2));
    const isOverStock = normalizedQty > ingredient.currentStock;

    return {
      normalizedQuantity: normalizedQty,
      remainingStock,
      costPerUnit,
      totalLoss,
      isOverStock
    };
  }

  // ====================================================================
  // QUERY & RETRIEVAL
  // ====================================================================

  public static async getWastageRecords(ingredientId?: string, _businessId?: string): Promise<WastageRecord[]> {
    if (!RBACService.hasPermission('inventory.view')) {
      throw new Error("Unauthorized: Missing required permission 'inventory.view'.");
    }

    try {
      let query = supabase
        .from('wastage')
        .select('*')
        .order('created_at', { ascending: false });

      if (ingredientId) {
        query = query.eq('ingredient_id', ingredientId);
      }

      const [wastageRes, ingredients] = await Promise.all([
        query,
        IngredientService.getIngredients()
      ]);

      if (wastageRes.error) {
        console.warn('[WastageService] getWastageRecords error:', wastageRes.error.message);
        const cached = localStorage.getItem(STORAGE_KEY_WASTAGE);
        return cached ? JSON.parse(cached) : [];
      }

      const ingMap = new Map(ingredients.map((i) => [i.id, i]));
      const records = (wastageRes.data || []).map((row) =>
        this.mapDatabaseWastage(row, ingMap.get(row.ingredient_id))
      );

      localStorage.setItem(STORAGE_KEY_WASTAGE, JSON.stringify(records));
      return records;
    } catch (e: any) {
      console.error('[WastageService] getWastageRecords exception:', e);
      const cached = localStorage.getItem(STORAGE_KEY_WASTAGE);
      return cached ? JSON.parse(cached) : [];
    }
  }

  // ====================================================================
  // RECORD WASTAGE
  // ====================================================================

  public static async recordWastage(
    dto: CreateWastageDTO,
    actorName = 'Staff',
    _businessId?: string,
    _forceDeductOrIdempotency?: boolean | string
  ): Promise<{ wastage: WastageRecord; wastageRecord: WastageRecord; transaction: InventoryTransaction }> {
    this.checkManagePermission();

    if (!dto.ingredientId) throw new Error('Ingredient ID is required.');
    if (dto.quantity <= 0) throw new Error('Wastage quantity must be strictly greater than 0.');
    if (!isSupportedUnit(dto.unit)) throw new Error(`Invalid unit '${dto.unit}'.`);

    const ingredient = await IngredientService.getIngredientById(dto.ingredientId);
    if (!ingredient) throw new Error(`Ingredient with id '${dto.ingredientId}' not found.`);

    let normalizedQty = dto.quantity;
    if (dto.unit !== ingredient.baseUnit && isSupportedUnit(dto.unit) && isSupportedUnit(ingredient.baseUnit)) {
      normalizedQty = convertQuantity(dto.quantity, dto.unit as SupportedUnit, ingredient.baseUnit as SupportedUnit);
    }

    const stockBefore = ingredient.currentStock;
    const stockAfter = Number((stockBefore - normalizedQty).toFixed(4));
    const costPerUnit = ingredient.averageCostPerUnit;
    const totalLoss = Number((normalizedQty * costPerUnit).toFixed(2));

    const wastagePayload = {
      ingredient_id: dto.ingredientId,
      quantity: normalizedQty,
      unit: ingredient.baseUnit,
      reason: dto.reason,
      notes: dto.notes?.trim() || null,
      cost_per_unit: costPerUnit,
      total_loss: totalLoss,
      created_by: actorName
    };

    const { data: wastageRow, error: wErr } = await supabase
      .from('wastage')
      .insert(wastagePayload)
      .select()
      .single();

    if (wErr) {
      console.error('[WastageService] recordWastage error:', wErr);
      throw new Error(`Database error recording wastage: ${wErr.message}`);
    }

    const txPayload = {
      ingredient_id: dto.ingredientId,
      transaction_type: 'WASTAGE',
      quantity: normalizedQty,
      unit: ingredient.baseUnit,
      unit_cost: costPerUnit,
      reference_id: wastageRow.id,
      reference_type: 'WASTAGE',
      notes: `Wastage [${dto.reason}]: ${dto.quantity} ${dto.unit}${dto.notes ? ` - ${dto.notes}` : ''}`,
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
      console.warn('[WastageService] Wastage transaction logging warning:', txErr.message);
    }

    const { error: updErr } = await supabase
      .from('ingredients')
      .update({
        current_stock: stockAfter,
        updated_at: new Date().toISOString()
      })
      .eq('id', dto.ingredientId);

    if (updErr) {
      console.error('[WastageService] Stock update error on wastage:', updErr);
      throw new Error(`Failed to deduct stock: ${updErr.message}`);
    }

    this.dispatchUpdateEvent('wastage_updated');
    this.dispatchUpdateEvent('ingredients_updated');
    this.dispatchUpdateEvent('inventory_transactions_updated');

    const wastageRecord = this.mapDatabaseWastage(wastageRow, ingredient);
    const transaction = IngredientService.mapDatabaseTransaction(txRow || txPayload);

    return { wastage: wastageRecord, wastageRecord, transaction };
  }

  private static dispatchUpdateEvent(name: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(name));
      window.dispatchEvent(new Event('storage'));
    }
  }
}
