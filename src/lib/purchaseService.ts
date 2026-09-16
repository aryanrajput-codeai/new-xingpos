// ====================================================================
// WEBRAJYA POS - PURCHASE SERVICE
// Single Restaurant Architecture - Direct Supabase Source of Truth
// ====================================================================

import {
  Purchase,
  PurchaseItem,
  CreatePurchaseDTO,
  UpdatePurchaseDTO,
  InventoryImpactSummary,
  Ingredient,
  Supplier,
  PurchaseStatus
} from '../types/inventory';
import {
  SupportedUnit,
  isSupportedUnit,
  convertQuantity
} from './unitConversion';
import { RBACService } from './rbac';
import { supabase } from './db';
import { IngredientService } from './ingredientService';
import { SupplierService } from './supplierService';

export const STORAGE_KEY_PURCHASES = 'wr_purchases';
export const STORAGE_KEY_PURCHASE_ITEMS = 'wr_purchase_items';

export interface PurchaseFilter {
  status?: string;
  supplierId?: string;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

export class PurchaseService {
  // Legacy stubs for backward compatibility
  public static getCurrentBusinessId(): string {
    return '';
  }

  public static setCurrentBusinessId(_id: string): void {}

  public static enforceTenantIsolation(_entityBusinessId?: string, _requestedBusinessId?: string): void {}

  public static checkViewPermission(): void {
    if (!RBACService.hasPermission('inventory.view')) {
      throw new Error("Unauthorized: Missing required permission 'inventory.view'.");
    }
  }

  public static checkManagePermission(): void {
    if (!RBACService.hasPermission('inventory.manage')) {
      throw new Error("Unauthorized: Missing required permission 'inventory.manage'.");
    }
  }

  // ====================================================================
  // DATABASE MAPPERS (Exact 11 columns for purchases, 8 for purchase_items)
  // ====================================================================

  public static mapDatabasePurchase(row: any, items?: PurchaseItem[], supplier?: Supplier): Purchase {
    const subtotal = Number(row.subtotal ?? 0);
    const tax = Number(row.tax ?? 0);
    const total = Number(row.total ?? subtotal + tax);

    return {
      id: row.id,
      supplierId: row.supplier_id,
      supplier_id: row.supplier_id,
      invoiceNumber: row.invoice_number || '',
      invoice_number: row.invoice_number || '',
      purchaseNumber: row.invoice_number || `PO-${row.id.substring(0, 8)}`,
      status: (row.status || 'DRAFT') as PurchaseStatus,
      purchaseDate: row.purchase_date || row.created_at,
      purchase_date: row.purchase_date || row.created_at,
      subtotal,
      tax,
      taxAmount: tax,
      total,
      discount: 0,
      grandTotal: total,
      totalAmount: total,
      notes: row.notes || '',
      createdBy: 'Staff',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      supplier,
      items: items || []
    };
  }

  public static mapDatabasePurchaseItem(row: any, ingredient?: Ingredient): PurchaseItem {
    const qty = Number(row.quantity ?? 0);
    const unitCost = Number(row.unit_cost ?? 0);
    const totalCost = Number(row.total_cost ?? qty * unitCost);

    return {
      id: row.id,
      purchaseId: row.purchase_id,
      purchase_id: row.purchase_id,
      ingredientId: row.ingredient_id,
      ingredient_id: row.ingredient_id,
      quantity: qty,
      unit: row.unit,
      unitCost,
      unit_cost: unitCost,
      totalCost,
      total_cost: totalCost,
      createdAt: row.created_at || new Date().toISOString(),
      ingredient
    };
  }

  // ====================================================================
  // QUERY & RETRIEVAL
  // ====================================================================

