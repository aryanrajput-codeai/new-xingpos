import { supabase } from "../lib/db";
import { MenuItem } from "../types";

// Immediately clear any legacy menu caches on boot to prevent stale or mock data restoration
if (typeof window !== "undefined" && window.localStorage) {
  try {
    const legacyKeys = [
      "ij_menu_items",
      "ij_menu",
      "idli_menu",
      "menu_items_cache",
      "products_cache",
      "cached_menu",
      "local_menu_items"
    ];
    legacyKeys.forEach(k => {
      if (localStorage.getItem(k) !== null) {
        localStorage.removeItem(k);
      }
    });
  } catch (e) {
    // Ignore storage errors in private browsing
  }
}

// In-memory memory-only store of verified live items from Supabase
let liveMenuItemsCache: MenuItem[] | null = null;

// Category icons map for The Xings Kitchen
export const CATEGORY_ICONS: Record<string, string> = {
  "Soup": "🥣",
  "Crispy Starter": "🥢",
  "Starter": "🥗",
  "Rolls": "🌯",
  "Veg Rice": "🍚",
  "Veg Noodles": "🍜",
  "Combo": "🍱"
};

/**
 * Normalizes raw Supabase database row from public.menu_items
 * strictly according to the STEP 3 data normalization rules.
 */
export function normalizeMenuItem(raw: any): MenuItem {
  const sellingPrice = Number(raw.price != null ? raw.price : (raw.category?.toLowerCase() === "soup" ? 49 : 99));
  
  // Original price defaults according to business rule:
  // Soup: original_price = 99, others = 199
  let origPrice: number | undefined = undefined;
  if (raw.original_price != null && !isNaN(Number(raw.original_price))) {
    origPrice = Number(raw.original_price);
  } else if (raw.category?.toLowerCase() === "soup") {
    origPrice = 99;
  } else {
    origPrice = 199;
  }

  // Discount price
  let discPrice = sellingPrice;
  if (raw.discount_price != null && !isNaN(Number(raw.discount_price))) {
    discPrice = Number(raw.discount_price);
  }

  // Display name priority: name || item_name
  const displayName = String(raw.name || raw.item_name || "Unnamed Dish").trim();

  // Clean image resolution: image_url || image || null (NO fake URLs generated)
  const resolvedImage = raw.image_url || raw.image || null;

  return {
    id: String(raw.id),
    name: displayName,
    itemName: String(raw.item_name || raw.name || displayName),
    price: sellingPrice,
    originalPrice: origPrice,
    discountPrice: discPrice,
    category: String(raw.category || "General").trim(),
    description: String(raw.description || "").trim(),
    isVeg: raw.is_veg !== undefined && raw.is_veg !== null ? !!raw.is_veg : true,
    isBestseller: !!raw.is_bestseller,
    isChefSpecial: !!raw.is_chef_special,
    image: resolvedImage,
    imageUrl: resolvedImage,
    spiciness: Number(raw.spiciness || 0),
    rating: Number(raw.rating != null ? raw.rating : 4.5),
    ratingCount: Number(raw.rating_count != null ? raw.rating_count : 10),
    itemCode: raw.item_code || `XING-${String(raw.id).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`,
    available: raw.available !== false && raw.is_available !== false,
    gstPercent: 0,
    hsnCode: "2106"
  };
}

/**
 * Generate a consistent text-based ID for new items
 */
export function generateMenuItemId(name: string, category: string): string {
  const catPrefix = category.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30);
  return `${catPrefix}-${nameSlug}-${Date.now().toString().slice(-4)}`;
}

/**
 * THE CENTRAL MENU SERVICE
 * Strictly connected to Supabase public.menu_items
 * NEVER returns hardcoded, mock, or fallback menu data.
 */
