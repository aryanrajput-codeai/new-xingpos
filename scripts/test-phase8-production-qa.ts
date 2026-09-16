// ====================================================================
// WEBRAJYA POS - PHASE 8: FULL PRODUCTION QA, SECURITY & STRESS TEST SUITE
// ====================================================================

// Polyfill localStorage & window for headless Node runtime
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

import { IngredientService } from '../src/lib/ingredientService';
import { RecipeService } from '../src/lib/recipeService';
import { PurchaseService } from '../src/lib/purchaseService';
import { SupplierService } from '../src/lib/supplierService';
import { InventoryConsumptionService } from '../src/lib/inventoryConsumptionService';
import { WastageService } from '../src/lib/wastageService';
import { StockAdjustmentService } from '../src/lib/stockAdjustmentService';
import { InventoryReportsService } from '../src/lib/inventoryReportsService';
import {
  convertQuantity,
  areUnitsCompatible,
  isSupportedUnit,
  SupportedUnit
} from '../src/lib/unitConversion';
import { calculateRecipeCost, calculateRecipeAvailability } from '../src/lib/recipeCosting';
import { RBACService } from '../src/lib/rbac';
import { LocalDB, Order } from '../src/lib/db';
import {
  Ingredient,
  Recipe,
  Purchase,
  WastageRecord,
  StockAdjustmentRecord
} from '../src/types/inventory';
import { StaffMember } from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    const msg = `  ✗ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`;
    console.error(msg);
    failureDetails.push(msg);
  }
}

