// ====================================================================
// WEBRAJYA POS - RECIPE SERVICE
// Single Restaurant Architecture - Direct Supabase Source of Truth
// ====================================================================

import {
  Recipe,
  RecipeItem,
  RecipeItemDTO,
  CreateRecipeDTO,
  UpdateRecipeDTO,
  RecipeCostBreakdown,
  RecipeAvailability,
  Ingredient
} from '../types/inventory';
import { MenuItem } from '../types';
import { RBACService } from './rbac';
import { supabase } from './db';
import { IngredientService } from './ingredientService';
import {
  calculateRecipeCost,
  calculateRecipeAvailability,
  validateRecipeItem
} from './recipeCosting';

export const STORAGE_KEY_RECIPES = 'wr_recipes';
export const STORAGE_KEY_RECIPE_ITEMS = 'wr_recipe_items';

export class RecipeService {
  // Legacy stubs for backward compatibility
  public static getCurrentBusinessId(): string {
    return '';
  }

  public static setCurrentBusinessId(_id: string): void {}

  public static enforceTenantIsolation(_entityBusinessId?: string, _requestedBusinessId?: string): void {}

  public static checkViewPermission(): void {
    if (
      !RBACService.hasPermission('inventory.view') &&
      !RBACService.hasPermission('menu.view')
    ) {
      throw new Error("Unauthorized: Missing required permission 'inventory.view' or 'menu.view'.");
    }
  }

  public static checkManagePermission(): void {
    if (
      !RBACService.hasPermission('inventory.manage') &&
      !RBACService.hasPermission('menu.edit')
    ) {
      throw new Error("Unauthorized: Missing required permission 'inventory.manage' or 'menu.edit'.");
    }
  }

  // ====================================================================
  // DATABASE MAPPERS (Exact 8 columns for recipes, 8 for recipe_items)
  // ====================================================================

  public static mapDatabaseRecipe(row: any, items?: RecipeItem[]): Recipe {
    const servings = Number(row.servings ?? 1);
    return {
      id: row.id,
      menuItemId: row.menu_item_id,
      menu_item_id: row.menu_item_id,
      recipeName: row.recipe_name || '',
      recipe_name: row.recipe_name || '',
      servings,
      portionSize: servings,
      servingUnit: 'portion',
      notes: row.notes || '',
      preparationNotes: row.notes || '',
      laborCost: 0,
      overheadCost: 0,
      isActive: row.is_active ?? true,
      is_active: row.is_active ?? true,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      items: items || []
    };
  }

  public static mapDatabaseRecipeItem(row: any, ingredient?: Ingredient): RecipeItem {
    const wastage = Number(row.wastage_percent ?? 0);
    return {
      id: row.id,
      recipeId: row.recipe_id,
      recipe_id: row.recipe_id,
      ingredientId: row.ingredient_id,
      ingredient_id: row.ingredient_id,
      quantity: Number(row.quantity ?? 0),
      unit: row.unit || 'g',
      wastagePercent: wastage,
      wastage_percent: wastage,
      wastePercentage: wastage,
      notes: '',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      ingredient
    };
  }

  // ====================================================================
  // RECIPES QUERY & RETRIEVAL
  // ====================================================================

  public static async getRecipes(_businessId?: string): Promise<Recipe[]> {
    this.checkViewPermission();

    try {
      const [recipesRes, itemsRes, ingredientsRes] = await Promise.all([
        supabase.from('recipes').select('*').order('recipe_name', { ascending: true }),
        supabase.from('recipe_items').select('*'),
        IngredientService.getIngredients()
      ]);

      if (recipesRes.error) {
        console.warn('[RecipeService] getRecipes error:', recipesRes.error.message);
        const cached = localStorage.getItem(STORAGE_KEY_RECIPES);
        return cached ? JSON.parse(cached) : [];
      }

      const ingMap = new Map(ingredientsRes.map((i) => [i.id, i]));
      const rawItems = itemsRes.data || [];

      const itemsByRecipe = new Map<string, RecipeItem[]>();
      for (const rawItem of rawItems) {
        const item = this.mapDatabaseRecipeItem(rawItem, ingMap.get(rawItem.ingredient_id));
        if (!itemsByRecipe.has(rawItem.recipe_id)) {
          itemsByRecipe.set(rawItem.recipe_id, []);
        }
        itemsByRecipe.get(rawItem.recipe_id)!.push(item);
      }

      const recipes = (recipesRes.data || []).map((row) => {
        const items = itemsByRecipe.get(row.id) || [];
        return this.mapDatabaseRecipe(row, items);
      });

      localStorage.setItem(STORAGE_KEY_RECIPES, JSON.stringify(recipes));
      return recipes;
    } catch (e: any) {
      console.error('[RecipeService] getRecipes exception:', e);
      const cached = localStorage.getItem(STORAGE_KEY_RECIPES);
      return cached ? JSON.parse(cached) : [];
    }
  }

