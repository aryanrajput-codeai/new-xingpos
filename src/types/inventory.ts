// ====================================================================
// POS + INVENTORY MANAGEMENT SYSTEM - SINGLE RESTAURANT ARCHITECTURE
// Verified Supabase Database Schema Aligned
// ====================================================================

export type IngredientUnit =
  | 'kg'
  | 'g'
  | 'l'
  | 'ml'
  | 'pcs'
  | 'dozen'
  | 'box'
  | 'can'
  | 'bottle'
  | 'pack'
  | 'portion'
  | 'unit';

export type IngredientStorageType = 'DRY' | 'CHILLED' | 'FROZEN' | 'AMBIENT';

// ingredient_categories table (6 columns: id, name, description, is_active, created_at, updated_at)
export interface IngredientCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  is_active?: boolean;
  createdAt: string;
  updatedAt: string;
  businessId?: string; // Optional legacy compatibility
}

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' | 'OVERSTOCKED' | 'INACTIVE';

// ingredients table (11 columns: id, name, category_id, base_unit, current_stock, minimum_stock, maximum_stock, average_cost_per_unit, is_active, created_at, updated_at)
export interface Ingredient {
  id: string;
  name: string;
  categoryId?: string | null;
  category_id?: string | null;
  baseUnit?: IngredientUnit;
  base_unit?: IngredientUnit;
  unit: IngredientUnit; // Alias to baseUnit
  currentStock: number;
  current_stock?: number;
  minimumStock?: number;
  minimum_stock?: number;
  maximumStock?: number | null;
  maximum_stock?: number | null;
  averageCostPerUnit?: number;
  average_cost_per_unit?: number;
  costPerUnit: number; // Alias to averageCostPerUnit
  minAlertLevel: number; // Alias to minimumStock
  maxStockLevel?: number | null; // Alias to maximumStock
  isActive: boolean;
  is_active?: boolean;
  createdAt: string;
  updatedAt: string;

  // Client-side UI & enrichment properties
  itemCode?: string;
  description?: string;
  reorderQuantity?: number;
  yieldPercentage?: number;
  storageType?: IngredientStorageType;
  lastRestockedAt?: string | null;
  category?: IngredientCategory;
  businessId?: string; // Optional legacy compatibility
}

// recipes table (8 columns: id, menu_item_id, recipe_name, servings, is_active, notes, created_at, updated_at)
export interface Recipe {
  id: string;
  menuItemId: string;
  menu_item_id?: string;
  recipeName?: string;
  recipe_name?: string;
  servings: number;
  portionSize: number; // Alias to servings
  servingUnit?: string;
  preparationNotes?: string;
  laborCost?: number;
  overheadCost?: number;
  notes?: string;
  isActive: boolean;
  is_active?: boolean;
  createdAt: string;
  updatedAt: string;
  items?: RecipeItem[];
  businessId?: string; // Optional legacy compatibility
}

// recipe_items table (8 columns: id, recipe_id, ingredient_id, quantity, unit, wastage_percent, created_at, updated_at)
export interface RecipeItem {
  id: string;
  recipeId: string;
  recipe_id?: string;
  ingredientId: string;
  ingredient_id?: string;
  quantity: number;
  unit: IngredientUnit;
  wastagePercent?: number; // Matches DB column wastage_percent
  wastage_percent?: number;
  wastePercentage?: number; // Alias to wastagePercent
  notes?: string;
  createdAt: string;
  updatedAt: string;
  ingredient?: Ingredient;
  businessId?: string; // Optional legacy compatibility
}

export interface RecipeItemDTO {
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
  wastePercentage?: number;
  wastagePercent?: number;
  notes?: string;
}

export interface CreateRecipeDTO {
  menuItemId: string;
  recipeName?: string;
  portionSize?: number;
  servings?: number;
  servingUnit?: string;
  preparationNotes?: string;
  laborCost?: number;
  overheadCost?: number;
  notes?: string;
  isActive?: boolean;
  items: RecipeItemDTO[];
  businessId?: string; // Optional legacy compatibility
}

export interface UpdateRecipeDTO {
  recipeName?: string;
  portionSize?: number;
  servings?: number;
  servingUnit?: string;
  preparationNotes?: string;
  laborCost?: number;
  overheadCost?: number;
  notes?: string;
  isActive?: boolean;
  items?: RecipeItemDTO[];
  businessId?: string; // Optional legacy compatibility
}