async function runPhase8QA() {
  console.log('\n======================================================');
  console.log('WEBRAJYA POS - PHASE 8 FULL PRODUCTION QA & AUDIT SUITE');
  console.log('======================================================\n');

  mockStorage.clear();

  // Setup Business A and Business B IDs
  const B_A = 'biz_production_alpha';
  const B_B = 'biz_production_beta';

  const staffList = RBACService.getStaff();
  const ownerStaff = staffList.find(s => s.role === 'Owner') || staffList[0];
  const waiterStaff = staffList.find(s => s.role === 'Waiter') || {
    id: 'staff-waiter-01',
    name: 'Waiter Amit',
    role: 'Waiter',
    status: 'Active',
    pin: '1234'
  } as any;

  RBACService.setActiveStaff(ownerStaff);

  // Seed POS Menu Items
  LocalDB.saveMenuItems([
    {
      id: 'item-pbm-1',
      name: 'Paneer Butter Masala',
      price: 250,
      category: 'Main Course',
      description: 'Rich cottage cheese in tomato gravy',
      isVeg: true,
      available: true
    } as any,
    {
      id: 'item-tikka-2',
      name: 'Paneer Tikka',
      price: 200,
      category: 'Starters',
      description: 'Charcoal grilled cottage cheese cubes',
      isVeg: true,
      available: true
    } as any,
    {
      id: 'item-e2e-pbm',
      name: 'E2E Paneer Butter Masala',
      price: 250,
      category: 'Main Course',
      description: 'Benchmark dish for E2E testing',
      isVeg: true,
      available: true
    } as any
  ]);

  // ------------------------------------------------------------------
  // 1. UNIT CONVERSION QA & ERROR HANDLING
  // ------------------------------------------------------------------
  console.log('--- 1. UNIT CONVERSION QA ---');
  assert(convertQuantity(500, 'g', 'kg') === 0.5, '500 g converts to 0.5 kg');
  assert(convertQuantity(2.5, 'kg', 'g') === 2500, '2.5 kg converts to 2500 g');
  assert(convertQuantity(750, 'ml', 'l') === 0.75, '750 ml converts to 0.75 L');
  assert(convertQuantity(1.5, 'l', 'ml') === 1500, '1.5 L converts to 1500 ml');
  assert(convertQuantity(12, 'pcs', 'pcs') === 12, '12 pcs converts to 12 pcs');
  assert(areUnitsCompatible('kg', 'g') === true, 'kg and g are compatible');
  assert(areUnitsCompatible('kg', 'l') === false, 'kg and l are NOT compatible');

  let invalidUnitRejected = false;
  try {
    convertQuantity(10, 'kg', 'l' as any);
  } catch (e) {
    invalidUnitRejected = true;
  }
  assert(invalidUnitRejected, 'Incompatible conversion (kg -> l) is rejected with error');

  // ------------------------------------------------------------------
  // 2. MULTI-TENANT ISOLATION QA
  // ------------------------------------------------------------------
  console.log('\n--- 2. MULTI-TENANT ISOLATION QA ---');

  // Create Ingredient in Business A
  IngredientService.setCurrentBusinessId(B_A);
  const { ingredient: ingA } = await IngredientService.createIngredient(
    {
      businessId: B_A,
      name: 'Paneer Alpha',
      unit: 'kg',
      costPerUnit: 280,
      minAlertLevel: 2,
      maxStockLevel: 20,
      openingStock: {
        quantity: 10,
        unit: 'kg',
        unitCost: 280
      }
    },
    'Owner Admin'
  );

  // Create Ingredient in Business B
  IngredientService.setCurrentBusinessId(B_B);
  const { ingredient: ingB } = await IngredientService.createIngredient(
    {
      businessId: B_B,
      name: 'Paneer Beta',
      unit: 'kg',
      costPerUnit: 350,
      minAlertLevel: 1,
      maxStockLevel: 15,
      openingStock: {
        quantity: 5,
        unit: 'kg',
        unitCost: 350
      }
    },
    'Owner Admin'
  );

  IngredientService.setCurrentBusinessId(B_A);

  const listA = await IngredientService.getIngredients(B_A);
  const listB = await IngredientService.getIngredients(B_B);

  assert(listA.some((i) => i.id === ingA.id), 'Business A sees ingA');
  assert(!listA.some((i) => i.id === ingB.id), 'Business A CANNOT see ingB (Tenant Isolation)');
  assert(listB.some((i) => i.id === ingB.id), 'Business B sees ingB');
  assert(!listB.some((i) => i.id === ingA.id), 'Business B CANNOT see ingA (Tenant Isolation)');

  let crossTenantDenied = false;
  try {
    // Attempting to adjust Business B ingredient using Business A context
    await StockAdjustmentService.recordAdjustment(
      {
        ingredientId: ingB.id,
        adjustmentType: 'ADJUSTMENT_IN',
        quantity: 1,
        unit: 'kg',
        reason: 'Data-entry correction'
      },
      'Hacker',
      B_A
    );
  } catch (e) {
    crossTenantDenied = true;
  }
  assert(crossTenantDenied, 'Cross-tenant mutation rejected by backend boundary');

  // ------------------------------------------------------------------
  // 3. AUTHORIZATION & RBAC TESTING
  // ------------------------------------------------------------------
  console.log('\n--- 3. AUTHORIZATION & RBAC TESTING ---');

  RBACService.setActiveStaff(waiterStaff);
  let unauthorizedDenied = false;
  try {
    await IngredientService.createIngredient(
      {
        businessId: B_A,
        name: 'Forbidden Ingredient',
        unit: 'kg',
        costPerUnit: 100,
        minAlertLevel: 1
      },
      'Waiter Amit'
    );
  } catch (e) {
    unauthorizedDenied = true;
  }
  assert(unauthorizedDenied, 'Unauthorized staff role (Waiter) blocked from creating ingredients');

  let unauthorizedAdjustmentDenied = false;
  try {
    await StockAdjustmentService.recordAdjustment(
      {
        ingredientId: ingA.id,
        adjustmentType: 'ADJUSTMENT_IN',
        quantity: 2,
        unit: 'kg',
        reason: 'Data-entry correction'
      },
      'Waiter Amit',
      B_A
    );
  } catch (e) {
    unauthorizedAdjustmentDenied = true;
  }
  assert(unauthorizedAdjustmentDenied, 'Unauthorized staff role blocked from adjusting stock');

  // Restore Owner role
  RBACService.setActiveStaff(ownerStaff);

  // ------------------------------------------------------------------
  // 4. RECIPE & COSTING QA
  // ------------------------------------------------------------------
  console.log('\n--- 4. RECIPE & COSTING QA ---');

  const { ingredient: butterA } = await IngredientService.createIngredient(
    {
      businessId: B_A,
      name: 'Butter Alpha',
      unit: 'kg',
      costPerUnit: 500,
      minAlertLevel: 1,
      openingStock: {
        quantity: 5,
        unit: 'kg',
        unitCost: 500
      }
    },
    'Owner Admin'
  );

  const recipeA = await RecipeService.createRecipe(
    {
      menuItemId: 'item-pbm-1',
      recipeName: 'Paneer Butter Masala',
      portionSize: 1,
      items: [
        {
          ingredientId: ingA.id,
          quantity: 200,
          unit: 'g',
          wastePercentage: 0
        },
        {
          ingredientId: butterA.id,
          quantity: 20,
          unit: 'g',
          wastePercentage: 0
        }
      ]
    },
    'Owner Admin'
  );

  assert(recipeA.id !== undefined, 'Recipe created successfully');
  assert(recipeA.items.length === 2, 'Recipe contains 2 ingredients');

  const ingMapA = new Map([[ingA.id, ingA], [butterA.id, butterA]]);
  const costBreakdown = calculateRecipeCost(recipeA, ingMapA, { id: 'item-pbm-1', price: 250 } as any);

  // Expected:
  // Paneer: 200g @ ₹280/kg = 0.2 * 280 = ₹56.00
  // Butter: 20g @ ₹500/kg = 0.02 * 500 = ₹10.00
  // Total = ₹66.00
  assert(costBreakdown.totalIngredientCost === 66, `Recipe ingredient cost is exactly ₹66.00 (got ₹${costBreakdown.totalIngredientCost})`);
  assert(costBreakdown.grossMargin === 184, `Gross margin against ₹250 selling price is ₹184.00 (got ₹${costBreakdown.grossMargin})`);

  const availability = calculateRecipeAvailability(recipeA, ingMapA);
  // Paneer: 10kg / 0.2kg = 50 servings
  // Butter: 5kg / 0.02kg = 250 servings
  // Bottleneck: Paneer = 50 servings
  assert(availability.availableServings === 50, `Recipe availability is 50 servings (got ${availability.availableServings})`);
  assert(availability.limitingIngredientName === 'Paneer Alpha', `Limiting ingredient correctly identified as Paneer Alpha`);

  // ------------------------------------------------------------------
  // 5. PURCHASE MANAGEMENT & WEIGHTED AVERAGE COST QA
  // ------------------------------------------------------------------
  console.log('\n--- 5. PURCHASES & WEIGHTED AVERAGE COST QA ---');

  const supp1 = await SupplierService.createSupplier(
    {
      name: 'Alpha Dairy Farms',
      contactPerson: 'Mukesh Bhai',
      phone: '9876500001'
    },
    'Owner Admin',
    B_A
  );

  const { purchase: draftPO } = await PurchaseService.createPurchase(
    {
      supplierId: supp1.id,
      status: 'DRAFT',
      items: [
        {
          ingredientId: ingA.id,
          quantity: 5,
          unit: 'kg',
          unitCost: 300
        }
      ]
    },
    'Owner Admin',
    B_A
  );

  const ingAAfterDraft = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterDraft?.currentStock === 10, 'Draft purchase DID NOT alter ingredient stock');

  // Finalize Purchase Order
  // Start: 10 kg @ ₹280/kg
  // Purchase: 5 kg @ ₹300/kg
  // Expected Stock: 15 kg
  // Weighted Average Cost: (10 * 280 + 5 * 300) / 15 = (2800 + 1500) / 15 = 4300 / 15 = 286.6667 -> 286.67
  const { purchase: finalizedPO } = await PurchaseService.finalizePurchase(draftPO.id, 'Owner Admin', B_A);
  assert(finalizedPO.status === 'FINALIZED', 'Purchase finalized successfully');

  const ingAAfterFinalize = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterFinalize?.currentStock === 15, `Stock increased to 15 kg (got ${ingAAfterFinalize?.currentStock})`);
  assert(ingAAfterFinalize?.costPerUnit === 286.67, `Weighted average cost is ₹286.67/kg (got ${ingAAfterFinalize?.costPerUnit})`);

  // Idempotency test: duplicate finalize blocked by Idempotency Lock
  let dupFinalizeBlocked = false;
  try {
    await PurchaseService.finalizePurchase(draftPO.id, 'Owner Admin', B_A);
  } catch (e: any) {
    if (e.message && (e.message.includes('Idempotency Lock') || e.message.includes('already been finalized'))) {
      dupFinalizeBlocked = true;
    }
  }
  assert(dupFinalizeBlocked, 'Duplicate purchase finalize is strictly blocked by Idempotency Lock');
  const ingAAfterDup = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterDup?.currentStock === 15, 'Stock remains strictly 15 kg without double-increment');

  // ------------------------------------------------------------------
  // 6. POS AUTOMATIC CONSUMPTION QA
  // ------------------------------------------------------------------
  console.log('\n--- 6. POS AUTOMATIC CONSUMPTION QA ---');

  const posOrder1: Order = {
    id: 'ORD-TEST-001',
    customerName: 'Test Diner',
    phoneNumber: '9999999999',
    email: 'test@example.com',
    packagingCharge: 0,
    discountAmount: 0,
    orderType: 'dine-in',
    items: [
      {
        menuItemId: 'item-pbm-1',
        name: 'Paneer Butter Masala',
        price: 250,
        quantity: 5
      }
    ],
    subtotal: 1250,
    gst: 62.5,
    grandTotal: 1312.5,
    paymentStatus: 'Paid',
    orderStatus: 'Confirmed',
    createdAt: new Date().toISOString()
  };

  // Sell 5 units:
  // Paneer: 5 * 200g = 1000g = 1 kg
  // Butter: 5 * 20g = 100g = 0.1 kg
  const consumption1 = await InventoryConsumptionService.consumeOrderInventory(posOrder1, {
    businessId: B_A,
    actorName: 'POS Cashier'
  });

  assert(consumption1.status === 'CONSUMED', 'POS Order 1 consumed successfully');

  const ingAAfterSale = await IngredientService.getIngredientById(ingA.id, B_A);
  const butterAAfterSale = await IngredientService.getIngredientById(butterA.id, B_A);

  assert(ingAAfterSale?.currentStock === 14, `Paneer stock correctly deducted from 15 to 14 kg (got ${ingAAfterSale?.currentStock})`);
  assert(butterAAfterSale?.currentStock === 4.9, `Butter stock correctly deducted from 5 to 4.9 kg (got ${butterAAfterSale?.currentStock})`);

  // POS Consumption Idempotency Test
  const dupConsumption = await InventoryConsumptionService.consumeOrderInventory(posOrder1, {
    businessId: B_A,
    actorName: 'POS Cashier'
  });
  const ingAAfterDupSale = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterDupSale?.currentStock === 14, 'Duplicate POS consumption call is strictly idempotent (stock remains 14 kg)');

  // Missing Recipe Test
  const missingRecipeOrder: Order = {
    id: 'ORD-NO-RECIPE-002',
    customerName: 'Mystery Diner',
    phoneNumber: '9999999998',
    email: 'mystery@example.com',
    packagingCharge: 0,
    discountAmount: 0,
    orderType: 'dine-in',
    items: [
      {
        menuItemId: 'item-unconfigured-99',
        name: 'Chef Secret Special',
        price: 300,
        quantity: 2
      }
    ],
    subtotal: 600,
    gst: 30,
    grandTotal: 630,
    paymentStatus: 'Paid',
    orderStatus: 'Confirmed',
    createdAt: new Date().toISOString()
  };

  const missingRecResult = await InventoryConsumptionService.consumeOrderInventory(missingRecipeOrder, {
    businessId: B_A
  });
  assert(missingRecResult.status === 'NO_RECIPES', 'Unconfigured recipe handled gracefully with NO_RECIPES status');
  const ingAAfterMissingRec = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterMissingRec?.currentStock === 14, 'Missing recipe order did NOT deduct arbitrary inventory');

  // Shared Ingredient Multi-Item Test
  // Create second dish: Paneer Tikka (150g Paneer)
  const tikkaRecipe = await RecipeService.createRecipe(
    {
      menuItemId: 'item-tikka-2',
      recipeName: 'Paneer Tikka',
      portionSize: 1,
      items: [
        {
          ingredientId: ingA.id,
          quantity: 150,
          unit: 'g'
        }
      ]
    },
    'Owner Admin'
  );

  const sharedOrder: Order = {
    id: 'ORD-SHARED-003',
    customerName: 'Party Table',
    phoneNumber: '9999999997',
    email: 'party@example.com',
    packagingCharge: 0,
    discountAmount: 0,
    orderType: 'dine-in',
    items: [
      {
        menuItemId: 'item-pbm-1',
        name: 'Paneer Butter Masala',
        price: 250,
        quantity: 2 // 2 * 200g = 400g
      },
      {
        menuItemId: 'item-tikka-2',
        name: 'Paneer Tikka',
        price: 200,
        quantity: 4 // 4 * 150g = 600g
      }
    ],
    subtotal: 1300,
    gst: 65,
    grandTotal: 1365,
    paymentStatus: 'Paid',
    orderStatus: 'Confirmed',
    createdAt: new Date().toISOString()
  };

  // Total Paneer consumed: 400g + 600g = 1000g = 1 kg
  // Stock should drop from 14 kg to 13 kg
  await InventoryConsumptionService.consumeOrderInventory(sharedOrder, { businessId: B_A });
  const ingAAfterShared = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterShared?.currentStock === 13, `Shared ingredient consumption aggregated correctly (was 14, now 13 kg, got ${ingAAfterShared?.currentStock})`);

  // ------------------------------------------------------------------
  // 7. ORDER CANCELLATION & REVERSAL QA
  // ------------------------------------------------------------------
  console.log('\n--- 7. ORDER CANCELLATION & REVERSAL QA ---');

  // Cancel ORD-SHARED-003: Restore 1 kg Paneer, back to 14 kg
  const reversalResult = await InventoryConsumptionService.reverseOrderInventory(sharedOrder.id, {
    businessId: B_A,
    actorName: 'Manager Vikram',
    reason: 'Customer cancelled before food prep'
  });

  assert(reversalResult?.status === 'REVERSED', 'Order consumption successfully reversed');
  const ingAAfterReversal = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterReversal?.currentStock === 14, `Paneer stock restored to 14 kg (got ${ingAAfterReversal?.currentStock})`);

  // Repeated cancellation idempotency check
  const dupReversal = await InventoryConsumptionService.reverseOrderInventory(sharedOrder.id, {
    businessId: B_A,
    actorName: 'Manager Vikram'
  });
  const ingAAfterDupRev = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterDupRev?.currentStock === 14, 'Duplicate cancellation does NOT double-restore stock');

  // Verify original SALE_CONSUMPTION transactions still exist in ledger
  const transactionsA = await IngredientService.getTransactions(ingA.id, B_A);
  const origSaleTx = transactionsA.find((t) => t.referenceId === sharedOrder.id && t.transactionType === 'SALE_CONSUMPTION');
  const returnTx = transactionsA.find((t) => t.referenceId === sharedOrder.id && t.transactionType === 'RETURN');
  assert(origSaleTx !== undefined, 'Original SALE_CONSUMPTION transaction remains preserved in ledger');
  assert(returnTx !== undefined, 'Reversal RETURN transaction recorded in ledger');

  // ------------------------------------------------------------------
  // 8. WASTAGE MANAGEMENT QA
  // ------------------------------------------------------------------
  console.log('\n--- 8. WASTAGE MANAGEMENT QA ---');

  // Current Paneer stock: 14 kg
  // Record 500 g wastage
  const wastage1 = await WastageService.recordWastage(
    {
      ingredientId: ingA.id,
      quantity: 500,
      unit: 'g',
      reason: 'SPOILAGE',
      notes: 'Storage temperature fluctuation'
    },
    'Chef Sanjay',
    B_A
  );

  assert(wastage1.wastageRecord.normalizedQuantity === 0.5, '500g normalized to 0.5 kg');
  const ingAAfterWastage = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterWastage?.currentStock === 13.5, `Stock deducted by 0.5 kg to 13.5 kg (got ${ingAAfterWastage?.currentStock})`);

  // Wastage Negative Stock Prevention Test
  let negativeWastageRejected = false;
  try {
    await WastageService.recordWastage(
      {
        ingredientId: ingA.id,
        quantity: 20, // 20 kg exceeds available 13.5 kg
        unit: 'kg',
        reason: 'Expired'
      },
      'Chef Sanjay',
      B_A
    );
  } catch (e) {
    negativeWastageRejected = true;
  }
  assert(negativeWastageRejected, 'Wastage exceeding available stock is rejected atomically');
  const ingAAfterFailedWastage = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterFailedWastage?.currentStock === 13.5, 'Stock remains intact after rejected wastage');

  // ------------------------------------------------------------------
  // 9. STOCK ADJUSTMENTS & PHYSICAL COUNT QA
  // ------------------------------------------------------------------
  console.log('\n--- 9. STOCK ADJUSTMENT & PHYSICAL COUNT QA ---');

  // Current Paneer stock: 13.5 kg
  // Perform ADJUSTMENT_OUT: 500 g -> Stock becomes 13 kg
  const adj1 = await StockAdjustmentService.recordAdjustment(
    {
      ingredientId: ingA.id,
      adjustmentType: 'ADJUSTMENT_OUT',
      quantity: 500,
      unit: 'g',
      reason: 'Other',
      notes: 'Staff tasting'
    },
    'Manager Vikram',
    B_A
  );

  assert(adj1.adjustmentRecord.status === 'FINALIZED', 'Stock adjustment finalized');
  const ingAAfterAdj1 = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterAdj1?.currentStock === 13, `Stock reduced to 13 kg after ADJUSTMENT_OUT (got ${ingAAfterAdj1?.currentStock})`);

  // Physical Count Mode
  // System has 13 kg. Audit says physical count is 14 kg (+1 kg difference)
  const auditAdj = await StockAdjustmentService.recordAdjustment(
    {
      ingredientId: ingA.id,
      isPhysicalCountMode: true,
      physicalCount: 14,
      unit: 'kg',
      adjustmentType: 'ADJUSTMENT_IN',
      quantity: 1,
      reason: 'Physical count correction',
      notes: 'Physical audit variance'
    },
    'Audit Team',
    B_A
  );

  assert(auditAdj.adjustmentRecord.adjustmentType === 'ADJUSTMENT_IN', 'Physical count discrepancy identified as ADJUSTMENT_IN');
  const ingAAfterAudit = await IngredientService.getIngredientById(ingA.id, B_A);
  assert(ingAAfterAudit?.currentStock === 14, `Stock reconciled to exact physical count of 14 kg (got ${ingAAfterAudit?.currentStock})`);

  // Re-adjust out 1 kg back to 13 kg so we can execute Step 32 exactly
  await StockAdjustmentService.recordAdjustment(
    {
      ingredientId: ingA.id,
      adjustmentType: 'ADJUSTMENT_OUT',
      quantity: 1,
      unit: 'kg',
      reason: 'Data-entry correction'
    },
    'Audit Team',
    B_A
  );

  // ------------------------------------------------------------------
  // 10. COMPLEX END-TO-END SCENARIO (STEP 32 / STEP 69)
  // ------------------------------------------------------------------
  console.log('\n--- 10. COMPLEX END-TO-END SCENARIO (STEP 32 & 69) ---');
  // Fresh ingredient for clean verification
  const { ingredient: pE2E } = await IngredientService.createIngredient(
    {
      businessId: B_A,
      name: 'Paneer E2E Benchmark',
      unit: 'kg',
      costPerUnit: 280,
      minAlertLevel: 2,
      openingStock: {
        quantity: 10,
        unit: 'kg',
        unitCost: 280
      }
    },
    'System Benchmark'
  );

  // Step 1: Opening Stock = 10 kg @ ₹280/kg
  assert(pE2E.currentStock === 10, 'Step 1: Opening stock is 10 kg');
  assert(pE2E.costPerUnit === 280, 'Step 1: Opening cost is ₹280/kg');

  // Step 2: Recipe: Paneer Butter Masala = 200g
  const rE2E = await RecipeService.createRecipe(
    {
      menuItemId: 'item-e2e-pbm',
      recipeName: 'E2E Paneer Butter Masala',
      portionSize: 1,
      items: [{ ingredientId: pE2E.id, quantity: 200, unit: 'g' }]
    },
    'System Benchmark'
  );
  assert(rE2E.items.length === 1, 'Step 2: Recipe configured with 200 g Paneer');

  // Step 3: Purchase: +5 kg @ ₹300/kg
  const poE2E = await PurchaseService.createPurchase(
    {
      supplierId: supp1.id,
      status: 'FINALIZED',
      items: [{ ingredientId: pE2E.id, quantity: 5, unit: 'kg', unitCost: 300 }]
    },
    'System Benchmark',
    B_A
  );
  const pAfterPo = await IngredientService.getIngredientById(pE2E.id, B_A);
  assert(pAfterPo?.currentStock === 15, `Step 3: Stock is 15 kg (got ${pAfterPo?.currentStock})`);
  assert(pAfterPo?.costPerUnit === 286.67, `Step 3: WAC is ₹286.67/kg (got ${pAfterPo?.costPerUnit})`);

  // Step 4: POS Sale: 5 units (5 * 200g = 1 kg consumed)
  const posE2E: Order = {
    id: 'ORD-E2E-FINAL',
    customerName: 'E2E Diner',
    phoneNumber: '9999999991',
    email: 'e2e@example.com',
    packagingCharge: 0,
    discountAmount: 0,
    orderType: 'dine-in',
    items: [{ menuItemId: 'item-e2e-pbm', name: 'E2E Paneer Butter Masala', price: 250, quantity: 5 }],
    subtotal: 1250,
    gst: 62.5,
    grandTotal: 1312.5,
    paymentStatus: 'Paid',
    orderStatus: 'Confirmed',
    createdAt: new Date().toISOString()
  };
  await InventoryConsumptionService.consumeOrderInventory(posE2E, { businessId: B_A });
  const pAfterSale = await IngredientService.getIngredientById(pE2E.id, B_A);
  assert(pAfterSale?.currentStock === 14, `Step 4: Stock is 14 kg after POS sale (got ${pAfterSale?.currentStock})`);

  // Step 5: Wastage: 500 g (0.5 kg)
  await WastageService.recordWastage(
    { ingredientId: pE2E.id, quantity: 500, unit: 'g', reason: 'Over-preparation' },
    'System Benchmark',
    B_A
  );
  const pAfterWaste = await IngredientService.getIngredientById(pE2E.id, B_A);
  assert(pAfterWaste?.currentStock === 13.5, `Step 5: Stock is 13.5 kg after wastage (got ${pAfterWaste?.currentStock})`);

  // Step 6: Adjustment OUT: 500 g (0.5 kg)
  await StockAdjustmentService.recordAdjustment(
    { ingredientId: pE2E.id, adjustmentType: 'ADJUSTMENT_OUT', quantity: 500, unit: 'g', reason: 'Other' },
    'System Benchmark',
    B_A
  );
  const pAfterAdjOut = await IngredientService.getIngredientById(pE2E.id, B_A);
  assert(pAfterAdjOut?.currentStock === 13, `Step 6: Stock is 13 kg after adjustment OUT (got ${pAfterAdjOut?.currentStock})`);

  // Step 7: Cancel POS order: restores 1 kg
  await InventoryConsumptionService.reverseOrderInventory(posE2E.id, {
    businessId: B_A,
    reason: 'Customer cancelled'
  });
  const pFinal = await IngredientService.getIngredientById(pE2E.id, B_A);
  assert(pFinal?.currentStock === 14, `Step 7: Final stock is exactly 14 kg after order reversal (got ${pFinal?.currentStock})`);

  // Step 8: Mathematical Ledger Consistency Audit
  const audit = await IngredientService.verifyStockConsistency(pE2E.id, B_A);
  assert(audit.isConsistent === true, 'Step 8: Mathematical ledger audit IS CONSISTENT');
  assert(audit.drift === 0, `Step 8: Stock drift is exactly 0.0000 (got ${audit.drift})`);
  assert(audit.currentStock === 14, `Step 8: Ledger calculated stock matches stored current stock (14 kg)`);

  // Breakdown verification:
  // Opening: 10
  // Purchases: 5
  // Returns (Reversal): 1
  // Total In = 16
  // Sale Consumption: 1
  // Wastage: 0.5
  // Adjustments Out: 0.5
  // Total Out = 2
  // Calculated = 16 - 2 = 14 kg!
  assert(audit.breakdown.openingStock === 10, 'Audit breakdown: opening stock = 10');
  assert(audit.breakdown.purchases === 5, 'Audit breakdown: purchases = 5');
  assert(audit.breakdown.returns === 1, 'Audit breakdown: returns = 1');
  assert(audit.breakdown.saleConsumption === 1, 'Audit breakdown: sale consumption = 1');
  assert(audit.breakdown.wastage === 0.5, 'Audit breakdown: wastage = 0.5');
  assert(audit.breakdown.adjustmentsOut === 0.5, 'Audit breakdown: adjustments out = 0.5');

  // ------------------------------------------------------------------
  // 11. REPORTING ACCURACY QA
  // ------------------------------------------------------------------
  console.log('\n--- 11. REPORTING ACCURACY QA ---');

  const allIngredients = await IngredientService.getIngredients(B_A);
  const allTx = await IngredientService.getTransactions(undefined, B_A);
  const allWastage = await WastageService.getWastageRecords(B_A);
  const allPurchases = await PurchaseService.getPurchases(undefined, B_A);
  const allRecipes = await RecipeService.getRecipes(B_A);
  const allConsumptions = await InventoryConsumptionService.getConsumptionHistory(B_A);

  const overviewRows = InventoryReportsService.computeStockOverview(allIngredients, []);
  const totalStockValuation = overviewRows.reduce((sum, r) => sum + r.stockValue, 0);
  assert(overviewRows.length >= 3, `Stock overview covers all active ingredients (${overviewRows.length} items)`);
  assert(totalStockValuation > 0, `Total stock valuation calculated accurately (₹${totalStockValuation})`);

  const now = new Date();
  const dateRange = {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    preset: 'this_month' as const,
    label: 'This Month'
  };

  const movementReport = InventoryReportsService.computeMovementReport(allIngredients, allTx, [], dateRange);
  assert(movementReport.length >= 3, 'Stock movement report generates rows for ingredients');

  const pE2EMovement = movementReport.find((m) => m.ingredientId === pE2E.id);
  assert(pE2EMovement !== undefined, 'E2E Paneer present in movement report');
  assert(pE2EMovement?.closingStock === 14, `Movement report closing stock matches 14 kg (got ${pE2EMovement?.closingStock})`);

  const wastageReport = InventoryReportsService.computeWastageReport(allWastage, dateRange);
  assert(wastageReport.rows.length >= 2, 'Wastage report contains recorded wastage');
  assert(wastageReport.totalLoss > 0, `Wastage total loss accurately computed (₹${wastageReport.totalLoss})`);

  const purchaseReport = InventoryReportsService.computePurchaseReport(allPurchases, dateRange);
  assert(purchaseReport.rows.length >= 1, 'Purchase report summarizes purchases');
  assert(purchaseReport.totalSpend > 0, `Purchase report calculates total spend (₹${purchaseReport.totalSpend})`);

  const recipeMargins = InventoryReportsService.computeRecipeProfitability(
    allRecipes,
    [
      { id: 'item-pbm-1', name: 'Paneer Butter Masala', price: 250, category: 'Main Course' } as any,
      { id: 'item-e2e-pbm', name: 'E2E Paneer Butter Masala', price: 250, category: 'Main Course' } as any
    ],
    allIngredients
  );
  assert(recipeMargins.length >= 2, 'Recipe margins report computed');
  assert(recipeMargins[0].profitMargin > 50, 'Recipe gross margin percentage correctly computed');

  const fullAudit = await InventoryReportsService.computeStockIntegrity(allIngredients, B_A);
  assert(fullAudit.totalAudited === allIngredients.length, 'Integrity audit evaluated 100% of ingredients');
  assert(fullAudit.discrepancyCount === 0, `Discrepancy count is 0 across entire inventory (got ${fullAudit.discrepancyCount})`);
  assert(fullAudit.integrityPercentage === 100, 'Overall inventory integrity is 100%');

  // CSV Export formatting test
  const csvMovement = InventoryReportsService.exportMovementCSV(movementReport);
  assert(csvMovement.includes('"Ingredient Name","Category","Unit","Opening Stock"'), 'CSV movement header formatted correctly');
  assert(csvMovement.includes('Paneer E2E Benchmark'), 'CSV movement includes E2E Paneer row');

  // ------------------------------------------------------------------
  // 12. POS FINANCIAL DATA INTEGRITY (NON-INTERFERENCE RULE)
  // ------------------------------------------------------------------
  console.log('\n--- 12. POS FINANCIAL DATA INTEGRITY ---');
  // Verify that POS order prices, subtotals, GST, and grandTotals were not touched
  assert(posE2E.subtotal === 1250, 'POS order subtotal remains strictly ₹1250');
  assert(posE2E.gst === 62.5, 'POS order GST remains strictly ₹62.5');
  assert(posE2E.grandTotal === 1312.5, 'POS order grandTotal remains strictly ₹1312.5');
  assert(posE2E.paymentStatus === 'Paid', 'POS payment status remains intact');

  console.log('\n======================================================');
  console.log(`PHASE 8 QA COMPLETE: ${totalTests} Ran | ${passedTests} Passed | ${failedTests} Failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES SUMMARY:');
    failureDetails.forEach((f) => console.error(f));
    process.exit(1);
  }
}

runPhase8QA().catch((err) => {
  console.error('CRITICAL QA UNHANDLED EXCEPTION:', err);
  process.exit(1);
});
