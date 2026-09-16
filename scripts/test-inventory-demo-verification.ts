/**
 * WebRajya POS - Inventory Full Demo Data & Feature Verification Test Suite
 * 
 * Verifies the isolated Demo / QA Dataset for Idli Junction:
 * - 37 Ingredients across 10 Categories (Healthy, Low Stock, Critical, Out of Stock, Inactive)
 * - 20 Recipes with Costing, Margin Tiers, and Limiting Ingredient Calculations
 * - 5 Suppliers with GSTIN, terms, and contact info
 * - 12 Purchases (2 Drafts, 10 Finalized, WAC Recalculations)
 * - 6 POS Orders & Automatic Recipe Consumption
 * - Order Cancellation & Inventory Reversal
 * - 8 Wastage Records across all standard reasons
 * - Stock Adjustments & Physical Count Reconciliation (Shortage & Overage)
 * - Mathematical Zero-Drift Audit (0.0000 drift across all ingredients)
 * - Strict Multi-Tenant Isolation & Clean Purge Capability
 * - Date-Range Data Distribution (Today, Yesterday, Last 7 Days, This Month, Last Month)
 */

// Headless polyfill
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

const mockStorage = new LocalStorageMock();
(global as any).localStorage = mockStorage;
(global as any).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};
(global as any).CustomEvent = class {
  constructor(public type: string, public init?: any) {}
};
(global as any).Event = class {
  constructor(public type: string) {}
};