export interface IngredientCostCalculation {
  recipeItemId?: string;
  ingredientId: string;
  ingredientName: string;
  itemCode?: string;
  specifiedQuantity: number;
  specifiedUnit: IngredientUnit;
  wastePercentage: number;
  effectiveQuantity: number;
  normalizedBaseQuantity: number;
  baseUnit: IngredientUnit;
  costPerUnit: number;
  costPerBaseUnit: number;
  calculatedCost: number;
}

export interface RecipeCostBreakdown {
  recipeId?: string;
  menuItemId: string;
  portionSize: number;
  totalIngredientCost: number;
  laborCost: number;
  overheadCost: number;
  totalRecipeCost: number;
  costPerServing: number;
  items: IngredientCostCalculation[];
  sellingPrice?: number;
  foodCostPercentage?: number;
  grossMargin?: number;
  grossMarginPercentage?: number;
}

export interface IngredientAvailabilityItem {
  ingredientId: string;
  ingredientName: string;
  itemCode?: string;
  currentStock: number;
  stockUnit: IngredientUnit;
  requiredPerServing: number;
  requiredUnit: IngredientUnit;
  wastePercentage: number;
  effectiveRequiredPerServing: number;
  normalizedAvailableStock: number;
  normalizedRequiredPerServing: number;
  baseUnit: IngredientUnit;
  maxServings: number;
}

export interface RecipeAvailability {
  recipeId?: string;
  menuItemId: string;
  isAvailable: boolean;
  availableServings: number;
  limitingIngredientId?: string;
  limitingIngredientName?: string;
  limitingIngredientStock?: number;
  limitingIngredientUnit?: IngredientUnit;
  ingredientAvailabilities: IngredientAvailabilityItem[];
}

// suppliers table (10 columns: id, name, contact_person, phone, email, address, gst_number, is_active, created_at, updated_at)
export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  gst_number?: string;
  gstin?: string; // Alias to gstNumber
  notes?: string;
  paymentTerms?: string;
  isActive: boolean;
  is_active?: boolean;
  createdAt: string;
  updatedAt: string;
  supplierCode?: string;
  businessId?: string; // Optional legacy compatibility
}

export interface CreateSupplierDTO {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  gstin?: string; // Alias
  notes?: string;
  paymentTerms?: string;
  isActive?: boolean;
  businessId?: string; // Optional legacy compatibility
}

export interface UpdateSupplierDTO {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  gstin?: string; // Alias
  notes?: string;
  paymentTerms?: string;
  isActive?: boolean;
  businessId?: string; // Optional legacy compatibility
}

export type PurchaseStatus = 'DRAFT' | 'FINALIZED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED' | 'RETURNED';
export type PurchasePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

// purchase_items table (8 columns: id, purchase_id, ingredient_id, quantity, unit, unit_cost, total_cost, created_at)
export interface PurchaseItem {
  id: string;
  purchaseId: string;
  purchase_id?: string;
  ingredientId: string;
  ingredient_id?: string;
  quantity: number;
  unit: IngredientUnit;
  unitCost: number;
  unit_cost?: number;
  totalCost: number;
  total_cost?: number;
  createdAt: string;
  normalizedBaseQuantity?: number;
  baseUnit?: IngredientUnit;
  costPerBaseUnit?: number;
  batchNumber?: string;
  expiryDate?: string | null;
  ingredient?: Ingredient;
  businessId?: string; // Optional legacy compatibility
}

export interface PurchaseItemDTO {
  id?: string;
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
  unitCost: number;
  totalCost?: number;
  batchNumber?: string;
  expiryDate?: string | null;
}

// purchases table (11 columns: id, supplier_id, invoice_number, status, purchase_date, subtotal, tax, total, notes, created_at, updated_at)
export interface Purchase {
  id: string;
  supplierId: string;
  supplier_id?: string;
  invoiceNumber?: string;
  invoice_number?: string;
  purchaseNumber?: string; // Alias
  status: PurchaseStatus;
  purchaseDate: string;
  purchase_date?: string;
  subtotal: number;
  tax: number;
  total: number;
  taxAmount?: number; // Alias
  discount?: number;
  grandTotal?: number; // Alias to total
  totalAmount?: number; // Alias to total
  notes?: string;
  createdBy?: string;
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  shippingCost?: number;
  paymentStatus?: PurchasePaymentStatus;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  items?: PurchaseItem[];
  businessId?: string; // Optional legacy compatibility
}

