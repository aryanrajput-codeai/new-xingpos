// ====================================================================
// WEBRAJYA POS - INGREDIENT MANAGEMENT & OPENING STOCK TEST SUITE
// ====================================================================

// Set up in-memory localStorage polyfill for Node / tsx environment
const storage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => storage[key] || null,
  setItem: (key: string, val: string) => { storage[key] = String(val); },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); }
};
(global as any).window = {
  dispatchEvent: () => true
};
(global as any).Event = class Event {
  constructor(public type: string) {}
};

import {
  convertQuantity,
  getBaseUnit,
  getUnitDimension,
  areUnitsCompatible,
  normalizeCostToBaseUnit,
  normalizeToBaseQuantity,
  isSupportedUnit,
  SupportedUnit
} from '../src/lib/unitConversion';
import { IngredientService } from '../src/lib/ingredientService';
import { RBACService } from '../src/lib/rbac';
import { StaffMember } from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('STARTING PHASE 2: INGREDIENT MANAGEMENT TEST SUITE');
  console.log('======================================================\n');

  // ------------------------------------------------------------------
  // 1. UNIT CONVERSION & NORMALIZATION ENGINE TESTS
  // ------------------------------------------------------------------
  console.log('1. UNIT CONVERSION & NORMALIZATION CHECKS');

  assert(isSupportedUnit('kg') === true, 'kg is supported unit');
  assert(isSupportedUnit('g') === true, 'g is supported unit');
  assert(isSupportedUnit('l') === true, 'l is supported unit');
  assert(isSupportedUnit('ml') === true, 'ml is supported unit');
  assert(isSupportedUnit('pcs') === true, 'pcs is supported unit');
  assert(isSupportedUnit('ton') === false, 'ton is NOT a supported unit');

  assert(getBaseUnit('g') === 'kg', 'Base unit of g is kg');
  assert(getBaseUnit('kg') === 'kg', 'Base unit of kg is kg');
  assert(getBaseUnit('ml') === 'l', 'Base unit of ml is l');
  assert(getBaseUnit('l') === 'l', 'Base unit of l is l');
  assert(getBaseUnit('pcs') === 'pcs', 'Base unit of pcs is pcs');

  assert(getUnitDimension('g') === 'weight', 'g is weight dimension');
  assert(getUnitDimension('ml') === 'volume', 'ml is volume dimension');
  assert(getUnitDimension('pcs') === 'count', 'pcs is count dimension');

  assert(areUnitsCompatible('g', 'kg') === true, 'g and kg are compatible');
  assert(areUnitsCompatible('ml', 'l') === true, 'ml and l are compatible');
  assert(areUnitsCompatible('g', 'ml') === false, 'g and ml are incompatible');

  // Conversion accuracy
  const convertedGtoKg = convertQuantity(500, 'g', 'kg');
  assert(convertedGtoKg === 0.5, '500 g converts to exactly 0.5 kg', `Got ${convertedGtoKg}`);

  const convertedKgToG = convertQuantity(2.5, 'kg', 'g');
  assert(convertedKgToG === 2500, '2.5 kg converts to 2500 g', `Got ${convertedKgToG}`);

  const convertedMlToL = convertQuantity(750, 'ml', 'l');
  assert(convertedMlToL === 0.75, '750 ml converts to 0.75 l', `Got ${convertedMlToL}`);

  // Incompatible dimensions throw
  let threwIncompatible = false;
  try {
    convertQuantity(10, 'kg', 'l');
  } catch (e) {
    threwIncompatible = true;
  }
  assert(threwIncompatible === true, 'Converting weight (kg) to volume (l) throws error');

  // Cost normalization
  // ₹0.28 per gram -> ₹280 per kg
  const normCost = normalizeCostToBaseUnit(0.28, 'g');
  assert(normCost.costPerBaseUnit === 280 && normCost.baseUnit === 'kg', '₹0.28/g normalizes to ₹280/kg', `Got ₹${normCost.costPerBaseUnit}`);

  // ------------------------------------------------------------------
  // 2. AUTHORIZATION & RBAC TESTS
  // ------------------------------------------------------------------
  console.log('\n2. AUTHORIZATION & RBAC TESTS');

  // Set active staff to Waiter (who does not have inventory.manage)
  const waiterStaff = RBACService.getStaff().find(s => s.role === 'Waiter')!;
  RBACService.setActiveStaff(waiterStaff);

  let waiterCreateBlocked = false;
  try {
    await IngredientService.createIngredient({
      name: 'Unauthorized Butter',
      unit: 'kg',
      minAlertLevel: 2,
      costPerUnit: 500
    });
  } catch (e: any) {
    if (e.message.includes('Unauthorized') || e.message.includes('inventory.manage')) {
      waiterCreateBlocked = true;
    }
  }
  assert(waiterCreateBlocked === true, 'Unauthorized user (Waiter) cannot create ingredients');

  // Switch active staff to Manager (who has inventory.view and inventory.manage)
  const managerStaff = RBACService.getStaff().find(s => s.role === 'Manager')!;
  RBACService.setActiveStaff(managerStaff);

  // ------------------------------------------------------------------
  // 3. INGREDIENT CREATION & VALIDATION TESTS
  // ------------------------------------------------------------------
  console.log('\n3. INGREDIENT CREATION & VALIDATION TESTS');

  const businessA = '00000000-0000-0000-0000-000000000001';
  IngredientService.setCurrentBusinessId(businessA);

  // Blank name rejection
  let blankNameRejected = false;
  try {
    await IngredientService.createIngredient({
      name: '   ',
      unit: 'kg',
      minAlertLevel: 5,
      costPerUnit: 100
    });
  } catch (e: any) {
    blankNameRejected = true;
  }
  assert(blankNameRejected === true, 'Blank ingredient name is rejected');

  // Negative min stock rejection
  let negMinStockRejected = false;
  try {
    await IngredientService.createIngredient({
      name: 'Salt',
      unit: 'kg',
      minAlertLevel: -2,
      costPerUnit: 20
    });
  } catch (e: any) {
    negMinStockRejected = true;
  }
  assert(negMinStockRejected === true, 'Negative min alert level is rejected');

  // Max stock < Min alert level rejection
  let maxLessThanMinRejected = false;
  try {
    await IngredientService.createIngredient({
      name: 'Sugar',
      unit: 'kg',
      minAlertLevel: 10,
      maxStockLevel: 5,
      costPerUnit: 40
    });
  } catch (e: any) {
    maxLessThanMinRejected = true;
  }
  assert(maxLessThanMinRejected === true, 'Max stock level less than min alert level is rejected');

  // Negative cost rejection
  let negCostRejected = false;
  try {
    await IngredientService.createIngredient({
      name: 'Turmeric',
      unit: 'kg',
      minAlertLevel: 2,
      costPerUnit: -10
    });
  } catch (e: any) {
    negCostRejected = true;
  }
  assert(negCostRejected === true, 'Negative unit cost is rejected');

  // Invalid unit rejection
  let invalidUnitRejected = false;
  try {
    await IngredientService.createIngredient({
      name: 'Black Pepper',
      unit: 'pounds' as any,
      minAlertLevel: 2,
      costPerUnit: 100
    });
  } catch (e: any) {
    invalidUnitRejected = true;
  }
  assert(invalidUnitRejected === true, 'Unsupported unit is rejected');

  // Successful Ingredient Creation (e.g. Basmati Rice)
  const createdRice = await IngredientService.createIngredient({
    name: 'Basmati Rice',
    itemCode: 'RIC-01',
    description: 'Premium long grain basmati rice for biryani',
    unit: 'kg',
    minAlertLevel: 15,
    maxStockLevel: 100,
    costPerUnit: 95,
    storageType: 'DRY'
  });
  assert(createdRice.ingredient.name === 'Basmati Rice', 'Successfully created Basmati Rice');
  assert(createdRice.ingredient.currentStock === 0, 'New ingredient initial stock defaults to 0');
  assert(createdRice.ingredient.costPerUnit === 95, 'Ingredient costPerUnit recorded as 95');

  // Duplicate ingredient name rejection within same business
  let duplicateRejected = false;
  try {
    await IngredientService.createIngredient({
      name: 'basmati rice', // case-insensitive duplicate check
      unit: 'kg',
      minAlertLevel: 10,
      costPerUnit: 90
    });
  } catch (e: any) {
    if (e.message.includes('already exists')) {
      duplicateRejected = true;
    }
  }
  assert(duplicateRejected === true, 'Duplicate ingredient name in same business is strictly rejected');

  // ------------------------------------------------------------------
  // 4. INGREDIENT EDITING & STOCK STATUS TESTS
  // ------------------------------------------------------------------
  console.log('\n4. INGREDIENT EDITING & STOCK STATUS TESTS');

  const updatedRice = await IngredientService.updateIngredient(createdRice.ingredient.id, {
    description: 'Updated long grain aromatic rice',
    minAlertLevel: 20,
    costPerUnit: 98
  });
  assert(updatedRice.minAlertLevel === 20, 'Updated minAlertLevel to 20');
  assert(updatedRice.costPerUnit === 98, 'Updated costPerUnit to 98');
  assert(updatedRice.currentStock === 0, 'Stock remains unchanged by standard edit (prevented silent modification)');

  // Initial stock status should be OUT_OF_STOCK (since currentStock = 0)
  const riceStatus = IngredientService.calculateStockStatus(updatedRice);
  assert(riceStatus === 'OUT_OF_STOCK', '0 stock calculated as OUT_OF_STOCK');

  // Toggle active
  const deactivatedRice = await IngredientService.toggleIngredientActive(updatedRice.id);
  assert(deactivatedRice.isActive === false, 'Ingredient successfully deactivated');
  const inactiveStatus = IngredientService.calculateStockStatus(deactivatedRice);
  assert(inactiveStatus === 'INACTIVE', 'Deactivated ingredient status is INACTIVE');

  // Reactivate
  const reactivatedRice = await IngredientService.toggleIngredientActive(updatedRice.id);
  assert(reactivatedRice.isActive === true, 'Ingredient successfully reactivated');

  // ------------------------------------------------------------------
  // 5. OPENING STOCK POSTING & IDEMPOTENCY LEDGER TESTS
  // ------------------------------------------------------------------
  console.log('\n5. OPENING STOCK WORKFLOW & IDEMPOTENCY CHECKS');

  // Example from user spec:
  // Paneer
  // 10 kg
  // ₹280/kg
  const createdPaneer = await IngredientService.createIngredient({
    name: 'Paneer',
    unit: 'kg',
    minAlertLevel: 5,
    maxStockLevel: 30,
    costPerUnit: 280,
    storageType: 'CHILLED'
  });

  // Post opening stock: 10 kg @ ₹280/kg
  const openingStockTx = await IngredientService.postOpeningStock(createdPaneer.ingredient.id, {
    quantity: 10,
    unit: 'kg',
    unitCost: 280,
    notes: 'Initial verified stock audit'
  });

  assert(openingStockTx.transactionType === 'OPENING_STOCK', 'Transaction type is OPENING_STOCK');
  assert(openingStockTx.quantity === 10, 'Transaction quantity is 10 kg');
  assert(openingStockTx.unitCost === 280, 'Transaction unit cost is ₹280');
  assert(openingStockTx.totalCost === 2800, 'Total transaction cost is ₹2800 (10 * 280)');
  assert(openingStockTx.stockBefore === 0, 'Stock before is 0');
  assert(openingStockTx.stockAfter === 10, 'Stock after is 10');

  // Verify ingredient current stock updated to reflect opening balance
  const refreshedPaneer = await IngredientService.getIngredientById(createdPaneer.ingredient.id);
  assert(refreshedPaneer?.currentStock === 10, 'Ingredient currentStock updated to 10 kg');
  assert(refreshedPaneer?.costPerUnit === 280, 'Ingredient costPerUnit updated to ₹280');

  const paneerStatus = IngredientService.calculateStockStatus(refreshedPaneer!);
  assert(paneerStatus === 'IN_STOCK', 'Paneer stock (10 > min 5) calculated as IN_STOCK');

  // IDEMPOTENCY / DUPLICATE PREVENTION:
  // Attempting to post opening stock a SECOND time for the same ingredient MUST be rejected!
  let duplicateOpeningStockBlocked = false;
  try {
    await IngredientService.postOpeningStock(createdPaneer.ingredient.id, {
      quantity: 5,
      unit: 'kg',
      unitCost: 280
    });
  } catch (e: any) {
    if (e.message.includes('Opening stock has already been posted') || e.message.includes('duplicate')) {
      duplicateOpeningStockBlocked = true;
    }
  }
  assert(duplicateOpeningStockBlocked === true, 'Duplicate opening stock posting is strictly prevented');

  // Also test creating an ingredient WITH inline opening stock on creation
  const createdMilk = await IngredientService.createIngredient({
    name: 'Full Cream Milk',
    unit: 'l',
    minAlertLevel: 10,
    maxStockLevel: 50,
    costPerUnit: 60,
    storageType: 'CHILLED',
    openingStock: {
      quantity: 25,
      unit: 'l',
      unitCost: 62,
      notes: 'Initial milk batch from local dairy'
    }
  });

  assert(createdMilk.openingStockTx !== undefined, 'Inline opening stock transaction created on ingredient creation');
  assert(createdMilk.ingredient.currentStock === 25, 'Ingredient currentStock initialized to 25 l');
  assert(createdMilk.openingStockTx?.totalCost === 1550, 'Opening total cost is ₹1550 (25 * 62)');

  // Duplicate opening stock prevention on milk
  let milkDuplicateBlocked = false;
  try {
    await IngredientService.postOpeningStock(createdMilk.ingredient.id, {
      quantity: 10,
      unit: 'l',
      unitCost: 60
    });
  } catch (e: any) {
    milkDuplicateBlocked = true;
  }
  assert(milkDuplicateBlocked === true, 'Cannot post second opening stock on ingredient created with inline opening stock');

  // ------------------------------------------------------------------
  // 6. TENANT ISOLATION TESTS
  // ------------------------------------------------------------------
  console.log('\n6. TENANT ISOLATION TESTS');

  const businessB = '00000000-0000-0000-0000-000000000002';

  // Attempting to access Business A ingredient while active business is Business B
  let crossBusinessBlocked = false;
  try {
    await IngredientService.getIngredientById(createdPaneer.ingredient.id, businessB);
  } catch (e: any) {
    if (e.message.includes('Tenant Isolation Violation') || e.message.includes('cross-business')) {
      crossBusinessBlocked = true;
    }
  }
  assert(crossBusinessBlocked === true, 'Cross-business ingredient access is strictly denied');

  // Creating ingredient with same name in Business B is allowed (tenants are isolated)
  IngredientService.setCurrentBusinessId(businessB);
  const businessBPaneer = await IngredientService.createIngredient({
    name: 'Paneer', // Same name as Business A!
    businessId: businessB,
    unit: 'kg',
    minAlertLevel: 4,
    costPerUnit: 290
  });
  assert(businessBPaneer.ingredient.businessId === businessB, 'Tenant B can create its own Paneer independently');

  const businessBIngredients = await IngredientService.getIngredients(businessB);
  assert(businessBIngredients.length === 1, 'Business B sees only its own ingredients');
  assert(businessBIngredients[0].name === 'Paneer', 'Business B ingredient list contains its own Paneer');

  // Reset tenant to default Business A
  IngredientService.setCurrentBusinessId(businessA);

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${totalTests} Ran | ${passedTests} Passed | ${failedTests} Failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
