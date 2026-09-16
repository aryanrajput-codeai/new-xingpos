// ====================================================================
// WEBRAJYA POS - PHASE 4: SUPPLIER & PURCHASE TEST SUITE
// ====================================================================

import { SupplierService } from '../src/lib/supplierService';
import { PurchaseService } from '../src/lib/purchaseService';
import { IngredientService } from '../src/lib/ingredientService';
import { RecipeService } from '../src/lib/recipeService';
import { calculateRecipeCost } from '../src/lib/recipeCosting';
import { RBACService } from '../src/lib/rbac';
import { LocalDB } from '../src/lib/db';
import { Ingredient, Recipe, MenuItem } from '../src/types';

// Mock localStorage & window for CLI Node runtime
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  }
};
(global as any).window = {
  dispatchEvent: () => true
};
(global as any).Event = class Event {
  constructor(public type: string) {}
};
(global as any).CustomEvent = class CustomEvent {
  constructor(public type: string, public detail: any) {}
};

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runTests() {
  console.log('======================================================');
  console.log('STARTING PHASE 4: SUPPLIERS & PURCHASES TEST SUITE');
  console.log('======================================================');

  const BUSINESS_A = '11111111-1111-1111-1111-111111111111';
  const BUSINESS_B = '22222222-2222-2222-2222-222222222222';

  // Log in as Manager (Owner/Manager has inventory.manage)
  const managerStaff = RBACService.getStaff().find((s) => s.role === 'Manager') || {
    id: 'mgr-001',
    name: 'Master Chef Operations',
    role: 'Manager' as const,
    pin: '1234',
    status: 'Active' as const,
    phone: '+91 99999 00000',
    email: 'manager@webrajya.in',
    joinedAt: new Date().toISOString()
  };
  RBACService.setActiveStaff(managerStaff as any);

  SupplierService.setCurrentBusinessId(BUSINESS_A);

  // ------------------------------------------------------------------
  // 1. SUPPLIER MANAGEMENT TESTS
  // ------------------------------------------------------------------
  console.log('\n1. SUPPLIER MANAGEMENT TESTS');

  // Validation: empty name
  try {
    await SupplierService.createSupplier({ name: '' }, 'Manager', BUSINESS_A);
    assert(false, 'Should reject empty supplier name');
  } catch (err: any) {
    assert(err.message.includes('Supplier name is required'), 'Reject empty supplier name');
  }

  // Validation: invalid GSTIN length
  try {
    await SupplierService.createSupplier(
      { name: 'Short GSTIN Mart', gstin: 'SHORT' },
      'Manager',
      BUSINESS_A
    );
    assert(false, 'Should reject invalid GSTIN length');
  } catch (err: any) {
    assert(err.message.includes('GSTIN must be exactly 15 characters'), 'Reject invalid GSTIN length');
  }

  // Valid Supplier Creation
  const supplierA = await SupplierService.createSupplier(
    {
      name: 'ABC Foods Co.',
      contactPerson: 'Arun Sharma',
      phone: '+91 98200 11223',
      email: 'arun@abcfoods.in',
      address: 'Plot 42, Vashi APMC, Navi Mumbai',
      gstin: '27ABCDE1234F1Z5',
      notes: 'Fresh dairy and groceries',
      paymentTerms: 'Net 15'
    },
    'Manager',
    BUSINESS_A
  );

  assert(supplierA.name === 'ABC Foods Co.', 'Successfully created supplier');
  assert(supplierA.businessId === BUSINESS_A, 'Supplier has correct businessId');
  assert(supplierA.isActive === true, 'Supplier defaults to active');

  // Duplicate name validation
  try {
    await SupplierService.createSupplier({ name: 'abc foods co.' }, 'Manager', BUSINESS_A);
    assert(false, 'Should reject duplicate supplier name');
  } catch (err: any) {
    assert(err.message.includes('already exists'), 'Reject duplicate supplier name in same business');
  }

  // Update Supplier
  const updatedSupplierA = await SupplierService.updateSupplier(
    supplierA.id,
    { contactPerson: 'Arun S. Sharma', paymentTerms: 'Net 30' },
    'Manager',
    BUSINESS_A
  );
  assert(updatedSupplierA.contactPerson === 'Arun S. Sharma', 'Supplier contact updated');
  assert(updatedSupplierA.paymentTerms === 'Net 30', 'Supplier payment terms updated');

  // Toggle active/inactive
  const deactivatedSupplier = await SupplierService.toggleSupplierActive(
    supplierA.id,
    'Manager',
    BUSINESS_A
  );
  assert(deactivatedSupplier.isActive === false, 'Supplier deactivated successfully');

  const reactivatedSupplier = await SupplierService.toggleSupplierActive(
    supplierA.id,
    'Manager',
    BUSINESS_A
  );
  assert(reactivatedSupplier.isActive === true, 'Supplier reactivated successfully');

  // ------------------------------------------------------------------
  // 2. SETUP INGREDIENTS FOR PURCHASING
  // ------------------------------------------------------------------
  console.log('\n2. SETUP INGREDIENTS FOR PURCHASING');

  // Create Paneer: 10 kg @ ₹280/kg
  const { ingredient: paneer } = await IngredientService.createIngredient(
    {
      businessId: BUSINESS_A,
      name: 'Fresh Malai Paneer',
      unit: 'kg',
      minAlertLevel: 2,
      costPerUnit: 280,
      openingStock: {
        quantity: 10,
        unit: 'kg',
        unitCost: 280
      }
    },
    'Manager'
  );

  assert(paneer.currentStock === 10, 'Paneer opening stock is 10 kg');
  assert(paneer.costPerUnit === 280, 'Paneer opening cost is ₹280/kg');

  // Create Butter: 2 kg @ ₹450/kg
  const { ingredient: butter } = await IngredientService.createIngredient(
    {
      businessId: BUSINESS_A,
      name: 'Amul Table Butter',
      unit: 'kg',
      minAlertLevel: 1,
      costPerUnit: 450,
      openingStock: {
        quantity: 2,
        unit: 'kg',
        unitCost: 450
      }
    },
    'Manager'
  );

  // ------------------------------------------------------------------
  // 3. PURCHASE DRAFT WORKFLOW & NON-IMPACT CHECK
  // ------------------------------------------------------------------
  console.log('\n3. PURCHASE DRAFT WORKFLOW & NON-IMPACT CHECK');

  const initialStockPaneer = paneer.currentStock;
  const initialTransactionsCount = (await IngredientService.getTransactions(undefined, BUSINESS_A)).length;

  const { purchase: draftPurchase } = await PurchaseService.createPurchase(
    {
      businessId: BUSINESS_A,
      supplierId: supplierA.id,
      invoiceNumber: 'INV-2026-001',
      notes: 'Weekly fresh dairy delivery',
      status: 'DRAFT',
      tax: 50,
      discount: 20,
      items: [
        {
          ingredientId: paneer.id,
          quantity: 5,
          unit: 'kg',
          unitCost: 300 // New purchase at ₹300/kg
        },
        {
          ingredientId: butter.id,
          quantity: 1000,
          unit: 'g', // Entered in grams: 1000g = 1kg
          unitCost: 0.5 // ₹0.5/g = ₹500/kg
        }
      ]
    },
    'Manager',
    BUSINESS_A
  );

  assert(draftPurchase.status === 'DRAFT', 'Purchase is saved as DRAFT');
  assert(draftPurchase.subtotal === 2000, `Draft subtotal is ₹2000 (5*300 + 1000*0.5), got: ${draftPurchase.subtotal}`);
  assert(draftPurchase.grandTotal === 2030, `Draft grand total is ₹2030 (2000 + 50 - 20), got: ${draftPurchase.grandTotal}`);

  // CRITICAL REQUIREMENT: Draft purchase MUST NOT change stock or ledger
  const reloadedPaneer = await IngredientService.getIngredientById(paneer.id, BUSINESS_A);
  assert(reloadedPaneer?.currentStock === initialStockPaneer, 'Draft purchase DID NOT increase stock');
  assert(reloadedPaneer?.costPerUnit === 280, 'Draft purchase DID NOT alter ingredient cost');

  const currentTransactions = await IngredientService.getTransactions(undefined, BUSINESS_A);
  assert(currentTransactions.length === initialTransactionsCount, 'Draft purchase DID NOT create ledger transaction');

  // Edit Draft Purchase
  const updatedDraft = await PurchaseService.updatePurchase(
    draftPurchase.id,
    {
      invoiceNumber: 'INV-2026-001-REV',
      tax: 60,
      discount: 0,
      items: [
        {
          ingredientId: paneer.id,
          quantity: 5,
          unit: 'kg',
          unitCost: 300 // 5 * 300 = 1500
        }
      ]
    },
    'Manager',
    BUSINESS_A
  );

  assert(updatedDraft.invoiceNumber === 'INV-2026-001-REV', 'Draft invoice number updated');
  assert(updatedDraft.subtotal === 1500, `Updated draft subtotal is ₹1500, got: ${updatedDraft.subtotal}`);
  assert(updatedDraft.grandTotal === 1560, `Updated draft grand total is ₹1560 (1500 + 60), got: ${updatedDraft.grandTotal}`);

  // ------------------------------------------------------------------
  // 4. PURCHASE VALIDATION TESTS
  // ------------------------------------------------------------------
  console.log('\n4. PURCHASE VALIDATION TESTS');

  // Empty items
  try {
    await PurchaseService.createPurchase(
      { supplierId: supplierA.id, items: [] },
      'Manager',
      BUSINESS_A
    );
    assert(false, 'Should reject empty items');
  } catch (err: any) {
    assert(err.message.includes('at least one ingredient'), 'Reject empty items');
  }

  // Non-positive quantity
  try {
    await PurchaseService.createPurchase(
      {
        supplierId: supplierA.id,
        items: [{ ingredientId: paneer.id, quantity: 0, unit: 'kg', unitCost: 300 }]
      },
      'Manager',
      BUSINESS_A
    );
    assert(false, 'Should reject zero quantity');
  } catch (err: any) {
    assert(err.message.includes('greater than 0'), 'Reject zero quantity');
  }

  // Negative rate
  try {
    await PurchaseService.createPurchase(
      {
        supplierId: supplierA.id,
        items: [{ ingredientId: paneer.id, quantity: 2, unit: 'kg', unitCost: -50 }]
      },
      'Manager',
      BUSINESS_A
    );
    assert(false, 'Should reject negative unit cost');
  } catch (err: any) {
    assert(err.message.includes('cannot be negative'), 'Reject negative unit cost');
  }

  // Incompatible unit (e.g. ml for weight ingredient)
  try {
    await PurchaseService.createPurchase(
      {
        supplierId: supplierA.id,
        items: [{ ingredientId: paneer.id, quantity: 500, unit: 'ml', unitCost: 1 }]
      },
      'Manager',
      BUSINESS_A
    );
    assert(false, 'Should reject incompatible unit dimension');
  } catch (err: any) {
    assert(err.message.includes('incompatible with ingredient base unit'), 'Reject volume unit for weight ingredient');
  }

  // ------------------------------------------------------------------
  // 5. ATOMIC FINALIZATION & WEIGHTED AVERAGE COST TEST
  // ------------------------------------------------------------------
  console.log('\n5. ATOMIC FINALIZATION & WEIGHTED AVERAGE COST TEST');

  // Spec Example:
  // Existing: 10 kg @ ₹280
  // Purchase: 5 kg @ ₹300
  // Total stock: 15 kg
  // Weighted Average Cost: ((10 * 280) + (5 * 300)) / 15 = (2800 + 1500) / 15 = 4300 / 15 = ₹286.67/kg
  const { purchase: finalizedPO, inventoryImpact } = await PurchaseService.finalizePurchase(
    updatedDraft.id,
    'Manager',
    BUSINESS_A
  );

  assert(finalizedPO.status === 'FINALIZED', 'Purchase marked as FINALIZED');
  assert(finalizedPO.finalizedBy === 'Manager', 'Purchase records finalizedBy actor');
  assert(Boolean(finalizedPO.finalizedAt), 'Purchase records finalizedAt timestamp');

  // Check Inventory Stock
  const finalizedPaneer = await IngredientService.getIngredientById(paneer.id, BUSINESS_A);
  assert(finalizedPaneer?.currentStock === 15, `Paneer stock increased to 15 kg (was 10, added 5). Actual: ${finalizedPaneer?.currentStock}`);

  // Check Weighted Average Cost
  assert(
    finalizedPaneer?.costPerUnit === 286.67,
    `Paneer weighted average cost is exactly ₹286.67/kg. Actual: ${finalizedPaneer?.costPerUnit}`
  );

  // Check Ledger Transaction
  const paneerTransactions = await IngredientService.getTransactions(paneer.id, BUSINESS_A);
  const purchaseTx = paneerTransactions.find((t) => t.referenceId === updatedDraft.id && t.transactionType === 'PURCHASE');
  assert(Boolean(purchaseTx), 'Immutable PURCHASE ledger transaction created');
  assert(purchaseTx?.quantity === 5, 'Transaction quantity is 5 kg');
  assert(purchaseTx?.stockBefore === 10, 'Transaction stockBefore is 10');
  assert(purchaseTx?.stockAfter === 15, 'Transaction stockAfter is 15');
  assert(purchaseTx?.totalCost === 1500, 'Transaction totalCost is ₹1500');

  // Check Inventory Impact Summary
  assert(inventoryImpact.length === 1, 'Inventory impact summary returned 1 affected item');
  assert(inventoryImpact[0].newAverageCost === 286.67, 'Inventory impact reflects new average cost');

  // ------------------------------------------------------------------
  // 6. IDEMPOTENCY VERIFICATION
  // ------------------------------------------------------------------
  console.log('\n6. IDEMPOTENCY VERIFICATION');

  try {
    await PurchaseService.finalizePurchase(updatedDraft.id, 'Manager', BUSINESS_A);
    assert(false, 'Should reject duplicate finalize call');
  } catch (err: any) {
    assert(err.message.includes('already been finalized'), 'Strictly prevent duplicate finalize call (idempotency lock)');
  }

  // Confirm stock was NOT increased a second time
  const paneerAfterDuplicate = await IngredientService.getIngredientById(paneer.id, BUSINESS_A);
  assert(paneerAfterDuplicate?.currentStock === 15, 'Stock did not increase twice on duplicate finalize');

  // ------------------------------------------------------------------
  // 7. MULTI-ITEM & UNIT CONVERSION FINALIZATION
  // ------------------------------------------------------------------
  console.log('\n7. MULTI-ITEM & UNIT CONVERSION FINALIZATION');

  // Purchase:
  // Tomato (create fresh): 500 g @ ₹0.04/g (₹40/kg)
  // Butter (existing 2 kg @ 450): 1 kg @ ₹500
  const { ingredient: tomato } = await IngredientService.createIngredient(
    {
      businessId: BUSINESS_A,
      name: 'Fresh Hybrid Tomatoes',
      unit: 'kg',
      minAlertLevel: 2,
      costPerUnit: 35,
      openingStock: {
        quantity: 5,
        unit: 'kg',
        unitCost: 35
      }
    },
    'Manager'
  );

  const { purchase: po2 } = await PurchaseService.createPurchase(
    {
      businessId: BUSINESS_A,
      supplierId: supplierA.id,
      invoiceNumber: 'INV-2026-002',
      status: 'FINALIZED', // Direct atomic finalize
      items: [
        {
          ingredientId: tomato.id,
          quantity: 5000, // 5000 g = 5 kg
          unit: 'g',
          unitCost: 0.045 // ₹0.045/g -> ₹45/kg, total ₹225
        },
        {
          ingredientId: butter.id,
          quantity: 2,
          unit: 'kg',
          unitCost: 480 // 2 kg @ ₹480 = ₹960
        }
      ]
    },
    'Manager',
    BUSINESS_A
  );

  assert(po2.status === 'FINALIZED', 'PO2 directly finalized');

  // Tomato: existing 5 kg @ 35 (=175), added 5 kg @ 45 (=225). Total stock: 10 kg. Avg cost: (175 + 225)/10 = ₹40.00
  const tomatoReloaded = await IngredientService.getIngredientById(tomato.id, BUSINESS_A);
  assert(tomatoReloaded?.currentStock === 10, `Tomato stock converted 5000g -> 5kg, total: 10kg. Actual: ${tomatoReloaded?.currentStock}`);
  assert(tomatoReloaded?.costPerUnit === 40, `Tomato avg cost is ₹40.00. Actual: ${tomatoReloaded?.costPerUnit}`);

  // Butter: existing 2 kg @ 450 (=900), added 2 kg @ 480 (=960). Total stock: 4 kg. Avg cost: (900 + 960)/4 = ₹465.00
  const butterReloaded = await IngredientService.getIngredientById(butter.id, BUSINESS_A);
  assert(butterReloaded?.currentStock === 4, `Butter stock is 4kg. Actual: ${butterReloaded?.currentStock}`);
  assert(butterReloaded?.costPerUnit === 465, `Butter avg cost is ₹465.00. Actual: ${butterReloaded?.costPerUnit}`);

  // ------------------------------------------------------------------
  // 8. DYNAMIC RECIPE COSTING REFLECTION
  // ------------------------------------------------------------------
  console.log('\n8. DYNAMIC RECIPE COSTING REFLECTION');

  // Mock Menu item and recipe using Paneer (200g) and Butter (20g)
  const mockMenuItem: any = {
    id: 'menu-pbm-1',
    name: 'Paneer Butter Masala',
    price: 250,
    category: 'Curries',
    available: true
  };

  const mockRecipe = {
    id: 'rec-pbm-1',
    businessId: BUSINESS_A,
    menuItemId: mockMenuItem.id,
    portionSize: 1,
    laborCost: 2,
    overheadCost: 2,
    items: [
      {
        recipeItemId: 'item-1',
        ingredientId: paneer.id,
        quantity: 200, // 200g
        unit: 'g',
        wastePercentage: 0
      },
      {
        recipeItemId: 'item-2',
        ingredientId: butter.id,
        quantity: 20, // 20g
        unit: 'g',
        wastePercentage: 0
      }
    ]
  };

  // Check recipe cost using the dynamically updated ingredients
  const allIngredients = await IngredientService.getIngredients(BUSINESS_A);
  const costBreakdown = calculateRecipeCost(mockRecipe as any, allIngredients, mockMenuItem);

  // Paneer cost: 0.2 kg * 286.67 = 57.33
  // Butter cost: 0.02 kg * 465 = 9.30
  // Ingredients total: 57.33 + 9.30 = 66.63
  // With Labor (2) and Overhead (2): 70.63
  assert(costBreakdown.items.length === 2, 'Recipe cost calculated with 2 ingredients');
  assert(costBreakdown.items[0].costPerBaseUnit === 286.67, `Recipe item Paneer base cost reflected as ₹286.67/kg`);
  assert(costBreakdown.items[1].costPerBaseUnit === 465, `Recipe item Butter base cost reflected as ₹465/kg`);
  assert(costBreakdown.totalRecipeCost === 70.63, `Total recipe cost dynamically reflects purchase weighted average cost: ₹70.63 (actual: ${costBreakdown.totalRecipeCost})`);

  // ------------------------------------------------------------------
  // 9. FINALIZED PURCHASE REVERSAL / CANCELLATION
  // ------------------------------------------------------------------
  console.log('\n9. FINALIZED PURCHASE REVERSAL / CANCELLATION');

  const stockBeforeCancel = (await IngredientService.getIngredientById(tomato.id, BUSINESS_A))?.currentStock || 0;
  const { purchase: cancelledPO, reversedCount } = await PurchaseService.cancelFinalizedPurchase(
    po2.id,
    'Supplier sent damaged goods',
    'Manager',
    BUSINESS_A
  );

  assert(cancelledPO.status === 'CANCELLED', 'PO status updated to CANCELLED');
  assert(reversedCount === 2, 'Two reversal transactions created');

  const tomatoAfterCancel = await IngredientService.getIngredientById(tomato.id, BUSINESS_A);
  assert(tomatoAfterCancel?.currentStock === stockBeforeCancel - 5, `Tomato stock safely reversed by 5kg (was ${stockBeforeCancel}, now ${tomatoAfterCancel?.currentStock})`);

  // Verify historical PURCHASE transaction was PRESERVED
  const allTx = await IngredientService.getTransactions(undefined, BUSINESS_A);
  const originalTx = allTx.find((t) => t.referenceId === po2.id && t.transactionType === 'PURCHASE');
  const revTx = allTx.find((t) => t.referenceId === po2.id && t.transactionType === 'PURCHASE_REVERSAL');
  assert(Boolean(originalTx), 'Original PURCHASE transaction preserved in ledger');
  assert(Boolean(revTx), 'Reversal transaction recorded with negative quantity');

  // ------------------------------------------------------------------
  // 10. MULTI-TENANT ISOLATION TESTS
  // ------------------------------------------------------------------
  console.log('\n10. MULTI-TENANT ISOLATION TESTS');

  // Create Supplier in Business B
  SupplierService.setCurrentBusinessId(BUSINESS_B);
  const supplierB = await SupplierService.createSupplier(
    { name: 'Business B Dairy Mart' },
    'Manager',
    BUSINESS_B
  );

  // Business A cannot access Business B supplier
  SupplierService.setCurrentBusinessId(BUSINESS_A);
  try {
    await SupplierService.getSupplierById(supplierB.id, BUSINESS_A);
    assert(false, 'Should deny cross-business supplier access');
  } catch (err: any) {
    assert(err.message.includes('Tenant Isolation Violation'), 'Cross-business supplier access strictly denied');
  }

  // Business A cannot attach Business B supplier to its purchase
  try {
    await PurchaseService.createPurchase(
      {
        businessId: BUSINESS_A,
        supplierId: supplierB.id,
        items: [{ ingredientId: paneer.id, quantity: 1, unit: 'kg', unitCost: 100 }]
      },
      'Manager',
      BUSINESS_A
    );
    assert(false, 'Should reject attaching Business B supplier to Business A purchase');
  } catch (err: any) {
    assert(err.message.includes('Tenant Isolation Violation'), 'Cross-business supplier attachment strictly rejected');
  }

  // ------------------------------------------------------------------
  // 11. RBAC AUTHORIZATION TESTS
  // ------------------------------------------------------------------
  console.log('\n11. RBAC AUTHORIZATION TESTS');

  // Switch to Waiter role (no inventory.manage permission)
  const waiterStaff = RBACService.getStaff().find((s) => s.role === 'Waiter') || {
    id: 'wtr-001',
    name: 'Floor Waiter',
    role: 'Waiter' as const,
    pin: '9999',
    status: 'Active' as const,
    phone: '+91 99999 11111',
    email: 'waiter@webrajya.in',
    joinedAt: new Date().toISOString()
  };
  RBACService.setActiveStaff(waiterStaff as any);

  try {
    await SupplierService.createSupplier({ name: 'Hacked Supplier' }, 'Waiter', BUSINESS_A);
    assert(false, 'Waiter should not create supplier');
  } catch (err: any) {
    assert(err.message.includes('Unauthorized'), 'Unauthorized staff (Waiter) blocked from creating supplier');
  }

  try {
    await PurchaseService.createPurchase(
      {
        supplierId: supplierA.id,
        items: [{ ingredientId: paneer.id, quantity: 1, unit: 'kg', unitCost: 100 }]
      },
      'Waiter',
      BUSINESS_A
    );
    assert(false, 'Waiter should not create purchase');
  } catch (err: any) {
    assert(err.message.includes('Unauthorized'), 'Unauthorized staff (Waiter) blocked from creating purchase');
  }

  // ------------------------------------------------------------------
  // 12. AUDIT LOGGING VERIFICATION
  // ------------------------------------------------------------------
  console.log('\n12. AUDIT LOGGING VERIFICATION');

  const auditLogs = LocalDB.getAuditLogs();
  const hasSupplierCreated = auditLogs.some((l) => l.action === 'Supplier Created');
  const hasPurchaseDraftCreated = auditLogs.some((l) => l.action === 'Purchase Draft Created');
  const hasPurchaseFinalized = auditLogs.some((l) => l.action === 'Purchase Finalized');
  const hasPurchaseCancelled = auditLogs.some((l) => l.action === 'Purchase Cancelled');

  assert(hasSupplierCreated, 'Audit log recorded for Supplier Created');
  assert(hasPurchaseDraftCreated, 'Audit log recorded for Purchase Draft Created');
  assert(hasPurchaseFinalized, 'Audit log recorded for Purchase Finalized');
  assert(hasPurchaseCancelled, 'Audit log recorded for Purchase Cancelled');

  console.log('======================================================');
  console.log(`TEST SUMMARY: ${passedCount + failedCount} Ran | ${passedCount} Passed | ${failedCount} Failed`);
  console.log('======================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