export interface CreatePurchaseDTO {
  supplierId: string;
  purchaseDate?: string;
  invoiceNumber?: string;
  notes?: string;
  status?: PurchaseStatus;
  subtotal?: number;
  tax?: number;
  total?: number;
  discount?: number;
  items: PurchaseItemDTO[];
  businessId?: string; // Optional legacy compatibility
}

export interface UpdatePurchaseDTO {
  supplierId?: string;
  purchaseDate?: string;
  invoiceNumber?: string;
  notes?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  discount?: number;
  items?: PurchaseItemDTO[];
  businessId?: string; // Optional legacy compatibility
}

export interface InventoryImpactSummary {
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnit;
  stockBefore: number;
  quantityAdded: number;
  stockAfter: number;
  costBefore: number;
  newAverageCost: number;
  totalCost: number;
}

export type WastageReason =
  | 'Spoiled'
  | 'Expired'
  | 'Damaged'
  | 'Spillage'
  | 'Burnt'
  | 'Over-preparation'
  | 'Lost'
  | 'Other'
  | 'SPOILAGE'
  | 'PREPARATION_ERROR'
  | 'EQUIPMENT_FAILURE'
  | 'RETURN_FROM_CUSTOMER';

// wastage table (10 columns: id, ingredient_id, quantity, unit, reason, notes, cost_per_unit, total_loss, created_by, created_at)
export interface WastageRecord {
  id: string;
  ingredientId: string;
  ingredient_id?: string;
  quantity: number;
  unit: IngredientUnit;
  reason: WastageReason;
  notes?: string;
  costPerUnit: number;
  cost_per_unit?: number;
  unitCost?: number; // Alias to costPerUnit
  totalLoss: number;
  total_loss?: number;
  createdBy: string;
  created_by?: string;
  createdAt: string;

  // UI enrichment
  ingredientName?: string;
  reportedBy?: string; // Alias to createdBy
  status?: 'FINALIZED' | 'VOIDED';
  stockBefore?: number;
  stockAfter?: number;
  normalizedQuantity?: number;
  ingredientUnit?: IngredientUnit;
  reference?: string;
  ingredient?: Ingredient;
  businessId?: string; // Optional legacy compatibility
}

export type Wastage = WastageRecord;

export interface CreateWastageDTO {
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
  reason: WastageReason;
  notes?: string;
  reference?: string;
  actorName?: string;
  businessId?: string; // Optional legacy compatibility
}

export type StockAdjustmentType = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

export type StockAdjustmentReason =
  | 'Physical count correction'
  | 'Data-entry correction'
  | 'Initial correction'
  | 'Stock found'
  | 'Stock missing'
  | 'Measurement correction'
  | 'Other';

export interface StockAdjustmentRecord {
  id: string;
  ingredientId: string;
  ingredientName?: string;
  adjustmentType: StockAdjustmentType;
  quantity: number;
  unit: IngredientUnit;
  stockBefore: number;
  stockAfter: number;
  reason: StockAdjustmentReason;
  notes?: string;
  reportedBy: string;
  reference?: string;
  createdAt: string;
  costPerUnit: number;
  totalCostImpact: number;
  normalizedQuantity?: number;
  ingredientUnit?: IngredientUnit;
  isPhysicalCountMode?: boolean;
  physicalCount?: number;
  status: 'FINALIZED';
  ingredient?: Ingredient;
  businessId?: string; // Optional legacy compatibility
}

export interface CreateStockAdjustmentDTO {
  ingredientId: string;
  adjustmentType: StockAdjustmentType;
  quantity: number;
  unit: IngredientUnit;
  reason: StockAdjustmentReason;
  notes?: string;
  reference?: string;
  isPhysicalCountMode?: boolean;
  physicalCount?: number;
  actorName?: string;
  businessId?: string; // Optional legacy compatibility
}