import {
  InventoryDemoService,
  DEMO_BUSINESS_ID,
  PRODUCTION_BUSINESS_ID
} from '../src/lib/inventoryDemoService';
import { IngredientService } from '../src/lib/ingredientService';
import { RecipeService } from '../src/lib/recipeService';
import { SupplierService } from '../src/lib/supplierService';
import { PurchaseService } from '../src/lib/purchaseService';
import { WastageService } from '../src/lib/wastageService';
import { StockAdjustmentService } from '../src/lib/stockAdjustmentService';
import { InventoryReportsService } from '../src/lib/inventoryReportsService';
import { LocalDB } from '../src/lib/db';
import { RBACService, ALL_PERMISSIONS } from '../src/lib/rbac';
import { calculateRecipeCost, calculateRecipeAvailability } from '../src/lib/recipeCosting';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runInventoryDemoVerification() {
  console.log('\n====================================================================');
  console.log(' WEBRAJYA POS — INVENTORY DEMO DATA & FULL FEATURE VERIFICATION');
  console.log(' Restaurant: Idli Junction (Trimurti Nagar, Nagpur)');
  console.log(' Target: Isolated QA & Demo Dataset Environment');
  console.log('====================================================================\n');

  // Setup Admin staff permissions
  const adminStaff = {
    id: 'staff-admin-01',
    name: 'General Manager',
    email: 'admin@idlijunction.in',
    role: 'Owner' as const,
    pin: '1234',
    isActive: true,
    permissions: ALL_PERMISSIONS,
    phone: '+919876543210',
    status: 'Active' as const,
    createdAt: new Date().toISOString()
  };
  RBACService.setActiveStaff(adminStaff);

  // ------------------------------------------------------------------
  // SECTION 1: SEED DEMO DATASET
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 1: DEMO DATASET SEEDING & ISOLATION ---');
  const seedResult = await InventoryDemoService.seedDemoData({ overwrite: true });
  assert(seedResult.success === true, 'Demo seeding executed successfully');
  assert(InventoryDemoService.isDemoMode() === true, 'Workspace switched to isolated Demo Tenant');

  const stats = await InventoryDemoService.getDemoStats();
  console.log(`  [Stats] Categories: ${stats.categoriesCount}, Ingredients: ${stats.ingredientsCount}, Recipes: ${stats.recipesCount}, Purchases: ${stats.purchasesCount}, Transactions: ${stats.transactionsCount}`);
  assert(stats.categoriesCount === 10, 'Created 10 distinct ingredient categories');
  assert(stats.ingredientsCount === 37, 'Created 37 realistic restaurant ingredients');
  assert(stats.recipesCount === 20, 'Created 20 authentic South Indian recipes');
  assert(stats.suppliersCount === 5, 'Created 5 regional Nagpur suppliers');
  assert(stats.purchasesCount === 12, 'Created 12 purchase orders (2 drafts, 10 finalized)');

  // ------------------------------------------------------------------
  // SECTION 2: STOCK STATUS BREAKDOWN
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 2: 4-TIER STOCK STATUS VERIFICATION ---');
  const demoIngredients = await IngredientService.getIngredients(DEMO_BUSINESS_ID);

  const healthyItem = demoIngredients.find((i) => i.name.includes('Sona Masoori Rice'));
  assert(!!healthyItem && healthyItem.currentStock > healthyItem.minAlertLevel, `Healthy stock item verified: ${healthyItem?.name} (${healthyItem?.currentStock} kg vs min ${healthyItem?.minAlertLevel} kg)`);

  const lowStockItem = demoIngredients.find((i) => i.name.includes('Small Mustard Seeds'));
  assert(!!lowStockItem && lowStockItem.currentStock <= lowStockItem.minAlertLevel && lowStockItem.currentStock > 0, `Low stock item verified: ${lowStockItem?.name} (${lowStockItem?.currentStock} kg <= min ${lowStockItem?.minAlertLevel} kg)`);

  const criticalItem = demoIngredients.find((i) => i.name.includes('Coconut Oil'));
  assert(!!criticalItem && criticalItem.currentStock > 0 && criticalItem.currentStock <= criticalItem.minAlertLevel * 0.5, `Critical stock item verified: ${criticalItem?.name} (${criticalItem?.currentStock} ${criticalItem?.unit})`);

  const outOfStockItem = demoIngredients.find((i) => i.name.includes('Mozzarella Cheese'));
  assert(!!outOfStockItem && outOfStockItem.currentStock === 0, `Out of stock item verified: ${outOfStockItem?.name} (${outOfStockItem?.currentStock} kg)`);

  const inactiveItem = demoIngredients.find((i) => i.name.includes('Seasonal Winter Spice Mix'));
  assert(!!inactiveItem && inactiveItem.isActive === false, `Inactive item verified: ${inactiveItem?.name} (isActive = false)`);

  // ------------------------------------------------------------------
  // SECTION 3: UNIT DIVERSITY
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 3: UNIT DIVERSITY (kg, g, l, ml, pcs) ---');
  const unitSet = new Set(demoIngredients.map((i) => i.unit));
  assert(unitSet.has('kg'), 'Unit kg verified in catalog');
  assert(unitSet.has('l'), 'Unit l verified in catalog');
  assert(unitSet.has('pcs'), 'Unit pcs verified in catalog');

  // ------------------------------------------------------------------
  // SECTION 4: WEIGHTED AVERAGE COST (WAC) RECALCULATION
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 4: WEIGHTED AVERAGE COST (WAC) CALCULATION ---');
  // Paneer test case: Opening was 10 kg @ 280 (2800). Purchase was 5 kg @ 300 (1500).
  // Total cost = 4300 / 15 = 286.6667 => 286.67
  const updatedIngredients = await IngredientService.getIngredients(DEMO_BUSINESS_ID);
  const paneer = updatedIngredients.find((i) => i.name.includes('Malai Paneer'))!;
  assert(
    Math.abs(paneer.costPerUnit - 286.67) < 0.1,
    `WAC recalculated properly: Expected ~₹286.67/kg, Got ₹${paneer.costPerUnit}/kg`
  );

  // ------------------------------------------------------------------
  // SECTION 5: DRAFT VS FINALIZED PURCHASES
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 5: PURCHASE DRAFT VS FINALIZED BEHAVIOR ---');
  const purchases = await PurchaseService.getPurchases(undefined, DEMO_BUSINESS_ID);
  const draftPos = purchases.filter((p) => p.status === 'DRAFT');
  const finalizedPos = purchases.filter((p) => p.status === 'RECEIVED' || p.status === 'FINALIZED');
  assert(draftPos.length === 2, `2 Draft purchase orders verified (Got ${draftPos.length})`);
  assert(finalizedPos.length === 10, `10 Finalized purchase orders verified (Got ${finalizedPos.length})`);

  // Verify Drafts did NOT create transactions
  const transactions = await IngredientService.getTransactions(undefined, DEMO_BUSINESS_ID);
  for (const d of draftPos) {
    const matchingTx = transactions.find((t) => t.referenceId === d.id);
    assert(!matchingTx, `Draft PO ${d.invoiceNumber} has 0 ledger transactions as required`);
  }

  // ------------------------------------------------------------------
  // SECTION 6: RECIPES, PROFITABILITY & LIMITING INGREDIENTS
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 6: RECIPES, MARGIN TIERS & LIMITING INGREDIENTS ---');
  const recipes = await RecipeService.getRecipes(DEMO_BUSINESS_ID);
  const menuItems = LocalDB.getMenuItems();

  const filterCoffeeRecipe = recipes.find((r) => r.menuItemId === 'i11')!;
  const filterCoffeeItem = menuItems.find((m) => m.id === 'i11')!;
  const coffeeCostBreakdown = calculateRecipeCost(filterCoffeeRecipe, updatedIngredients, filterCoffeeItem);
  assert(coffeeCostBreakdown.totalRecipeCost > 0, `Filter coffee recipe cost calculated: ₹${coffeeCostBreakdown.totalRecipeCost.toFixed(2)}`);
  assert(coffeeCostBreakdown.grossMargin! > 0, `Filter coffee gross margin: ₹${coffeeCostBreakdown.grossMargin!.toFixed(2)} (${coffeeCostBreakdown.grossMarginPercentage}%)`);

  // Limiting ingredient check for Cheese Dosa (Cheese is 0kg stock)
  const cheeseDosaRecipe = recipes.find((r) => r.menuItemId === 'i6')!;
  const cheeseAvailability = calculateRecipeAvailability(cheeseDosaRecipe, updatedIngredients);
  assert(cheeseAvailability.isAvailable === false, 'Cheese Dosa correctly marked unavailable because Mozzarella Cheese is out of stock');
  assert(cheeseAvailability.availableServings === 0, 'Cheese Dosa available servings is 0');
  assert(cheeseAvailability.limitingIngredientName?.includes('Mozzarella Cheese') === true, `Limiting ingredient correctly identified: ${cheeseAvailability.limitingIngredientName}`);

  // ------------------------------------------------------------------
  // SECTION 7: POS CONSUMPTION & ORDER REVERSAL
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 7: POS CONSUMPTION & CANCELLATION REVERSAL ---');
  const consumptionTxs = transactions.filter((t) => t.transactionType === 'SALE_CONSUMPTION');
  assert(consumptionTxs.length > 0, `Verified ${consumptionTxs.length} SALE_CONSUMPTION ledger transactions`);

  const returnTxs = transactions.filter((t) => t.transactionType === 'RETURN');
  assert(returnTxs.length > 0, `Verified order cancellation created ${returnTxs.length} RETURN ledger transactions`);

  // ------------------------------------------------------------------
  // SECTION 8: WASTAGE AUDIT
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 8: WASTAGE RECORDS & REASON COVERAGE ---');
  const wastageRecords = await WastageService.getWastageRecords(DEMO_BUSINESS_ID);
  assert(wastageRecords.length === 8, `8 Wastage records verified across various dates (Got ${wastageRecords.length})`);
  const reasons = new Set(wastageRecords.map((w) => w.reason));
  assert(reasons.has('Spoiled'), 'Wastage reason "Spoiled" verified');
  assert(reasons.has('Expired'), 'Wastage reason "Expired" verified');
  assert(reasons.has('Damaged'), 'Wastage reason "Damaged" verified');
  assert(reasons.has('Spillage'), 'Wastage reason "Spillage" verified');
  assert(reasons.has('Burnt'), 'Wastage reason "Burnt" verified');
  assert(reasons.has('Over-preparation'), 'Wastage reason "Over-preparation" verified');

  // ------------------------------------------------------------------
  // SECTION 9: STOCK ADJUSTMENTS & PHYSICAL COUNT RECONCILIATION
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 9: PHYSICAL COUNT RECONCILIATION (VARIANCE) ---');
  const adjustments = await StockAdjustmentService.getAdjustments(DEMO_BUSINESS_ID);
  assert(adjustments.length >= 4, `At least 4 stock adjustments verified (Got ${adjustments.length})`);

  const adjIn = adjustments.find((a) => a.adjustmentType === 'ADJUSTMENT_IN');
  const adjOut = adjustments.find((a) => a.adjustmentType === 'ADJUSTMENT_OUT');
  assert(!!adjIn, 'Adjustment IN verified (+2.0kg found stock)');
  assert(!!adjOut, 'Adjustment OUT verified (chef testing)');

  const physicalCountAudits = adjustments.filter((a) => a.isPhysicalCountMode);
  assert(physicalCountAudits.length >= 2, `Verified ${physicalCountAudits.length} physical stocktake reconciliations`);
  const shortageAudit = physicalCountAudits.find((a) => a.adjustmentType === 'ADJUSTMENT_OUT');
  const overageAudit = physicalCountAudits.find((a) => a.adjustmentType === 'ADJUSTMENT_IN');
  assert(!!shortageAudit, 'Shortage variance scenario verified (-1.5kg Potato)');
  assert(!!overageAudit, 'Overage variance scenario verified (+1.2L Milk)');

  // ------------------------------------------------------------------
  // SECTION 10: ZERO-DRIFT MATHEMATICAL AUDIT
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 10: ZERO-DRIFT MATHEMATICAL AUDIT ---');
  const latestDemoIngredients = await IngredientService.getIngredients(DEMO_BUSINESS_ID);
  const audit = await InventoryReportsService.computeStockIntegrity(latestDemoIngredients, DEMO_BUSINESS_ID);
  console.log(`  [Audit] Tested Ingredients: ${audit.totalAudited}`);
  console.log(`  [Audit] Discrepancies: ${audit.discrepancyCount}`);
  console.log(`  [Audit] Overall Mathematical Integrity: ${audit.integrityPercentage}%`);
  if (audit.discrepancyCount > 0) {
    for (const row of audit.rows.filter((r) => !r.isConsistent)) {
      console.log(`  [Discrepancy Details] ${row.ingredientName}: Current=${row.currentStock}, Calc=${row.calculatedStock}, Drift=${row.drift}`);
      console.log('    Breakdown:', JSON.stringify(row.breakdown));
    }
  }
  assert(audit.discrepancyCount === 0, 'Mathematical drift is strictly 0.0000 across all demo ingredients');
  assert(audit.integrityPercentage === 100, 'Overall integrity is 100.0%');

  // ------------------------------------------------------------------
  // SECTION 11: DATE RANGE VERIFICATION
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 11: DATE-RANGE FILTER SPREAD ---');
  // Check that records span multiple calendar days
  const allTransactions = await IngredientService.getTransactions(undefined, DEMO_BUSINESS_ID);
  const txDates = allTransactions
    .map((t) => new Date(t.createdAt).getTime())
    .filter((time) => !Number.isNaN(time));
  const minDate = Math.min(...txDates);
  const maxDate = Math.max(...txDates);
  const dateSpanDays = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24));
  console.log(`  [Date Spread] Transactions span ${dateSpanDays} days (from ${new Date(minDate).toLocaleDateString()} to ${new Date(maxDate).toLocaleDateString()})`);
  assert(dateSpanDays >= 25, 'Demo transactions realistically spread across at least 25 days');

  // ------------------------------------------------------------------
  // SECTION 12: MULTI-TENANT ISOLATION & CLEAN PURGE
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 12: MULTI-TENANT ISOLATION & PURGE SAFETY ---');
  // 1. Check production tenant has 0 demo items
  const prodIngredients = await IngredientService.getIngredients(PRODUCTION_BUSINESS_ID);
  assert(prodIngredients.length === 0, 'Production business has 0 demo ingredients (Tenant isolated)');

  // 2. Test clearDemoData
  const clearResult = await InventoryDemoService.clearDemoData(false);
  assert(clearResult.success === true, `Demo data cleared successfully. Removed ${clearResult.removedCount} demo items`);

  const demoIngredientsAfter = await IngredientService.getIngredients(DEMO_BUSINESS_ID);
  assert(demoIngredientsAfter.length === 0, 'Demo business is completely empty after purge');

  // 3. Re-seed so demo data remains ready for manual browser UI testing!
  console.log('\n--- FINALIZING: RE-SEEDING READY FOR MANUAL INSPECTION ---');
  const finalSeed = await InventoryDemoService.seedDemoData({ overwrite: true });
  assert(finalSeed.success === true, 'Re-seeded demo environment ready for immediate manual browser testing');

  console.log('\n====================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runInventoryDemoVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
