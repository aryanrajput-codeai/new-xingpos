/**
 * The Xings Kitchen - Operational Feature Flags & Toggles Engine
 * Centralizes all toggleable features across the POS and Customer Ordering Experience.
 */

export interface FeatureFlagItem {
  id: string;
  name: string;
  category: "ordering" | "kitchen" | "pos" | "guest";
  description: string;
  enabled: boolean;
  iconName: string;
  badge?: string;
}

export interface FeatureFlags {
  onlineOrdering: boolean;
  tableQrOrdering: boolean;
  autoPrintKot: boolean;
  soundAlerts: boolean;
  autoAcceptOrders: boolean;
  promoCoupons: boolean;
  deliveryMode: boolean;
  takeawayMode: boolean;
  inventoryTracking: boolean;
  customerFeedback: boolean;
  tableFloorplan: boolean;
  doubleSidedReceipts: boolean;
  liveKotMonitor: boolean;
  taxGstCalculation: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  onlineOrdering: true,
  tableQrOrdering: true,
  autoPrintKot: true,
  soundAlerts: true,
  autoAcceptOrders: false,
  promoCoupons: true,
  deliveryMode: true,
  takeawayMode: true,
  inventoryTracking: true,
  customerFeedback: true,
  tableFloorplan: true,
  doubleSidedReceipts: true,
  liveKotMonitor: true,
  taxGstCalculation: false,
};

export const FEATURE_METADATA: Record<keyof FeatureFlags, {
  name: string;
  category: "ordering" | "kitchen" | "pos" | "guest";
  description: string;
  icon: string;
  badge?: string;
}> = {
  onlineOrdering: {
    name: "Online Customer Ordering",
    category: "ordering",
    description: "Allow guests to place orders via mobile & desktop web ordering portal",
    icon: "Globe",
    badge: "Core Service"
  },
  tableQrOrdering: {
    name: "Table QR Self-Ordering",
    category: "ordering",
    description: "Enable dine-in guests to scan physical QR codes and order directly from their table",
    icon: "QrCode",
    badge: "Dine-In"
  },
  autoPrintKot: {
    name: "Automatic KOT Printing",
    category: "kitchen",
    description: "Instantly send kitchen order tickets and customer bills to thermal printers upon arrival",
    icon: "Printer",
    badge: "Hardware"
  },
  soundAlerts: {
    name: "Audible Order Chime Alerts",
    category: "pos",
    description: "Sound an alert chime when a new customer order or KOT arrives",
    icon: "Bell",
    badge: "Audio"
  },
  autoAcceptOrders: {
    name: "Instant Order Auto-Accept",
    category: "kitchen",
    description: "Automatically accept incoming orders without manual cashier confirmation",
    icon: "Zap",
    badge: "Automation"
  },
  promoCoupons: {
    name: "Promo Coupons & Discounts",
    category: "guest",
    description: "Allow customers to apply promotional discount codes during checkout",
    icon: "Ticket",
    badge: "Marketing"
  },
  deliveryMode: {
    name: "Home Delivery Orders",
    category: "ordering",
    description: "Accept doorstep delivery orders with address verification and delivery fees",
    icon: "Truck",
    badge: "Logistics"
  },
  takeawayMode: {
    name: "Express Takeaway Pickup",
    category: "ordering",
    description: "Enable counter self-pickup orders for on-the-go patrons",
    icon: "ShoppingBag",
    badge: "Express"
  },
  inventoryTracking: {
    name: "Ingredient Inventory Alerts",
    category: "pos",
    description: "Track raw material consumption and show alerts when ingredient stock falls low",
    icon: "Boxes",
    badge: "Stock"
  },
  customerFeedback: {
    name: "Guest Reviews & Ratings",
    category: "guest",
    description: "Collect culinary reviews, star ratings, and guest feedback for the menu",
    icon: "Star",
    badge: "Reputation"
  },
  tableFloorplan: {
    name: "Interactive Table Floorplan",
    category: "pos",
    description: "Enable visual dining hall floorplan with table occupancy and seating status",
    icon: "LayoutGrid",
    badge: "Floor"
  },
  doubleSidedReceipts: {
    name: "Double-Sided Thermal Print",
    category: "kitchen",
    description: "Print outlet addresses and policies on the reverse side of 80mm bills",
    icon: "FileText",
    badge: "Thermal"
  },
  liveKotMonitor: {
    name: "Live Kitchen Monitor (KDS)",
    category: "kitchen",
    description: "Display live digital tickets with preparation timers on kitchen display screens",
    icon: "Flame",
    badge: "Kitchen"
  },
  taxGstCalculation: {
    name: "Tax & Compliance Settings",
    category: "pos",
    description: "Tax exemption mode active across all order channels",
    icon: "Receipt",
    badge: "Taxation"
  },
};

const STORAGE_KEY = "xings_feature_flags";

export class FeatureFlagsManager {
  static getFlags(): FeatureFlags {
    if (typeof window === "undefined") return { ...DEFAULT_FEATURE_FLAGS };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FEATURE_FLAGS));
        return { ...DEFAULT_FEATURE_FLAGS };
      }
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_FEATURE_FLAGS,
        ...parsed,
      };
    } catch {
      return { ...DEFAULT_FEATURE_FLAGS };
    }
  }

  static isEnabled(feature: keyof FeatureFlags): boolean {
    const flags = this.getFlags();
    return Boolean(flags[feature]);
  }

  static setFlag(feature: keyof FeatureFlags, enabled: boolean): FeatureFlags {
    const current = this.getFlags();
    const updated = {
      ...current,
      [feature]: enabled,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("xings-features-changed", { detail: updated }));
    } catch (err) {
      console.error("Failed to save feature flags:", err);
    }
    return updated;
  }

  static resetToDefaults(): FeatureFlags {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FEATURE_FLAGS));
      window.dispatchEvent(new CustomEvent("xings-features-changed", { detail: DEFAULT_FEATURE_FLAGS }));
    } catch (err) {
      console.error("Failed to reset feature flags:", err);
    }
    return { ...DEFAULT_FEATURE_FLAGS };
  }

  static setAll(enabled: boolean): FeatureFlags {
    const updated = Object.keys(DEFAULT_FEATURE_FLAGS).reduce((acc, key) => {
      acc[key as keyof FeatureFlags] = enabled;
      return acc;
    }, {} as FeatureFlags);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("xings-features-changed", { detail: updated }));
    } catch (err) {
      console.error("Failed to set all feature flags:", err);
    }
    return updated;
  }
}