  public static async getRecipeById(id: string, _businessId?: string): Promise<Recipe | null> {
    this.checkViewPermission();

    const [recipeRes, itemsRes, ingredients] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', id).maybeSingle(),
      supabase.from('recipe_items').select('*').eq('recipe_id', id),
      IngredientService.getIngredients()
    ]);

    if (recipeRes.error) {
      console.error('[RecipeService] getRecipeById error:', recipeRes.error);
      throw new Error(`Failed to fetch recipe: ${recipeRes.error.message}`);
    }

    if (!recipeRes.data) return null;

    const ingMap = new Map(ingredients.map((i) => [i.id, i]));
    const items = (itemsRes.data || []).map((raw) =>
      this.mapDatabaseRecipeItem(raw, ingMap.get(raw.ingredient_id))
    );

    return this.mapDatabaseRecipe(recipeRes.data, items);
  }

  public static async getRecipeByMenuItemId(menuItemId: string, _businessId?: string): Promise<Recipe | null> {
    this.checkViewPermission();

    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .maybeSingle();

    if (error) {
      console.warn('[RecipeService] getRecipeByMenuItemId error:', error.message);
      return null;
    }

    if (!data) return null;
    return this.getRecipeById(data.id);
  }

  // ====================================================================
  // RECIPES MUTATION (CREATE, UPDATE, DELETE)
  // ====================================================================

  public static async createRecipe(dto: CreateRecipeDTO, _businessId?: string): Promise<Recipe> {
    this.checkManagePermission();

    if (!dto.menuItemId || !dto.menuItemId.trim()) {
      throw new Error('Menu Item ID is required to create a recipe.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new Error('A recipe must have at least one ingredient item.');
    }

    const servings = Math.max(1, Number(dto.servings || dto.portionSize || 1));
    const recipeName = dto.recipeName?.trim() || `Recipe for ${dto.menuItemId}`;

    const ingredients = await IngredientService.getIngredients();
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));
    const seenIngredients = new Set<string>();

    for (const item of dto.items) {
      const ing = ingMap.get(item.ingredientId);
      if (!ing) {
        throw new Error(`Ingredient with id '${item.ingredientId}' not found.`);
      }
      validateRecipeItem(item, ing, seenIngredients);
      seenIngredients.add(item.ingredientId);
    }

    const recipePayload = {
      menu_item_id: dto.menuItemId,
      recipe_name: recipeName,
      servings,
      is_active: dto.isActive !== undefined ? dto.isActive : true,
      notes: dto.notes || dto.preparationNotes || null
    };

    const { data: recipeRow, error: recipeErr } = await supabase
      .from('recipes')
      .insert(recipePayload)
      .select()
      .single();

    if (recipeErr) {
      console.error('[RecipeService] createRecipe insert recipe error:', recipeErr);
      throw new Error(`Database error creating recipe: ${recipeErr.message}`);
    }

    const itemRows = dto.items.map((it) => ({
      recipe_id: recipeRow.id,
      ingredient_id: it.ingredientId,
      quantity: it.quantity,
      unit: it.unit,
      wastage_percent: Math.max(0, Number(it.wastagePercent ?? it.wastePercentage ?? 0))
    }));

    const { data: createdItems, error: itemsErr } = await supabase
      .from('recipe_items')
      .insert(itemRows)
      .select();

    if (itemsErr) {
      console.error('[RecipeService] createRecipe insert items error:', itemsErr);
      await supabase.from('recipes').delete().eq('id', recipeRow.id);
      throw new Error(`Database error creating recipe items: ${itemsErr.message}`);
    }

    const recipeItems = (createdItems || []).map((raw) =>
      this.mapDatabaseRecipeItem(raw, ingMap.get(raw.ingredient_id))
    );

    const recipe = this.mapDatabaseRecipe(recipeRow, recipeItems);
    this.dispatchUpdateEvent('recipes_updated');
    return recipe;
  }

  public static async updateRecipe(id: string, dto: UpdateRecipeDTO, _businessId?: string): Promise<Recipe> {
    this.checkManagePermission();

    const existing = await this.getRecipeById(id);
    if (!existing) {
      throw new Error(`Recipe with id '${id}' not found.`);
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (dto.recipeName !== undefined) {
      updatePayload.recipe_name = dto.recipeName.trim();
    }
    if (dto.servings !== undefined || dto.portionSize !== undefined) {
      updatePayload.servings = Math.max(1, Number(dto.servings || dto.portionSize));
    }
    if (dto.notes !== undefined || dto.preparationNotes !== undefined) {
      updatePayload.notes = dto.notes || dto.preparationNotes || null;
    }
    if (dto.isActive !== undefined) {
      updatePayload.is_active = !!dto.isActive;
    }

    const { data: updatedRecipeRow, error: updateErr } = await supabase
      .from('recipes')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('[RecipeService] updateRecipe error:', updateErr);
      throw new Error(`Database error updating recipe: ${updateErr.message}`);
    }

    let recipeItems = existing.items || [];
    if (dto.items && dto.items.length > 0) {
      const ingredients = await IngredientService.getIngredients();
      const ingMap = new Map(ingredients.map((i) => [i.id, i]));
      const seen = new Set<string>();

      for (const it of dto.items) {
        const ing = ingMap.get(it.ingredientId);
        if (!ing) throw new Error(`Ingredient '${it.ingredientId}' not found.`);
        validateRecipeItem(it, ing, seen);
        seen.add(it.ingredientId);
      }

      await supabase.from('recipe_items').delete().eq('recipe_id', id);

      const itemRows = dto.items.map((it) => ({
        recipe_id: id,
        ingredient_id: it.ingredientId,
        quantity: it.quantity,
        unit: it.unit,
        wastage_percent: Math.max(0, Number(it.wastagePercent ?? it.wastePercentage ?? 0))
      }));

      const { data: newItems, error: itemsErr } = await supabase
        .from('recipe_items')
        .insert(itemRows)
        .select();

      if (itemsErr) {
        console.error('[RecipeService] updateRecipe insert items error:', itemsErr);
        throw new Error(`Database error updating recipe items: ${itemsErr.message}`);
      }

      recipeItems = (newItems || []).map((raw) =>
        this.mapDatabaseRecipeItem(raw, ingMap.get(raw.ingredient_id))
      );
    }

    const updated = this.mapDatabaseRecipe(updatedRecipeRow, recipeItems);
    this.dispatchUpdateEvent('recipes_updated');
    return updated;
  }

  public static async toggleRecipeActive(id: string, _businessId?: string): Promise<Recipe> {
    const existing = await this.getRecipeById(id);
    if (!existing) throw new Error(`Recipe '${id}' not found.`);
    return this.updateRecipe(id, { isActive: !existing.isActive });
  }

  public static async deleteRecipe(id: string, _businessId?: string): Promise<void> {
    this.checkManagePermission();

    await supabase.from('recipe_items').delete().eq('recipe_id', id);
    const { error } = await supabase.from('recipes').delete().eq('id', id);

    if (error) {
      console.error('[RecipeService] deleteRecipe error:', error);
      throw new Error(`Database error deleting recipe: ${error.message}`);
    }

    this.dispatchUpdateEvent('recipes_updated');
  }

  // ====================================================================
  // COSTING & AVAILABILITY
  // ====================================================================

  public static async getRecipeCostBreakdown(
    menuItemId: string,
    sellingPriceOrMenuItem?: number | MenuItem,
    _businessId?: string
  ): Promise<RecipeCostBreakdown | null> {
    this.checkViewPermission();

    const recipe = await this.getRecipeByMenuItemId(menuItemId);
    if (!recipe || !recipe.items || recipe.items.length === 0) return null;

    const price = typeof sellingPriceOrMenuItem === 'number'
      ? sellingPriceOrMenuItem
      : typeof sellingPriceOrMenuItem === 'object' && sellingPriceOrMenuItem !== null
      ? (sellingPriceOrMenuItem as any).price
      : undefined;

    const ingredients = await IngredientService.getIngredients();
    return calculateRecipeCost(recipe, ingredients, price);
  }

  public static async getRecipeAvailability(menuItemId: string, _businessId?: string): Promise<RecipeAvailability | null> {
    this.checkViewPermission();

    const recipe = await this.getRecipeByMenuItemId(menuItemId);
    if (!recipe || !recipe.items || recipe.items.length === 0) return null;

    const ingredients = await IngredientService.getIngredients();
    return calculateRecipeAvailability(recipe, ingredients);
  }

  public static async getRecipeCost(
    recipeIdOrRecipe: string | (Omit<Partial<Recipe>, 'items'> & { items?: (RecipeItem | RecipeItemDTO)[] }),
    _businessId?: string
  ): Promise<RecipeCostBreakdown | null> {
    this.checkViewPermission();

    if (typeof recipeIdOrRecipe === 'string') {
      let recipe = await this.getRecipeById(recipeIdOrRecipe);
      if (!recipe) {
        recipe = await this.getRecipeByMenuItemId(recipeIdOrRecipe);
      }
      if (!recipe || !recipe.items || recipe.items.length === 0) return null;
      const ingredients = await IngredientService.getIngredients();
      return calculateRecipeCost(recipe, ingredients);
    }

    const ingredients = await IngredientService.getIngredients();
    return calculateRecipeCost(recipeIdOrRecipe, ingredients);
  }

  public static async getMenuRecipeOverview(
    menuItemsOrBusinessId?: MenuItem[] | string,
    _businessId?: string
  ): Promise<{
    menuItemId: string;
    menuItem?: MenuItem;
    hasRecipe: boolean;
    recipe?: Recipe;
    costBreakdown?: RecipeCostBreakdown;
    availability?: RecipeAvailability;
  }[]> {
    this.checkViewPermission();

    const menuItems = Array.isArray(menuItemsOrBusinessId) ? menuItemsOrBusinessId : undefined;

    const [recipes, ingredients] = await Promise.all([
      this.getRecipes(),
      IngredientService.getIngredients()
    ]);

    const recipeMap = new Map<string, Recipe>();
    for (const r of recipes) {
      recipeMap.set(r.menuItemId, r);
    }

    const items = menuItems || [];
    if (items.length > 0) {
      return items.map((mItem) => {
        const recipe = recipeMap.get(mItem.id);
        const hasRecipe = !!recipe;
        const costBreakdown = recipe ? calculateRecipeCost(recipe, ingredients, mItem.price) : undefined;
        const availability = recipe ? calculateRecipeAvailability(recipe, ingredients) : undefined;
        return {
          menuItemId: mItem.id,
          menuItem: mItem,
          hasRecipe,
          recipe,
          costBreakdown,
          availability
        };
      });
    }

    const results = [];
    for (const [menuItemId, recipe] of recipeMap.entries()) {
      const costBreakdown = calculateRecipeCost(recipe, ingredients);
      const availability = calculateRecipeAvailability(recipe, ingredients);
      results.push({
        menuItemId,
        hasRecipe: true,
        recipe,
        costBreakdown,
        availability
      });
    }

    return results;
  }

  private static dispatchUpdateEvent(name: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(name));
      window.dispatchEvent(new Event('storage'));
    }
  }
}
