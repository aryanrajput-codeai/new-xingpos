// ====================================================================
// WEBRAJYA POS - PHASE 3: RECIPE MANAGEMENT & COSTING TEST SUITE
// ====================================================================

import {
  calculateIngredientCost,
  calculateRecipeCost,
  calculateRecipeAvailability,
  validateRecipeItem
} from '../src/lib/recipeCosting';
import { RecipeService } from '../src/lib/recipeService';
import { IngredientService } from '../src/lib/ingredientService';
import { RBACService } from '../src/lib/rbac';
import { LocalDB } from '../src/lib/db';
import { Ingredient, Recipe, RecipeItemDTO } from '../src/types/inventory';
import { MenuItem } from '../src/types';

// Mock localStorage environment for headless Node runtime
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
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
  dispatchEvent: () => true
};
(global as any).Event = class {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
};

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string): void {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
    failedCount++;
  }
}

function assertThrows(fn: () => any, testName: string, expectedMessageSubstring?: string): void {
  try {
    fn();
    console.error(`  ✗ FAIL: ${testName} (Expected exception but none was thrown)`);
    failedCount++;
  } catch (err: any) {
    if (expectedMessageSubstring && !err.message.toLowerCase().includes(expectedMessageSubstring.toLowerCase())) {
      console.error(
        `  ✗ FAIL: ${testName} (Exception thrown: "${err.message}", expected substring: "${expectedMessageSubstring}")`
      );
      failedCount++;
    } else {
      console.log(`  ✓ PASS: ${testName}`);
      passedCount++;
    }
  }
}