export type InventoryTransactionType =
  | 'OPENING_STOCK'
  | 'PURCHASE'
  | 'PURCHASE_RECEIPT'
  | 'PURCHASE_REVERSAL'
  | 'ORDER_CONSUMPTION'
  | 'ORDER_RESTORE'
  | 'SALE_CONSUMPTION'
  | 'SALE_REVERSAL'
  | 'WASTAGE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'MANUAL_ADJUSTMENT'
  | 'STOCKTAKE_RECONCILE'
  | 'RETURN'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

// inventory_transactions table (13 columns: id, ingredient_id, transaction_type, quantity, unit, unit_cost, reference_id, reference_type, notes, created_at, stock_after, stock_before, created_by)
export interface InventoryTransaction {
  id: string;
  ingredientId: string;
  ingredient_id?: string;
  transactionType: InventoryTransactionType;
  transaction_type?: InventoryTransactionType;
  quantity: number;
  unit: IngredientUnit;
  unitCost: number;
  unit_cost?: number;
  referenceId?: string | null;
  reference_id?: string | null;
  referenceType?: string | null;
  reference_type?: string | null;
  notes?: string;
  stockBefore: number;
  stock_before?: number;
  stockAfter: number;
  stock_after?: number;
  createdBy: string;
  created_by?: string;
  performedBy?: string; // Alias to createdBy
  totalCost?: number;
  createdAt: string;
  created_at?: string;
  ingredient?: Ingredient;
  businessId?: string; // Optional legacy compatibility
}

export interface ConsumedIngredientDetail {
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  requiredUnit: IngredientUnit;
  wastePercentage: number;
  effectiveQuantity: number;
  normalizedQuantity: number;
  ingredientUnit: IngredientUnit;
  unitCost: number;
  lineCost: number;
  stockBefore: number;
  stockAfter: number;
  transactionId: string;
}

export interface OrderInventoryConsumptionItem {
  orderItemId?: string;
  menuItemId: string;
  menuItemName: string;
  quantitySold: number;
  recipeId: string;
  ingredients: ConsumedIngredientDetail[];
}

export interface MissingRecipeNotice {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  reason: string;
}

export interface OrderInventoryConsumption {
  id: string;
  orderId: string;
  status: 'CONSUMED' | 'REVERSED' | 'PARTIALLY_REVERSED' | 'NO_RECIPES' | 'FAILED';
  totalItemsConsumed: number;
  totalCost: number;
  consumedAt: string;
  reversedAt?: string | null;
  reversedBy?: string | null;
  reversalReason?: string | null;
  items: OrderInventoryConsumptionItem[];
  missingRecipes?: MissingRecipeNotice[];
  transactions: string[];
  metadata?: Record<string, any>;
  businessId?: string; // Optional legacy compatibility
}

export interface StockAvailabilityIssue {
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  availableStock: number;
  unit: IngredientUnit;
  shortage: number;
}

export interface ConsumptionOptions {
  actorName?: string;
  allowNegativeStock?: boolean;
  notes?: string;
  businessId?: string; // Optional legacy compatibility
}

export interface ReversalOptions {
  actorName?: string;
  reason?: string;
  notes?: string;
  businessId?: string; // Optional legacy compatibility
}

export interface PartialReversalItem {
  menuItemId: string;
  quantity: number;
}

// Opening stock DTO
export interface OpeningStockDTO {
  quantity: number;
  unit: IngredientUnit;
  unitCost: number;
  notes?: string;
}

export interface CreateIngredientDTO {
  name: string;
  categoryId?: string | null;
  unit: IngredientUnit;
  baseUnit?: IngredientUnit;
  minAlertLevel?: number;
  maxStockLevel?: number | null;
  costPerUnit?: number;
  itemCode?: string;
  description?: string;
  reorderQuantity?: number;
  yieldPercentage?: number;
  storageType?: IngredientStorageType;
  isActive?: boolean;
  openingStock?: OpeningStockDTO;
  businessId?: string; // Optional legacy compatibility
}

export interface UpdateIngredientDTO {
  name?: string;
  categoryId?: string | null;
  unit?: IngredientUnit;
  baseUnit?: IngredientUnit;
  minAlertLevel?: number;
  maxStockLevel?: number | null;
  costPerUnit?: number;
  itemCode?: string;
  description?: string;
  reorderQuantity?: number;
  yieldPercentage?: number;
  storageType?: IngredientStorageType;
  isActive?: boolean;
  businessId?: string; // Optional legacy compatibility
}