export const MenuService = {
  /**
   * Fetch all live menu items directly from Supabase public.menu_items
   * Orders by category, then name.
   */
  async getMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("[MenuService] Failed to fetch menu items from Supabase:", error);
      throw new Error(`Unable to load menu from Supabase: ${error.message}`);
    }

    if (!data || !Array.isArray(data)) {
      liveMenuItemsCache = [];
      return [];
    }

    const normalized = data.map(normalizeMenuItem);
    liveMenuItemsCache = normalized;

    // Trigger local listeners
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("live_menu_updated", { detail: normalized }));
    }

    return normalized;
  },

  /**
   * Get in-memory cached live items if available (never uses localStorage)
   */
  getLiveMenuItemsSync(): MenuItem[] {
    return liveMenuItemsCache || [];
  },

  /**
   * Fetch single menu item by ID from public.menu_items
   */
  async getMenuItemById(id: string): Promise<MenuItem | null> {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(`[MenuService] Failed to fetch item ${id}:`, error);
      throw error;
    }

    if (!data) return null;
    return normalizeMenuItem(data);
  },

  /**
   * Get unique dynamic categories directly from Supabase items
   */
  async getMenuCategories(): Promise<string[]> {
    try {
      const items = await this.getMenuItems();
      const categoriesSet = new Set<string>();
      items.forEach(item => {
        if (item.category && item.category.trim()) {
          categoriesSet.add(item.category.trim());
        }
      });
      return Array.from(categoriesSet);
    } catch (e) {
      // If error occurs, propagate to let UI show retry
      throw e;
    }
  },

  /**
   * Create a new menu item in Supabase public.menu_items
   */
  async createMenuItem(data: Partial<MenuItem>): Promise<MenuItem> {
    const id = data.id?.trim() || generateMenuItemId(data.name || "item", data.category || "starter");
    const name = data.name?.trim() || "New Dish";
    const category = data.category?.trim() || "Starter";
    const price = Number(data.price != null ? data.price : (category.toLowerCase() === "soup" ? 49 : 99));
    const originalPrice = data.originalPrice != null ? Number(data.originalPrice) : (category.toLowerCase() === "soup" ? 99 : 199);
    const discountPrice = data.discountPrice != null ? Number(data.discountPrice) : price;

    const payload: any = {
      id,
      name,
      item_name: data.itemName?.trim() || name,
      price,
      original_price: originalPrice,
      discount_price: discountPrice,
      category,
      description: data.description?.trim() || null,
      is_veg: data.isVeg !== undefined ? !!data.isVeg : true,
      is_bestseller: !!data.isBestseller,
      is_chef_special: !!data.isChefSpecial,
      image: data.imageUrl || data.image || null,
      image_url: data.imageUrl || data.image || null,
      spiciness: Number(data.spiciness || 0),
      rating: Number(data.rating != null ? data.rating : 4.5),
      rating_count: Number(data.ratingCount != null ? data.ratingCount : 10)
    };

    console.log("[MenuService] Creating menu item in Supabase:", payload);

    const { data: inserted, error } = await supabase
      .from("menu_items")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("[MenuService] Insert error:", error);
      throw new Error(`Failed to create item in Supabase: ${error.message}`);
    }

    const item = normalizeMenuItem(inserted);

    // Update in-memory cache
    if (liveMenuItemsCache) {
      liveMenuItemsCache = [item, ...liveMenuItemsCache];
    }

    this.notifyMenuChange();
    return item;
  },

  /**
   * Update an existing menu item in Supabase public.menu_items
   */
  async updateMenuItem(id: string, data: Partial<MenuItem>): Promise<MenuItem> {
    const updatePayload: any = {};

    if (data.name !== undefined) {
      updatePayload.name = data.name.trim();
      if (!data.itemName) {
        updatePayload.item_name = data.name.trim();
      }
    }
    if (data.itemName !== undefined) updatePayload.item_name = data.itemName.trim();
    if (data.price !== undefined) updatePayload.price = Number(data.price);
    if (data.originalPrice !== undefined) updatePayload.original_price = Number(data.originalPrice);
    if (data.discountPrice !== undefined) updatePayload.discount_price = Number(data.discountPrice);
    if (data.category !== undefined) updatePayload.category = data.category.trim();
    if (data.description !== undefined) updatePayload.description = data.description.trim() || null;
    if (data.isVeg !== undefined) updatePayload.is_veg = !!data.isVeg;
    if (data.isBestseller !== undefined) updatePayload.is_bestseller = !!data.isBestseller;
    if (data.isChefSpecial !== undefined) updatePayload.is_chef_special = !!data.isChefSpecial;
    if (data.imageUrl !== undefined || data.image !== undefined) {
      const img = data.imageUrl || data.image || null;
      updatePayload.image = img;
      updatePayload.image_url = img;
    }
    if (data.spiciness !== undefined) updatePayload.spiciness = Number(data.spiciness);
    if (data.rating !== undefined) updatePayload.rating = Number(data.rating);
    if (data.ratingCount !== undefined) updatePayload.rating_count = Number(data.ratingCount);

    console.log(`[MenuService] Updating item ${id} in Supabase:`, updatePayload);

    const { data: updated, error } = await supabase
      .from("menu_items")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`[MenuService] Update error for ${id}:`, error);
      throw new Error(`Failed to update item in Supabase: ${error.message}`);
    }

    const item = normalizeMenuItem(updated);

    // Update in-memory cache
    if (liveMenuItemsCache) {
      liveMenuItemsCache = liveMenuItemsCache.map(i => i.id === id ? item : i);
    }

    this.notifyMenuChange();
    return item;
  },

  /**
   * Delete a menu item by ID from Supabase public.menu_items
   */
  async deleteMenuItem(id: string): Promise<void> {
    console.log(`[MenuService] Deleting item ${id} from Supabase...`);

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`[MenuService] Delete error for ${id}:`, error);
      throw new Error(`Failed to delete item from Supabase: ${error.message}`);
    }

    // Update in-memory cache
    if (liveMenuItemsCache) {
      liveMenuItemsCache = liveMenuItemsCache.filter(i => i.id !== id);
    }

    this.notifyMenuChange();
  },

  /**
   * Permanently delete all items from public.menu_items
   */
  async deleteAllMenuItems(): Promise<void> {
    console.log("[MenuService] Deleting all items from public.menu_items...");

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .neq("id", "___NEVER_MATCH___");

    if (error) {
      console.error("[MenuService] Delete all error:", error);
      throw new Error(`Failed to clear menu in Supabase: ${error.message}`);
    }

    liveMenuItemsCache = [];
    this.notifyMenuChange();
  },

  /**
   * Broadcast menu change to all tabs and component listeners
   */
  notifyMenuChange(): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("menu_updated"));
      window.dispatchEvent(new Event("storage"));
    }
  }
};

export default MenuService;