async function runPhase3Tests(): Promise<void> {
  console.log('======================================================');
  console.log('STARTING PHASE 3: RECIPE MANAGEMENT & COSTING TEST SUITE');
  console.log('======================================================');

  mockStorage.clear();

  const B1 = '00000000-0000-0000-0000-000000000001';
  const B2 = '00000000-0000-0000-0000-000000000002';
  RecipeService.setCurrentBusinessId(B1);
  IngredientService.setCurrentBusinessId(B1);

  // Set active staff to Store Manager (has inventory.manage and menu.edit)
  const managerStaff = RBACService.getStaff().find((s) => s.role === 'Manager')!;
  RBACService.setActiveStaff(managerStaff);

  // Seed Menu Items into LocalDB
  const mockMenuItems: MenuItem[] = [
    {
      id: 'menu-paneer-butter',
      itemCode: 'CURRY-01',
      name: 'Paneer Butter Masala',
      category: 'Main Course',
      description: 'Cottage cheese cubes in rich tomato butter gravy',
      price: 250,
      isVeg: true,
      imageUrl: '',
      rating: 4.9,
      ratingCount: 120,
      isBestseller: true,
      isChefSpecial: true,
      spiciness: 2,
      available: true
    },
    {
      id: 'menu-veg-biryani',
      itemCode: 'RICE-01',
      name: 'Special Veg Biryani',
      category: 'Rice & Biryani',
      description: 'Fragrant basmati rice cooked with fresh veggies and whole spices',
      price: 180,
      isVeg: true,
      imageUrl: '',
      rating: 4.7,
      ratingCount: 85,
      isBestseller: false,
      isChefSpecial: false,
      spiciness: 3,
      available: true
    }
  ];
  LocalDB.saveMenuItems(mockMenuItems);

  // ------------------------------------------------------------------
  // 1. PURE RECIPE COSTING & UNIT CONVERSION TESTS
  // ------------------------------------------------------------------
  console.log('\n1. PURE RECIPE COSTING & UNIT CONVERSION TESTS');

  // Paneer: 1 kg costs ₹280 => ₹0.28 per g
  const mockPaneer: Ingredient = {
    id: 'ing-paneer',
    businessId: B1,
    name: 'Paneer',
    unit: 'kg',
    minAlertLevel: 2,
    costPerUnit: 280, // ₹280/kg
    currentStock: 2, // 2 kg
    reorderQuantity: 5,
    yieldPercentage: 100,
    storageType: 'CHILLED',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Butter: 1 kg costs ₹500 => ₹0.50 per g
  const mockButter: Ingredient = {
    id: 'ing-butter',
    businessId: B1,
    name: 'Butter',
    unit: 'kg',
    minAlertLevel: 1,
    costPerUnit: 500, // ₹500/kg
    currentStock: 1,
    reorderQuantity: 2,
    yieldPercentage: 100,
    storageType: 'CHILLED',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Fresh Tomato: 1 kg costs ₹40 => ₹0.04 per g
  const mockTomato: Ingredient = {
    id: 'ing-tomato',
    businessId: B1,
    name: 'Tomato',
    unit: 'kg',
    minAlertLevel: 1,
    costPerUnit: 40, // ₹40/kg
    currentStock: 0.5, // 500 g
    reorderQuantity: 5,
    yieldPercentage: 100,
    storageType: 'AMBIENT',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Cooking Cream: 1 l costs ₹200 => ₹0.20 per ml
  const mockCream: Ingredient = {
    id: 'ing-cream',
    businessId: B1,
    name: 'Fresh Cream',
    unit: 'l',
    minAlertLevel: 0.5,
    costPerUnit: 200, // ₹200/l
    currentStock: 1,
    reorderQuantity: 2,
    yieldPercentage: 100,
    storageType: 'CHILLED',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Spices: 1 kg costs ₹600 => ₹0.60 per g
  const mockSpices: Ingredient = {
    id: 'ing-spices',
    businessId: B1,
    name: 'Garam Masala Spices',
    unit: 'kg',
    minAlertLevel: 0.2,
    costPerUnit: 600, // ₹600/kg
    currentStock: 0.5,
    reorderQuantity: 1,
    yieldPercentage: 100,
    storageType: 'DRY',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Test Section 5 User Prompt Example:
  // Paneer: 200 g * ₹0.28/g = ₹56.00
  const paneerCost = calculateIngredientCost(
    { ingredientId: mockPaneer.id, quantity: 200, unit: 'g', wastePercentage: 0 },
    mockPaneer
  );
  assert(paneerCost.calculatedCost === 56, 'Paneer 200 g @ ₹280/kg calculates to exactly ₹56.00');
  assert(paneerCost.normalizedBaseQuantity === 0.2, 'Paneer 200 g normalizes to 0.2 kg');
  assert(paneerCost.costPerBaseUnit === 280, 'Paneer base unit cost is ₹280/kg');

  // Butter: 20 g * ₹0.50/g = ₹10.00
  const butterCost = calculateIngredientCost(
    { ingredientId: mockButter.id, quantity: 20, unit: 'g', wastePercentage: 0 },
    mockButter
  );
  assert(butterCost.calculatedCost === 10, 'Butter 20 g @ ₹500/kg calculates to exactly ₹10.00');

  // Tomato: 100 g @ ₹40/kg = ₹4.00
  const tomatoCost = calculateIngredientCost(
    { ingredientId: mockTomato.id, quantity: 100, unit: 'g', wastePercentage: 0 },
    mockTomato
  );
  assert(tomatoCost.calculatedCost === 4, 'Tomato 100 g @ ₹40/kg calculates to exactly ₹4.00');

  // Cream: 30 ml @ ₹200/l = ₹6.00
  const creamCost = calculateIngredientCost(
    { ingredientId: mockCream.id, quantity: 30, unit: 'ml', wastePercentage: 0 },
    mockCream
  );
  assert(creamCost.calculatedCost === 6, 'Cream 30 ml @ ₹200/l calculates to exactly ₹6.00');

  // Spices: 10 g @ ₹600/kg = ₹6.00
  const spicesCost = calculateIngredientCost(
    { ingredientId: mockSpices.id, quantity: 10, unit: 'g', wastePercentage: 0 },
    mockSpices
  );
  assert(spicesCost.calculatedCost === 6, 'Spices 10 g @ ₹600/kg calculates to exactly ₹6.00');

  // Total Recipe Cost: 56 + 10 + 4 + 6 + 6 + 4 (other) = ₹86.00
  const fullMockRecipe: Partial<Recipe> = {
    id: 'test-rec-1',
    menuItemId: 'menu-paneer-butter',
    portionSize: 1,
    laborCost: 2.0,
    overheadCost: 2.0,
    items: [
      { id: '1', businessId: B1, recipeId: 'test-rec-1', ingredientId: mockPaneer.id, quantity: 200, unit: 'g', wastePercentage: 0, createdAt: '', updatedAt: '' },
      { id: '2', businessId: B1, recipeId: 'test-rec-1', ingredientId: mockButter.id, quantity: 20, unit: 'g', wastePercentage: 0, createdAt: '', updatedAt: '' },
      { id: '3', businessId: B1, recipeId: 'test-rec-1', ingredientId: mockTomato.id, quantity: 100, unit: 'g', wastePercentage: 0, createdAt: '', updatedAt: '' },
      { id: '4', businessId: B1, recipeId: 'test-rec-1', ingredientId: mockCream.id, quantity: 30, unit: 'ml', wastePercentage: 0, createdAt: '', updatedAt: '' },
      { id: '5', businessId: B1, recipeId: 'test-rec-1', ingredientId: mockSpices.id, quantity: 10, unit: 'g', wastePercentage: 0, createdAt: '', updatedAt: '' }
    ]
  };

  const allMockIngs = [mockPaneer, mockButter, mockTomato, mockCream, mockSpices];
  const recipeCostBreakdown = calculateRecipeCost(fullMockRecipe, allMockIngs, mockMenuItems[0]);
  assert(recipeCostBreakdown.totalIngredientCost === 82, 'Total ingredient cost is ₹82.00');
  assert(recipeCostBreakdown.totalRecipeCost === 86, 'Total recipe cost with labor & overhead is ₹86.00');
  assert(recipeCostBreakdown.costPerServing === 86, 'Cost per serving is ₹86.00');
  assert(recipeCostBreakdown.foodCostPercentage === 34.4, 'Food cost percentage for ₹250 menu price is 34.4% (86 / 250)');
  assert(recipeCostBreakdown.grossMargin === 164, 'Gross margin is ₹164.00 (250 - 86)');
  assert(recipeCostBreakdown.grossMarginPercentage === 65.6, 'Gross margin percentage is 65.6%');

  // Incompatible unit conversion check
  assertThrows(
    () => calculateIngredientCost({ ingredientId: mockPaneer.id, quantity: 200, unit: 'ml', wastePercentage: 0 }, mockPaneer),
    'Cannot convert between incompatible dimensions (ml for Paneer in kg)',
    'incompatible'
  );

  // ------------------------------------------------------------------
  // 2. WASTAGE PERCENTAGE CALCULATION TESTS
  // ------------------------------------------------------------------
  console.log('\n2. WASTAGE PERCENTAGE CALCULATION TESTS');

  // Paneer with 5% wastage:
  // Effective raw requirement = 200 * (1 + 0.05) = 210 g = 0.21 kg
  // Cost = 0.21 kg * ₹280 = ₹58.80
  const paneerWithWaste = calculateIngredientCost(
    { ingredientId: mockPaneer.id, quantity: 200, unit: 'g', wastePercentage: 5 },
    mockPaneer
  );
  assert(paneerWithWaste.effectiveQuantity === 210, 'Effective quantity with 5% waste is 210 g');
  assert(paneerWithWaste.normalizedBaseQuantity === 0.21, 'Normalized base quantity is 0.21 kg');
  assert(paneerWithWaste.calculatedCost === 58.8, 'Paneer cost with 5% waste is ₹58.80 (210g @ ₹0.28/g)');

  // ------------------------------------------------------------------
  // 3. RECIPE AVAILABILITY ENGINE TESTS (Section 8 of prompt)
  // ------------------------------------------------------------------
  console.log('\n3. RECIPE AVAILABILITY ENGINE TESTS');

  // Prompt example:
  // Recipe requires:
  // Paneer = 200 g, Available Paneer = 2 kg (2000 g) => 10 servings
  // Tomato = 100 g, Available Tomato = 500 g => 5 servings
  // Recipe availability = 5 servings, Display: Available: 5 servings
  const availabilityTestRecipe: Partial<Recipe> = {
    id: 'test-rec-avail',
    menuItemId: 'menu-paneer-butter',
    portionSize: 1,
    items: [
      { id: '1', businessId: B1, recipeId: 'test-rec-avail', ingredientId: mockPaneer.id, quantity: 200, unit: 'g', wastePercentage: 0, createdAt: '', updatedAt: '' },
      { id: '2', businessId: B1, recipeId: 'test-rec-avail', ingredientId: mockTomato.id, quantity: 100, unit: 'g', wastePercentage: 0, createdAt: '', updatedAt: '' }
    ]
  };

  const availResult1 = calculateRecipeAvailability(availabilityTestRecipe, [mockPaneer, mockTomato]);
  assert(availResult1.isAvailable === true, 'Recipe is available');
  assert(availResult1.availableServings === 5, 'Recipe availability is exactly 5 servings');
  assert(availResult1.limitingIngredientName === 'Tomato', 'Limiting ingredient is Tomato');

  // Test zero stock of an ingredient -> Unavailable (0 servings)
  const emptyTomato: Ingredient = { ...mockTomato, currentStock: 0 };
  const availResultZero = calculateRecipeAvailability(availabilityTestRecipe, [mockPaneer, emptyTomato]);
  assert(availResultZero.isAvailable === false, 'Recipe is unavailable when Tomato has 0 stock');
  assert(availResultZero.availableServings === 0, 'Available servings is 0');
  assert(availResultZero.limitingIngredientName === 'Tomato', 'Limiting bottleneck ingredient is Tomato');

  // Test with wastage reducing servings:
  // If Tomato requires 100 g + 25% waste = 125 g. Available Tomato = 500 g => 500 / 125 = 4 servings.
  const recipeWithWasteAvail: Partial<Recipe> = {
    id: 'test-rec-avail-waste',
    menuItemId: 'menu-paneer-butter',
    portionSize: 1,
    items: [
      { id: '1', businessId: B1, recipeId: 'test-rec-avail-waste', ingredientId: mockPaneer.id, quantity: 200, unit: 'g', wastePercentage: 0, createdAt: '', updatedAt: '' },
      { id: '2', businessId: B1, recipeId: 'test-rec-avail-waste', ingredientId: mockTomato.id, quantity: 100, unit: 'g', wastePercentage: 25, createdAt: '', updatedAt: '' }
    ]
  };
  const availResultWaste = calculateRecipeAvailability(recipeWithWasteAvail, [mockPaneer, mockTomato]);
  assert(availResultWaste.availableServings === 4, 'Recipe availability reduced to 4 servings due to 25% wastage on Tomato');

  // ------------------------------------------------------------------
  // 4. VALIDATION RULES & ATOMIC TRANSACTION TESTS
  // ------------------------------------------------------------------
  console.log('\n4. VALIDATION RULES & ATOMIC TRANSACTION TESTS');

  // Duplicate ingredient within recipe
  const duplicateSet = new Set<string>();
  duplicateSet.add('ing-paneer');
  assertThrows(
    () => validateRecipeItem({ ingredientId: 'ing-paneer', quantity: 50, unit: 'g' }, mockPaneer, duplicateSet),
    'Reject duplicate ingredient in same recipe',
    'duplicate'
  );

  // Negative quantity
  assertThrows(
    () => validateRecipeItem({ ingredientId: 'ing-butter', quantity: -10, unit: 'g' }, mockButter, new Set()),
    'Reject negative ingredient quantity',
    'positive'
  );

  // Zero quantity
  assertThrows(
    () => validateRecipeItem({ ingredientId: 'ing-butter', quantity: 0, unit: 'g' }, mockButter, new Set()),
    'Reject zero ingredient quantity',
    'positive'
  );

  // Wastage >= 100%
  assertThrows(
    () => validateRecipeItem({ ingredientId: 'ing-butter', quantity: 50, unit: 'g', wastePercentage: 100 }, mockButter, new Set()),
    'Reject wastage percentage >= 100%',
    'wastage'
  );

  // Negative wastage
  assertThrows(
    () => validateRecipeItem({ ingredientId: 'ing-butter', quantity: 50, unit: 'g', wastePercentage: -5 }, mockButter, new Set()),
    'Reject negative wastage percentage',
    'wastage'
  );

  // Incompatible unit dimension (g for Cream which is measured in l)
  assertThrows(
    () => validateRecipeItem({ ingredientId: 'ing-cream', quantity: 50, unit: 'g' }, mockCream, new Set()),
    'Reject unit dimension mismatch (g for liquid Cream)',
    'incompatible'
  );

  // ------------------------------------------------------------------
  // 5. RECIPE SERVICE CRUD & ATOMIC SAVE WORKFLOW
  // ------------------------------------------------------------------
  console.log('\n5. RECIPE SERVICE CRUD & ATOMIC SAVE WORKFLOW');

  // Create real ingredients in IngredientService for Business B1
  const ing1 = await IngredientService.createIngredient({
    name: 'Fresh Malai Paneer',
    unit: 'kg',
    costPerUnit: 280,
    minAlertLevel: 2,
    openingStock: { quantity: 5, unit: 'kg', unitCost: 280 }
  });

  const ing2 = await IngredientService.createIngredient({
    name: 'Amul Salted Butter',
    unit: 'kg',
    costPerUnit: 500,
    minAlertLevel: 1,
    openingStock: { quantity: 2, unit: 'kg', unitCost: 500 }
  });

  const ing3 = await IngredientService.createIngredient({
    name: 'Ripe Red Tomatoes',
    unit: 'kg',
    costPerUnit: 40,
    minAlertLevel: 2,
    openingStock: { quantity: 10, unit: 'kg', unitCost: 40 }
  });

  // Attempt to create recipe with invalid ingredient: Should fail atomically and create NO recipe
  const brokenItems: RecipeItemDTO[] = [
    { ingredientId: ing1.ingredient.id, quantity: 200, unit: 'g', wastePercentage: 0 },
    { ingredientId: 'non-existent-ingredient', quantity: 50, unit: 'g', wastePercentage: 0 }
  ];

  try {
    await RecipeService.createRecipe({
      menuItemId: 'menu-paneer-butter',
      recipeName: 'Broken Recipe Test',
      portionSize: 1,
      items: brokenItems
    });
    assert(false, 'Broken recipe creation should fail');
  } catch (err: any) {
    assert(true, 'Broken recipe creation fails atomically when one ingredient is invalid');
  }

  // Verify that no recipe was saved
  const recipesAfterBroken = await RecipeService.getRecipes(B1);
  assert(
    !recipesAfterBroken.some((r) => r.recipeName === 'Broken Recipe Test'),
    'No orphaned recipe record created on failed validation'
  );

  // Create valid recipe for Paneer Butter Masala
  const validItems: RecipeItemDTO[] = [
    { ingredientId: ing1.ingredient.id, quantity: 200, unit: 'g', wastePercentage: 0 },
    { ingredientId: ing2.ingredient.id, quantity: 25, unit: 'g', wastePercentage: 0 },
    { ingredientId: ing3.ingredient.id, quantity: 150, unit: 'g', wastePercentage: 5 } // 5% waste
  ];

  const createdRecipe = await RecipeService.createRecipe({
    menuItemId: 'menu-paneer-butter',
    recipeName: 'Restaurant Style Paneer Butter Masala',
    portionSize: 1,
    servingUnit: 'portion',
    preparationNotes: 'Cook gravy on medium simmer; add butter and paneer cubes just before serving.',
    laborCost: 4.0,
    overheadCost: 3.0,
    items: validItems
  });

  assert(createdRecipe.id.startsWith('rec-'), 'Created recipe has valid ID');
  assert(createdRecipe.recipeName === 'Restaurant Style Paneer Butter Masala', 'Recipe name matches');
  assert(createdRecipe.portionSize === 1, 'Portion size is 1');
  assert(createdRecipe.items?.length === 3, 'Recipe has 3 ingredients');

  // Verify unique constraint: Cannot create second recipe for same menu item in B1
  try {
    await RecipeService.createRecipe({
      menuItemId: 'menu-paneer-butter',
      recipeName: 'Second Paneer Recipe (Duplicate)',
      portionSize: 1,
      items: validItems
    });
    assert(false, 'Should prevent duplicate recipe for same menu item');
  } catch (err: any) {
    assert(true, 'Strictly prevents duplicate recipe for same menu item in the same business');
  }

  // Cost calculation for created recipe
  const createdCost = await RecipeService.getRecipeCost(createdRecipe.id, B1);
  assert(createdCost !== null, 'Retrieved recipe cost breakdown');
  // Paneer: 200g @ 280 = ₹56.00
  // Butter: 25g @ 500 = ₹12.50
  // Tomato: 150g * 1.05 = 157.5g @ 40 = ₹6.30
  // Ingredients total = 56 + 12.50 + 6.30 = ₹74.80
  // Labor (4) + Overhead (3) = ₹7.00
  // Total Recipe Cost = ₹81.80
  assert(createdCost!.totalRecipeCost === 81.8, `Calculated total recipe cost is ₹81.80 (actual: ₹${createdCost!.totalRecipeCost})`);
  assert(createdCost!.foodCostPercentage === 32.7, `Food cost percentage is 32.7% (actual: ${createdCost!.foodCostPercentage}%)`);

  // Availability calculation for created recipe
  const createdAvail = await RecipeService.getRecipeAvailability(createdRecipe.id, B1);
  assert(createdAvail !== null, 'Retrieved recipe availability');
  // Paneer stock = 5 kg / 0.2 kg = 25 servings
  // Butter stock = 2 kg / 0.025 kg = 80 servings
  // Tomato stock = 10 kg / 0.1575 kg = 63 servings
  assert(createdAvail!.availableServings === 25, `Recipe availability is 25 servings (limited by Paneer, actual: ${createdAvail!.availableServings})`);
  assert(createdAvail!.limitingIngredientName === 'Fresh Malai Paneer', 'Limiting ingredient is Fresh Malai Paneer');

  // Update recipe: update portion size and items
  const updatedRecipe = await RecipeService.updateRecipe(createdRecipe.id, {
    recipeName: 'Executive Paneer Butter Masala',
    items: [
      { ingredientId: ing1.ingredient.id, quantity: 250, unit: 'g', wastePercentage: 0 },
      { ingredientId: ing2.ingredient.id, quantity: 30, unit: 'g', wastePercentage: 0 }
    ]
  });
  assert(updatedRecipe.recipeName === 'Executive Paneer Butter Masala', 'Recipe name successfully updated');
  assert(updatedRecipe.items?.length === 2, 'Recipe items count updated to 2');

  // Toggle active/inactive
  const deactivated = await RecipeService.toggleRecipeActive(createdRecipe.id, B1);
  assert(deactivated.isActive === false, 'Recipe successfully deactivated');
  const reactivated = await RecipeService.toggleRecipeActive(createdRecipe.id, B1);
  assert(reactivated.isActive === true, 'Recipe successfully reactivated');

  // ------------------------------------------------------------------
  // 6. DYNAMIC COST UPDATES (Section 6 of prompt)
  // ------------------------------------------------------------------
  console.log('\n6. DYNAMIC COST UPDATES');

  // When ingredient cost changes in the inventory, recipe cost must update dynamically
  // without relying on stale cached numbers.
  // Update Paneer cost from ₹280 to ₹320
  await IngredientService.updateIngredient(ing1.ingredient.id, {
    costPerUnit: 320
  });

  const updatedCostData = await RecipeService.getRecipeCost(createdRecipe.id, B1);
  // Recipe has 250g Paneer @ ₹320/kg = ₹80.00
  // and 30g Butter @ ₹500/kg = ₹15.00
  // Ingredients total = ₹95.00
  // Total with labor (4) + overhead (3) = ₹102.00
  assert(
    updatedCostData!.totalIngredientCost === 95,
    `Dynamic ingredient cost updated to ₹95.00 after master ingredient price change (actual: ₹${updatedCostData!.totalIngredientCost})`
  );
  assert(
    updatedCostData!.totalRecipeCost === 102,
    `Total recipe cost dynamically reflects updated master ingredient cost at ₹102.00`
  );

  // ------------------------------------------------------------------
  // 7. MULTI-TENANT ISOLATION TESTS
  // ------------------------------------------------------------------
  console.log('\n7. MULTI-TENANT ISOLATION TESTS');

  // Switch to Business B2
  RecipeService.setCurrentBusinessId(B2);
  IngredientService.setCurrentBusinessId(B2);

  // Business B2 cannot view Business B1 recipe
  assertThrows(
    () => RecipeService.enforceTenantIsolation(createdRecipe.businessId, B2),
    'Cross-business access denied when requesting B1 recipe under B2',
    'tenant isolation'
  );

  // Business B2 recipes list should not contain B1 recipes
  const b2Recipes = await RecipeService.getRecipes(B2);
  assert(
    !b2Recipes.some((r) => r.id === createdRecipe.id),
    'Business B2 recipe query does not return Business B1 recipes'
  );

  // Attempting to attach Business B1 ingredient to Business B2 recipe should fail
  try {
    await RecipeService.createRecipe({
      businessId: B2,
      menuItemId: 'menu-paneer-butter',
      recipeName: 'B2 Cross-Tenant Attempt',
      portionSize: 1,
      items: [
        { ingredientId: ing1.ingredient.id, quantity: 200, unit: 'g' } // ing1 belongs to B1!
      ]
    });
    assert(false, 'Cross-tenant ingredient attachment should fail');
  } catch (err: any) {
    assert(true, 'Cross-tenant ingredient attachment strictly rejected');
  }

  // Business B2 can create its own recipe for the same menu item independently
  const b2Ing = await IngredientService.createIngredient({
    businessId: B2,
    name: 'B2 Organic Paneer',
    unit: 'kg',
    costPerUnit: 350,
    minAlertLevel: 1,
    openingStock: { quantity: 10, unit: 'kg', unitCost: 350 }
  });

  const b2Recipe = await RecipeService.createRecipe({
    businessId: B2,
    menuItemId: 'menu-paneer-butter',
    recipeName: 'B2 Signature Paneer Curry',
    portionSize: 1,
    items: [{ ingredientId: b2Ing.ingredient.id, quantity: 220, unit: 'g' }]
  });

  assert(b2Recipe.businessId === B2, 'Business B2 created recipe under its own tenant');
  assert(b2Recipe.recipeName === 'B2 Signature Paneer Curry', 'B2 recipe created independently');

  // Switch back to B1
  RecipeService.setCurrentBusinessId(B1);
  IngredientService.setCurrentBusinessId(B1);

  // ------------------------------------------------------------------
  // 8. RBAC AUTHORIZATION TESTS
  // ------------------------------------------------------------------
  console.log('\n8. RBAC AUTHORIZATION TESTS');

  // Waiter role (has no inventory.manage or menu.edit)
  const waiterStaff = RBACService.getStaff().find((s) => s.role === 'Waiter')!;
  RBACService.setActiveStaff(waiterStaff);

  try {
    await RecipeService.createRecipe({
      menuItemId: 'menu-veg-biryani',
      recipeName: 'Unauthorized Waiter Recipe',
      portionSize: 1,
      items: [{ ingredientId: ing1.ingredient.id, quantity: 100, unit: 'g' }]
    });
    assert(false, 'Unauthorized staff cannot create recipes');
  } catch (err: any) {
    assert(true, 'Unauthorized staff (Waiter) strictly prevented from creating recipes');
  }

  // Switch back to Store Manager
  RBACService.setActiveStaff(managerStaff);

  // ------------------------------------------------------------------
  // 9. AUDIT LOGGING VERIFICATION
  // ------------------------------------------------------------------
  console.log('\n9. AUDIT LOGGING VERIFICATION');

  const auditLogs = LocalDB.getAuditLogs();
  const recipeCreatedLog = auditLogs.find((l) => l.action === 'Recipe Created');
  const recipeUpdatedLog = auditLogs.find((l) => l.action === 'Recipe Updated');
  const recipeDeactivatedLog = auditLogs.find((l) => l.action === 'Recipe Deactivated');

  assert(recipeCreatedLog !== undefined, 'Audit log recorded for "Recipe Created"');
  assert(recipeUpdatedLog !== undefined, 'Audit log recorded for "Recipe Updated"');
  assert(recipeDeactivatedLog !== undefined, 'Audit log recorded for "Recipe Deactivated"');

  // ------------------------------------------------------------------
  // 10. MENU RECIPE OVERVIEW AGGREGATION
  // ------------------------------------------------------------------
  console.log('\n10. MENU RECIPE OVERVIEW AGGREGATION');

  const overview = await RecipeService.getMenuRecipeOverview(B1);
  assert(overview.length === mockMenuItems.length, `Menu recipe overview returns all ${mockMenuItems.length} menu items`);
  const paneerItem = overview.find((o) => o.menuItem.id === 'menu-paneer-butter');
  assert(paneerItem !== undefined && paneerItem.recipe !== null, 'Paneer Butter Masala has associated recipe');
  assert(paneerItem!.costBreakdown !== null, 'Paneer item has live computed cost breakdown');
  assert(paneerItem!.availability !== null, 'Paneer item has live computed availability');

  const unconfiguredItem = overview.find((o) => o.menuItem.id === 'menu-veg-biryani');
  assert(unconfiguredItem !== undefined && unconfiguredItem.recipe === null, 'Biryani correctly marked as having no recipe');

  // Clean up: delete recipe
  await RecipeService.deleteRecipe(createdRecipe.id, B1);
  const recipesAfterDelete = await RecipeService.getRecipes(B1);
  assert(
    !recipesAfterDelete.some((r) => r.id === createdRecipe.id),
    'Recipe successfully deleted'
  );

  console.log('======================================================');
  console.log(`TEST SUMMARY: ${passedCount + failedCount} Ran | ${passedCount} Passed | ${failedCount} Failed`);
  console.log('======================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