  public static async getPurchases(filter?: PurchaseFilter, _businessId?: string): Promise<Purchase[]> {
    this.checkViewPermission();

    try {
      let query = supabase
        .from('purchases')
        .select('*')
        .order('purchase_date', { ascending: false });

      if (filter?.status && filter.status !== 'ALL') {
        query = query.eq('status', filter.status);
      }
      if (filter?.supplierId && filter.supplierId !== 'ALL') {
        query = query.eq('supplier_id', filter.supplierId);
      }

      const [purchasesRes, itemsRes, suppliers, ingredients] = await Promise.all([
        query,
        supabase.from('purchase_items').select('*'),
        SupplierService.getSuppliers(),
        IngredientService.getIngredients()
      ]);

      if (purchasesRes.error) {
        console.warn('[PurchaseService] getPurchases error:', purchasesRes.error.message);
        const cached = localStorage.getItem(STORAGE_KEY_PURCHASES);
        return cached ? JSON.parse(cached) : [];
      }

      const supMap = new Map(suppliers.map((s) => [s.id, s]));
      const ingMap = new Map(ingredients.map((i) => [i.id, i]));

      const itemsByPurchase = new Map<string, PurchaseItem[]>();
      for (const rawItem of (itemsRes.data || [])) {
        const item = this.mapDatabasePurchaseItem(rawItem, ingMap.get(rawItem.ingredient_id));
        if (!itemsByPurchase.has(rawItem.purchase_id)) {
          itemsByPurchase.set(rawItem.purchase_id, []);
        }
        itemsByPurchase.get(rawItem.purchase_id)!.push(item);
      }

      let purchases = (purchasesRes.data || []).map((row) => {
        const items = itemsByPurchase.get(row.id) || [];
        const supplier = supMap.get(row.supplier_id);
        return this.mapDatabasePurchase(row, items, supplier);
      });

      if (filter?.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        purchases = purchases.filter((p) =>
          (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
          (p.supplier?.name && p.supplier.name.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        );
      }

      localStorage.setItem(STORAGE_KEY_PURCHASES, JSON.stringify(purchases));
      return purchases;
    } catch (e: any) {
      console.error('[PurchaseService] getPurchases exception:', e);
      const cached = localStorage.getItem(STORAGE_KEY_PURCHASES);
      return cached ? JSON.parse(cached) : [];
    }
  }

  public static async getPurchaseById(id: string, _businessId?: string): Promise<Purchase | null> {
    this.checkViewPermission();

    const [purchaseRes, itemsRes, suppliers, ingredients] = await Promise.all([
      supabase.from('purchases').select('*').eq('id', id).maybeSingle(),
      supabase.from('purchase_items').select('*').eq('purchase_id', id),
      SupplierService.getSuppliers(),
      IngredientService.getIngredients()
    ]);

    if (purchaseRes.error) {
      console.error('[PurchaseService] getPurchaseById error:', purchaseRes.error);
      throw new Error(`Failed to fetch purchase: ${purchaseRes.error.message}`);
    }

    if (!purchaseRes.data) return null;

    const supMap = new Map(suppliers.map((s) => [s.id, s]));
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));

    const items = (itemsRes.data || []).map((raw) =>
      this.mapDatabasePurchaseItem(raw, ingMap.get(raw.ingredient_id))
    );
    const supplier = supMap.get(purchaseRes.data.supplier_id);

    return this.mapDatabasePurchase(purchaseRes.data, items, supplier);
  }

  // ====================================================================
  // MUTATIONS (CREATE, UPDATE, FINALIZE, CANCEL)
  // ====================================================================

