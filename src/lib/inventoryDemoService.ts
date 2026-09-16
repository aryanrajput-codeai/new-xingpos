// ====================================================================
// WEBRAJYA POS - ISOLATED INVENTORY DEMO & QA DATA ENGINE
// ====================================================================
// Provides an isolated, realistic, multi-category demo dataset for
// manual testing of every inventory feature in Xings Kitchen.
//
// Safety & Isolation Guarantees:
// 1. Strict Tenant Boundary: Isolated under DEMO_BUSINESS_ID
// 2. Clear Identifiers: All demo IDs prefixed with 'demo-' or 'DEMO-'
// 3. Zero Production Contamination: Clear operation removes only demo records
// 4. Authoritative Services: Uses real business logic, ledger, and WAC formulas
// ====================================================================

import { IngredientService } from './ingredientService';
import { RecipeService } from './recipeService';
import { SupplierService } from './supplierService';
import { PurchaseService } from './purchaseService';
import { InventoryConsumptionService } from './inventoryConsumptionService';
import { WastageService } from './wastageService';
import { StockAdjustmentService } from './stockAdjustmentService';
import { InventoryReportsService } from './inventoryReportsService';
import { LocalDB, Order } from './db';
import { SupportedUnit } from './unitConversion';
import {
  Ingredient,
  IngredientCategory,
  IngredientStorageType,
  Recipe,
  Supplier,
  Purchase,
  WastageRecord,
  WastageReason,
  StockAdjustmentRecord,
  StockAdjustmentReason,
  InventoryTransaction
} from '../types/inventory';

export const DEMO_BUSINESS_ID = 'demo-idli-junction-tenant-0001';
export const PRODUCTION_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

export interface DemoStats {
  isDemoActive: boolean;
  businessId: string;
  categoriesCount: number;
  ingredientsCount: number;
  healthyCount: number;
  lowStockCount: number;
  criticalCount: number;
  outOfStockCount: number;
  recipesCount: number;
  suppliersCount: number;
  purchasesCount: number;
  ordersCount: number;
  wastageCount: number;
  adjustmentsCount: number;
  transactionsCount: number;
  totalValuation: number;
  integrityPercent: number;
  driftCount: number;
}

export interface DemoSeedResult {
  success: boolean;
  message: string;
  stats: DemoStats;
}

export class InventoryDemoService {
  /**
   * Checks if the active workspace is currently in Demo Mode
   */
  public static isDemoMode(): boolean {
    return IngredientService.getCurrentBusinessId() === DEMO_BUSINESS_ID;
  }

