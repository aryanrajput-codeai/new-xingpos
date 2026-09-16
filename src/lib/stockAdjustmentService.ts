// ====================================================================
// WEBRAJYA POS - STOCK ADJUSTMENT SERVICE
// Single Restaurant Architecture - Direct Supabase Source of Truth
// ====================================================================

import {
  StockAdjustmentRecord,
  CreateStockAdjustmentDTO,
  StockAdjustmentType,
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
import { ensureSupabaseSession } from './supabaseAuth';
import { IngredientService } from './ingredientService';

export const STORAGE_KEY_ADJUSTMENTS = 'wr_stock_adjustments';

export class StockAdjustmentService {
  // Legacy stubs for backward compatibility
  public static getCurrentBusinessId(): string {
    return '';
  }

  public static setCurrentBusinessId(_id: string): void {}

  public static enforceTenantIsolation(_entityBusinessId?: string, _requestedBusinessId?: string): void {}

  private static checkManagePermission(): void {
    if (!RBACService.hasPermission('inventory.manage')) {
      throw new Error("Unauthorized: Missing required permission 'inventory.manage' to record stock adjustments.");
    }
  }

  public static estimateAdjustment(
    ingredient: Ingredient,
    mode: 'DIRECT' | 'PHYSICAL_COUNT',
    params: {
      adjustmentType?: StockAdjustmentType;
      quantity?: number;
      unit?: string;
      physicalCount?: number;
    }
  ): {
    normalizedDelta: number;
    effectiveType: StockAdjustmentType;
    stockBefore: number;
    stockAfter: number;
    costImpact: number;
    hasDiscrepancy: boolean;
  } {
    const stockBefore = ingredient.currentStock;
    let normalizedDelta = 0;
    let effectiveType: StockAdjustmentType = 'ADJUSTMENT_IN';

    if (mode === 'PHYSICAL_COUNT') {
      const targetCount = Number(params.physicalCount ?? 0);
      const diff = targetCount - stockBefore;
      if (diff >= 0) {
        effectiveType = 'ADJUSTMENT_IN';
        normalizedDelta = Number(diff.toFixed(4));
      } else {
        effectiveType = 'ADJUSTMENT_OUT';
        normalizedDelta = Number(Math.abs(diff).toFixed(4));
      }
    } else {
      effectiveType = params.adjustmentType || 'ADJUSTMENT_IN';
      const rawQty = Number(params.quantity ?? 0);
      const unit = params.unit || ingredient.baseUnit;
      if (unit !== ingredient.baseUnit && isSupportedUnit(unit) && isSupportedUnit(ingredient.baseUnit)) {
        normalizedDelta = convertQuantity(rawQty, unit as SupportedUnit, ingredient.baseUnit as SupportedUnit);
      } else {
        normalizedDelta = rawQty;
      }
    }

    let stockAfter = stockBefore;
    if (effectiveType === 'ADJUSTMENT_IN') {
      stockAfter = Number((stockBefore + normalizedDelta).toFixed(4));
    } else {
      stockAfter = Number((stockBefore - normalizedDelta).toFixed(4));
    }

    const costImpact = Number((normalizedDelta * ingredient.averageCostPerUnit).toFixed(2));
    const hasDiscrepancy = normalizedDelta > 0.0001;

    return {
      normalizedDelta,
      effectiveType,
      stockBefore,
      stockAfter,
      costImpact,
      hasDiscrepancy
    };
  }

  public static async recordAdjustment(
    dto: CreateStockAdjustmentDTO,
    actorName = 'Store Manager',
    _businessId?: string,
    _forceApplyOrIdempotency?: boolean | string
  ): Promise<{ adjustment: StockAdjustmentRecord; adjustmentRecord: StockAdjustmentRecord; transaction: InventoryTransaction }> {
    this.checkManagePermission();
    await ensureSupabaseSession();

    if (!dto.ingredientId) throw new Error('Ingredient ID is required.');
    const ingredient = await IngredientService.getIngredientById(dto.ingredientId);
    if (!ingredient) throw new Error(`Ingredient with id '${dto.ingredientId}' not found.`);

    let normalizedQty = 0;
    let effectiveType: StockAdjustmentType = dto.adjustmentType;

    if (dto.isPhysicalCountMode && dto.physicalCount !== undefined) {
      const targetCount = Number(dto.physicalCount);
      const diff = targetCount - ingredient.currentStock;
      if (diff >= 0) {
        effectiveType = 'ADJUSTMENT_IN';
        normalizedQty = Number(diff.toFixed(4));
      } else {
        effectiveType = 'ADJUSTMENT_OUT';
        normalizedQty = Number(Math.abs(diff).toFixed(4));
      }
    } else {
      if (dto.quantity <= 0) throw new Error('Adjustment quantity must be greater than 0.');
      if (!isSupportedUnit(dto.unit)) throw new Error(`Invalid unit '${dto.unit}'.`);

      if (dto.unit !== ingredient.baseUnit && isSupportedUnit(dto.unit) && isSupportedUnit(ingredient.baseUnit)) {
        normalizedQty = convertQuantity(dto.quantity, dto.unit as SupportedUnit, ingredient.baseUnit as SupportedUnit);
      } else {
        normalizedQty = dto.quantity;
      }
    }

    const stockBefore = ingredient.currentStock;
    let stockAfter = stockBefore;
    if (effectiveType === 'ADJUSTMENT_IN') {
      stockAfter = Number((stockBefore + normalizedQty).toFixed(4));
    } else {
      stockAfter = Number((stockBefore - normalizedQty).toFixed(4));
    }

    const costImpact = Number((normalizedQty * ingredient.averageCostPerUnit).toFixed(2));
    const now = new Date().toISOString();

    const txPayload = {
      ingredient_id: dto.ingredientId,
      transaction_type: effectiveType,
      quantity: normalizedQty,
      unit: ingredient.baseUnit,
      unit_cost: ingredient.averageCostPerUnit,
      reference_id: `ADJ-${Date.now().toString(36).toUpperCase()}`,
      reference_type: 'STOCK_ADJUSTMENT',
      notes: `Adjustment [${dto.reason}]: ${effectiveType === 'ADJUSTMENT_IN' ? '+' : '-'}${normalizedQty} ${ingredient.baseUnit}${dto.notes ? ` - ${dto.notes}` : ''}`,
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
      console.error('[StockAdjustmentService] Record adjustment tx error:', txErr);
      throw new Error(`Database error recording transaction: ${txErr.message}`);
    }

    const { error: updErr } = await supabase
      .from('ingredients')
      .update({
        current_stock: stockAfter,
        updated_at: now
      })
      .eq('id', dto.ingredientId);

    if (updErr) {
      console.error('[StockAdjustmentService] Update stock error:', updErr);
      throw new Error(`Failed to update stock: ${updErr.message}`);
    }

    const record: StockAdjustmentRecord = {
      id: txRow.id,
      ingredientId: dto.ingredientId,
      ingredientName: ingredient.name,
      adjustmentType: effectiveType,
      quantity: normalizedQty,
      unit: ingredient.baseUnit,
      stockBefore,
      stockAfter,
      reason: dto.reason,
      notes: dto.notes,
      reportedBy: actorName,
      costPerUnit: ingredient.averageCostPerUnit,
      totalCostImpact: costImpact,
      status: 'FINALIZED',
      createdAt: now,
      ingredient
    };

    const stored = localStorage.getItem(STORAGE_KEY_ADJUSTMENTS);
    const all: StockAdjustmentRecord[] = stored ? JSON.parse(stored) : [];
    all.unshift(record);
    localStorage.setItem(STORAGE_KEY_ADJUSTMENTS, JSON.stringify(all.slice(0, 100)));

    this.dispatchUpdateEvent('adjustments_updated');
    this.dispatchUpdateEvent('ingredients_updated');
    this.dispatchUpdateEvent('inventory_transactions_updated');

    const transaction = IngredientService.mapDatabaseTransaction(txRow);
    return { adjustment: record, adjustmentRecord: record, transaction };
  }

  public static async getAdjustments(_businessId?: string): Promise<StockAdjustmentRecord[]> {
    const stored = localStorage.getItem(STORAGE_KEY_ADJUSTMENTS);
    return stored ? JSON.parse(stored) : [];
  }

  private static dispatchUpdateEvent(name: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(name));
      window.dispatchEvent(new Event('storage'));
    }
  }
}