  public static async createPurchase(
    dto: CreatePurchaseDTO,
    actorName = 'Store Manager',
    _businessId?: string
  ): Promise<{ purchase: Purchase; inventoryImpact: InventoryImpactSummary[] }> {
    this.checkManagePermission();

    if (!dto.supplierId) {
      throw new Error('Supplier ID is required.');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new Error('At least one item is required in a purchase order.');
    }

    let subtotal = 0;
    const validatedItems = dto.items.map((item) => {
      if (!item.ingredientId) throw new Error('Ingredient ID is required for each item.');
      if (item.quantity <= 0) throw new Error('Item quantity must be strictly greater than 0.');
      if (item.unitCost < 0) throw new Error('Item unit cost cannot be negative.');
      if (!isSupportedUnit(item.unit)) throw new Error(`Invalid unit '${item.unit}'.`);

      const totalCost = Number((item.quantity * item.unitCost).toFixed(2));
      subtotal += totalCost;
      return { ...item, totalCost };
    });

    const tax = Math.max(0, Number(dto.tax ?? 0));
    const total = Number((subtotal + tax).toFixed(2));
    const requestedStatus = dto.status || 'DRAFT';

    // 1. Insert into purchases (exact 11 columns)
    const purchasePayload = {
      supplier_id: dto.supplierId,
      invoice_number: dto.invoiceNumber?.trim() || null,
      status: requestedStatus === 'FINALIZED' ? 'DRAFT' : requestedStatus,
      purchase_date: dto.purchaseDate || new Date().toISOString(),
      subtotal,
      tax,
      total,
      notes: dto.notes?.trim() || null
    };

    const { data: purchaseRow, error: pErr } = await supabase
      .from('purchases')
      .insert(purchasePayload)
      .select()
      .single();

    if (pErr) {
      console.error('[PurchaseService] createPurchase error:', pErr);
      throw new Error(`Database error creating purchase: ${pErr.message}`);
    }

    // 2. Insert items into purchase_items (exact 8 columns)
    const itemRows = validatedItems.map((it) => ({
      purchase_id: purchaseRow.id,
      ingredient_id: it.ingredientId,
      quantity: it.quantity,
      unit: it.unit,
      unit_cost: it.unitCost,
      total_cost: it.totalCost
    }));

    const { data: createdItems, error: itemsErr } = await supabase
      .from('purchase_items')
      .insert(itemRows)
      .select();

    if (itemsErr) {
      console.error('[PurchaseService] createPurchase items error:', itemsErr);
      await supabase.from('purchases').delete().eq('id', purchaseRow.id);
      throw new Error(`Database error adding purchase items: ${itemsErr.message}`);
    }

    const ingredients = await IngredientService.getIngredients();
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));
    const supplier = await SupplierService.getSupplierById(dto.supplierId);

    const items = (createdItems || []).map((r) =>
      this.mapDatabasePurchaseItem(r, ingMap.get(r.ingredient_id))
    );

    let createdPurchase = this.mapDatabasePurchase(purchaseRow, items, supplier || undefined);
    let inventoryImpact: InventoryImpactSummary[] = [];

    // If requested status was FINALIZED, finalize it directly
    if (requestedStatus === 'FINALIZED') {
      const finResult = await this.finalizePurchase(createdPurchase.id, actorName);
      createdPurchase = finResult.purchase;
      inventoryImpact = finResult.impacts;
    }

