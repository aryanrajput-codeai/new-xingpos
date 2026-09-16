// ====================================================================
// WEBRAJYA POS - RECIPE COSTING & AVAILABILITY ENGINE
// ====================================================================

import {
  Ingredient,
  Recipe,
  RecipeItem,
  RecipeItemDTO,
  IngredientCostCalculation,
  RecipeCostBreakdown,
  IngredientAvailabilityItem,
  RecipeAvailability
} from '../types/inventory';
import { MenuItem } from '../types';
import {
  SupportedUnit,
  isSupportedUnit,
  areUnitsCompatible,
  normalizeToBaseQuantity,
  normalizeCostToBaseUnit
} from './unitConversion';

export interface ValidatedRecipeItemInput {
  ingredientId: string;
  quantity: number;
  unit: SupportedUnit;
  wastePercentage?: number;
  notes?: string;
}

/**
 * Validates a single recipe item row against business and culinary rules
 */
export function validateRecipeItem(
  item: RecipeItemDTO,
  ingredient: Ingredient,
  existingIngredientIds: Set<string> = new Set()
): void {
  if (!item.ingredientId || !item.ingredientId.trim()) {
    throw new Error('Ingredient ID is required for each recipe item.');
  }

  if (existingIngredientIds.has(item.ingredientId)) {
    throw new Error(
      `Duplicate ingredient detected: '${ingredient?.name || item.ingredientId}' is already included in this recipe. Duplicate ingredients within the same recipe are not permitted.`
    );
  }

  if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
    throw new Error(
      `Invalid quantity '${item.quantity}' for ingredient '${ingredient?.name || item.ingredientId}'. Quantity must be a positive number greater than 0.`
    );
  }

  if (!isSupportedUnit(item.unit)) {
    throw new Error(
      `Unsupported unit '${item.unit}' for ingredient '${ingredient?.name || item.ingredientId}'. Supported units: g, kg, ml, l, pcs.`
    );
  }

  if (!isSupportedUnit(ingredient.unit)) {
    throw new Error(
      `Master ingredient '${ingredient.name}' has unsupported unit '${ingredient.unit}'.`
    );
  }

  if (!areUnitsCompatible(item.unit, ingredient.unit)) {
    throw new Error(
      `Incompatible unit conversion: Recipe specifies '${item.unit}', but ingredient '${ingredient.name}' is measured in '${ingredient.unit}'. Both must share the same dimension (e.g. weight, volume, or count).`
    );
  }

  const waste = item.wastePercentage !== undefined && item.wastePercentage !== null ? item.wastePercentage : 0;
  if (typeof waste !== 'number' || isNaN(waste) || waste < 0 || waste >= 100) {
    throw new Error(
      `Invalid wastage percentage '${waste}%' for ingredient '${ingredient?.name || item.ingredientId}'. Wastage must be >= 0% and < 100%.`
    );
  }
}

/**
 * Calculates the exact dynamic cost for a single recipe ingredient row
 */
export function calculateIngredientCost(
  item: {
    recipeItemId?: string;
    ingredientId: string;
    quantity: number;
    unit: string;
    wastePercentage?: number;
  },
  ingredient: Ingredient
): IngredientCostCalculation {
  if (!isSupportedUnit(item.unit)) {
    throw new Error(`Unsupported recipe unit: '${item.unit}'`);
  }
  if (!isSupportedUnit(ingredient.unit)) {
    throw new Error(`Unsupported ingredient unit: '${ingredient.unit}'`);
  }
  if (!areUnitsCompatible(item.unit, ingredient.unit)) {
    throw new Error(
      `Cannot calculate cost: Incompatible units between recipe '${item.unit}' and ingredient '${ingredient.unit}'.`
    );
  }

  const waste = Math.max(0, item.wastePercentage || 0);
  const wasteMultiplier = 1 + waste / 100;
  const effectiveQuantity = Math.round(item.quantity * wasteMultiplier * 10000) / 10000;

  // Normalize effective consumption to base unit (kg, l, pcs)
  const { baseQuantity, baseUnit } = normalizeToBaseQuantity(effectiveQuantity, item.unit);

  // Normalize master ingredient unit cost to base unit
  const { costPerBaseUnit } = normalizeCostToBaseUnit(
    Math.max(0, ingredient.costPerUnit || 0),
    ingredient.unit
  );

  // Calculate extended row cost
  const calculatedCost = Math.round(baseQuantity * costPerBaseUnit * 100) / 100;

  return {
    recipeItemId: item.recipeItemId,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    itemCode: ingredient.itemCode,
    specifiedQuantity: item.quantity,
    specifiedUnit: item.unit,
    wastePercentage: waste,
    effectiveQuantity,
    normalizedBaseQuantity: baseQuantity,
    baseUnit,
    costPerUnit: ingredient.costPerUnit,
    costPerBaseUnit,
    calculatedCost
  };
}

/**
 * Calculates complete recipe cost breakdown including labor, overhead, and margin analysis
 */
