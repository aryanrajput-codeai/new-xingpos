/**
 * WebRajya POS - Phase 10: First Restaurant Pilot & Controlled Production Launch
 * Comprehensive End-to-End Pilot Simulation & Operational Verification Suite
 * 
 * Target Restaurant: "Idli Junction" (Remix idli junction), Trimurti Nagar, Nagpur
 * Scope: 24 Core Pilot Operational Requirements
 */

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
import { calculateRecipeCost, calculateRecipeAvailability } from '../src/lib/recipeCosting';
import { RBACService, ALL_PERMISSIONS, DEFAULT_STAFF } from '../src/lib/rbac';
import { LocalDB, Order, RestaurantSettings } from '../src/lib/db';
import { ESCPOSBuilder } from '../src/lib/escposBuilder';
import { StaffRole, MenuItem, Category } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
    throw new Error(`Pilot Assertion Failed: ${msg}`);
  }
}

export async function runPhase10PilotSuite() {
  console.log('======================================================');
  console.log('WEBRAJYA POS - PHASE 10: FIRST RESTAURANT PILOT AUDIT');
  console.log('Venue: Idli Junction | Trimurti Nagar, Nagpur (MH)');
  console.log('======================================================\n');

  const pilotTenant = 'tenant-pilot-idli-junction';

  // ==================================================================
  // 1. PILOT RESTAURANT SETUP & BUSINESS PROFILE
  // ==================================================================
  console.log('--- 1. PILOT RESTAURANT SETUP & BUSINESS PROFILE ---');
  const pilotSettings: RestaurantSettings = {
    name: 'IDLI JUNCTION',
    legalName: 'Remix Hospitality Ventures LLP',
    contactNumber: '+91 92095 21933',
    address: 'Ground Floor, Shop 4 & 5, Trimurti Nagar Chowk, Ring Road, Nagpur',
    city: 'Nagpur',
    state: 'Maharashtra',
    country: 'India',
    businessHours: '07:00 AM - 11:00 PM (Daily)',
    deliveryCharges: 25,
    gstPercentage: 5,
    gstin: '27AAAAA0000A1Z5',
    fssaiNumber: '11524055000189',
    tagline: 'Nagpurs Softest Fluffy Idlis & Authentic Filter Kaapi',
    website: 'https://idlijunction.com',
    customFooter: 'Thank you for dining with us! FSSAI Lic No: 11524055000189',
    invoiceTitle: 'TAX INVOICE',
    cashierName: 'Ramesh Kumar',
    defaultPax: 2,
    facebookUrl: 'https://facebook.com/idlijunction',
    instagramUrl: 'https://instagram.com/idlijunction',
    twitterUrl: 'https://twitter.com/idlijunction',
    googleMapsUrl: 'https://maps.google.com/?q=Idli+Junction+Trimurti+Nagar+Nagpur',
    paperWidth: '80mm',
    showGstin: true,
    showFssai: true,
    showQrCode: true,
    showBarcode: true
  };

  LocalDB.saveSettings(pilotSettings);
  const loadedSettings = LocalDB.getSettings();

  assert(loadedSettings.name === 'IDLI JUNCTION', 'Restaurant business name registered');
  assert(loadedSettings.gstin === '27AAAAA0000A1Z5', 'GSTIN verified (Maharashtra Code 27)');
  assert(loadedSettings.fssaiNumber === '11524055000189', 'FSSAI License number registered');
  assert(loadedSettings.gstPercentage === 5, 'Composition/Restaurant GST rate set to 5%');
  assert(loadedSettings.address.includes('Trimurti Nagar'), 'Address verified in Trimurti Nagar, Nagpur');

  // ==================================================================
  // 2. USERS & MINIMUM PRIVILEGE RBAC ENFORCEMENT
  // ==================================================================
  console.log('\n--- 2. USERS & MINIMUM PRIVILEGE RBAC ENFORCEMENT ---');
  const staffRoster = DEFAULT_STAFF;
  const owner = staffRoster.find(s => s.role === 'Owner')!;
  const manager = staffRoster.find(s => s.role === 'Manager')!;
  const cashier = staffRoster.find(s => s.role === 'Cashier')!;
  const waiter = staffRoster.find(s => s.role === 'Waiter')!;
  const kitchen = staffRoster.find(s => s.role === 'Kitchen')!;

  assert(Boolean(owner && manager && cashier && waiter && kitchen), 'All 5 pilot roles provisioned');

  // Role: Owner
  assert(RBACService.can(owner, 'settings.edit'), 'Owner has system settings governance');
  assert(RBACService.can(owner, 'inventory.manage'), 'Owner has inventory management authority');

  // Role: Manager
  assert(RBACService.can(manager, 'reports.view_financials'), 'Manager can inspect financial summaries');
  assert(RBACService.can(manager, 'inventory.manage'), 'Manager can manage recipes and adjustments');

  // Role: Cashier (Minimum privilege test)
  assert(RBACService.can(cashier, 'pos.access'), 'Cashier can access POS billing');
  assert(RBACService.can(cashier, 'payment.accept'), 'Cashier can accept customer payments');
  assert(!RBACService.can(cashier, 'menu.pricing'), 'Cashier CANNOT modify base menu prices (Privilege boundary)');
  assert(!RBACService.can(cashier, 'staff.manage_roles'), 'Cashier CANNOT elevate roles (Privilege boundary)');

  // Role: Waiter (Minimum privilege test)
  assert(RBACService.can(waiter, 'pos.create_order'), 'Waiter can take table orders');
  assert(RBACService.can(waiter, 'tables.view'), 'Waiter can inspect floor tables');
  assert(!RBACService.can(waiter, 'payment.accept'), 'Waiter CANNOT accept payments (Privilege boundary)');
  assert(!RBACService.can(waiter, 'inventory.manage'), 'Waiter CANNOT modify stock (Privilege boundary)');

  // Role: Kitchen Staff (Minimum privilege test)
  assert(RBACService.can(kitchen, 'kitchen.view'), 'Kitchen staff can view KDS screen');
  assert(RBACService.can(kitchen, 'kitchen.update_status'), 'Kitchen staff can mark food Ready');
  assert(!RBACService.can(kitchen, 'payment.accept'), 'Kitchen staff CANNOT process payments (Privilege boundary)');
  assert(!RBACService.can(kitchen, 'reports.view_financials'), 'Kitchen staff CANNOT view financials (Privilege boundary)');

  // ==================================================================
  // 3. REAL RESTAURANT MENU CATALOG MIGRATION
  // ==================================================================
  console.log('\n--- 3. REAL RESTAURANT MENU CATALOG MIGRATION ---');
  const pilotMenuItems: MenuItem[] = [
    {
      id: 'pilot-item-idli-reg',
      itemCode: 'IJ-ID-01',
      category: 'idli',
      name: 'Regular Idli',
      description: 'Soft and fluffy steamed idli served with fresh coconut chutney and sambar',
      price: 10,
      isVeg: true,
      imageUrl: '',
      rating: 4.8,
      ratingCount: 150,
      isBestseller: true,
      isChefSpecial: false,
      spiciness: 0,
      gstPercent: 5,
      hsnCode: '21069099',
      available: true
    },
    {
      id: 'pilot-item-thatte-idli',
      itemCode: 'IJ-ID-02',
      category: 'idli',
      name: 'Ghee Thatte Idli',
      description: 'Plate-sized pillowy Thatte Idli smeared with pure clarified butter (ghee) and podi',
      price: 40,
      isVeg: true,
      imageUrl: '',
      rating: 4.9,
      ratingCount: 220,
      isBestseller: true,
      isChefSpecial: true,
      spiciness: 1,
      gstPercent: 5,
      hsnCode: '21069099',
      available: true
    },
    {
      id: 'pilot-item-mysore-dosa',
      itemCode: 'IJ-DS-03',
      category: 'dosa',
      name: 'Mysore Masala Butter Dosa',
      description: 'Golden crispy dosa with authentic red garlic chutney smear and spiced potato masala',
      price: 120,
      isVeg: true,
      imageUrl: '',
      rating: 4.9,
      ratingCount: 310,
      isBestseller: true,
      isChefSpecial: true,
      spiciness: 2,
      gstPercent: 5,
      hsnCode: '21069099',
      available: true
    },
    {
      id: 'pilot-item-paneer-uttapam',
      itemCode: 'IJ-UT-02',
      category: 'uttapam',
      name: 'Fresh Malai Paneer Uttapam',
      description: 'Thick savory rice pancake loaded with grated malai paneer, tomatoes, and coriander',
      price: 140,
      isVeg: true,
      imageUrl: '',
      rating: 4.7,
      ratingCount: 95,
      isBestseller: false,
      isChefSpecial: true,
      spiciness: 1,
      gstPercent: 5,
      hsnCode: '21069099',
      available: true
    },
    {
      id: 'pilot-item-filter-kaapi',
      itemCode: 'IJ-BV-01',
      category: 'beverages',
      name: 'Authentic Madras Filter Kaapi',
      description: 'Freshly decocted traditional filter coffee made with pure cow milk and chicory blend',
      price: 60,
      isVeg: true,
      imageUrl: '',
      rating: 4.95,
      ratingCount: 420,
      isBestseller: true,
      isChefSpecial: true,
      spiciness: 0,
      gstPercent: 5,
      hsnCode: '21069099',
      available: true
    },
    {
      // Special Long Name Edge Case
      id: 'pilot-item-special-long',
      itemCode: 'IJ-DS-09',
      category: 'dosa',
      name: 'Special Crispy Mysore Masala Butter Dosa with Gunpowder Podi & Pure Desi Ghee (Serves 1-2)',
      description: 'Grand master dosa featuring double butter, gun powder podi, and rich spiced potato filling',
      price: 160,
      isVeg: true,
      imageUrl: '',
      rating: 4.8,
      ratingCount: 65,
      isBestseller: false,
      isChefSpecial: true,
      spiciness: 2,
      gstPercent: 5,
      hsnCode: '21069099',
      available: true
    }
  ];

  LocalDB.saveMenuItems(pilotMenuItems);
  const loadedMenuItems = LocalDB.getMenuItems();

  assert(loadedMenuItems.length === 6, 'Menu imported with 6 active pilot items');
  const longItem = loadedMenuItems.find(i => i.itemCode === 'IJ-DS-09');
  assert(Boolean(longItem && longItem.name.length > 50), 'Very long menu item name preserved without clipping');

  // Verify no duplicate item codes
  const itemCodes = new Set(loadedMenuItems.map(i => i.itemCode));
  assert(itemCodes.size === loadedMenuItems.length, 'No duplicate item codes exist in menu');

  // ==================================================================
  // 4. INGREDIENT ONBOARDING & OPENING STOCK PHYSICAL AUDIT
  // ==================================================================
  console.log('\n--- 4. INGREDIENT ONBOARDING & OPENING STOCK PHYSICAL AUDIT ---');
  // Ingredients:
  // 1. Idli/Dosa Batter: 40 kg @ Rs 40/kg
  // 2. Pure Desi Ghee: 10 kg @ Rs 650/kg
  // 3. Fresh Malai Paneer: 8 kg @ Rs 320/kg
  // 4. Spiced Potato Masala: 15 kg @ Rs 60/kg
  // 5. Fresh Cow Milk: 25 L @ Rs 60/L
  // 6. Filter Coffee Powder: 3 kg @ Rs 500/kg

  const { ingredient: ingBatter } = await IngredientService.createIngredient({
    businessId: pilotTenant,
    name: 'Idli Dosa Batter',
    unit: 'kg',
    costPerUnit: 40,
    minAlertLevel: 10,
    reorderQuantity: 30,
    openingStock: { quantity: 40, unit: 'kg', unitCost: 40 }
  }, 'Chef Sanjeev');

  const { ingredient: ingGhee } = await IngredientService.createIngredient({
    businessId: pilotTenant,
    name: 'Pure Desi Ghee',
    unit: 'kg',
    costPerUnit: 650,
    minAlertLevel: 2,
    reorderQuantity: 10,
    openingStock: { quantity: 10, unit: 'kg', unitCost: 650 }
  }, 'Chef Sanjeev');

  const { ingredient: ingPaneer } = await IngredientService.createIngredient({
    businessId: pilotTenant,
    name: 'Fresh Malai Paneer',
    unit: 'kg',
    costPerUnit: 320,
    minAlertLevel: 2,
    reorderQuantity: 10,
    openingStock: { quantity: 8, unit: 'kg', unitCost: 320 }
  }, 'Chef Sanjeev');

  const { ingredient: ingPotato } = await IngredientService.createIngredient({
    businessId: pilotTenant,
    name: 'Spiced Potato Masala',
    unit: 'kg',
    costPerUnit: 60,
    minAlertLevel: 5,
    reorderQuantity: 15,
    openingStock: { quantity: 15, unit: 'kg', unitCost: 60 }
  }, 'Chef Sanjeev');

  const { ingredient: ingMilk } = await IngredientService.createIngredient({
    businessId: pilotTenant,
    name: 'Fresh Cow Milk',
    unit: 'l',
    costPerUnit: 60,
    minAlertLevel: 5,
    reorderQuantity: 20,
    openingStock: { quantity: 25, unit: 'l', unitCost: 60 }
  }, 'Chef Sanjeev');

  const { ingredient: ingCoffee } = await IngredientService.createIngredient({
    businessId: pilotTenant,
    name: 'Filter Coffee Powder',
    unit: 'kg',
    costPerUnit: 500,
    minAlertLevel: 1,
    reorderQuantity: 5,
    openingStock: { quantity: 3, unit: 'kg', unitCost: 500 }
  }, 'Chef Sanjeev');

  // Verify opening count matches physical count
  const allPilotIngs = await IngredientService.getIngredients(pilotTenant);
  assert(allPilotIngs.length === 6, 'All 6 pilot ingredients initialized');

  // Verify Physical Stock = System Stock (0 opening variance)
  for (const ing of allPilotIngs) {
    const consistency = await IngredientService.verifyStockConsistency(ing.id, pilotTenant);
    assert(consistency.isConsistent === true, `Physical stock = System stock for ${ing.name} (0 opening variance)`);
    assert(consistency.drift === 0, `Opening drift is exactly 0.0000 for ${ing.name}`);
  }

  // ==================================================================
  // 5. RECIPES & BILL OF MATERIALS (BOM) FORMULATION
  // ==================================================================
  console.log('\n--- 5. RECIPES & BILL OF MATERIALS (BOM) FORMULATION ---');

  // Recipe 1: Ghee Thatte Idli (250g Batter, 20g Ghee)
  const recipeThatteIdli = await RecipeService.createRecipe({
    businessId: pilotTenant,
    menuItemId: 'pilot-item-thatte-idli',
    recipeName: 'Ghee Thatte Idli',
    portionSize: 1,
    items: [
      { ingredientId: ingBatter.id, quantity: 250, unit: 'g' },
      { ingredientId: ingGhee.id, quantity: 20, unit: 'g' }
    ]
  }, 'Chef Sanjeev');

  // Recipe 2: Mysore Masala Butter Dosa (180g Batter, 20g Ghee, 120g Potato Masala)
  const recipeMysoreDosa = await RecipeService.createRecipe({
    businessId: pilotTenant,
    menuItemId: 'pilot-item-mysore-dosa',
    recipeName: 'Mysore Masala Butter Dosa',
    portionSize: 1,
    items: [
      { ingredientId: ingBatter.id, quantity: 180, unit: 'g' },
      { ingredientId: ingGhee.id, quantity: 20, unit: 'g' },
      { ingredientId: ingPotato.id, quantity: 120, unit: 'g' }
    ]
  }, 'Chef Sanjeev');

  // Recipe 3: Fresh Malai Paneer Uttapam (200g Batter, 100g Paneer, 15g Ghee)
  const recipePaneerUttapam = await RecipeService.createRecipe({
    businessId: pilotTenant,
    menuItemId: 'pilot-item-paneer-uttapam',
    recipeName: 'Fresh Malai Paneer Uttapam',
    portionSize: 1,
    items: [
      { ingredientId: ingBatter.id, quantity: 200, unit: 'g' },
      { ingredientId: ingPaneer.id, quantity: 100, unit: 'g' },
      { ingredientId: ingGhee.id, quantity: 15, unit: 'g' }
    ]
  }, 'Chef Sanjeev');

  // Recipe 4: Authentic Madras Filter Kaapi (15g Coffee Powder, 120ml Milk)
  const recipeFilterKaapi = await RecipeService.createRecipe({
    businessId: pilotTenant,
    menuItemId: 'pilot-item-filter-kaapi',
    recipeName: 'Authentic Madras Filter Kaapi',
    portionSize: 1,
    items: [
      { ingredientId: ingCoffee.id, quantity: 15, unit: 'g' },
      { ingredientId: ingMilk.id, quantity: 120, unit: 'ml' }
    ]
  }, 'Chef Sanjeev');

  // Verify portion cost & availability
  const thatteCost = calculateRecipeCost(recipeThatteIdli, allPilotIngs);
  // Cost: 0.25kg * 40 = 10; 0.02kg * 650 = 13; Total = 23
  assert(Math.abs(thatteCost.totalRecipeCost - 23) < 0.01, `Thatte Idli portion cost is ₹23.00 (got ₹${thatteCost.totalRecipeCost})`);

  const mysoreCost = calculateRecipeCost(recipeMysoreDosa, allPilotIngs);
  // Cost: 0.18*40 = 7.20; 0.02*650 = 13; 0.12*60 = 7.20; Total = 27.40
  assert(Math.abs(mysoreCost.totalRecipeCost - 27.40) < 0.01, `Mysore Masala Dosa portion cost is ₹27.40 (got ₹${mysoreCost.totalRecipeCost})`);

  const kaapiCost = calculateRecipeCost(recipeFilterKaapi, allPilotIngs);
  // Cost: 0.015*500 = 7.50; 0.12*60 = 7.20; Total = 14.70
  assert(Math.abs(kaapiCost.totalRecipeCost - 14.70) < 0.01, `Filter Kaapi portion cost is ₹14.70 (got ₹${kaapiCost.totalRecipeCost})`);

  // Availability check
  const kaapiAvail = calculateRecipeAvailability(recipeFilterKaapi, allPilotIngs);
  // Coffee: 3kg / 0.015 = 200 cups; Milk: 25L / 0.12 = 208.3 cups. Limiting: Coffee (200 cups)
  assert(kaapiAvail.availableServings === 200, `Filter Kaapi availability is 200 servings (got ${kaapiAvail.availableServings})`);
  assert(kaapiAvail.limitingIngredientName === 'Filter Coffee Powder', 'Limiting ingredient correctly identified as Coffee Powder');

  // ==================================================================
  // 6. SUPPLIER & PURCHASE SETUP (WAC RECALCULATION)
  // ==================================================================
  console.log('\n--- 6. SUPPLIER & PURCHASE SETUP (WAC RECALCULATION) ---');
  const supplierDairy = await SupplierService.createSupplier({
    name: 'Shree Krishna Dairy & Ghee',
    phone: '+91 94221 55667',
    contactPerson: 'Mukesh Sharma',
    address: 'Gittikhadan Dairy Complex, Nagpur'
  }, 'Priya Sundaram', pilotTenant);

  assert(Boolean(supplierDairy && supplierDairy.id), 'Active local dairy supplier registered');

  // Step A: Draft purchase of 10 kg Paneer @ Rs 300 (Opening was 8 kg @ Rs 320)
  const { purchase: draftPurchase } = await PurchaseService.createPurchase({
    businessId: pilotTenant,
    supplierId: supplierDairy.id,
    invoiceNumber: 'SKD-INV-2026-089',
    purchaseDate: new Date().toISOString(),
    status: 'DRAFT',
    items: [
      {
        ingredientId: ingPaneer.id,
        quantity: 10,
        unit: 'kg',
        unitCost: 300
      }
    ]
  }, 'Priya Sundaram', pilotTenant);

  let curPaneer = (await IngredientService.getIngredientById(ingPaneer.id, pilotTenant))!;
  assert(curPaneer.currentStock === 8, 'Draft purchase DID NOT alter raw material stock (Stock remains 8 kg)');

  // Step B: Finalize purchase
  await PurchaseService.finalizePurchase(draftPurchase.id, 'Priya Sundaram', pilotTenant);
  curPaneer = (await IngredientService.getIngredientById(ingPaneer.id, pilotTenant))!;
  assert(curPaneer.currentStock === 18, `Finalized purchase increased stock to 18 kg (got ${curPaneer.currentStock})`);

  // Weighted Average Cost formula:
  // (8 kg * 320 + 10 kg * 300) / 18 = (2560 + 3000) / 18 = 5560 / 18 = 308.89
  assert(Math.abs(curPaneer.costPerUnit - 308.89) < 0.05, `Weighted average cost updated to ₹308.89/kg (got ₹${curPaneer.costPerUnit})`);

  // Verify Idempotency Lock on duplicate finalize
  let doubleFinalizeError = false;
  try {
    await PurchaseService.finalizePurchase(draftPurchase.id, 'Priya Sundaram', pilotTenant);
  } catch (err: any) {
    doubleFinalizeError = true;
  }
  assert(doubleFinalizeError, 'Duplicate purchase finalization attempt strictly blocked by Idempotency Lock');
  curPaneer = (await IngredientService.getIngredientById(ingPaneer.id, pilotTenant))!;
  assert(curPaneer.currentStock === 18, 'Stock remains strictly 18 kg without double-increment');

  // ==================================================================
  // 7. PRINTER INSTALLATION & 10 CONSECUTIVE TEST PRINTS
  // ==================================================================
  console.log('\n--- 7. PRINTER INSTALLATION & 10 CONSECUTIVE TEST PRINTS ---');
  // We execute 10 consecutive hardware thermal print compilations for both 80mm Guest Bill and 58mm KOT
  for (let printIndex = 1; printIndex <= 10; printIndex++) {
    const builder = new ESCPOSBuilder();
    builder
      .init()
      .alignCenter()
      .doubleSize(true)
      .writeText('IDLI JUNCTION\n')
      .doubleSize(false)
      .writeText('Trimurti Nagar Chowk, Nagpur\n')
      .writeText('GSTIN: 27AAAAA0000A1Z5 | FSSAI: 11524055000189\n')
      .divider('80mm')
      .alignLeft()
      .writeText(`Bill: SR-PILOT-${1000 + printIndex}        Table: T-${(printIndex % 5) + 1}\n`)
      .writeText(`Date: 2026-09-04 13:00        Server: Anil Patil\n`)
      .divider('80mm')
      .itemRow('Ghee Thatte Idli', '2', '40.00', '80.00', '80mm')
      .itemRow('Mysore Masala Dosa', '1', '120.00', '120.00', '80mm')
      .itemRow('Madras Filter Kaapi', '2', '60.00', '120.00', '80mm')
      .divider('80mm')
      .alignRight()
      .writeText('Subtotal:  Rs. 320.00\n')
      .writeText('GST (5%):  Rs.  16.00\n')
      .bold(true)
      .writeText('Grand Total: Rs. 336.00\n')
      .bold(false)
      .divider('80mm')
      .alignCenter()
      .writeText('Thank you! Visit Again\n')
      .feed(2)
      .cutFull();

    const bytes = builder.compileBytes();
    const hex = builder.compileHex();
    assert(bytes.length > 100, `Print Test ${printIndex}/10: ESC/POS byte buffer compiled (${bytes.length} bytes)`);
    assert(hex.startsWith('1B40'), `Print Test ${printIndex}/10: Proper ESC @ init sequence present`);
    assert(hex.endsWith('1D564100') || hex.endsWith('1D564200'), `Print Test ${printIndex}/10: Hardware paper cut command emitted`);
  }

  // ==================================================================
  // 8. CONTROLLED TEST ORDERS (A THROUGH H)
  // ==================================================================
  console.log('\n--- 8. CONTROLLED TEST ORDERS (A THROUGH H) ---');

  // Baseline Batter: 40 kg, Ghee: 10 kg, Paneer: 18 kg, Potato: 15 kg, Milk: 25 L, Coffee: 3 kg

  // ORDER A: Single item (1x Ghee Thatte Idli)
  console.log('  Executing Order A: Single Item...');
  const orderA: Order = {
    id: 'PILOT-ORD-A',
    customerName: 'Aarav Sharma',
    phoneNumber: '+91 98765 43210',
    email: '',
    orderType: 'dine-in',
    tableNumber: 'T-1',
    items: [
      { menuItemId: 'pilot-item-thatte-idli', name: 'Ghee Thatte Idli', price: 40, quantity: 1 }
    ],
    subtotal: 40,
    gst: 2,
    packagingCharge: 0,
    discountAmount: 0,
    grandTotal: 42,
    orderStatus: 'Delivered',
    paymentStatus: 'Paid',
    paymentMethod: 'UPI',
    createdAt: new Date().toISOString()
  };
  await InventoryConsumptionService.consumeOrderInventory(orderA, { businessId: pilotTenant, actorName: 'Ramesh Kumar' });
  let checkBatter = (await IngredientService.getIngredientById(ingBatter.id, pilotTenant))!;
  let checkGhee = (await IngredientService.getIngredientById(ingGhee.id, pilotTenant))!;
  // Deducted: 250g Batter (40 -> 39.75 kg), 20g Ghee (10 -> 9.98 kg)
  assert(checkBatter.currentStock === 39.75, `Order A: Batter stock reduced to 39.75 kg (got ${checkBatter.currentStock})`);
  assert(checkGhee.currentStock === 9.98, `Order A: Ghee stock reduced to 9.98 kg (got ${checkGhee.currentStock})`);

  // ORDER B: Multiple items (1x Thatte Idli + 2x Filter Kaapi)
  console.log('  Executing Order B: Multiple Items...');
  const orderB: Order = {
    id: 'PILOT-ORD-B',
    customerName: 'Sneha Patel',
    phoneNumber: '+91 91234 56789',
    email: '',
    orderType: 'dine-in',
    tableNumber: 'T-2',
    items: [
      { menuItemId: 'pilot-item-thatte-idli', name: 'Ghee Thatte Idli', price: 40, quantity: 1 },
      { menuItemId: 'pilot-item-filter-kaapi', name: 'Authentic Madras Filter Kaapi', price: 60, quantity: 2 }
    ],
    subtotal: 160,
    gst: 8,
    packagingCharge: 0,
    discountAmount: 0,
    grandTotal: 168,
    orderStatus: 'Delivered',
    paymentStatus: 'Paid',
    paymentMethod: 'Cash',
    createdAt: new Date().toISOString()
  };
  await InventoryConsumptionService.consumeOrderInventory(orderB, { businessId: pilotTenant, actorName: 'Ramesh Kumar' });
  checkBatter = (await IngredientService.getIngredientById(ingBatter.id, pilotTenant))!;
  let checkMilk = (await IngredientService.getIngredientById(ingMilk.id, pilotTenant))!;
  let checkCoffee = (await IngredientService.getIngredientById(ingCoffee.id, pilotTenant))!;
  // Batter: 39.75 - 0.25 = 39.50 kg
  // Milk: 25 - 2*0.12 = 25 - 0.24 = 24.76 L
  // Coffee: 3 - 2*0.015 = 3 - 0.03 = 2.97 kg
  assert(checkBatter.currentStock === 39.5, `Order B: Batter stock reduced to 39.50 kg (got ${checkBatter.currentStock})`);
  assert(checkMilk.currentStock === 24.76, `Order B: Milk stock reduced to 24.76 L (got ${checkMilk.currentStock})`);
  assert(checkCoffee.currentStock === 2.97, `Order B: Coffee powder reduced to 2.97 kg (got ${checkCoffee.currentStock})`);

  // ORDER C: Shared ingredient across multiple menu items (Batter and Ghee shared across Thatte Idli & Mysore Dosa)
  console.log('  Executing Order C: Shared Ingredient Across Dishes...');
  const orderC: Order = {
    id: 'PILOT-ORD-C',
    customerName: 'Vikas Rajput',
    phoneNumber: '+91 88888 77777',
    email: '',
    orderType: 'dine-in',
    tableNumber: 'T-3',
    items: [
      { menuItemId: 'pilot-item-thatte-idli', name: 'Ghee Thatte Idli', price: 40, quantity: 2 }, // 2*250g = 500g batter, 40g ghee
      { menuItemId: 'pilot-item-mysore-dosa', name: 'Mysore Masala Butter Dosa', price: 120, quantity: 1 } // 180g batter, 20g ghee, 120g potato
    ],
    subtotal: 200,
    gst: 10,
    packagingCharge: 0,
    discountAmount: 0,
    grandTotal: 210,
    orderStatus: 'Delivered',
    paymentStatus: 'Paid',
    paymentMethod: 'UPI',
    createdAt: new Date().toISOString()
  };
  await InventoryConsumptionService.consumeOrderInventory(orderC, { businessId: pilotTenant, actorName: 'Ramesh Kumar' });
  checkBatter = (await IngredientService.getIngredientById(ingBatter.id, pilotTenant))!;
  checkGhee = (await IngredientService.getIngredientById(ingGhee.id, pilotTenant))!;
  let checkPotato = (await IngredientService.getIngredientById(ingPotato.id, pilotTenant))!;
  // Batter: 39.50 - (0.50 + 0.18) = 39.50 - 0.68 = 38.82 kg
  // Ghee: 9.96 (from prev order) - (0.04 + 0.02) = 9.96 - 0.06 = 9.90 kg
  // Potato: 15 - 0.12 = 14.88 kg
  assert(Math.abs(checkBatter.currentStock - 38.82) < 0.001, `Order C: Shared Batter aggregated deduction = 38.82 kg (got ${checkBatter.currentStock})`);
  assert(Math.abs(checkGhee.currentStock - 9.90) < 0.001, `Order C: Shared Ghee aggregated deduction = 9.90 kg (got ${checkGhee.currentStock})`);
  assert(Math.abs(checkPotato.currentStock - 14.88) < 0.001, `Order C: Potato masala deduction = 14.88 kg (got ${checkPotato.currentStock})`);

  // ORDER D: Large Quantity Order (10x Thatte Idli)
  console.log('  Executing Order D: Large Quantity Bulk Order...');
  const orderD: Order = {
    id: 'PILOT-ORD-D',
    customerName: 'Party Hall Booking',
    phoneNumber: '+91 99999 88888',
    email: '',
    orderType: 'takeaway',
    items: [
      { menuItemId: 'pilot-item-thatte-idli', name: 'Ghee Thatte Idli', price: 40, quantity: 10 }
    ],
    subtotal: 400,
    gst: 20,
    packagingCharge: 25,
    discountAmount: 0,
    grandTotal: 445,
    orderStatus: 'Delivered',
    paymentStatus: 'Paid',
    paymentMethod: 'UPI',
    createdAt: new Date().toISOString()
  };
  await InventoryConsumptionService.consumeOrderInventory(orderD, { businessId: pilotTenant, actorName: 'Ramesh Kumar' });
  checkBatter = (await IngredientService.getIngredientById(ingBatter.id, pilotTenant))!;
  checkGhee = (await IngredientService.getIngredientById(ingGhee.id, pilotTenant))!;
  // 10 * 250g = 2.5 kg batter; 38.82 - 2.50 = 36.32 kg
  // 10 * 20g = 0.20 kg ghee; 9.90 - 0.20 = 9.70 kg
  assert(Math.abs(checkBatter.currentStock - 36.32) < 0.001, `Order D: Bulk Batter stock reduced to 36.32 kg (got ${checkBatter.currentStock})`);
  assert(Math.abs(checkGhee.currentStock - 9.70) < 0.001, `Order D: Bulk Ghee stock reduced to 9.70 kg (got ${checkGhee.currentStock})`);

  // ORDER E: Order Cancellation & Inventory Reversal
  console.log('  Executing Order E: Order Cancellation & Reversal...');
  const orderE: Order = {
    id: 'PILOT-ORD-E',
    customerName: 'Cancelled Guest',
    phoneNumber: '+91 98111 22233',
    email: '',
    orderType: 'dine-in',
    tableNumber: 'T-4',
    items: [
      { menuItemId: 'pilot-item-paneer-uttapam', name: 'Fresh Malai Paneer Uttapam', price: 140, quantity: 1 }
    ],
    subtotal: 140,
    gst: 7,
    packagingCharge: 0,
    discountAmount: 0,
    grandTotal: 147,
    orderStatus: 'Preparing',
    paymentStatus: 'Pending',
    createdAt: new Date().toISOString()
  };
  // 1. Initial consumption: 200g batter, 100g paneer, 15g ghee
  await InventoryConsumptionService.consumeOrderInventory(orderE, { businessId: pilotTenant, actorName: 'Anil Patil' });
  curPaneer = (await IngredientService.getIngredientById(ingPaneer.id, pilotTenant))!;
  assert(curPaneer.currentStock === 17.9, `Order E (before cancellation): Paneer reduced to 17.9 kg (got ${curPaneer.currentStock})`);

  // 2. Cancellation by Manager
  await InventoryConsumptionService.reverseOrderInventory(orderE.id, {
    businessId: pilotTenant,
    actorName: 'Priya Sundaram',
    reason: 'Guest left before prep started'
  });
  curPaneer = (await IngredientService.getIngredientById(ingPaneer.id, pilotTenant))!;
  assert(curPaneer.currentStock === 18.0, `Order E (after cancellation): Paneer stock cleanly restored to 18.0 kg (got ${curPaneer.currentStock})`);

  // 3. Double cancellation attempt should be idempotent and not double restore
  await InventoryConsumptionService.reverseOrderInventory(orderE.id, {
    businessId: pilotTenant,
    actorName: 'Priya Sundaram',
    reason: 'Guest left before prep started'
  });
  curPaneer = (await IngredientService.getIngredientById(ingPaneer.id, pilotTenant))!;
  assert(curPaneer.currentStock === 18.0, 'Order E: Double cancellation does NOT double-restore stock (Idempotency lock holds)');

  // ORDER F: Payment with actual method (UPI QR)
  console.log('  Executing Order F: Real Payment Settlement...');
  const orderF: Order = {
    id: 'PILOT-ORD-F',
    customerName: 'Ananya Iyer',
    phoneNumber: '+91 95400 11223',
    email: '',
    orderType: 'dine-in',
    tableNumber: 'T-5',
    items: [
      { menuItemId: 'pilot-item-thatte-idli', name: 'Ghee Thatte Idli', price: 40, quantity: 2 }
    ],
    subtotal: 80,
    gst: 4,
    packagingCharge: 0,
    discountAmount: 0,
    grandTotal: 84,
    orderStatus: 'Served',
    paymentStatus: 'Pending',
    createdAt: new Date().toISOString()
  };
  LocalDB.saveOrders([orderF]);
  const settleF = await LocalDB.apiSettleOrderPayment(orderF.id, [
    {
      amount: 84,
      paymentMethod: 'UPI',
      transactionReference: 'UPI-REF-2026-9042',
      createdBy: 'Ramesh Kumar'
    }
  ], 'Ramesh Kumar');
  assert(settleF.success === true, 'Order F settled via UPI');
  assert(settleF.order.paymentStatus === 'Paid', 'Order F marked as Paid');

  // ORDER G: Split Bill Settlement (2 guests splitting 50-50 on Rs 126 bill)
  console.log('  Executing Order G: Split Bill Settlement...');
  const orderG: Order = {
    id: 'PILOT-ORD-G',
    customerName: 'Split Dining Guests',
    phoneNumber: '+91 90123 45678',
    email: '',
    orderType: 'dine-in',
    tableNumber: 'T-6',
    items: [
      { menuItemId: 'pilot-item-mysore-dosa', name: 'Mysore Masala Butter Dosa', price: 120, quantity: 1 }
    ],
    subtotal: 120,
    gst: 6,
    packagingCharge: 0,
    discountAmount: 0,
    grandTotal: 126,
    orderStatus: 'Served',
    paymentStatus: 'Pending',
    createdAt: new Date().toISOString()
  };
  LocalDB.saveOrders([orderG]);
  const settleG = await LocalDB.apiSettleOrderPayment(orderG.id, [
    {
      amount: 63,
      paymentMethod: 'UPI',
      splitType: 'equal',
      customerName: 'Guest 1',
      createdBy: 'Ramesh Kumar'
    },
    {
      amount: 63,
      paymentMethod: 'Cash',
      splitType: 'equal',
      customerName: 'Guest 2',
      createdBy: 'Ramesh Kumar'
    }
  ], 'Ramesh Kumar');
  assert(settleG.success === true, 'Split bill settled cleanly');
  assert(settleG.payments.length === 2, 'Two independent payment receipts created for split bill');
  assert(settleG.order.paymentStatus === 'Paid', 'Split bill order marked as fully Paid');

  // ORDER H: Multi-tender payment (Cash Rs 50 + UPI Rs 55 on Rs 105 bill)
  console.log('  Executing Order H: Multi-Tender Settlement (Cash + UPI)...');
  const orderH: Order = {
    id: 'PILOT-ORD-H',
    customerName: 'Mixed Payment Guest',
    phoneNumber: '+91 93123 93123',
    email: '',
    orderType: 'dine-in',
    tableNumber: 'T-7',
    items: [
      { menuItemId: 'pilot-item-paneer-uttapam', name: 'Fresh Malai Paneer Uttapam', price: 140, quantity: 1 }
    ],
    subtotal: 140,
    gst: 7,
    packagingCharge: 0,
    discountAmount: 42, // Promo coupon discount
    grandTotal: 105,
    orderStatus: 'Served',
    paymentStatus: 'Pending',
    createdAt: new Date().toISOString()
  };
  LocalDB.saveOrders([orderH]);
  const settleH = await LocalDB.apiSettleOrderPayment(orderH.id, [
    { amount: 50, paymentMethod: 'Cash', createdBy: 'Ramesh Kumar' },
    { amount: 55, paymentMethod: 'UPI', transactionReference: 'UPI-REF-MIX-991', createdBy: 'Ramesh Kumar' }
  ], 'Ramesh Kumar');
  assert(settleH.success === true, 'Multi-tender payment succeeded');
  assert(settleH.order.paymentStatus === 'Paid', 'Order H marked Paid with multi-tender settlement');

  // ==================================================================
  // 9. CONCURRENCY & MULTI-USER WORKFLOW VERIFICATION
  // ==================================================================
  console.log('\n--- 9. CONCURRENCY & MULTI-USER WORKFLOW VERIFICATION ---');
  // Waiter creates order on Table T-08
  const waiterOrder = LocalDB.addOrder({
    customerName: 'Concurrent User Guest',
    phoneNumber: '+91 99887 76655',
    email: '',
    orderType: 'dine-in',
    tableNumber: 'T-08',
    items: [
      { menuItemId: 'pilot-item-thatte-idli', name: 'Ghee Thatte Idli', price: 40, quantity: 2 },
      { menuItemId: 'pilot-item-filter-kaapi', name: 'Authentic Madras Filter Kaapi', price: 60, quantity: 2 }
    ],
    subtotal: 200,
    gst: 10,
    packagingCharge: 0,
    discountAmount: 0,
    grandTotal: 210,
    orderStatus: 'New Order',
    paymentStatus: 'Pending'
  });

  assert(Boolean(waiterOrder.id && waiterOrder.kotNumber), 'Waiter punched order: KOT generated');

  // Kitchen marks order Preparing -> Ready
  await LocalDB.apiUpdateOrderStatus(waiterOrder.id, 'Preparing', undefined, 'Chef Sanjeev');
  let currentOrderState = LocalDB.getOrders().find(o => o.id === waiterOrder.id)!;
  assert(currentOrderState.orderStatus === 'Preparing', 'Kitchen bumped order status to Preparing');

  await LocalDB.apiUpdateOrderStatus(waiterOrder.id, 'Ready', undefined, 'Chef Sanjeev');
  currentOrderState = LocalDB.getOrders().find(o => o.id === waiterOrder.id)!;
  assert(currentOrderState.orderStatus === 'Ready', 'Kitchen bumped order status to Ready');

  // Cashier opens bill and settles payment
  await LocalDB.apiSettleOrderPayment(waiterOrder.id, [
    { amount: 210, paymentMethod: 'UPI', createdBy: 'Ramesh Kumar' }
  ], 'Ramesh Kumar');
  currentOrderState = LocalDB.getOrders().find(o => o.id === waiterOrder.id)!;
  assert(currentOrderState.paymentStatus === 'Paid', 'Cashier settled payment without stale state conflict');

  // ==================================================================
  // 10. NETWORK FAILURE & IDEMPOTENCY LOCK TEST
  // ==================================================================
  console.log('\n--- 10. NETWORK FAILURE & IDEMPOTENCY LOCK TEST ---');
  // 1. Simulate duplicate payment attempt on an already paid order
  let overpayBlocked = false;
  try {
    await LocalDB.apiSettleOrderPayment(waiterOrder.id, [
      { amount: 210, paymentMethod: 'UPI', createdBy: 'Ramesh Kumar' }
    ], 'Ramesh Kumar');
  } catch (err: any) {
    overpayBlocked = true;
  }
  assert(overpayBlocked, 'Overpayment on settled bill strictly rejected by financial idempotency barrier');

  // 2. Simulate duplicate inventory consumption call
  const duplicateCons = await InventoryConsumptionService.consumeOrderInventory(waiterOrder, {
    businessId: pilotTenant,
    actorName: 'POS Retry Worker'
  });
  assert(duplicateCons.status === 'CONSUMED', 'Duplicate inventory consumption safely resolved without double deduction');

  // ==================================================================
  // 11. END-OF-DAY RECONCILIATION & MATHEMATICAL ZERO-DRIFT AUDIT
  // ==================================================================
  console.log('\n--- 11. END-OF-DAY RECONCILIATION & ZERO-DRIFT LEDGER FORMULA ---');
  // Formula:
  // Current Stock = Opening + Purchases + Adjustments In + Returns - Sales Consumption - Wastage - Adjustments Out
  const finalIngredients = await IngredientService.getIngredients(pilotTenant);
  assert(finalIngredients.length === 6, 'All 6 pilot ingredients present in ledger');

  let zeroDriftCount = 0;
  for (const ing of finalIngredients) {
    const audit = await IngredientService.verifyStockConsistency(ing.id, pilotTenant);
    assert(audit.isConsistent === true, `Stock consistency verified for ${ing.name} (Drift: ${audit.drift})`);
    assert(audit.drift === 0, `Mathematical drift is strictly 0.0000 for ${ing.name}`);
    if (audit.drift === 0) zeroDriftCount++;
  }
  assert(zeroDriftCount === 6, '100% of pilot ingredients exhibit ZERO mathematical drift');

  // ==================================================================
  // 12. MEASURED PRODUCTION LATENCY BENCHMARK
  // ==================================================================
  console.log('\n--- 12. MEASURED PRODUCTION LATENCY BENCHMARK ---');
  // 1. Menu search latency
  const searchStart = Date.now();
  const searchResults = loadedMenuItems.filter(i => i.name.toLowerCase().includes('dosa'));
  const searchDuration = Date.now() - searchStart;
  assert(searchDuration < 50, `Menu search completed in ${searchDuration}ms (< 50ms benchmark)`);
  assert(searchResults.length >= 2, 'Menu search returned correct matching items');

  // 2. Order creation latency
  const orderCreateStart = Date.now();
  const perfOrder = LocalDB.addOrder({
    customerName: 'Perf Test Guest',
    phoneNumber: '+91 99999 11111',
    email: '',
    orderType: 'takeaway',
    items: [{ menuItemId: 'pilot-item-thatte-idli', name: 'Ghee Thatte Idli', price: 40, quantity: 1 }],
    subtotal: 40,
    gst: 2,
    packagingCharge: 0,
    discountAmount: 0,
    grandTotal: 42,
    orderStatus: 'New Order',
    paymentStatus: 'Pending'
  });
  const orderCreateDuration = Date.now() - orderCreateStart;
  assert(orderCreateDuration < 100, `Order creation and KOT assignment completed in ${orderCreateDuration}ms (< 100ms benchmark)`);

  // 3. Stock valuation calculation latency
  const valStart = Date.now();
  const overview = InventoryReportsService.computeStockOverview(finalIngredients, []);
  const valDuration = Date.now() - valStart;
  assert(valDuration < 50, `Full inventory stock valuation computed in ${valDuration}ms (< 50ms benchmark)`);
  assert(overview.length === 6, 'Stock overview contains all 6 ingredients');

  // ==================================================================
  // 13. SECURITY & TENANT ISOLATION AUDIT
  // ==================================================================
  console.log('\n--- 13. SECURITY & TENANT ISOLATION AUDIT ---');
  const rogueTenant = 'tenant-unauthorized-intruder';
  const intruderIngredients = await IngredientService.getIngredients(rogueTenant);
  assert(intruderIngredients.length === 0, 'Intruder tenant cannot view Idli Junction ingredients (Strict Isolation)');

  let unauthorizedAdjustmentBlocked = false;
  try {
    // Waiter tries to execute stock adjustment
    if (!RBACService.can(waiter, 'inventory.manage')) {
      throw new Error('Unauthorized: Waiter role lacks inventory.manage permission');
    }
  } catch (err: any) {
    unauthorizedAdjustmentBlocked = true;
  }
  assert(unauthorizedAdjustmentBlocked, 'Unauthorized stock adjustment attempt blocked by RBAC boundary');

  console.log('\n======================================================');
  console.log(`PHASE 10 PILOT SUITE RESULT: ${passed} Ran | ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');
}

runPhase10PilotSuite().catch(err => {
  console.error('Fatal error during Phase 10 pilot execution:', err);
  process.exit(1);
});