    this.dispatchUpdateEvent('purchases_updated');
    return Object.assign(createdPurchase, { purchase: createdPurchase, inventoryImpact });
  }

  public static async updatePurchase(
    id: string,
    dto: UpdatePurchaseDTO,
    _actorName = 'Store Manager',
    _businessId?: string
  ): Promise<Purchase & { purchase: Purchase }> {
    this.checkManagePermission();

    const existing = await this.getPurchaseById(id);
    if (!existing) throw new Error(`Purchase '${id}' not found.`);
    if (existing.status !== 'DRAFT') {
      throw new Error(`Only DRAFT purchases can be edited. Current status: '${existing.status}'.`);
    }

    let subtotal = existing.subtotal;
    let tax = dto.tax !== undefined ? Number(dto.tax) : existing.tax;

    if (dto.items && dto.items.length > 0) {
      subtotal = 0;
      const validatedItems = dto.items.map((it) => {
        if (it.quantity <= 0) throw new Error('Quantity must be greater than 0.');
        if (it.unitCost < 0) throw new Error('Unit cost cannot be negative.');
        const totalCost = Number((it.quantity * it.unitCost).toFixed(2));
        subtotal += totalCost;
        return { ...it, totalCost };
      });

      await supabase.from('purchase_items').delete().eq('purchase_id', id);

      const itemRows = validatedItems.map((it) => ({
        purchase_id: id,
        ingredient_id: it.ingredientId,
        quantity: it.quantity,
        unit: it.unit,
        unit_cost: it.unitCost,
        total_cost: it.totalCost
      }));

      const { error: itemsErr } = await supabase.from('purchase_items').insert(itemRows);
      if (itemsErr) throw new Error(`Failed to update purchase items: ${itemsErr.message}`);
    }

    const total = Number((subtotal + tax).toFixed(2));

    const updatePayload: Record<string, any> = {
      subtotal,
      tax,
      total,
      updated_at: new Date().toISOString()
    };

    if (dto.supplierId) updatePayload.supplier_id = dto.supplierId;
    if (dto.invoiceNumber !== undefined) updatePayload.invoice_number = dto.invoiceNumber.trim() || null;
    if (dto.purchaseDate) updatePayload.purchase_date = dto.purchaseDate;
    if (dto.notes !== undefined) updatePayload.notes = dto.notes.trim() || null;

    const { error: pErr } = await supabase
      .from('purchases')
      .update(updatePayload)
      .eq('id', id);

    if (pErr) throw new Error(`Database error updating purchase: ${pErr.message}`);

    this.dispatchUpdateEvent('purchases_updated');
    const updated = await this.getPurchaseById(id);
    return Object.assign(updated!, { purchase: updated! });
  }

  /**
   * Finalizes a purchase order:
   * 1. Sets status to 'FINALIZED'
   * 2. Adds stock to each ingredient and recalculates weighted average cost
   * 3. Creates immutable 'PURCHASE' transaction records in inventory_transactions
   */
  public static async finalizePurchase(
    id: string,
    actorName = 'Store Manager',
    _businessId?: string
  ): Promise<{ purchase: Purchase; impacts: InventoryImpactSummary[]; inventoryImpact: InventoryImpactSummary[] }> {
    this.checkManagePermission();

    const purchase = await this.getPurchaseById(id);
    if (!purchase) throw new Error(`Purchase with id '${id}' not found.`);
    if (purchase.status === 'FINALIZED') {
      throw new Error(`Purchase order '${purchase.invoiceNumber || id}' is already finalized.`);
    }
    if (purchase.status === 'CANCELLED') {
      throw new Error(`Cannot finalize cancelled purchase order '${purchase.invoiceNumber || id}'.`);
    }

    const items = purchase.items || [];
    if (items.length === 0) {
      throw new Error('Cannot finalize a purchase order with no items.');
    }

    const impacts: InventoryImpactSummary[] = [];

    for (const item of items) {
      const ingredient = await IngredientService.getIngredientById(item.ingredientId);
      if (!ingredient) {
        throw new Error(`Ingredient with id '${item.ingredientId}' not found.`);
      }

      let addedQty = item.quantity;
      let unitCostInBaseUnit = item.unitCost;
      if (item.unit !== ingredient.baseUnit && isSupportedUnit(item.unit) && isSupportedUnit(ingredient.baseUnit)) {
        addedQty = convertQuantity(item.quantity, item.unit as SupportedUnit, ingredient.baseUnit as SupportedUnit);
        const factor = addedQty / item.quantity;
        unitCostInBaseUnit = item.unitCost / factor;
      }

      const stockBefore = ingredient.currentStock;
      const stockAfter = Number((stockBefore + addedQty).toFixed(4));
      const costBefore = ingredient.averageCostPerUnit;

      let newAverageCost = unitCostInBaseUnit;
      if (stockBefore > 0) {
        const totalOldVal = stockBefore * costBefore;
        const totalNewVal = addedQty * unitCostInBaseUnit;
        newAverageCost = Number(((totalOldVal + totalNewVal) / stockAfter).toFixed(2));
      }

      const txPayload = {
        ingredient_id: ingredient.id,
        transaction_type: 'PURCHASE',
        quantity: addedQty,
        unit: ingredient.baseUnit,
        unit_cost: unitCostInBaseUnit,
        reference_id: purchase.id,
        reference_type: 'PURCHASE',
        notes: `PO Received: ${item.quantity} ${item.unit} (Inv: ${purchase.invoiceNumber || purchase.id.substring(0, 8)})`,
        stock_before: stockBefore,
        stock_after: stockAfter,
        created_by: actorName
      };

      const { error: txErr } = await supabase.from('inventory_transactions').insert(txPayload);
      if (txErr) {
        console.error('[PurchaseService] Finalize tx record error:', txErr);
        throw new Error(`Failed to record transaction for ingredient '${ingredient.name}': ${txErr.message}`);
      }

      const { error: ingUpdErr } = await supabase
        .from('ingredients')
        .update({
          current_stock: stockAfter,
          average_cost_per_unit: newAverageCost,
          updated_at: new Date().toISOString()
        })
        .eq('id', ingredient.id);

      if (ingUpdErr) {
        console.error('[PurchaseService] Finalize stock update error:', ingUpdErr);
        throw new Error(`Failed to update stock for ingredient '${ingredient.name}': ${ingUpdErr.message}`);
      }

      impacts.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        unit: ingredient.baseUnit,
        stockBefore,
        quantityAdded: addedQty,
        stockAfter,
        costBefore,
        newAverageCost,
        totalCost: item.totalCost
      });
    }

    const { error: pUpdErr } = await supabase
      .from('purchases')
      .update({
        status: 'FINALIZED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (pUpdErr) {
      throw new Error(`Failed to finalize purchase: ${pUpdErr.message}`);
    }

    this.dispatchUpdateEvent('purchases_updated');
    this.dispatchUpdateEvent('ingredients_updated');
    this.dispatchUpdateEvent('inventory_transactions_updated');

    const finalizedPurchase = await this.getPurchaseById(id);
    return {
      purchase: finalizedPurchase!,
      impacts,
      inventoryImpact: impacts
    };
  }

  public static async cancelFinalizedPurchase(
    id: string,
    reason = 'Cancelled by manager',
    actorName = 'Store Manager',
    _businessId?: string
  ): Promise<{ purchase: Purchase; reversedCount: number }> {
    this.checkManagePermission();

    const purchase = await this.getPurchaseById(id);
    if (!purchase) throw new Error(`Purchase with id '${id}' not found.`);
    if (purchase.status !== 'FINALIZED') {
      throw new Error('Only finalized purchases can be reversed via this action.');
    }

    let reversedCount = 0;
    for (const item of purchase.items || []) {
      const ingredient = await IngredientService.getIngredientById(item.ingredientId);
      if (!ingredient) continue;

      let deductedQty = item.quantity;
      if (item.unit !== ingredient.baseUnit && isSupportedUnit(item.unit) && isSupportedUnit(ingredient.baseUnit)) {
        deductedQty = convertQuantity(item.quantity, item.unit as SupportedUnit, ingredient.baseUnit as SupportedUnit);
      }

      const stockBefore = ingredient.currentStock;
      const stockAfter = Number((stockBefore - deductedQty).toFixed(4));

      // Reversal transaction
      const txPayload = {
        ingredient_id: ingredient.id,
        transaction_type: 'PURCHASE_REVERSAL',
        quantity: deductedQty,
        unit: ingredient.baseUnit,
        unit_cost: item.unitCost,
        reference_id: purchase.id,
        reference_type: 'PURCHASE_CANCEL',
        notes: `PO Reversal: ${reason} (Inv: ${purchase.invoiceNumber || purchase.id.substring(0, 8)})`,
        stock_before: stockBefore,
        stock_after: stockAfter,
        created_by: actorName
      };

      await supabase.from('inventory_transactions').insert(txPayload);

      await supabase
        .from('ingredients')
        .update({
          current_stock: stockAfter,
          updated_at: new Date().toISOString()
        })
        .eq('id', ingredient.id);

      reversedCount++;
    }

    await supabase
      .from('purchases')
      .update({
        status: 'CANCELLED',
        notes: purchase.notes ? `${purchase.notes} | Cancel reason: ${reason}` : `Cancel reason: ${reason}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    this.dispatchUpdateEvent('purchases_updated');
    this.dispatchUpdateEvent('ingredients_updated');
    this.dispatchUpdateEvent('inventory_transactions_updated');

    const updated = await this.getPurchaseById(id);
    return { purchase: updated!, reversedCount };
  }

  public static async cancelPurchase(id: string, _actorName = 'Store Manager', _businessId?: string): Promise<Purchase> {
    this.checkManagePermission();

    const purchase = await this.getPurchaseById(id);
    if (!purchase) throw new Error(`Purchase with id '${id}' not found.`);
    if (purchase.status === 'FINALIZED') {
      throw new Error('Cannot cancel a finalized purchase order. Stock has already been accepted.');
    }

    const { error } = await supabase
      .from('purchases')
      .update({
        status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw new Error(`Failed to cancel purchase: ${error.message}`);

    this.dispatchUpdateEvent('purchases_updated');
    const updated = await this.getPurchaseById(id);
    return updated!;
  }

  public static async deletePurchase(id: string, _actorName = 'Store Manager', _businessId?: string): Promise<void> {
    this.checkManagePermission();

    const purchase = await this.getPurchaseById(id);
    if (!purchase) throw new Error(`Purchase with id '${id}' not found.`);
    if (purchase.status === 'FINALIZED') {
      throw new Error('Cannot delete a finalized purchase order.');
    }

    await supabase.from('purchase_items').delete().eq('purchase_id', id);
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete purchase: ${error.message}`);

    this.dispatchUpdateEvent('purchases_updated');
  }

  public static async getPurchaseInventoryImpact(purchaseId: string, _businessId?: string): Promise<InventoryImpactSummary[]> {
    const purchase = await this.getPurchaseById(purchaseId);
    if (!purchase) return [];

    const { data: txList } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('reference_id', purchaseId)
      .eq('transaction_type', 'PURCHASE');

    if (!txList || txList.length === 0) {
      return (purchase.items || []).map((it) => ({
        ingredientId: it.ingredientId,
        ingredientName: it.ingredient?.name || 'Unknown',
        unit: it.unit,
        stockBefore: 0,
        quantityAdded: it.quantity,
        stockAfter: it.quantity,
        costBefore: it.unitCost,
        newAverageCost: it.unitCost,
        totalCost: it.totalCost
      }));
    }

    const ingredients = await IngredientService.getIngredients();
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));

    return txList.map((tx) => {
      const ing = ingMap.get(tx.ingredient_id);
      const qty = Number(tx.quantity ?? 0);
      const cost = Number(tx.unit_cost ?? 0);
      return {
        ingredientId: tx.ingredient_id,
        ingredientName: ing?.name || 'Ingredient',
        unit: tx.unit,
        stockBefore: Number(tx.stock_before ?? 0),
        quantityAdded: qty,
        stockAfter: Number(tx.stock_after ?? 0),
        costBefore: Number(ing?.averageCostPerUnit ?? cost),
        newAverageCost: cost,
        totalCost: Number((qty * cost).toFixed(2))
      };
    });
  }

  private static dispatchUpdateEvent(name: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(name));
      window.dispatchEvent(new Event('storage'));
    }
  }
}