export function calculateRecipeCost(
  recipe: Omit<Partial<Recipe>, 'items'> & { items?: (RecipeItem | RecipeItemDTO)[] },
  ingredientsMap: Map<string, Ingredient> | Ingredient[],
  menuItemOrPrice?: MenuItem | number
): RecipeCostBreakdown {
  const map: Map<string, Ingredient> = ingredientsMap instanceof Map
    ? ingredientsMap
    : new Map(ingredientsMap.map((i) => [i.id, i]));

  const items = recipe.items || [];
  const calculatedItems: IngredientCostCalculation[] = [];
  let totalIngredientCost = 0;

  for (const item of items) {
    const ing = map.get(item.ingredientId);
    if (!ing) {
      continue;
    }
    const costData = calculateIngredientCost(item, ing);
    calculatedItems.push(costData);
    totalIngredientCost += costData.calculatedCost;
  }

  totalIngredientCost = Math.round(totalIngredientCost * 100) / 100;
  const laborCost = Math.max(0, recipe.laborCost || 0);
  const overheadCost = Math.max(0, recipe.overheadCost || 0);
  const totalRecipeCost = Math.round((totalIngredientCost + laborCost + overheadCost) * 100) / 100;

  const portionSize = recipe.portionSize && recipe.portionSize > 0 ? recipe.portionSize : 1;
  const costPerServing = Math.round((totalRecipeCost / portionSize) * 100) / 100;

  let foodCostPercentage: number | undefined;
  let grossMargin: number | undefined;
  let grossMarginPercentage: number | undefined;
  let sellingPrice: number | undefined;

  if (menuItemOrPrice !== undefined && menuItemOrPrice !== null) {
    sellingPrice = typeof menuItemOrPrice === 'number' ? menuItemOrPrice : (menuItemOrPrice as MenuItem).price;
    if (sellingPrice > 0) {
      foodCostPercentage = Math.round((costPerServing / sellingPrice) * 1000) / 10;
      grossMargin = Math.round((sellingPrice - costPerServing) * 100) / 100;
      grossMarginPercentage = Math.round((grossMargin / sellingPrice) * 1000) / 10;
    } else {
      foodCostPercentage = 0;
      grossMargin = -costPerServing;
      grossMarginPercentage = 0;
    }
  }

  return {
    recipeId: recipe.id,
    menuItemId: recipe.menuItemId || '',
    portionSize,
    totalIngredientCost,
    laborCost,
    overheadCost,
    totalRecipeCost,
    costPerServing,
    items: calculatedItems,
    sellingPrice,
    foodCostPercentage,
    grossMargin,
    grossMarginPercentage
  };
}

/**
 * Calculates real-time recipe availability based on the limiting ingredient stock
 */
export function calculateRecipeAvailability(
  recipe: Omit<Partial<Recipe>, 'items'> & { items?: (RecipeItem | RecipeItemDTO)[] },
  ingredientsMap: Map<string, Ingredient> | Ingredient[]
): RecipeAvailability {
  const map: Map<string, Ingredient> = ingredientsMap instanceof Map
    ? ingredientsMap
    : new Map(ingredientsMap.map((i) => [i.id, i]));

  const items = recipe.items || [];
  const portionSize = recipe.portionSize && recipe.portionSize > 0 ? recipe.portionSize : 1;

  if (items.length === 0) {
    return {
      recipeId: recipe.id,
      menuItemId: recipe.menuItemId || '',
      isAvailable: false,
      availableServings: 0,
      ingredientAvailabilities: []
    };
  }

  const ingredientAvailabilities: IngredientAvailabilityItem[] = [];
  let minServings = Infinity;
  let limitingItem: IngredientAvailabilityItem | null = null;

  for (const item of items) {
    const ing = map.get(item.ingredientId);
    if (!ing || !isSupportedUnit(item.unit) || !isSupportedUnit(ing.unit) || !areUnitsCompatible(item.unit, ing.unit)) {
      continue;
    }

    // Recipe requirement per single serving:
    const waste = Math.max(0, item.wastePercentage || 0);
    const wasteMultiplier = 1 + waste / 100;
    const requiredPerServing = (item.quantity / portionSize);
    const effectiveRequiredPerServing = requiredPerServing * wasteMultiplier;

    // Normalize required per serving to base unit
    const { baseQuantity: reqInBase, baseUnit } = normalizeToBaseQuantity(
      effectiveRequiredPerServing,
      item.unit
    );

    // Normalize live available stock to base unit
    const liveStock = Math.max(0, ing.currentStock || 0);
    const { baseQuantity: availInBase } = normalizeToBaseQuantity(liveStock, ing.unit);

    let maxServings = 0;
    if (reqInBase > 0) {
      if (availInBase <= 0) {
        maxServings = 0;
      } else {
        maxServings = Math.floor(availInBase / reqInBase);
      }
    } else {
      maxServings = Infinity;
    }

    const availItem: IngredientAvailabilityItem = {
      ingredientId: ing.id,
      ingredientName: ing.name,
      itemCode: ing.itemCode,
      currentStock: ing.currentStock,
      stockUnit: ing.unit,
      requiredPerServing: Math.round(requiredPerServing * 1000) / 1000,
      requiredUnit: item.unit,
      wastePercentage: waste,
      effectiveRequiredPerServing: Math.round(effectiveRequiredPerServing * 1000) / 1000,
      normalizedAvailableStock: availInBase,
      normalizedRequiredPerServing: reqInBase,
      baseUnit,
      maxServings: maxServings === Infinity ? 999999 : maxServings
    };

    ingredientAvailabilities.push(availItem);

    if (availItem.maxServings < minServings) {
      minServings = availItem.maxServings;
      limitingItem = availItem;
    }
  }

  const finalAvailableServings = minServings === Infinity || minServings < 0 ? 0 : minServings;

  return {
    recipeId: recipe.id,
    menuItemId: recipe.menuItemId || '',
    isAvailable: finalAvailableServings > 0,
    availableServings: finalAvailableServings,
    limitingIngredientId: limitingItem?.ingredientId,
    limitingIngredientName: limitingItem?.ingredientName,
    limitingIngredientStock: limitingItem?.currentStock,
    limitingIngredientUnit: limitingItem?.stockUnit,
    ingredientAvailabilities
  };
}
