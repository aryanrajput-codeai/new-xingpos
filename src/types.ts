export interface MenuItem {
  id: string;
  itemCode?: string;
  category: string;
  name: string;
  itemName?: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPrice?: number;
  isVeg: boolean;
  imageUrl?: string | null;
  image?: string | null;
  rating: number;
  ratingCount: number;
  isBestseller: boolean;
  isChefSpecial: boolean;
  spiciness: number;
  gstPercent?: number;
  hsnCode?: string;
  available?: boolean;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  customization?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon name or emoji
  description: string;
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  date: string;
  comment: string;
  avatar: string;
}

export type KOTStatus = "New Order" | "Accepted" | "Preparing" | "Ready" | "Served" | "Cancelled";

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  customization?: string;
  addedAt?: string;
  addedBy?: string;
  kotNumber?: string;
  sessionNumber?: number;
}

export interface KOT {
  id: string; // Format: KOT-0001, etc.
  orderId: string;
  tableNumber: string;
  customerName: string;
  orderType: "dine-in" | "takeaway" | "delivery";
  status: KOTStatus;
  specialInstructions: string;
  createdAt: string;
  preparationTime: number; // Duration in minutes to prepare
  printed?: boolean; // Tracking thermal/POS ticket layout generation
  items: {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    customization?: string;
  }[];
  isAddOn?: boolean;
}

export interface RestaurantTable {
  id: string;
  tableNumber: string;
  capacity: number;
  seatingArea: string;
  status: "Available" | "Occupied" | "Reserved" | "Service Required";
}

export interface PrinterEmulatorLog {
  id: string;
  kotId: string;
  kotNumber: string;
  restaurantId: string;
  receiptText: string;
  printStatus: "Pending" | "Printing" | "Printed" | "Failed";
  createdAt: string;
}