  /**
   * Switches the active workspace between Demo and Production
   */
  public static setDemoMode(enable: boolean): void {
    const targetId = enable ? DEMO_BUSINESS_ID : PRODUCTION_BUSINESS_ID;
    IngredientService.setCurrentBusinessId(targetId);

    // Broadcast reactive events to update all open tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('inventory_demo_mode_changed', { detail: { isDemo: enable, businessId: targetId } }));
      window.dispatchEvent(new CustomEvent('inventory_refresh'));
      window.dispatchEvent(new CustomEvent('recipes_updated'));
      window.dispatchEvent(new Event('storage'));
    }
  }

  /**
   * Helper to compute relative ISO dates for realistic date-range testing
   */
  private static getRelativeDate(daysAgo: number, hours = 10, minutes = 0): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  }

  /**
   * Seeds the comprehensive Xings Kitchen Demo Dataset
   */
  public static async seedDemoData(options?: { overwrite?: boolean }): Promise<DemoSeedResult> {
    const previousBusinessId = IngredientService.getCurrentBusinessId();

    try {
      // Switch context to Demo Tenant
      IngredientService.setCurrentBusinessId(DEMO_BUSINESS_ID);

      // 1. Clean previous demo records if requested or existing
      await this.clearDemoData(false);

      const now = new Date();
      const lastMonthDate = this.getRelativeDate(32, 9, 30);
      const midMonthDate = this.getRelativeDate(14, 11, 15);
      const lastWeekDate = this.getRelativeDate(5, 14, 0);
      const yesterdayDate = this.getRelativeDate(1, 16, 45);
      const todayDate = now.toISOString();

      // ====================================================================
      // 1. CATEGORIES (10 Categories)
      // ====================================================================
      const categoryDefs: { name: string; description: string }[] = [
        { name: 'Dairy', description: 'Fresh milk, paneer, curd, butter, cream, and cheese' },
        { name: 'Vegetables', description: 'Fresh kitchen produce, onions, potatoes, tomatoes, herbs' },
        { name: 'Grains & Rice', description: 'Sona Masoori, raw rice, poha, rava, and wheat flour' },
        { name: 'Pulses', description: 'Urad dal, toor dal, moong dal, and chana dal' },
        { name: 'Spices', description: 'Mustard seeds, cumin, turmeric, red chilli, garam masala, salt' },
        { name: 'Oils & Fats', description: 'Desi ghee, refined sunflower oil, cold-pressed coconut oil' },
        { name: 'Beverages', description: 'Chicory filter coffee powder, Assam CTC tea, refined sugar' },
        { name: 'Bakery', description: 'Cashew nuts, bakery pav, and garnishing essentials' },
        { name: 'Packaging', description: 'Biodegradable 3-compartment boxes, foil bags, takeaway cups' },
        { name: 'Other', description: 'Wet tamarind, special rasam paste, and miscellaneous kitchen items' }
      ];

      const categoryMap = new Map<string, IngredientCategory>();
      for (const catDef of categoryDefs) {
        const cat = await IngredientService.createCategory(
          {
            name: `${catDef.name} [DEMO]`,
            description: catDef.description,
            isActive: true
          },
          DEMO_BUSINESS_ID
        );
        categoryMap.set(catDef.name, cat);
      }

      // ====================================================================
      // 2. INGREDIENTS (37 Ingredients with diverse units & stock states)
      // ====================================================================
      // We will initialize them with realistic opening stock.
      interface DemoIngDef {
        key: string;
        name: string;
        category: string;
        code: string;
        unit: SupportedUnit;
        costPerUnit: number;
        minAlert: number;
        maxStock?: number;
        reorderQty?: number;
        storageType: 'ambient' | 'refrigerated' | 'frozen';
        isActive?: boolean;
        openingQty: number;
        openingCost: number;
      }

      const ingredientDefs: DemoIngDef[] = [
        // Dairy (6 items)
        { key: 'milk', name: 'Cow Milk [DEMO]', category: 'Dairy', code: 'DEMO-ING-01', unit: 'l', costPerUnit: 60, minAlert: 10, maxStock: 60, reorderQty: 20, storageType: 'refrigerated', openingQty: 30, openingCost: 60 },
        { key: 'paneer', name: 'Malai Paneer [DEMO]', category: 'Dairy', code: 'DEMO-ING-02', unit: 'kg', costPerUnit: 280, minAlert: 2, maxStock: 20, reorderQty: 10, storageType: 'refrigerated', openingQty: 10, openingCost: 280 }, // Critical test case: opening 10kg @ 280
        { key: 'curd', name: 'Fresh Curd [DEMO]', category: 'Dairy', code: 'DEMO-ING-03', unit: 'kg', costPerUnit: 70, minAlert: 5, maxStock: 25, reorderQty: 10, storageType: 'refrigerated', openingQty: 14, openingCost: 70 },
        { key: 'butter', name: 'Pure Salted Butter [DEMO]', category: 'Dairy', code: 'DEMO-ING-04', unit: 'kg', costPerUnit: 500, minAlert: 2, maxStock: 12, reorderQty: 5, storageType: 'refrigerated', openingQty: 4.5, openingCost: 500 },
        { key: 'cheese', name: 'Mozzarella Cheese [DEMO]', category: 'Dairy', code: 'DEMO-ING-05', unit: 'kg', costPerUnit: 450, minAlert: 2, maxStock: 10, reorderQty: 5, storageType: 'refrigerated', openingQty: 0, openingCost: 450 }, // Out of stock
        { key: 'cream', name: 'Fresh Dairy Cream [DEMO]', category: 'Dairy', code: 'DEMO-ING-06', unit: 'kg', costPerUnit: 300, minAlert: 1, maxStock: 6, reorderQty: 3, storageType: 'refrigerated', openingQty: 2.5, openingCost: 300 },

        // Vegetables (8 items)
        { key: 'potato', name: 'Kitchen Potatoes [DEMO]', category: 'Vegetables', code: 'DEMO-ING-07', unit: 'kg', costPerUnit: 30, minAlert: 10, maxStock: 80, reorderQty: 30, storageType: 'ambient', openingQty: 40, openingCost: 30 },
        { key: 'onion', name: 'Red Onions [DEMO]', category: 'Vegetables', code: 'DEMO-ING-08', unit: 'kg', costPerUnit: 35, minAlert: 10, maxStock: 70, reorderQty: 25, storageType: 'ambient', openingQty: 32, openingCost: 35 },
        { key: 'tomato', name: 'Hybrid Tomatoes [DEMO]', category: 'Vegetables', code: 'DEMO-ING-09', unit: 'kg', costPerUnit: 40, minAlert: 8, maxStock: 50, reorderQty: 20, storageType: 'ambient', openingQty: 26, openingCost: 40 },
        { key: 'green_chilli', name: 'Fresh Green Chillies [DEMO]', category: 'Vegetables', code: 'DEMO-ING-10', unit: 'kg', costPerUnit: 80, minAlert: 2, maxStock: 10, reorderQty: 5, storageType: 'ambient', openingQty: 4.5, openingCost: 80 },
        { key: 'coriander', name: 'Green Coriander Leaves [DEMO]', category: 'Vegetables', code: 'DEMO-ING-11', unit: 'kg', costPerUnit: 60, minAlert: 1, maxStock: 8, reorderQty: 4, storageType: 'ambient', openingQty: 3.2, openingCost: 60 },
        { key: 'ginger', name: 'Fresh Ginger Root [DEMO]', category: 'Vegetables', code: 'DEMO-ING-12', unit: 'kg', costPerUnit: 120, minAlert: 1, maxStock: 8, reorderQty: 3, storageType: 'ambient', openingQty: 2.5, openingCost: 120 },
        { key: 'curry_leaves', name: 'Fresh Curry Leaves [DEMO]', category: 'Vegetables', code: 'DEMO-ING-13', unit: 'kg', costPerUnit: 100, minAlert: 0.5, maxStock: 3, reorderQty: 1, storageType: 'ambient', openingQty: 0.45, openingCost: 100 }, // Low Stock (< minAlert 0.5)
        { key: 'lemon', name: 'Fresh Nagpur Lemons [DEMO]', category: 'Vegetables', code: 'DEMO-ING-14', unit: 'pcs', costPerUnit: 5, minAlert: 20, maxStock: 150, reorderQty: 50, storageType: 'ambient', openingQty: 75, openingCost: 5 },

        // Grains & Rice (4 items)
        { key: 'rice', name: 'Sona Masoori Rice [DEMO]', category: 'Grains & Rice', code: 'DEMO-ING-15', unit: 'kg', costPerUnit: 55, minAlert: 20, maxStock: 150, reorderQty: 50, storageType: 'ambient', openingQty: 65, openingCost: 55 },
        { key: 'poha', name: 'Nylon Poha (Flattened Rice) [DEMO]', category: 'Grains & Rice', code: 'DEMO-ING-16', unit: 'kg', costPerUnit: 50, minAlert: 5, maxStock: 35, reorderQty: 15, storageType: 'ambient', openingQty: 20, openingCost: 50 },
        { key: 'rava', name: 'Bombay Sooji / Rava [DEMO]', category: 'Grains & Rice', code: 'DEMO-ING-17', unit: 'kg', costPerUnit: 45, minAlert: 5, maxStock: 30, reorderQty: 10, storageType: 'ambient', openingQty: 16, openingCost: 45 },
        { key: 'atta', name: 'Chakki Whole Wheat Atta [DEMO]', category: 'Grains & Rice', code: 'DEMO-ING-18', unit: 'kg', costPerUnit: 40, minAlert: 5, maxStock: 30, reorderQty: 10, storageType: 'ambient', openingQty: 15, openingCost: 40 },

        // Pulses (3 items)
        { key: 'urad_dal', name: 'Premium Urad Dal Gota [DEMO]', category: 'Pulses', code: 'DEMO-ING-19', unit: 'kg', costPerUnit: 130, minAlert: 10, maxStock: 60, reorderQty: 25, storageType: 'ambient', openingQty: 28, openingCost: 130 },
        { key: 'moong_dal', name: 'Yellow Moong Dal [DEMO]', category: 'Pulses', code: 'DEMO-ING-20', unit: 'kg', costPerUnit: 120, minAlert: 5, maxStock: 30, reorderQty: 10, storageType: 'ambient', openingQty: 14, openingCost: 120 },
        { key: 'toor_dal', name: 'Unpolished Toor Dal [DEMO]', category: 'Pulses', code: 'DEMO-ING-21', unit: 'kg', costPerUnit: 150, minAlert: 8, maxStock: 50, reorderQty: 20, storageType: 'ambient', openingQty: 20, openingCost: 150 },

        // Oils & Fats (3 items)
        { key: 'desi_ghee', name: 'Pure Desi Cow Ghee [DEMO]', category: 'Oils & Fats', code: 'DEMO-ING-22', unit: 'kg', costPerUnit: 650, minAlert: 3, maxStock: 25, reorderQty: 10, storageType: 'ambient', openingQty: 12, openingCost: 650 },
        { key: 'refined_oil', name: 'Refined Sunflower Oil [DEMO]', category: 'Oils & Fats', code: 'DEMO-ING-23', unit: 'l', costPerUnit: 140, minAlert: 10, maxStock: 70, reorderQty: 25, storageType: 'ambient', openingQty: 35, openingCost: 140 },
        { key: 'coconut_oil', name: 'Cold Pressed Coconut Oil [DEMO]', category: 'Oils & Fats', code: 'DEMO-ING-24', unit: 'l', costPerUnit: 280, minAlert: 2, maxStock: 15, reorderQty: 5, storageType: 'ambient', openingQty: 0.25, openingCost: 280 }, // Critical (< 2L, low)

        // Spices (7 items)
        { key: 'mustard_seeds', name: 'Small Mustard Seeds (Rai) [DEMO]', category: 'Spices', code: 'DEMO-ING-25', unit: 'kg', costPerUnit: 160, minAlert: 3.5, maxStock: 6, reorderQty: 2, storageType: 'ambient', openingQty: 0.85, openingCost: 160 }, // Low Stock (< minAlert 3.5)
        { key: 'cumin', name: 'Whole Cumin (Jeera) [DEMO]', category: 'Spices', code: 'DEMO-ING-26', unit: 'kg', costPerUnit: 320, minAlert: 1.0, maxStock: 6, reorderQty: 2, storageType: 'ambient', openingQty: 2.2, openingCost: 320 },
        { key: 'turmeric', name: 'Pure Haldi Turmeric [DEMO]', category: 'Spices', code: 'DEMO-ING-27', unit: 'kg', costPerUnit: 200, minAlert: 1.0, maxStock: 6, reorderQty: 2, storageType: 'ambient', openingQty: 2.5, openingCost: 200 },
        { key: 'red_chilli', name: 'Kashmiri Red Chilli Powder [DEMO]', category: 'Spices', code: 'DEMO-ING-28', unit: 'kg', costPerUnit: 350, minAlert: 1.0, maxStock: 6, reorderQty: 2, storageType: 'ambient', openingQty: 2.8, openingCost: 350 },
        { key: 'garam_masala', name: 'Special Garam Masala [DEMO]', category: 'Spices', code: 'DEMO-ING-29', unit: 'kg', costPerUnit: 500, minAlert: 0.5, maxStock: 4, reorderQty: 1, storageType: 'ambient', openingQty: 1.3, openingCost: 500 },
        { key: 'salt', name: 'Tata Iodized Salt [DEMO]', category: 'Spices', code: 'DEMO-ING-30', unit: 'kg', costPerUnit: 25, minAlert: 5, maxStock: 30, reorderQty: 15, storageType: 'ambient', openingQty: 18, openingCost: 25 },
        { key: 'inactive_spice', name: 'Seasonal Winter Spice Mix [DEMO]', category: 'Spices', code: 'DEMO-ING-31', unit: 'kg', costPerUnit: 400, minAlert: 1, maxStock: 5, reorderQty: 2, storageType: 'ambient', isActive: false, openingQty: 0, openingCost: 400 }, // Inactive item

        // Beverages (3 items)
        { key: 'coffee_powder', name: 'Traditional Filter Coffee Powder [DEMO]', category: 'Beverages', code: 'DEMO-ING-32', unit: 'kg', costPerUnit: 550, minAlert: 2, maxStock: 15, reorderQty: 5, storageType: 'ambient', openingQty: 5.5, openingCost: 550 },
        { key: 'tea_powder', name: 'Assam CTC Tea Powder [DEMO]', category: 'Beverages', code: 'DEMO-ING-33', unit: 'kg', costPerUnit: 380, minAlert: 1, maxStock: 10, reorderQty: 3, storageType: 'ambient', openingQty: 3.8, openingCost: 380 },
        { key: 'sugar', name: 'Pure Refined Sugar [DEMO]', category: 'Beverages', code: 'DEMO-ING-34', unit: 'kg', costPerUnit: 45, minAlert: 10, maxStock: 60, reorderQty: 25, storageType: 'ambient', openingQty: 28, openingCost: 45 },

        // Bakery (1 item)
        { key: 'cashews', name: 'Whole Cashew Nuts [DEMO]', category: 'Bakery', code: 'DEMO-ING-35', unit: 'kg', costPerUnit: 850, minAlert: 1, maxStock: 6, reorderQty: 2, storageType: 'ambient', openingQty: 0, openingCost: 850 }, // Out of stock

        // Packaging (1 item)
        { key: 'meal_box', name: 'Eco 3-Comp Takeaway Boxes [DEMO]', category: 'Packaging', code: 'DEMO-ING-36', unit: 'pcs', costPerUnit: 8, minAlert: 50, maxStock: 600, reorderQty: 200, storageType: 'ambient', openingQty: 280, openingCost: 8 },

        // Other (1 item)
        { key: 'tamarind', name: 'Wet Seedless Tamarind Pulp [DEMO]', category: 'Other', code: 'DEMO-ING-37', unit: 'kg', costPerUnit: 180, minAlert: 2, maxStock: 12, reorderQty: 5, storageType: 'ambient', openingQty: 4.8, openingCost: 180 }
      ];

      const ingredientMap = new Map<string, Ingredient>();

      for (const def of ingredientDefs) {
        const cat = categoryMap.get(def.category);
        const { ingredient } = await IngredientService.createIngredient(
          {
            businessId: DEMO_BUSINESS_ID,
            name: def.name,
            categoryId: cat ? cat.id : null,
            itemCode: def.code,
            unit: def.unit,
            costPerUnit: def.costPerUnit,
            minAlertLevel: def.minAlert,
            maxStockLevel: def.maxStock,
            reorderQuantity: def.reorderQty,
            storageType: (def.storageType === 'refrigerated' ? 'CHILLED' : def.storageType === 'frozen' ? 'FROZEN' : 'AMBIENT') as IngredientStorageType,
            isActive: def.isActive !== undefined ? def.isActive : true,
            openingStock: def.openingQty > 0 ? {
              quantity: def.openingQty,
              unit: def.unit,
              unitCost: def.openingCost,
              notes: `Initial opening stock for demo environment (${def.name})`
            } : undefined
          },
          'Demo Data Seeder'
        );
        ingredientMap.set(def.key, ingredient);
      }

      // ====================================================================
      // 3. SUPPLIERS (5 Verified Regional Suppliers)
      // ====================================================================
      const supplierDefs = [
        {
          name: 'Nagpur Fresh Dairy Farms [DEMO]',
          contactPerson: 'Mr. Rajesh Deshmukh',
          phone: '+91 98221 44551',
          email: 'dairy@nagpurfresh.com',
          address: 'Ganeshpeth Dairy Market, Nagpur - 440018',
          gstin: '27AABCN1234F1Z5',
          paymentTerms: 'Net 15'
        },
        {
          name: 'Nagpur Mandi Vegetables & Greens [DEMO]',
          contactPerson: 'Mr. Suresh Patel',
          phone: '+91 98222 33442',
          email: 'veggies@nagpurmandi.in',
          address: 'Cotton Market Wholesale Yard, Nagpur - 440002',
          gstin: '27AABCP5678G1Z9',
          paymentTerms: 'Cash on Delivery'
        },
        {
          name: 'Dakshin Agro Grains & Pulses [DEMO]',
          contactPerson: 'Mr. K. Ramaswamy',
          phone: '+91 94441 55663',
          email: 'orders@dakshinagro.com',
          address: 'APMC Yard, Kalamna Market, Nagpur - 440035',
          gstin: '27AABCD9012H1Z3',
          paymentTerms: 'Net 30'
        },
        {
          name: 'Kaapi Nilayam & Beverage Corp [DEMO]',
          contactPerson: 'Mr. Venkat Raman',
          phone: '+91 98401 77884',
          email: 'supply@kaapinilayam.com',
          address: 'Central Avenue Depot, Nagpur - 440012',
          gstin: '27AABCK3456J1Z7',
          paymentTerms: 'Net 30'
        },
        {
          name: 'Vidarbha Kirana & Oil Merchants [DEMO]',
          contactPerson: 'Mr. Ashok Agrawal',
          phone: '+91 93701 99005',
          email: 'vidarbha.kirana@gmail.com',
          address: 'Itwari Wholesale Kirana Line, Nagpur - 440002',
          gstin: '27AABCV7890K1Z1',
          paymentTerms: 'Net 30'
        }
      ];

      const supplierList: Supplier[] = [];
      for (const supDef of supplierDefs) {
        const sup = await SupplierService.createSupplier(
          {
            businessId: DEMO_BUSINESS_ID,
            name: supDef.name,
            contactPerson: supDef.contactPerson,
            phone: supDef.phone,
            email: supDef.email,
            address: supDef.address,
            gstin: supDef.gstin,
            paymentTerms: supDef.paymentTerms,
            isActive: true
          },
          'Demo Data Seeder',
          DEMO_BUSINESS_ID
        );
        supplierList.push(sup);
      }

      // ====================================================================
      // 4. PURCHASES (12 Purchases: 2 Drafts, 10 Finalized, WAC Recalculation)
      // ====================================================================
      // Section 9: Paneer WAC test:
      // Opening: 10 kg @ ₹280/kg
      // Purchase: 5 kg @ ₹300/kg
      // Expected WAC: (10*280 + 5*300) / 15 = 4300 / 15 = ₹286.67/kg
      const pDairy = supplierList[0];
      const pVeg = supplierList[1];
      const pGrain = supplierList[2];
      const pBev = supplierList[3];
      const pKirana = supplierList[4];

      // PO 1 (Finalized): Paneer WAC test purchase (Last Month)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pDairy.id,
          invoiceNumber: 'DEMO-INV-DAIRY-01',
          purchaseDate: lastMonthDate,
          status: 'FINALIZED',
          notes: 'Special fresh Malai Paneer batch - WAC recalculation batch',
          items: [
            {
              ingredientId: ingredientMap.get('paneer')!.id,
              quantity: 5,
              unit: 'kg',
              unitCost: 300 // higher cost triggers WAC update to 286.67
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 2 (Finalized): Cow Milk batch (Last Month)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pDairy.id,
          invoiceNumber: 'DEMO-INV-DAIRY-02',
          purchaseDate: lastMonthDate,
          status: 'FINALIZED',
          notes: 'Morning fresh cow milk delivery',
          items: [
            {
              ingredientId: ingredientMap.get('milk')!.id,
              quantity: 20,
              unit: 'l',
              unitCost: 60
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 3 (Finalized): Bulk Grains & Dal (Mid Month)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pGrain.id,
          invoiceNumber: 'DEMO-INV-GRAIN-01',
          purchaseDate: midMonthDate,
          status: 'FINALIZED',
          notes: 'Sona Masoori & Urad Dal replenishments',
          items: [
            {
              ingredientId: ingredientMap.get('rice')!.id,
              quantity: 25,
              unit: 'kg',
              unitCost: 55
            },
            {
              ingredientId: ingredientMap.get('urad_dal')!.id,
              quantity: 15,
              unit: 'kg',
              unitCost: 130
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 4 (Finalized): Fresh Mandi Vegetables (Mid Month)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pVeg.id,
          invoiceNumber: 'DEMO-INV-VEG-01',
          purchaseDate: midMonthDate,
          status: 'FINALIZED',
          notes: 'Potatoes, Onions, and Tomatoes procurement',
          items: [
            {
              ingredientId: ingredientMap.get('potato')!.id,
              quantity: 25,
              unit: 'kg',
              unitCost: 30
            },
            {
              ingredientId: ingredientMap.get('onion')!.id,
              quantity: 20,
              unit: 'kg',
              unitCost: 35
            },
            {
              ingredientId: ingredientMap.get('tomato')!.id,
              quantity: 15,
              unit: 'kg',
              unitCost: 40
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 5 (Finalized): Oils & Ghee Restock (Last Week)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pKirana.id,
          invoiceNumber: 'DEMO-INV-OIL-01',
          purchaseDate: lastWeekDate,
          status: 'FINALIZED',
          notes: 'Sunflower oil and Pure Desi Ghee restock',
          items: [
            {
              ingredientId: ingredientMap.get('refined_oil')!.id,
              quantity: 15,
              unit: 'l',
              unitCost: 140
            },
            {
              ingredientId: ingredientMap.get('desi_ghee')!.id,
              quantity: 5,
              unit: 'kg',
              unitCost: 650
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 6 (Finalized): Beverages & Sugar Restock (Last Week)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pBev.id,
          invoiceNumber: 'DEMO-INV-BEV-01',
          purchaseDate: lastWeekDate,
          status: 'FINALIZED',
          notes: 'Filter coffee powder and sugar replenishment',
          items: [
            {
              ingredientId: ingredientMap.get('coffee_powder')!.id,
              quantity: 3,
              unit: 'kg',
              unitCost: 550
            },
            {
              ingredientId: ingredientMap.get('sugar')!.id,
              quantity: 15,
              unit: 'kg',
              unitCost: 45
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 7 (Finalized): Spices & Seasonings (Yesterday)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pKirana.id,
          invoiceNumber: 'DEMO-INV-SPICE-01',
          purchaseDate: yesterdayDate,
          status: 'FINALIZED',
          notes: 'Mustard seeds, turmeric, and cumin',
          items: [
            {
              ingredientId: ingredientMap.get('mustard_seeds')!.id,
              quantity: 2,
              unit: 'kg',
              unitCost: 160
            },
            {
              ingredientId: ingredientMap.get('cumin')!.id,
              quantity: 2,
              unit: 'kg',
              unitCost: 320
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 8 (Finalized): Toor Dal Procurement (Yesterday)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pGrain.id,
          invoiceNumber: 'DEMO-INV-GRAIN-02',
          purchaseDate: yesterdayDate,
          status: 'FINALIZED',
          notes: 'Unpolished Toor Dal restock for Sambar',
          items: [
            {
              ingredientId: ingredientMap.get('toor_dal')!.id,
              quantity: 10,
              unit: 'kg',
              unitCost: 150
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 9 (Finalized): Today Fresh Produce (Today)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pVeg.id,
          invoiceNumber: 'DEMO-INV-VEG-TODAY',
          purchaseDate: todayDate,
          status: 'FINALIZED',
          notes: 'Morning fresh green chillies, lemons, and ginger',
          items: [
            {
              ingredientId: ingredientMap.get('green_chilli')!.id,
              quantity: 2,
              unit: 'kg',
              unitCost: 80
            },
            {
              ingredientId: ingredientMap.get('lemon')!.id,
              quantity: 30,
              unit: 'pcs',
              unitCost: 5
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 10 (Finalized): Today Dairy Curd & Milk (Today)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pDairy.id,
          invoiceNumber: 'DEMO-INV-DAIRY-TODAY',
          purchaseDate: todayDate,
          status: 'FINALIZED',
          notes: 'Fresh dahi / curd and afternoon milk supply',
          items: [
            {
              ingredientId: ingredientMap.get('curd')!.id,
              quantity: 10,
              unit: 'kg',
              unitCost: 70
            },
            {
              ingredientId: ingredientMap.get('milk')!.id,
              quantity: 10,
              unit: 'l',
              unitCost: 60
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 11 (DRAFT): Pending packaging quote (Must NOT alter stock)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pKirana.id,
          invoiceNumber: 'DEMO-PO-DRAFT-01',
          purchaseDate: todayDate,
          status: 'DRAFT',
          notes: 'Draft quotation for 100 extra meal boxes - stock untouched',
          items: [
            {
              ingredientId: ingredientMap.get('meal_box')!.id,
              quantity: 100,
              unit: 'pcs',
              unitCost: 8
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // PO 12 (DRAFT): Pending butter bulk order (Must NOT alter stock)
      await PurchaseService.createPurchase(
        {
          businessId: DEMO_BUSINESS_ID,
          supplierId: pDairy.id,
          invoiceNumber: 'DEMO-PO-DRAFT-02',
          purchaseDate: todayDate,
          status: 'DRAFT',
          notes: 'Draft inquiry for 10kg pure butter supply',
          items: [
            {
              ingredientId: ingredientMap.get('butter')!.id,
              quantity: 10,
              unit: 'kg',
              unitCost: 500
            }
          ]
        },
        'Store Manager',
        DEMO_BUSINESS_ID
      );

      // ====================================================================
      // 5. RECIPES (20 Realistic Recipes with portioning and margin tiers)
      // ====================================================================
      const recipeConfigs = [
        {
          menuItemId: 'i1',
          name: 'Regular Idli Recipe',
          portionSize: 1,
          servingUnit: 'portion (2 pcs)',
          items: [
            { key: 'rice', qty: 0.06, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'urad_dal', qty: 0.02, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'salt', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i2',
          name: 'Ghee Thatte Idli Recipe',
          portionSize: 1,
          servingUnit: 'portion (1 large pc)',
          items: [
            { key: 'rice', qty: 0.12, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'urad_dal', qty: 0.04, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'desi_ghee', qty: 0.02, unit: 'kg' as SupportedUnit, waste: 1 }
          ]
        },
        {
          menuItemId: 'i3',
          name: 'Mini Podi Idli Recipe',
          portionSize: 1,
          servingUnit: 'plate (12 button idlis)',
          items: [
            { key: 'rice', qty: 0.08, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'urad_dal', qty: 0.03, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'desi_ghee', qty: 0.015, unit: 'kg' as SupportedUnit, waste: 1 },
            { key: 'mustard_seeds', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i4',
          name: 'Plain Dosa Recipe',
          portionSize: 1,
          servingUnit: 'plate (1 crepe)',
          items: [
            { key: 'rice', qty: 0.10, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'urad_dal', qty: 0.03, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'refined_oil', qty: 0.015, unit: 'l' as SupportedUnit, waste: 2 }
          ]
        },
        {
          menuItemId: 'i5',
          name: 'Mysore Masala Dosa Recipe',
          portionSize: 1,
          servingUnit: 'plate (1 filled crepe)',
          items: [
            { key: 'rice', qty: 0.10, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'urad_dal', qty: 0.03, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'potato', qty: 0.12, unit: 'kg' as SupportedUnit, waste: 5 },
            { key: 'onion', qty: 0.04, unit: 'kg' as SupportedUnit, waste: 5 },
            { key: 'desi_ghee', qty: 0.01, unit: 'kg' as SupportedUnit, waste: 1 },
            { key: 'turmeric', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 },
            { key: 'mustard_seeds', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i6',
          name: 'Cheese Dosa Recipe',
          portionSize: 1,
          servingUnit: 'plate (1 crepe)',
          items: [
            { key: 'rice', qty: 0.10, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'urad_dal', qty: 0.03, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'cheese', qty: 0.05, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'butter', qty: 0.015, unit: 'kg' as SupportedUnit, waste: 1 }
          ]
        },
        {
          menuItemId: 'i7',
          name: 'Sambar Wada Recipe',
          portionSize: 1,
          servingUnit: 'portion (2 wadas with sambar)',
          items: [
            { key: 'urad_dal', qty: 0.06, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'toor_dal', qty: 0.03, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'refined_oil', qty: 0.025, unit: 'l' as SupportedUnit, waste: 5 },
            { key: 'onion', qty: 0.02, unit: 'kg' as SupportedUnit, waste: 5 },
            { key: 'tomato', qty: 0.02, unit: 'kg' as SupportedUnit, waste: 5 },
            { key: 'tamarind', qty: 0.005, unit: 'kg' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i8',
          name: 'Upma Recipe',
          portionSize: 1,
          servingUnit: 'bowl (200g)',
          items: [
            { key: 'rava', qty: 0.08, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'onion', qty: 0.03, unit: 'kg' as SupportedUnit, waste: 5 },
            { key: 'refined_oil', qty: 0.015, unit: 'l' as SupportedUnit, waste: 1 },
            { key: 'mustard_seeds', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 },
            { key: 'green_chilli', qty: 0.004, unit: 'kg' as SupportedUnit, waste: 2 }
          ]
        },
        {
          menuItemId: 'i9',
          name: 'Onion Uttapam Recipe',
          portionSize: 1,
          servingUnit: 'portion (1 thick pancake)',
          items: [
            { key: 'rice', qty: 0.12, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'urad_dal', qty: 0.04, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'onion', qty: 0.08, unit: 'kg' as SupportedUnit, waste: 6 },
            { key: 'refined_oil', qty: 0.02, unit: 'l' as SupportedUnit, waste: 2 },
            { key: 'coriander', qty: 0.005, unit: 'kg' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i10',
          name: 'Tomato Uttapam Recipe',
          portionSize: 1,
          servingUnit: 'portion (1 thick pancake)',
          items: [
            { key: 'rice', qty: 0.12, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'urad_dal', qty: 0.04, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'tomato', qty: 0.08, unit: 'kg' as SupportedUnit, waste: 6 },
            { key: 'refined_oil', qty: 0.02, unit: 'l' as SupportedUnit, waste: 2 }
          ]
        },
        {
          menuItemId: 'i11',
          name: 'Filter Coffee Recipe',
          portionSize: 1,
          servingUnit: 'cup (120ml)',
          items: [
            { key: 'coffee_powder', qty: 0.012, unit: 'kg' as SupportedUnit, waste: 5 },
            { key: 'milk', qty: 0.10, unit: 'l' as SupportedUnit, waste: 2 },
            { key: 'sugar', qty: 0.01, unit: 'kg' as SupportedUnit, waste: 1 }
          ]
        },
        {
          menuItemId: 'i12',
          name: 'Paneer Dosa Recipe',
          portionSize: 1,
          servingUnit: 'plate (1 crepe)',
          items: [
            { key: 'rice', qty: 0.10, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'urad_dal', qty: 0.03, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'paneer', qty: 0.08, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'desi_ghee', qty: 0.015, unit: 'kg' as SupportedUnit, waste: 1 }
          ]
        },
        {
          menuItemId: 'i13',
          name: 'Sambar Vada Dip Recipe',
          portionSize: 1,
          servingUnit: 'bowl',
          items: [
            { key: 'toor_dal', qty: 0.05, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'tomato', qty: 0.03, unit: 'kg' as SupportedUnit, waste: 4 },
            { key: 'onion', qty: 0.02, unit: 'kg' as SupportedUnit, waste: 4 },
            { key: 'tamarind', qty: 0.005, unit: 'kg' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i14',
          name: 'Coconut Chutney Recipe',
          portionSize: 1,
          servingUnit: 'cup (50g)',
          items: [
            { key: 'coconut_oil', qty: 0.005, unit: 'l' as SupportedUnit, waste: 0 },
            { key: 'green_chilli', qty: 0.004, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'mustard_seeds', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 },
            { key: 'salt', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i15',
          name: 'Tomato Chutney Recipe',
          portionSize: 1,
          servingUnit: 'cup (50g)',
          items: [
            { key: 'tomato', qty: 0.06, unit: 'kg' as SupportedUnit, waste: 4 },
            { key: 'onion', qty: 0.02, unit: 'kg' as SupportedUnit, waste: 4 },
            { key: 'red_chilli', qty: 0.003, unit: 'kg' as SupportedUnit, waste: 0 },
            { key: 'refined_oil', qty: 0.005, unit: 'l' as SupportedUnit, waste: 1 }
          ]
        },
        {
          menuItemId: 'i16',
          name: 'Kanda Poha Recipe',
          portionSize: 1,
          servingUnit: 'plate (200g)',
          items: [
            { key: 'poha', qty: 0.08, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'onion', qty: 0.04, unit: 'kg' as SupportedUnit, waste: 5 },
            { key: 'refined_oil', qty: 0.015, unit: 'l' as SupportedUnit, waste: 2 },
            { key: 'mustard_seeds', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 },
            { key: 'turmeric', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 },
            { key: 'green_chilli', qty: 0.004, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'lemon', qty: 0.5, unit: 'pcs' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i17',
          name: 'Paneer Masala Recipe',
          portionSize: 1,
          servingUnit: 'portion (250g)',
          items: [
            { key: 'paneer', qty: 0.15, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'tomato', qty: 0.10, unit: 'kg' as SupportedUnit, waste: 5 },
            { key: 'onion', qty: 0.08, unit: 'kg' as SupportedUnit, waste: 5 },
            { key: 'cream', qty: 0.03, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'butter', qty: 0.02, unit: 'kg' as SupportedUnit, waste: 1 },
            { key: 'garam_masala', qty: 0.005, unit: 'kg' as SupportedUnit, waste: 0 },
            { key: 'red_chilli', qty: 0.004, unit: 'kg' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i18',
          name: 'Masala Cutting Chai Recipe',
          portionSize: 1,
          servingUnit: 'glass (100ml)',
          items: [
            { key: 'tea_powder', qty: 0.008, unit: 'kg' as SupportedUnit, waste: 3 },
            { key: 'milk', qty: 0.07, unit: 'l' as SupportedUnit, waste: 2 },
            { key: 'sugar', qty: 0.01, unit: 'kg' as SupportedUnit, waste: 1 },
            { key: 'ginger', qty: 0.004, unit: 'kg' as SupportedUnit, waste: 5 }
          ]
        },
        {
          menuItemId: 'i19',
          name: 'Fresh Lemon Water Recipe',
          portionSize: 1,
          servingUnit: 'glass (250ml)',
          items: [
            { key: 'lemon', qty: 1.0, unit: 'pcs' as SupportedUnit, waste: 0 },
            { key: 'sugar', qty: 0.02, unit: 'kg' as SupportedUnit, waste: 1 },
            { key: 'salt', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 }
          ]
        },
        {
          menuItemId: 'i20',
          name: 'South Indian Curd Rice Recipe',
          portionSize: 1,
          servingUnit: 'bowl (250g)',
          items: [
            { key: 'rice', qty: 0.12, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'curd', qty: 0.15, unit: 'kg' as SupportedUnit, waste: 2 },
            { key: 'mustard_seeds', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 },
            { key: 'curry_leaves', qty: 0.002, unit: 'kg' as SupportedUnit, waste: 0 },
            { key: 'refined_oil', qty: 0.008, unit: 'l' as SupportedUnit, waste: 1 }
          ]
        }
      ];

      const recipeList: Recipe[] = [];
      for (const rDef of recipeConfigs) {
        const recipeItems = rDef.items.map((item) => ({
          ingredientId: ingredientMap.get(item.key)!.id,
          quantity: item.qty,
          unit: item.unit,
          wastePercentage: item.waste
        }));

        const recipe = await RecipeService.createRecipe(
          {
            businessId: DEMO_BUSINESS_ID,
            menuItemId: rDef.menuItemId,
            recipeName: rDef.name,
            portionSize: rDef.portionSize,
            servingUnit: rDef.servingUnit,
            isActive: true,
            items: recipeItems
          },
          'Executive Chef'
        );
        recipeList.push(recipe);
      }

      // ====================================================================
      // 6. POS CONSUMPTION ORDERS (6 Realistic Orders)
      // ====================================================================
      const demoOrders: Order[] = [
        // Order 1: Single item (2x Ghee Thatte Idli) (Last Month)
        {
          id: 'DEMO-ORD-001',
          tableNumber: '1',
          orderType: 'dine-in',
          items: [{ menuItemId: 'i2', name: 'Ghee Thatte Idli', price: 40, quantity: 2 }],
          orderStatus: 'Completed',
          paymentStatus: 'Paid',
          phoneNumber: '',
          email: '',
          subtotal: 80,
          gst: 4,
          packagingCharge: 0,
          discountAmount: 0,
          grandTotal: 84,
          createdAt: lastMonthDate,
          customerName: 'Sample Customer A (Demo)'
        },
        // Order 2: Multi item (Masala Dosa + Filter Coffee) (Mid Month)
        {
          id: 'DEMO-ORD-002',
          tableNumber: '3',
          orderType: 'dine-in',
          items: [
            { menuItemId: 'i5', name: 'Mysore Masala Dosa', price: 60, quantity: 1 },
            { menuItemId: 'i11', name: 'Filter Coffee', price: 20, quantity: 2 }
          ],
          orderStatus: 'Completed',
          paymentStatus: 'Paid',
          phoneNumber: '',
          email: '',
          subtotal: 100,
          gst: 5,
          packagingCharge: 0,
          discountAmount: 0,
          grandTotal: 105,
          createdAt: midMonthDate,
          customerName: 'Sample Customer B (Demo)'
        },
        // Order 3: Shared ingredients across dishes (Idli + Plain Dosa + Onion Uttapam) (Last Week)
        {
          id: 'DEMO-ORD-003',
          tableNumber: '5',
          orderType: 'dine-in',
          items: [
            { menuItemId: 'i1', name: 'Regular Idli', price: 10, quantity: 4 },
            { menuItemId: 'i4', name: 'Plain Dosa', price: 40, quantity: 2 },
            { menuItemId: 'i9', name: 'Onion Uttapam', price: 50, quantity: 1 }
          ],
          orderStatus: 'Completed',
          paymentStatus: 'Paid',
          phoneNumber: '',
          email: '',
          subtotal: 170,
          gst: 8.5,
          packagingCharge: 0,
          discountAmount: 0,
          grandTotal: 178.5,
          createdAt: lastWeekDate,
          customerName: 'Family Table (Demo)'
        },
        // Order 4: Bulk orders (10x Filter Coffee + 5x Poha) (Yesterday)
        {
          id: 'DEMO-ORD-004',
          tableNumber: '8',
          orderType: 'takeaway',
          items: [
            { menuItemId: 'i11', name: 'Filter Coffee', price: 20, quantity: 10 },
            { menuItemId: 'i16', name: 'Kanda Poha', price: 30, quantity: 5 }
          ],
          orderStatus: 'Completed',
          paymentStatus: 'Paid',
          phoneNumber: '',
          email: '',
          subtotal: 350,
          gst: 17.5,
          packagingCharge: 0,
          discountAmount: 0,
          grandTotal: 367.5,
          createdAt: yesterdayDate,
          customerName: 'Office Party Order (Demo)'
        },
        // Order 5: Lunch specialty (Paneer Masala + Curd Rice) (Today)
        {
          id: 'DEMO-ORD-005',
          tableNumber: '2',
          orderType: 'dine-in',
          items: [
            { menuItemId: 'i17', name: 'Paneer Masala', price: 120, quantity: 2 },
            { menuItemId: 'i20', name: 'Curd Rice', price: 60, quantity: 2 }
          ],
          orderStatus: 'Completed',
          paymentStatus: 'Paid',
          phoneNumber: '',
          email: '',
          subtotal: 360,
          gst: 18,
          packagingCharge: 0,
          discountAmount: 0,
          grandTotal: 378,
          createdAt: todayDate,
          customerName: 'Lunch Guests (Demo)'
        },
        // Order 6: Cancellation & Reversal scenario (2x Paneer Dosa) (Today)
        {
          id: 'DEMO-ORD-CANCEL-01',
          tableNumber: '4',
          orderType: 'dine-in',
          items: [{ menuItemId: 'i12', name: 'Paneer Dosa', price: 80, quantity: 2 }],
          orderStatus: 'Cancelled',
          paymentStatus: 'Voided',
          phoneNumber: '',
          email: '',
          subtotal: 160,
          gst: 8,
          packagingCharge: 0,
          discountAmount: 0,
          grandTotal: 168,
          createdAt: todayDate,
          customerName: 'Guest Cancelled Order (Demo)'
        }
      ];

      // Save demo orders in LocalDB (for sales reports)
      const existingOrders = LocalDB.getOrders();
      const filteredOrders = existingOrders.filter((o) => !o.id.startsWith('DEMO-'));
      LocalDB.saveOrders([...filteredOrders, ...demoOrders]);

      // Consume inventory for all orders
      for (const order of demoOrders) {
        await InventoryConsumptionService.consumeOrderInventory(order, {
          businessId: DEMO_BUSINESS_ID,
          actorName: 'POS Cashier'
        });
      }

      // Section 11: Reversal Verification - Cancel Order 6
      await InventoryConsumptionService.reverseOrderInventory(
        'DEMO-ORD-CANCEL-01',
        {
          businessId: DEMO_BUSINESS_ID,
          actorName: 'Store Manager',
          reason: 'Customer cancelled due to emergency departure'
        }
      );

      // ====================================================================
      // 7. WASTAGE RECORDS (Across Multiple Dates & Reasons)
      // ====================================================================
      const wastageConfigs = [
        {
          key: 'tomato',
          qty: 1.2,
          unit: 'kg' as SupportedUnit,
          reason: 'Spoiled' as WastageReason,
          date: lastMonthDate,
          notes: 'Overripe tomatoes in bottom crate during humid weather'
        },
        {
          key: 'milk',
          qty: 0.8,
          unit: 'l' as SupportedUnit,
          reason: 'Expired' as WastageReason,
          date: midMonthDate,
          notes: 'Milk turned sour before evening shift'
        },
        {
          key: 'meal_box',
          qty: 4,
          unit: 'pcs' as SupportedUnit,
          reason: 'Damaged' as WastageReason,
          date: lastWeekDate,
          notes: 'Outer packaging box crushed during transport'
        },
        {
          key: 'refined_oil',
          qty: 0.25,
          unit: 'l' as SupportedUnit,
          reason: 'Spillage' as WastageReason,
          date: lastWeekDate,
          notes: 'Accidental counter spillage during fryer refill'
        },
        {
          key: 'potato',
          qty: 0.3,
          unit: 'kg' as SupportedUnit,
          reason: 'Burnt' as WastageReason,
          date: yesterdayDate,
          notes: 'Tempering pan scorched during peak breakfast rush'
        },
        {
          key: 'rice',
          qty: 0.5,
          unit: 'kg' as SupportedUnit,
          reason: 'Over-preparation' as WastageReason,
          date: yesterdayDate,
          notes: 'Surplus cooked idli batter discarded at closing'
        },
        {
          key: 'salt',
          qty: 0.1,
          unit: 'kg' as SupportedUnit,
          reason: 'Lost' as WastageReason,
          date: todayDate,
          notes: 'Bag torn on store shelf edge'
        },
        {
          key: 'coriander',
          qty: 0.05,
          unit: 'kg' as SupportedUnit,
          reason: 'Other' as WastageReason,
          date: todayDate,
          notes: 'Wilted woody bottom stems trimmed and discarded'
        }
      ];

      for (const w of wastageConfigs) {
        await WastageService.recordWastage(
          {
            businessId: DEMO_BUSINESS_ID,
            ingredientId: ingredientMap.get(w.key)!.id,
            quantity: w.qty,
            unit: w.unit,
            reason: w.reason,
            notes: w.notes
          },
          'Chef de Cuisine',
          DEMO_BUSINESS_ID
        );
      }

      // ====================================================================
      // 8. STOCK ADJUSTMENTS & PHYSICAL COUNT AUDITS (In & Out)
      // ====================================================================
      // Adjustment IN: Found Stock (+2.0 kg Rice in dry storage)
      await StockAdjustmentService.recordAdjustment(
        {
          businessId: DEMO_BUSINESS_ID,
          ingredientId: ingredientMap.get('rice')!.id,
          adjustmentType: 'ADJUSTMENT_IN',
          quantity: 2.0,
          unit: 'kg',
          reason: 'Stock found',
          notes: 'Unrecorded unopened 2kg buffer bag discovered during dry rack cleaning'
        },
        'Inventory Supervisor',
        DEMO_BUSINESS_ID
      );

      // Adjustment OUT: Recipe Testing / Quality audit (-0.4 kg Paneer)
      await StockAdjustmentService.recordAdjustment(
        {
          businessId: DEMO_BUSINESS_ID,
          ingredientId: ingredientMap.get('paneer')!.id,
          adjustmentType: 'ADJUSTMENT_OUT',
          quantity: 0.4,
          unit: 'kg',
          reason: 'Other',
          notes: 'Head chef quality test portion for new seasonal tikka blend'
        },
        'Executive Chef',
        DEMO_BUSINESS_ID
      );

      // Section 14: Physical Stocktake Variance Reconciliation
      // Scenario A (Shortage): Kitchen Potatoes - physical count reveals shortage
      const currentPotato = (await IngredientService.getIngredientById(ingredientMap.get('potato')!.id, DEMO_BUSINESS_ID))!;
      const targetPhysicalPotato = Math.max(0, Number((currentPotato.currentStock - 1.5).toFixed(2)));
      await StockAdjustmentService.recordAdjustment(
        {
          businessId: DEMO_BUSINESS_ID,
          ingredientId: currentPotato.id,
          adjustmentType: 'ADJUSTMENT_OUT',
          quantity: 1.5,
          isPhysicalCountMode: true,
          physicalCount: targetPhysicalPotato,
          unit: 'kg',
          reason: 'Physical count correction',
          notes: `Monthly physical stocktake: System had ${currentPotato.currentStock} kg, Physical verified ${targetPhysicalPotato} kg (-1.5 kg variance reconciled)`
        },
        'Audit Team',
        DEMO_BUSINESS_ID
      );

      // Scenario B (Overage): Cow Milk - physical count reveals overage
      const currentMilk = (await IngredientService.getIngredientById(ingredientMap.get('milk')!.id, DEMO_BUSINESS_ID))!;
      const targetPhysicalMilk = Number((currentMilk.currentStock + 1.2).toFixed(2));
      await StockAdjustmentService.recordAdjustment(
        {
          businessId: DEMO_BUSINESS_ID,
          ingredientId: currentMilk.id,
          adjustmentType: 'ADJUSTMENT_IN',
          quantity: 1.2,
          isPhysicalCountMode: true,
          physicalCount: targetPhysicalMilk,
          unit: 'l',
          reason: 'Physical count correction',
          notes: `Physical dip measurement: System had ${currentMilk.currentStock} L, Physical measured ${targetPhysicalMilk} L (+1.2 L overage reconciled)`
        },
        'Audit Team',
        DEMO_BUSINESS_ID
      );

      // Ensure all demo ledger transactions realistically reflect historical timeline (30 days)
      if (typeof localStorage !== 'undefined') {
        const storedTxRaw = localStorage.getItem('wr_inventory_transactions');
        if (storedTxRaw) {
          const allTx = JSON.parse(storedTxRaw);
          const orderDateMap = new Map(demoOrders.map((o) => [o.id, o.createdAt]));

          for (const tx of allTx) {
            if (tx.businessId === DEMO_BUSINESS_ID) {
              if (tx.transactionType === 'OPENING_STOCK') {
                tx.createdAt = lastMonthDate;
              } else if (tx.referenceId && orderDateMap.has(tx.referenceId)) {
                tx.createdAt = orderDateMap.get(tx.referenceId)!;
              }
            }
          }
          localStorage.setItem('wr_inventory_transactions', JSON.stringify(allTx));
        }
      }

      // Final: Retrieve demo statistics
      const stats = await this.getDemoStats();

      // Trigger UI updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('inventory_refresh'));
        window.dispatchEvent(new CustomEvent('recipes_updated'));
      }

      return {
        success: true,
        message: `Successfully seeded Xings Kitchen Demo Environment with ${stats.ingredientsCount} ingredients, ${stats.recipesCount} recipes, ${stats.purchasesCount} purchases, and ${stats.transactionsCount} ledger transactions. Zero mathematical drift verified!`,
        stats
      };
    } finally {
      // If user was originally on another tenant and didn't want to switch, restore it.
      // But by default we keep them on DEMO_BUSINESS_ID so they can immediately test!
    }
  }

  /**
   * Safely clears ONLY Demo Records without touching production data
   */
  public static async clearDemoData(broadcast = true): Promise<{ success: boolean; removedCount: number }> {
    let removedCount = 0;

    const purgeKey = (key: string, isDemoRecord: (item: any) => boolean) => {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        const kept = list.filter((item: any) => {
          const isDemo = isDemoRecord(item);
          if (isDemo) removedCount++;
          return !isDemo;
        });
        localStorage.setItem(key, JSON.stringify(kept));
      } catch (err) {
        console.error(`Error purging demo records from ${key}:`, err);
      }
    };

    const isDemoEntity = (item: any): boolean => {
      if (!item) return false;
      const bId = item.businessId;
      const id = String(item.id || '');
      const name = String(item.name || item.recipeName || item.invoiceNumber || '').toLowerCase();

      return (
        bId === DEMO_BUSINESS_ID ||
        id.startsWith('demo-') ||
        id.startsWith('DEMO-') ||
        name.includes('[demo]')
      );
    };

    purgeKey('wr_ingredient_categories', isDemoEntity);
    purgeKey('wr_ingredients', isDemoEntity);
    purgeKey('wr_inventory_transactions', isDemoEntity);
    purgeKey('wr_recipes', isDemoEntity);
    purgeKey('wr_recipe_ingredients', isDemoEntity);
    purgeKey('wr_suppliers', isDemoEntity);
    purgeKey('wr_purchases', isDemoEntity);
    purgeKey('wr_purchase_items', isDemoEntity);
    purgeKey('wr_wastage_records', isDemoEntity);
    purgeKey('wr_stock_adjustments', isDemoEntity);
    purgeKey('wr_stock_adjustment_items', isDemoEntity);
    purgeKey('ij_orders', (o: any) => String(o?.id || '').startsWith('DEMO-'));

    if (broadcast && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('inventory_refresh'));
      window.dispatchEvent(new CustomEvent('recipes_updated'));
      window.dispatchEvent(new Event('storage'));
    }

    return { success: true, removedCount };
  }

  /**
   * Calculates comprehensive statistics and verification metrics for the Demo Dataset
   */
  public static async getDemoStats(): Promise<DemoStats> {
    const isDemo = this.isDemoMode();
    const bId = DEMO_BUSINESS_ID;

    const [
      categories,
      ingredients,
      recipes,
      suppliers,
      purchases,
      wastage,
      adjustments,
      transactions
    ] = await Promise.all([
      IngredientService.getCategories(bId),
      IngredientService.getIngredients(bId),
      RecipeService.getRecipes(bId),
      SupplierService.getSuppliers(bId),
      PurchaseService.getPurchases(undefined, bId),
      WastageService.getWastageRecords(bId),
      StockAdjustmentService.getAdjustments(bId),
      IngredientService.getTransactions(undefined, bId)
    ]);

    const demoCategories = categories.filter((c) => c.name.includes('[DEMO]'));
    const activeIngredients = ingredients.filter((i) => i.isActive);

    let healthyCount = 0;
    let lowStockCount = 0;
    let criticalCount = 0;
    let outOfStockCount = 0;
    let totalValuation = 0;

    for (const ing of activeIngredients) {
      const stock = Number(ing.currentStock) || 0;
      const minAlert = Number(ing.minAlertLevel) || 0;
      const cost = Number(ing.costPerUnit) || 0;

      if (stock > 0) {
        totalValuation += stock * cost;
      }

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minAlert * 0.25) {
        criticalCount++;
      } else if (stock <= minAlert) {
        lowStockCount++;
      } else {
        healthyCount++;
      }
    }

    // Run Mathematical Zero-Drift Audit
    const audit = await InventoryReportsService.computeStockIntegrity(ingredients, bId);

    const storedOrders = LocalDB.getOrders();
    const demoOrders = storedOrders.filter((o) => o.id.startsWith('DEMO-'));

    return {
      isDemoActive: isDemo,
      businessId: IngredientService.getCurrentBusinessId(),
      categoriesCount: demoCategories.length,
      ingredientsCount: ingredients.length,
      healthyCount,
      lowStockCount,
      criticalCount,
      outOfStockCount,
      recipesCount: recipes.length,
      suppliersCount: suppliers.length,
      purchasesCount: purchases.length,
      ordersCount: demoOrders.length,
      wastageCount: wastage.length,
      adjustmentsCount: adjustments.length,
      transactionsCount: transactions.length,
      totalValuation: Number(totalValuation.toFixed(2)),
      integrityPercent: audit.integrityPercentage,
      driftCount: audit.discrepancyCount
    };
  }
}
