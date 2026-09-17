import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Plus, Search, Calculator, Shield, ShieldAlert, KeyRound, 
  Trash2, Edit3, ClipboardList, CheckCircle, FileText, ShoppingCart, 
  Percent, ArrowRight, User, Phone, MapPin, Sparkles, Hash, Layers,
  Printer, AlertCircle, RefreshCw, X, ArrowRightLeft, Receipt,
  Landmark, Lock, Clock, Banknote
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LocalDB, Order, Coupon, InventoryItem, AuditLog, RestaurantSettings } from "../lib/db";
import { MenuItem, RestaurantTable, Category, Shift, ShiftFinancials, StaffMember, PermissionKey, ManagerOverrideContext } from "../types";
import { PhysicalThermalPrinter, getWRPrinterSettings } from "../lib/printerService";
import { RBACService } from "../lib/rbac";
import TransferTableModal from "./TransferTableModal";
import { SplitBillModal } from "./SplitBillModal";
import { ShiftManagementModal } from "./ShiftManagementModal";
import { ShiftHistoryModal } from "./ShiftHistoryModal";
import ManagerOverrideModal from "./ManagerOverrideModal";
import StaffQuickSwitchModal from "./StaffQuickSwitchModal";

interface PosBillingPortalProps {
  menuItems: MenuItem[];
  orders: Order[];
  tables: RestaurantTable[];
  settings: RestaurantSettings;
  coupons: Coupon[];
  onOrderPlaced: () => void;
  setShowBillPrint: (order: Order | null) => void;
}

interface CartItem {
  id: string; // "item-" + id or "manual-" + timestamp
  name: string;
  price: number;
  quantity: number;
  customization?: string;
  isManual: boolean;
  category?: string;
  gstRate: number; // e.g. 5, 12, 18, 28
  discount: number; // item-level discount percentage (0 to 100)
  hsnCode?: string;
}

export default function PosBillingPortal({
  menuItems,
  orders,
  tables,
  settings,
  coupons,
  onOrderPlaced,
  setShowBillPrint
}: PosBillingPortalProps) {
  // POS Tabs: "register" (Active POS Cart) or "reports" (Performance Analytics Ledger)
  const [posTab, setPosTab] = useState<"register" | "reports">("register");

  // Staff Operator & Role State
  const [activeStaff, setActiveStaff] = useState<StaffMember>(() => RBACService.getActiveStaff());
  const [showStaffSwitchModal, setShowStaffSwitchModal] = useState(false);
  const currentRole = (activeStaff.role === "Owner" ? "Owner" : activeStaff.role === "Manager" ? "Manager" : "Cashier") as "Owner" | "Manager" | "Cashier";

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  
  // Order Configuration State
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway" | "delivery">("dine-in");
  const [selectedTable, setSelectedTable] = useState("");
  const [posPaymentStatus, setPosPaymentStatus] = useState<"Paid" | "Pending">("Paid");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [printNotice, setPrintNotice] = useState<{
    type: "success" | "warning";
    message: string;
    details?: string;
    order: Order;
  } | null>(null);

  // Table Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourceTable, setTransferSourceTable] = useState<string | null>(null);
  const [transferSourceOrder, setTransferSourceOrder] = useState<Order | null>(null);

  // Split Bill & Settlement Modal State
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitTargetOrder, setSplitTargetOrder] = useState<Order | null>(null);

  // Shift Management & Cash Reconciliation State
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showShiftHistoryModal, setShowShiftHistoryModal] = useState(false);
  const [activeShift, setActiveShift] = useState<Shift | null>(() => LocalDB.getActiveShift());
  const [shiftFinancials, setShiftFinancials] = useState<ShiftFinancials | null>(() => {
    const s = LocalDB.getActiveShift();
    if (s) {
      try {
        return LocalDB.calculateShiftFinancials(s.id);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const reloadShiftData = useCallback(() => {
    const s = LocalDB.getActiveShift();
    setActiveShift(s);
    if (s) {
      try {
        setShiftFinancials(LocalDB.calculateShiftFinancials(s.id));
      } catch (e) {
        setShiftFinancials(null);
      }
    } else {
      setShiftFinancials(null);
    }
  }, []);

  useEffect(() => {
    // Listen for storage events for shifts and payments
    const handleStorageChange = () => {
      reloadShiftData();
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("shifts_updated", handleStorageChange);
    window.addEventListener("shift_opened", handleStorageChange);
    window.addEventListener("shift_closed", handleStorageChange);
    window.addEventListener("shift_reopened", handleStorageChange);
    window.addEventListener("cash_adjustments_updated", handleStorageChange);
    window.addEventListener("payments_updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("shifts_updated", handleStorageChange);
      window.removeEventListener("shift_opened", handleStorageChange);
      window.removeEventListener("shift_closed", handleStorageChange);
      window.removeEventListener("shift_reopened", handleStorageChange);
      window.removeEventListener("cash_adjustments_updated", handleStorageChange);
      window.removeEventListener("payments_updated", handleStorageChange);
    };
  }, [reloadShiftData]);

  const activeOrderForSelectedTable = useMemo(() => {
    if (orderType !== "dine-in" || !selectedTable) return null;
    return orders.find(o => 
      o.orderType === "dine-in" && 
      o.tableNumber === selectedTable && 
      o.paymentStatus !== "Paid" && 
      o.orderStatus !== "Cancelled"
    );
  }, [orderType, selectedTable, orders]);

  // Search & Filters for Regular Items Catalog
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Modals Toggles
  const [showManualModal, setShowManualModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  // Manual Item Form States
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState("General");
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualPrice, setManualPrice] = useState("");
  const [manualGstRate, setManualGstRate] = useState(5);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [manualHsnCode, setManualHsnCode] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualFormErrors, setManualFormErrors] = useState<string[]>([]);

  // Manager Override security workflow context
  const [overrideContext, setOverrideContext] = useState<ManagerOverrideContext | null>(null);

  // Item inline editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState("");
  const [editDiscountVal, setEditDiscountVal] = useState("");

  // Filter menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.itemCode?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      return matchesSearch && matchesCategory && item.available !== false;
    });
  }, [menuItems, searchQuery, activeCategory]);

  // Categories list derived from menu
  const categories = useMemo(() => {
    const list = new Set(menuItems.map(i => i.category));
    return ["All", ...Array.from(list)];
  }, [menuItems]);

  // Math Calculations for current Register Cart
  const cartTotals = useMemo(() => {
    let rawSubtotal = 0;
    let totalDiscount = 0;
    let totalGst = 0;

    cart.forEach(item => {
      const itemBase = item.price * item.quantity;
      const itemDiscountAmount = itemBase * (item.discount / 100);
      const itemDiscountedBase = itemBase - itemDiscountAmount;
      const itemGst = itemDiscountedBase * (item.gstRate / 100);

      rawSubtotal += itemBase;
      totalDiscount += itemDiscountAmount;
      totalGst += itemGst;
    });

    // Global coupon discount
    let couponDiscountAmount = 0;
    if (appliedCoupon) {
      const currentSubtotal = rawSubtotal - totalDiscount;
      if (appliedCoupon.type === "percentage") {
        couponDiscountAmount = Math.round(currentSubtotal * (appliedCoupon.value / 100));
      } else {
        couponDiscountAmount = Math.min(appliedCoupon.value, currentSubtotal);
      }
    }

    const packagingCharge = orderType === "dine-in" ? 0 : 25;
    const finalSubtotal = rawSubtotal - totalDiscount;
    const finalGrandTotal = Math.max(0, Math.round(finalSubtotal + totalGst + packagingCharge - couponDiscountAmount));

    return {
      subtotal: rawSubtotal,
      itemDiscounts: totalDiscount,
      couponDiscount: couponDiscountAmount,
      gst: Math.round(totalGst),
      packaging: packagingCharge,
      grandTotal: finalGrandTotal
    };
  }, [cart, appliedCoupon, orderType]);

  // Handle adding regular menu items to cart
  const handleAddRegularToCart = (item: MenuItem) => {
    // Check if item already exists in cart
    const existing = cart.find(c => c.id === `reg-${item.id}`);
    if (existing) {
      setCart(prev => prev.map(c => c.id === `reg-${item.id}` ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      const newItem: CartItem = {
        id: `reg-${item.id}`,
        name: item.name,
        price: item.price,
        quantity: 1,
        isManual: false,
        category: item.category,
        gstRate: item.gstPercent || settings.gstPercentage || 5,
        discount: 0,
        hsnCode: item.hsnCode || "2106"
      };
      setCart(prev => [...prev, newItem]);
    }
  };

  // Validate and submit manual billing item
  const handleAddManualItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!manualName.trim()) {
      errors.push("Culinary Item Name is strictly required.");
    }
    const parsedPrice = parseFloat(manualPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      errors.push("Unit Price must be a valid number greater than zero.");
    }
    if (manualQuantity < 1) {
      errors.push("Quantity must be at least 1.");
    }
    if (manualDiscount < 0 || manualDiscount > 100) {
      errors.push("Discount percentage must be between 0% and 100%.");
    }

    if (errors.length > 0) {
      setManualFormErrors(errors);
      return;
    }

    const performAdd = () => {
      const newItem: CartItem = {
        id: `manual-${Date.now()}`,
        name: manualName.trim(),
        price: parsedPrice,
        quantity: manualQuantity,
        isManual: true,
        category: manualCategory,
        gstRate: manualGstRate,
        discount: manualDiscount,
        hsnCode: manualHsnCode.trim() || "9963", // standard F&B service code
        customization: manualNotes.trim() || undefined
      };

      setCart(prev => [...prev, newItem]);
      LocalDB.addAuditLog(
        "Manual Item Added to POS Cart", 
        `Added manual item: "${manualName}" @ ₹${parsedPrice} x${manualQuantity} (GST: ${manualGstRate}%, Disc: ${manualDiscount}%)`, 
        `POS (${activeStaff.name} - ${activeStaff.role})`
      );

      // Close modal and reset
      setShowManualModal(false);
      setManualName("");
      setManualQuantity(1);
      setManualPrice("");
      setManualGstRate(5);
      setManualDiscount(0);
      setManualHsnCode("");
      setManualNotes("");
      setManualFormErrors([]);
    };

    // Check RBAC permission for adding manual items
    executeWithPermission(
      "pos.manual_item",
      {
        actionType: "add_manual",
        title: "Manual Culinary Item Authorization",
        description: `Authorization required to add non-catalog open item "${manualName}" (₹${parsedPrice})`,
        targetName: manualName,
        newValue: parsedPrice
      },
      performAdd
    );
  };

  // Handle quantity adjustment
  const handleAdjustQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  // RBAC Permission verification helper
  const executeWithPermission = (
    permission: PermissionKey,
    context: {
      actionType: ManagerOverrideContext["actionType"];
      title: string;
      description?: string;
      targetId?: string;
      targetName?: string;
      originalValue?: any;
      newValue?: any;
    },
    successCallback: () => void
  ) => {
    if (RBACService.can(activeStaff, permission)) {
      successCallback();
    } else {
      setOverrideContext({
        actionType: context.actionType,
        requiredPermission: permission,
        title: context.title,
        description: context.description || `Action requires higher permission level than '${activeStaff.role}'`,
        targetId: context.targetId,
        targetName: context.targetName,
        originalValue: context.originalValue,
        newValue: context.newValue,
        onSuccess: successCallback
      });
      setShowOverrideModal(true);
    }
  };

  // Handle manual/normal item price modifier
  const handleUpdatePrice = (id: string, newPriceStr: string) => {
    const val = parseFloat(newPriceStr);
    if (isNaN(val) || val <= 0) return;

    const targetItem = cart.find(c => c.id === id);
    if (!targetItem) return;

    executeWithPermission(
      "pos.edit_price",
      {
        actionType: "edit_price",
        title: "Unit Price Override Authorization",
        description: `Modify price for "${targetItem.name}" from ₹${targetItem.price} to ₹${val}`,
        targetId: id,
        targetName: targetItem.name,
        originalValue: targetItem.price,
        newValue: val
      },
      () => {
        setCart(prev => prev.map(item => item.id === id ? { ...item, price: val } : item));
        LocalDB.addAuditLog(
          "POS Price Override",
          `Overrode unit price for "${targetItem.name}" from ₹${targetItem.price} to ₹${val}`,
          `POS (${activeStaff.name} - ${activeStaff.role})`
        );
        setEditingItemId(null);
      }
    );
  };

  // Handle discount override
  const handleUpdateDiscount = (id: string, newDiscStr: string) => {
    const val = parseInt(newDiscStr, 10);
    if (isNaN(val) || val < 0 || val > 100) return;

    const targetItem = cart.find(c => c.id === id);
    if (!targetItem) return;

    executeWithPermission(
      "pos.apply_discount",
      {
        actionType: "edit_discount",
        title: "Item Discount Authorization",
        description: `Apply ${val}% item-level discount on "${targetItem.name}"`,
        targetId: id,
        targetName: targetItem.name,
        originalValue: targetItem.discount,
        newValue: val
      },
      () => {
        setCart(prev => prev.map(item => item.id === id ? { ...item, discount: val } : item));
        LocalDB.addAuditLog(
          "POS Item Discount Overridden",
          `Overrode item-level discount for "${targetItem.name}" to ${val}%`,
          `POS (${activeStaff.name} - ${activeStaff.role})`
        );
        setEditingItemId(null);
      }
    );
  };

  // Handle manual / regular item removal (Void)
  const handleRemoveFromCart = (id: string) => {
    const targetItem = cart.find(c => c.id === id);
    if (!targetItem) return;

    executeWithPermission(
      "pos.void_item",
      {
        actionType: "delete_item",
        title: "Cart Item Void Authorization",
        description: `Void and remove item "${targetItem.name}" (₹${targetItem.price * targetItem.quantity}) from active bill`,
        targetId: id,
        targetName: targetItem.name,
        originalValue: targetItem.price * targetItem.quantity
      },
      () => {
        setCart(prev => prev.filter(item => item.id !== id));
        LocalDB.addAuditLog(
          "POS Cart Item Deleted",
          `Removed item "${targetItem.name}" from billing cart`,
          `POS (${activeStaff.name} - ${activeStaff.role})`
        );
      }
    );
  };

  // Verify and apply global promo coupons
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    
    if (!couponCode.trim()) return;

    const code = couponCode.trim().toUpperCase();
    const matched = coupons.find(c => c.code === code);

    if (!matched) {
      setCouponError("Invalid coupon promotional key.");
      return;
    }

    // Expiry check
    if (new Date(matched.expiryDate) < new Date()) {
      setCouponError("This promotion campaign has expired.");
      return;
    }

    const netItemTotal = cartTotals.subtotal - cartTotals.itemDiscounts;
    if (matched.minOrderAmount && netItemTotal < matched.minOrderAmount) {
      setCouponError(`Minimum purchase threshold of ₹${matched.minOrderAmount} not satisfied.`);
      return;
    }

    const applyAction = () => {
      setAppliedCoupon(matched);
      setCouponCode("");
      LocalDB.addAuditLog(
        "POS Coupon Applied", 
        `Applied promotion code: ${code} (Discount: ${matched.value}${matched.type === "percentage" ? "%" : " Fixed"})`,
        `POS (${activeStaff.name} - ${activeStaff.role})`
      );
    };

    executeWithPermission(
      "pos.apply_discount",
      {
        actionType: "apply_global_discount",
        title: "Promotional Coupon Authorization",
        description: `Apply coupon ${code} (${matched.value}${matched.type === "percentage" ? "%" : "₹"} off) to active order`,
        targetName: code,
        newValue: matched.value
      },
      applyAction
    );
  };

  // Process and save finalized invoice with thermal printing
  const handleFinalizeCheckout = async () => {
    if (cart.length === 0 || isFinalizing) return;

    // 1. Strict validation per order type
    if (orderType === "dine-in") {
      if (!selectedTable) {
        alert("Table allocation is required for Dine-In orders. Please select a table before finalizing.");
        return;
      }
    } else if (orderType === "delivery") {
      if (!customerName.trim()) {
        alert("Customer recipient name is required for delivery orders.");
        return;
      }
      if (!customerPhone.trim() || customerPhone.replace(/\D/g, "").length < 7) {
        alert("A valid 10-digit mobile contact number is required for delivery dispatch.");
        return;
      }
      if (!customerAddress.trim()) {
        alert("A complete delivery/shipping address is required for delivery orders.");
        return;
      }
    }

    setIsFinalizing(true);
    try {
      // Formulate Order Object for LocalDB saving
      const finalOrderItems = cart.map(item => ({
        menuItemId: item.isManual ? "manual" : item.id.replace("reg-", ""),
        name: item.name,
        price: item.price - (item.price * (item.discount / 100)), // discounted price
        quantity: item.quantity,
        customization: item.customization,
        // Store complete manual attributes for ledger reports
        isManual: item.isManual,
        category: item.category,
        gstRate: item.gstRate,
        discount: item.discount,
        hsnCode: item.hsnCode,
        notes: item.customization
      }));

      const defaultName = orderType === "dine-in" 
        ? "Walk-in Guest" 
        : orderType === "takeaway" 
        ? "Takeaway Guest" 
        : "Delivery Customer";

      const orderPayload: Omit<Order, "id" | "createdAt"> = {
        customerName: customerName.trim() || defaultName,
        phoneNumber: customerPhone.trim() || (orderType === "dine-in" ? "+91 00000 00000" : ""),
        email: customerEmail.trim() || "walkin@idlijunction.com",
        orderType: orderType,
        tableNumber: orderType === "dine-in" ? selectedTable : undefined,
        address: orderType === "delivery" ? customerAddress.trim() : undefined,
        items: finalOrderItems,
        subtotal: cartTotals.subtotal - cartTotals.itemDiscounts,
        gst: cartTotals.gst,
        packagingCharge: cartTotals.packaging,
        discountAmount: cartTotals.couponDiscount,
        appliedCoupon: appliedCoupon?.code || undefined,
        grandTotal: cartTotals.grandTotal,
        paymentStatus: orderType === "dine-in" ? posPaymentStatus : "Paid",
        orderSource: "POS",
        orderStatus: "Confirmed",
        paymentMethod: orderType === "delivery" ? "Cash On Delivery" : "POS Counter Terminal",
        // Include POS employee tracker metadata
        kotPrintStatus: "Pending",
        billPrintStatus: "Pending"
      };

      // Inject staff role into order database representation safely and persist to DB
      const finalOrder = await LocalDB.apiAddOrder({
        ...orderPayload,
        orderSource: "POS",
        orderStatus: "Confirmed",
        billedBy: `POS (${currentRole})`
      } as any);

      // Save customized report log details
      LocalDB.addAuditLog(
        "POS Checkout Completed",
        `Finalized invoice #${finalOrder.id} [${orderType.toUpperCase()}${orderType === "dine-in" ? ` - Table #${selectedTable}` : ""}] for ₹${finalOrder.grandTotal} containing ${cart.length} culinary elements.`,
        `POS (${currentRole})`
      );

      // If dine-in, let's mark table status
      if (orderType === "dine-in" && selectedTable) {
        const dbTables = LocalDB.getTables();
        const targetStatus = (finalOrder.paymentStatus === "Paid") ? "Available" : "Occupied";
        LocalDB.saveTables(dbTables.map(t => t.tableNumber === selectedTable ? { ...t, status: targetStatus } : t));
      }

      // Refresh parent lists
      onOrderPlaced();

      // Clean current checkout state immediately so POS is ready for next customer
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setCustomerAddress("");
      setOrderType("dine-in");
      setSelectedTable("");
      setAppliedCoupon(null);
      setCouponCode("");

      // -----------------------------------------------------------------
      // CONFIGURED PRINT WORKFLOW: BILL_ONLY | KOT_ONLY | BOTH
      // -----------------------------------------------------------------
      const paperWidth = settings.billFormat?.paperWidth || settings.paperWidth || "80mm";
      const printWorkflowMode = settings.printMode || "BOTH";

      // Synthesize KOT structure for the order
      const kotObject = {
        id: finalOrder.kotNumber || `KOT-${finalOrder.id.replace("SR-", "")}`,
        orderId: finalOrder.id,
        tableNumber: finalOrder.tableNumber || "Takeaway",
        customerName: finalOrder.customerName,
        orderType: finalOrder.orderType,
        status: "New Order",
        specialInstructions: finalOrder.items.map((i: any) => i.customization).filter(Boolean).join(", ") || "None",
        createdAt: finalOrder.createdAt,
        preparationTime: 15,
        items: finalOrder.items
      };

      if (printWorkflowMode === "BILL_ONLY") {
        setPrintNotice({
          type: "info",
          message: `Order #${finalOrder.id} — Printing Customer Bill...`,
          order: finalOrder
        });

        await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "bill", "Printing");
        const billRes = await PhysicalThermalPrinter.printBill(finalOrder, settings, paperWidth, "silent");

        const isElectron = Boolean(window.electronAPI?.isElectron);

        if (billRes.success) {
          await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "bill", "Printed");
          setPrintNotice({
            type: "success",
            message: isElectron 
              ? `Order #${finalOrder.id} finalized! Customer Bill printed successfully. Ready for next order.`
              : `Order #${finalOrder.id} finalized! Customer Bill print request sent. Ready for next order.`,
            order: finalOrder
          });
        } else {
          await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "bill", "Failed");
          setPrintNotice({
            type: "error",
            message: `Order #${finalOrder.id} created, but Customer Bill printing failed: ${billRes.error || "Printer unavailable"}`,
            order: finalOrder
          });
        }
      } else if (printWorkflowMode === "KOT_ONLY") {
        setPrintNotice({
          type: "info",
          message: `Order #${finalOrder.id} — Printing KOT...`,
          order: finalOrder
        });

        await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "kot", "Printing");
        const kotSuccess = await PhysicalThermalPrinter.printKOT(kotObject as any, paperWidth, "silent", `POS (${currentRole})`, settings);
        const isElectron = Boolean(window.electronAPI?.isElectron);

        if (kotSuccess) {
          await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "kot", "Printed");
          setPrintNotice({
            type: "success",
            message: isElectron
              ? `Order #${finalOrder.id} finalized! KOT printed successfully. Ready for next order.`
              : `Order #${finalOrder.id} finalized! KOT print request sent. Ready for next order.`,
            order: finalOrder
          });
        } else {
          await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "kot", "Failed");
          setPrintNotice({
            type: "error",
            message: `Order #${finalOrder.id} created, but KOT printing failed!`,
            order: finalOrder
          });
        }
      } else {
        // BOTH (Default): KOT FIRST -> CUSTOMER BILL SECOND
        setPrintNotice({
          type: "info",
          message: `Order #${finalOrder.id} — Printing KOT...`,
          order: finalOrder
        });

        await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "kot", "Printing");
        const kotSuccess = await PhysicalThermalPrinter.printKOT(kotObject as any, paperWidth, "silent", `POS (${currentRole})`, settings);

        if (!kotSuccess) {
          await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "kot", "Failed");
          await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "bill", "Failed");
          setPrintNotice({
            type: "error",
            message: `Order #${finalOrder.id} created, but KOT printing failed! Customer Bill printing aborted.`,
            order: finalOrder
          });
          return;
        }

        await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "kot", "Printed");

        // Brief delay between KOT and Bill for paper feed/cut
        setPrintNotice({
          type: "info",
          message: `Order #${finalOrder.id} — KOT Printed! Printing Customer Bill...`,
          order: finalOrder
        });
        await new Promise(resolve => setTimeout(resolve, 800));

        // Step 2: Print Customer Bill
        await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "bill", "Printing");
        const billRes = await PhysicalThermalPrinter.printBill(finalOrder, settings, paperWidth, "silent");
        const isElectron = Boolean(window.electronAPI?.isElectron);

        if (billRes.success) {
          await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "bill", "Printed");
          setPrintNotice({
            type: "success",
            message: isElectron
              ? `Order #${finalOrder.id} finalized! KOT & Customer Bill printed successfully. Ready for next order.`
              : `Order #${finalOrder.id} finalized! KOT & Customer Bill print request sent.`,
            order: finalOrder
          });
        } else {
          await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "bill", "Failed");
          setPrintNotice({
            type: "error",
            message: `Order #${finalOrder.id}: KOT printed successfully, but Customer Bill printing failed: ${billRes.error || "Printer unavailable"}`,
            order: finalOrder
          });
        }
      }

      // Ensure modal is closed so POS remains on main billing screen
      setShowBillPrint(null);

      // Auto-dismiss notification after 5 seconds
      setTimeout(() => {
        setPrintNotice(prev => prev?.order.id === finalOrder.id && prev.type === "success" ? null : prev);
      }, 5000);
    } catch (err: any) {
      alert(err.message || "Failed to finalize order.");
    } finally {
      setIsFinalizing(false);
    }
  };

  // Silent receipt print helper for POS banner
  const handleManualBrowserPrint = async (order: Order) => {
    const paperWidth = settings.billFormat?.paperWidth || settings.paperWidth || "80mm";
    setPrintNotice({
      type: "info",
      message: `Re-printing Customer Bill for Order #${order.id}...`,
      order
    });
    const res = await PhysicalThermalPrinter.printBill(order, settings, paperWidth, "silent");
    const isElectron = Boolean(window.electronAPI?.isElectron);
    if (res.success) {
      setPrintNotice({
        type: "success",
        message: isElectron
          ? `Customer Bill for Order #${order.id} printed successfully.`
          : `Print request sent for Customer Bill (Order #${order.id}).`,
        order
      });
    } else {
      setPrintNotice({
        type: "error",
        message: `Failed to print Customer Bill: ${res.error || "Printer unavailable"}`,
        order
      });
    }
  };

  // Derived POS Performance analytics for reporting tab
  const posReports = useMemo(() => {
    // Filter orders which were created/billed via the POS module or contain manual items
    const completedPosOrders = orders.filter(o => o.orderStatus !== "Cancelled");
    
    let manualRevenueSum = 0;
    const manualProductsBilled: { [name: string]: { name: string; qty: number; revenue: number; gst: number; category: string; hsn: string } } = {};
    const staffBilledTally: { [staff: string]: { count: number; total: number } } = {};

    completedPosOrders.forEach(o => {
      // Find staff who performed the billing
      const staffMember = (o as any).billedBy || "POS System Master";
      
      if (!staffBilledTally[staffMember]) {
        staffBilledTally[staffMember] = { count: 0, total: 0 };
      }
      staffBilledTally[staffMember].count += 1;
      staffBilledTally[staffMember].total += o.grandTotal;

      // Extract manual items inside the order
      o.items.forEach((itm: any) => {
        if (itm.isManual) {
          const itemRevenue = itm.price * itm.quantity;
          const itemGst = itemRevenue * ((itm.gstRate || 5) / 100);
          manualRevenueSum += itemRevenue;

          if (!manualProductsBilled[itm.name]) {
            manualProductsBilled[itm.name] = {
              name: itm.name,
              qty: 0,
              revenue: 0,
              gst: 0,
              category: itm.category || "General",
              hsn: itm.hsnCode || "9963"
            };
          }
          manualProductsBilled[itm.name].qty += itm.quantity;
          manualProductsBilled[itm.name].revenue += itemRevenue;
          manualProductsBilled[itm.name].gst += itemGst;
        }
      });
    });

    // Calculate Dine-In Merge Analytics
    const dineInMergeAnalytics = completedPosOrders
      .filter(o => o.orderType === "dine-in")
      .map(o => {
        const initialTime = o.createdAt;
        const addOnCount = o.addOnCount || 0;
        
        // Sum quantities of items added after the initial session (sessionNumber > 1)
        const totalAddedLater = o.items
          .filter((itm: any) => itm.sessionNumber > 1)
          .reduce((sum, itm) => sum + (itm.quantity || 0), 0);

        // Find average time between subsequent orders (timeline timestamps)
        let averageTimeStr = "N/A";
        if (o.timeline && o.timeline.length > 1) {
          let totalDiffMs = 0;
          let diffCount = 0;
          for (let i = 1; i < o.timeline.length; i++) {
            const t1 = new Date(o.timeline[i - 1].timestamp).getTime();
            const t2 = new Date(o.timeline[i].timestamp).getTime();
            if (!isNaN(t1) && !isNaN(t2)) {
              totalDiffMs += Math.abs(t2 - t1);
              diffCount++;
            }
          }
          if (diffCount > 0) {
            const avgMins = Math.round((totalDiffMs / diffCount) / 60000);
            averageTimeStr = `${avgMins} mins`;
          }
        }

        return {
          orderId: o.id,
          tableNumber: o.tableNumber || "N/A",
          initialTime: new Date(initialTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          addOnCount,
          totalAddedLater,
          averageTimeStr,
          finalBillAmount: o.grandTotal
        };
      });

    return {
      manualRevenue: manualRevenueSum,
      manualProducts: Object.values(manualProductsBilled),
      staffTally: Object.entries(staffBilledTally).map(([staff, stats]) => ({ staff, ...stats })),
      dineInMergeAnalytics
    };
  }, [orders]);

  return (
    <div className="space-y-3 sm:space-y-4 w-full text-xs font-sans text-stone-700" id="pos-billing-portal">
      {/* 1. Header Navigation Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#C67C4E]/10 rounded-lg text-[#C67C4E]">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </span>
            <h3 className="text-sm sm:text-base font-serif font-bold text-stone-900 uppercase tracking-wide">
              POS Billing & Open Item Portal
            </h3>
          </div>
          <p className="text-[10px] sm:text-[11px] text-stone-400">
            Rapidly create order invoices, apply custom discounts, and process manual culinary items seamlessly.
          </p>
        </div>

        {/* Controller selectors */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Active Terminal Tab selector */}
          <div className="bg-stone-100 p-0.5 sm:p-1 rounded-lg sm:rounded-xl flex border border-stone-200">
            <button
              onClick={() => setPosTab("register")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-bold text-[9px] sm:text-[10px] tracking-wider uppercase transition-all cursor-pointer ${
                posTab === "register"
                  ? "bg-white text-stone-950 shadow-xs"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Active Register
            </button>
            <button
              onClick={() => setPosTab("reports")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-bold text-[9px] sm:text-[10px] tracking-wider uppercase transition-all cursor-pointer ${
                posTab === "reports"
                  ? "bg-white text-stone-950 shadow-xs"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              POS Ledger Report
            </button>
          </div>

          {/* Thermal Printer Status Indicator */}
          {Boolean(window.electronAPI?.isElectron) ? (
            <div 
              title="Electron Silent Printing: Local hardware printer integration ready"
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 border transition-all bg-emerald-50 text-emerald-800 border-emerald-200"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Printer className="w-3.5 h-3.5" />
              <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase">
                Printer: Ready
              </span>
            </div>
          ) : (
            <div 
              title="Web Browser Mode: Hardware printer status unverified on web client"
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 border transition-all bg-slate-100 text-slate-700 border-slate-300"
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <Printer className="w-3.5 h-3.5" />
              <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase">
                Print Service: Available
              </span>
            </div>
          )}

          {/* Transfer Table Quick Action (Only for Dine-In) */}
          {orderType === "dine-in" && (
            <button
              type="button"
              onClick={() => {
                if (!selectedTable) {
                  alert("Please choose a table first to initiate a table transfer.");
                  return;
                }
                executeWithPermission(
                  "pos.transfer_table",
                  {
                    actionType: "edit_price",
                    title: "Table Transfer Authorization",
                    description: `Authorize table relocation and transfer of active orders for Table ${selectedTable || 'Active'}`
                  },
                  () => {
                    setTransferSourceTable(selectedTable || null);
                    setTransferSourceOrder(activeOrderForSelectedTable || null);
                    setShowTransferModal(true);
                  }
                );
              }}
              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 font-mono text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer shadow-xs"
              title="Transfer Table / Switch Table Order"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
              <span>Transfer Table</span>
            </button>
          )}

          {/* Split Bill & Multi-Payment Settlement */}
          <button
            type="button"
            onClick={() => {
              const target = (orderType === "dine-in" && activeOrderForSelectedTable) 
                ? activeOrderForSelectedTable 
                : orders.find(o => o.orderStatus !== "Delivered" && o.orderStatus !== "Cancelled");
              if (target) {
                executeWithPermission(
                  "pos.split_bill",
                  {
                    actionType: "edit_price",
                    title: "Split Bill Authorization",
                    description: `Authorize multi-tender splitting and partial settlements for Bill #${target.id}`
                  },
                  () => {
                    setSplitTargetOrder(target);
                    setShowSplitModal(true);
                  }
                );
              } else {
                alert("Please select a table with an active order or select an active order to split.");
              }
            }}
            className="bg-[#d4af37]/15 hover:bg-[#d4af37]/25 text-[#886915] dark:text-[#d4af37] border border-[#d4af37]/40 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 font-mono text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer shadow-xs"
            title="Split Bill & Settle Multi-Payment"
          >
            <Receipt className="w-3.5 h-3.5 text-[#9a7b20]" />
            <span>Split Bill</span>
          </button>
        </div>
      </div>

      {/* Print Notification Banner */}
      <AnimatePresence>
        {printNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              printNotice.type === "success"
                ? "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                : "bg-amber-50/95 border-amber-300 text-amber-950"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${printNotice.type === "success" ? "bg-emerald-200/60 text-emerald-800" : "bg-amber-200/60 text-amber-800"}`}>
                {printNotice.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </span>
              <div className="space-y-0.5">
                <p className="text-xs font-bold leading-tight">{printNotice.message}</p>
                {printNotice.details && (
                  <p className="text-[11px] opacity-80 leading-relaxed font-sans">{printNotice.details}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => handleManualBrowserPrint(printNotice.order)}
                className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-3 h-3" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintNotice(null)}
                className="p-1 rounded-md text-stone-500 hover:text-stone-800 hover:bg-black/5 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {posTab === "register" ? (
        /* 2. MAIN REGISTER DESK: RESPONSIVE TWO COLUMN WORKSPACE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
          
          {/* Left Column: Menu Selector, Search & Catalog */}
          <div className="lg:col-span-7 xl:col-span-7 2xl:col-span-8 flex flex-col gap-3 min-w-0">
            
            {/* Search Bar & Category Scroller Row */}
            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-stone-200 shadow-2xs space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search standard menu catalog..."
                    className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 focus:border-[#C67C4E] rounded-xl text-xs focus:outline-none transition-colors"
                  />
                </div>
                
                {/* PROMINENT "+ Add Manual Item" BUTTON */}
                <button
                  onClick={() => {
                    executeWithPermission(
                      "pos.manual_item",
                      {
                        actionType: "add_manual",
                        title: "Manual Item Insertion Authorization",
                        description: "Authorization required to create and add a non-catalog custom culinary item"
                      },
                      () => setShowManualModal(true)
                    );
                  }}
                  className="px-3.5 py-2 bg-gradient-to-r from-[#C67C4E] to-[#aa7c11] hover:from-[#aa7c11] hover:to-[#C67C4E] text-white font-mono font-bold uppercase tracking-wider text-[10px] sm:text-xs rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-center gap-1.5 flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Manual Item</span>
                </button>
              </div>

              {/* Category Scroller */}
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] uppercase font-bold tracking-wider transition-all whitespace-nowrap cursor-pointer border ${
                      activeCategory === cat
                        ? "bg-[#C67C4E] text-white border-[#C67C4E]"
                        : "bg-stone-50 text-stone-500 border-stone-200 hover:text-stone-850 hover:bg-stone-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Catalog Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-2.5 overflow-y-auto max-h-[calc(100vh-255px)] min-h-[280px] pr-1">
              {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleAddRegularToCart(item)}
                  title={item.name}
                  className="bg-white p-2.5 sm:p-3 rounded-xl border border-stone-200 hover:border-[#C67C4E] transition-all cursor-pointer hover:shadow-xs group flex flex-col justify-between min-h-[96px] sm:min-h-[102px]"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-1">
                      <span className={`text-[7px] sm:text-[8px] px-1.5 py-0.2 rounded-full font-mono font-bold uppercase border ${
                        item.isVeg 
                          ? "bg-green-50 text-green-700 border-green-100" 
                          : "bg-red-50 text-red-600 border-red-100"
                      }`}>
                        {item.isVeg ? "Veg" : "Non-Veg"}
                      </span>
                      {item.isBestseller && (
                        <span className="bg-amber-50 text-amber-700 text-[7px] sm:text-[8px] font-bold px-1 rounded-sm border border-amber-100">POPULAR</span>
                      )}
                    </div>
                    <h5 className="font-serif font-bold text-stone-850 group-hover:text-[#C67C4E] transition-colors leading-tight line-clamp-2 text-[11px] sm:text-xs mt-0.5 break-words" title={item.name}>
                      {item.name}
                    </h5>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-stone-100 pt-1.5 mt-auto">
                    <span className="text-stone-900 font-mono font-bold text-xs whitespace-nowrap">₹{item.price.toLocaleString("en-IN")}</span>
                    <button
                      type="button"
                      aria-label={`Add ${item.name} to billing cart`}
                      className="w-5 h-5 bg-stone-100 rounded-md group-hover:bg-[#C67C4E] group-hover:text-white flex items-center justify-center text-stone-600 text-xs font-bold transition-all cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {filteredMenuItems.length === 0 && (
                <div className="col-span-full py-10 text-center bg-white border border-stone-200 rounded-xl">
                  <p className="text-stone-400 font-medium text-xs">No matching culinary items found in catalog.</p>
                  <p className="text-[10px] text-stone-400 mt-1">Try refining search or click "+ Add Manual Item" to bill dynamically.</p>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Billing Checkout Station */}
          <div className="lg:col-span-5 xl:col-span-5 2xl:col-span-4 bg-white border border-stone-200 rounded-xl sm:rounded-2xl shadow-xs overflow-hidden flex flex-col lg:sticky lg:top-2 self-start max-h-[calc(100vh-125px)]">
            
            {/* Header: Customer Details */}
            <div className="p-2.5 sm:p-3 bg-stone-50 border-b border-stone-200 space-y-2 flex-shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono font-bold text-stone-450 uppercase tracking-widest flex items-center gap-1">
                  <ShoppingCart className="w-3.5 h-3.5 text-[#C67C4E]" />
                  Active Billing Cart
                </span>
                <span className="text-stone-900 font-bold font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-stone-200">
                  {cart.length} Item{cart.length !== 1 && "s"}
                </span>
              </div>

              {/* Order Type Toggle Selector */}
              <div className="grid grid-cols-3 gap-1 bg-stone-200 p-0.5 rounded-lg border border-stone-250">
                {(["dine-in", "takeaway", "delivery"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setOrderType(type);
                      if (type !== "dine-in") setSelectedTable("");
                    }}
                    className={`py-1 rounded-md font-bold text-[9px] tracking-wider uppercase transition-all cursor-pointer ${
                      orderType === type
                        ? "bg-[#C67C4E] text-white shadow-2xs"
                        : "text-stone-500 hover:text-stone-850"
                    }`}
                  >
                    {type === "dine-in" ? "Dine-In" : type === "takeaway" ? "Takeaway" : "Delivery"}
                  </button>
                ))}
              </div>

              {/* Dynamic Information Inputs */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                {/* 1. DINE-IN Specific Fields */}
                {orderType === "dine-in" && (
                  <>
                    <div className="col-span-2 space-y-0.5">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-stone-500 uppercase tracking-wider text-[8px] flex items-center gap-1">
                          <span>ALLOCATE TABLE *</span>
                        </label>
                        {selectedTable && (
                          <span className="text-[#aa7c11] font-mono font-bold text-[8px]">Table #{selectedTable} Selected</span>
                        )}
                      </div>
                      <select
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-lg py-1 px-2 text-stone-850 font-medium focus:outline-none focus:border-[#C67C4E] text-[10px] shadow-2xs"
                      >
                        <option value="">-- Choose Table Seating --</option>
                        {tables.map(table => {
                          const isOccupied = table.status === "Occupied";
                          return (
                            <option key={table.id} value={table.tableNumber}>
                              Table #{table.tableNumber} ({table.capacity} pax - {table.seatingArea}) {isOccupied ? "• [Occupied]" : "• [Available]"}
                            </option>
                          );
                        })}
                      </select>
                      {activeOrderForSelectedTable && (
                        <div className="mt-1 p-1.5 bg-amber-50 border border-amber-250 text-amber-900 rounded-lg flex items-center justify-between gap-1.5 font-medium text-[9px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0 animate-pulse"></span>
                            <span className="truncate font-semibold">Active: ₹{activeOrderForSelectedTable.grandTotal} {activeOrderForSelectedTable.paidAmount ? `(Paid: ₹${activeOrderForSelectedTable.paidAmount})` : ""}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSplitTargetOrder(activeOrderForSelectedTable);
                                setShowSplitModal(true);
                              }}
                              className="px-2 py-0.5 bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#886915] font-bold rounded flex items-center gap-1 cursor-pointer transition-colors shadow-2xs text-[9px]"
                              title="Split Bill & Settle Payments"
                            >
                              <Receipt className="w-2.5 h-2.5" />
                              <span>Split / Pay</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTransferSourceTable(selectedTable);
                                setTransferSourceOrder(activeOrderForSelectedTable);
                                setShowTransferModal(true);
                              }}
                              className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded flex items-center gap-1 cursor-pointer transition-colors shadow-2xs text-[9px]"
                              title="Transfer this order to another table"
                            >
                              <ArrowRightLeft className="w-2.5 h-2.5" />
                              <span>Transfer</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <label className="font-bold text-stone-450 uppercase tracking-wider text-[8px] flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-stone-400" /> GUEST NAME
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Walk-in Guest"
                        className="w-full bg-white border border-stone-200 rounded-lg py-1 px-2 focus:outline-none focus:border-[#C67C4E] text-[10px]"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="font-bold text-stone-450 uppercase tracking-wider text-[8px] flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-stone-400" /> MOBILE CONTACT
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d+ -]/g, ""))}
                        placeholder="9123456789 (Optional)"
                        className="w-full bg-white border border-stone-200 rounded-lg py-1 px-2 focus:outline-none focus:border-[#C67C4E] text-[10px]"
                      />
                    </div>
                  </>
                )}

                {/* 2. TAKEAWAY Specific Fields */}
                {orderType === "takeaway" && (
                  <>
                    <div className="col-span-2 bg-amber-50/80 border border-amber-250 rounded-lg p-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🥡</span>
                        <div>
                          <span className="font-bold text-[9px] text-amber-950 block uppercase font-mono tracking-wider">
                            TAKEAWAY COUNTER PICKUP
                          </span>
                          <span className="text-[8px] text-amber-700 block">
                            Direct counter dispatch • Standard packaging (+₹25) • No table assigned
                          </span>
                        </div>
                      </div>
                      <span className="text-[8px] font-mono font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded uppercase shrink-0">
                        Counter
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <label className="font-bold text-stone-500 uppercase tracking-wider text-[8px] flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-stone-400" /> CUSTOMER NAME
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Takeaway Guest"
                        className="w-full bg-white border border-stone-200 rounded-lg py-1 px-2 focus:outline-none focus:border-[#C67C4E] text-[10px]"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="font-bold text-stone-500 uppercase tracking-wider text-[8px] flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-stone-400" /> MOBILE CONTACT
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d+ -]/g, ""))}
                        placeholder="9123456789 (Optional)"
                        className="w-full bg-white border border-stone-200 rounded-lg py-1 px-2 focus:outline-none focus:border-[#C67C4E] text-[10px]"
                      />
                    </div>
                  </>
                )}

                {/* 3. DELIVERY Specific Fields */}
                {orderType === "delivery" && (
                  <>
                    <div className="col-span-2 bg-purple-50/80 border border-purple-250 rounded-lg p-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🛵</span>
                        <div>
                          <span className="font-bold text-[9px] text-purple-950 block uppercase font-mono tracking-wider">
                            DOORSTEP DELIVERY DISPATCH
                          </span>
                          <span className="text-[8px] text-purple-700 block">
                            Out for delivery by rider • Packaging included (+₹25) • No table assigned
                          </span>
                        </div>
                      </div>
                      <span className="text-[8px] font-mono font-bold bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded uppercase shrink-0">
                        Delivery
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <label className="font-bold text-purple-900 uppercase tracking-wider text-[8px] flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-purple-600" /> CUSTOMER NAME *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={60}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Customer Full Name"
                        className="w-full bg-white border border-purple-200 rounded-lg py-1 px-2 focus:outline-none focus:border-purple-600 text-[10px]"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="font-bold text-purple-900 uppercase tracking-wider text-[8px] flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-purple-600" /> MOBILE CONTACT *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={15}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d+ -]/g, ""))}
                        placeholder="10-digit Phone Number"
                        className="w-full bg-white border border-purple-200 rounded-lg py-1 px-2 focus:outline-none focus:border-purple-600 text-[10px]"
                      />
                    </div>

                    <div className="col-span-2 space-y-0.5">
                      <label className="font-bold text-purple-900 uppercase tracking-wider text-[8px] flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-purple-600" /> SHIPPING / DELIVERY ADDRESS *
                      </label>
                      <textarea
                        rows={2}
                        required
                        maxLength={250}
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Flat/House No, Building, Street, Landmark, Pincode..."
                        className="w-full bg-white border border-purple-200 rounded-lg p-1.5 focus:outline-none focus:border-purple-600 text-[10px] resize-none"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Cart Items List Container */}
            <div className="flex-grow overflow-y-auto max-h-[22vh] xl:max-h-[26vh] p-2.5 sm:p-3 space-y-2 divide-y divide-stone-100 min-h-[90px]">
              {cart.map((item) => {
                const isEditing = editingItemId === item.id;
                const lineItemTotal = ((item.price * item.quantity) - (item.price * item.quantity * (item.discount / 100)));
                
                return (
                  <div key={item.id} className="pt-2 first:pt-0 flex flex-col gap-1.5">
                    <div className="flex justify-between items-start gap-1.5">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="font-bold text-stone-900 flex items-center gap-1 flex-wrap text-xs">
                          <span className="truncate max-w-[130px] sm:max-w-[170px] xl:max-w-[140px]" title={item.name}>{item.name}</span>
                          {item.isManual && (
                            <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[7px] font-bold px-1 py-0.2 rounded font-mono">
                              MANUAL
                            </span>
                          )}
                        </div>
                        {item.hsnCode && (
                          <div className="text-[8px] font-mono text-stone-400">HSN: {item.hsnCode}</div>
                        )}
                        {item.customization && (
                          <div className="text-[8px] italic text-[#C67C4E] truncate max-w-[180px]" title={item.customization}>Notes: {item.customization}</div>
                        )}
                        
                        <div className="text-[9px] font-mono text-stone-500 whitespace-nowrap">
                          ₹{item.price.toLocaleString("en-IN")} x {item.quantity}
                          {item.discount > 0 && (
                            <span className="text-green-600 font-bold ml-1">(-{item.discount}%)</span>
                          )}
                          <span className="text-stone-400 ml-1">| GST: {item.gstRate}%</span>
                        </div>
                      </div>

                      {/* Math Result & Stepper */}
                      <div className="text-right space-y-1 flex-shrink-0">
                        <span className="font-mono font-bold text-stone-850 block text-xs whitespace-nowrap">
                          ₹{lineItemTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                        
                        {/* Adjust inline Quantity */}
                        <div className="flex items-center border border-stone-200 rounded bg-stone-50 h-5 overflow-hidden select-none ml-auto">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => handleAdjustQuantity(item.id, -1)}
                            className="px-1.5 text-stone-500 hover:bg-stone-200 cursor-pointer h-full font-bold flex items-center text-xs"
                          >
                            -
                          </button>
                          <span className="px-1.5 font-mono text-[10px] font-bold text-stone-900">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => handleAdjustQuantity(item.id, 1)}
                            className="px-1.5 text-stone-500 hover:bg-stone-200 cursor-pointer h-full font-bold flex items-center text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Editor Trigger Row & Quick Action elements */}
                    <div className="flex items-center justify-between gap-1">
                      {isEditing ? (
                        <div className="flex gap-1.5 items-center bg-stone-50 p-1.5 rounded-lg border border-stone-200 w-full">
                          <div className="space-y-0.5 flex-1">
                            <span className="text-[7px] font-bold text-stone-400 block uppercase">PRICE (₹)</span>
                            <input
                              type="number"
                              value={editPriceVal}
                              onChange={(e) => setEditPriceVal(e.target.value)}
                              placeholder={item.price.toString()}
                              className="w-full bg-white border border-stone-200 rounded px-1.5 py-0.5 text-[9px]"
                            />
                          </div>
                          
                          <div className="space-y-0.5 flex-1">
                            <span className="text-[7px] font-bold text-stone-400 block uppercase">DISC (%)</span>
                            <input
                              type="number"
                              value={editDiscountVal}
                              onChange={(e) => setEditDiscountVal(e.target.value)}
                              placeholder={item.discount.toString()}
                              className="w-full bg-white border border-stone-200 rounded px-1.5 py-0.5 text-[9px]"
                            />
                          </div>

                          <div className="flex gap-1 self-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (editPriceVal && parseFloat(editPriceVal) !== item.price) {
                                  handleUpdatePrice(item.id, editPriceVal);
                                } else if (editDiscountVal && parseInt(editDiscountVal, 10) !== item.discount) {
                                  handleUpdateDiscount(item.id, editDiscountVal);
                                } else {
                                  setEditingItemId(null);
                                }
                              }}
                              className="px-2 py-1 bg-green-600 text-white rounded text-[8px] uppercase font-bold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="px-2 py-1 bg-stone-400 text-white rounded text-[8px] uppercase font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2.5 items-center">
                          <button
                            type="button"
                            title="Edit item price or discount"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditPriceVal(item.price.toString());
                              setEditDiscountVal(item.discount.toString());
                            }}
                            className="text-[#C67C4E] hover:text-[#aa7c11] flex items-center gap-1 cursor-pointer font-bold font-mono text-[8px]"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            EDIT
                          </button>
                          <button
                            type="button"
                            title="Remove item from cart"
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer font-bold font-mono text-[8px]"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            REMOVE
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {cart.length === 0 && (
                <div className="py-6 text-center text-stone-400 flex flex-col items-center justify-center gap-1.5">
                  <div className="p-2.5 bg-stone-100 rounded-full text-stone-300">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-600 text-xs">POS Cart is empty.</p>
                    <p className="text-[9px] text-stone-400">Click catalog items or add a manual open item.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Promos & Coupon codes */}
            <div className="p-2 border-t border-stone-200 bg-stone-50 space-y-1 flex-shrink-0">
              <form onSubmit={handleApplyCoupon} className="flex gap-1.5">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Promo Code (e.g. IDLI10)"
                  className="bg-white border border-stone-200 px-2.5 py-1 rounded-lg text-[10px] flex-grow uppercase focus:outline-none focus:border-[#C67C4E]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-stone-850 hover:bg-stone-900 text-white rounded-lg text-[9px] uppercase tracking-wider font-bold cursor-pointer flex-shrink-0"
                >
                  Apply
                </button>
              </form>
              
              {couponError && (
                <p className="text-red-600 text-[9px] font-mono leading-tight">{couponError}</p>
              )}
              {appliedCoupon && (
                <div className="flex justify-between items-center bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-lg text-[9px]">
                  <span className="font-bold truncate max-w-[170px]" title={`PROMO ACTIVE: ${appliedCoupon.code}`}>PROMO ACTIVE: {appliedCoupon.code}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCoupon(null);
                      LocalDB.addAuditLog("POS Coupon Cleared", "Cleared global promo coupon", `POS (${currentRole})`);
                    }}
                    className="text-green-800 hover:text-green-950 font-bold ml-2 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Bill Summary Calculations & Dispatch */}
            <div className="p-2.5 sm:p-3 bg-stone-900 text-stone-200 space-y-2 flex-shrink-0">
              <div className="space-y-1 text-[10px] font-sans">
                <div className="flex justify-between text-stone-400">
                  <span>Cart Subtotal</span>
                  <span className="font-mono whitespace-nowrap">₹{cartTotals.subtotal.toLocaleString("en-IN")}</span>
                </div>
                {cartTotals.itemDiscounts > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Item Discounts</span>
                    <span className="font-mono whitespace-nowrap">-₹{cartTotals.itemDiscounts.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {cartTotals.couponDiscount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Coupon ({appliedCoupon?.code})</span>
                    <span className="font-mono whitespace-nowrap">-₹{cartTotals.couponDiscount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-400">
                  <span>Taxes (CGST & SGST)</span>
                  <span className="font-mono whitespace-nowrap">₹{cartTotals.gst.toLocaleString("en-IN")}</span>
                </div>
                {cartTotals.packaging > 0 && (
                  <div className="flex justify-between text-stone-400">
                    <span>Packaging Charge</span>
                    <span className="font-mono whitespace-nowrap">₹{cartTotals.packaging.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-stone-800 pt-1.5 font-bold text-white text-xs sm:text-sm">
                  <span className="text-[#C67C4E]">GRAND TOTAL</span>
                  <span className="text-[#C67C4E] font-mono whitespace-nowrap">₹{cartTotals.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Order-type aware settlement info */}
              {orderType === "dine-in" ? (
                <div className="flex justify-between items-center bg-stone-800 p-1.5 rounded-lg border border-stone-700 text-[8px] gap-1.5">
                  <span className="font-bold text-stone-300 uppercase tracking-wider">SETTLEMENT:</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPosPaymentStatus("Pending")}
                      className={`px-2 py-0.5 rounded font-bold uppercase tracking-wide transition-all cursor-pointer ${
                        posPaymentStatus === "Pending"
                          ? "bg-[#C67C4E] text-white shadow-xs"
                          : "bg-stone-700 text-stone-300 hover:bg-stone-600"
                      }`}
                    >
                      Unpaid (Open Tab)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosPaymentStatus("Paid")}
                      className={`px-2 py-0.5 rounded font-bold uppercase tracking-wide transition-all cursor-pointer ${
                        posPaymentStatus === "Paid"
                          ? "bg-green-600 text-white shadow-xs"
                          : "bg-stone-700 text-stone-300 hover:bg-stone-600"
                      }`}
                    >
                      Settle Now
                    </button>
                  </div>
                </div>
              ) : orderType === "delivery" ? (
                <div className="flex justify-between items-center bg-purple-950/80 p-1.5 rounded-lg border border-purple-800/80 text-[8px] gap-1.5">
                  <span className="font-bold text-purple-300 uppercase tracking-wider">SETTLEMENT:</span>
                  <span className="font-mono font-bold text-purple-200 uppercase text-[9px] flex items-center gap-1">
                    <span>🛵 Cash On Delivery / Rider Collect</span>
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-amber-950/80 p-1.5 rounded-lg border border-amber-800/80 text-[8px] gap-1.5">
                  <span className="font-bold text-amber-300 uppercase tracking-wider">SETTLEMENT:</span>
                  <span className="font-mono font-bold text-amber-200 uppercase text-[9px] flex items-center gap-1">
                    <span>🥡 Instant Counter Paid</span>
                  </span>
                </div>
              )}

              {/* Final checkout dispatch trigger */}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleFinalizeCheckout}
                title={cart.length === 0 ? "Add items to cart to finalize bill" : "Finalize order & open thermal receipt print preview"}
                className={`w-full py-2.5 sm:py-3 bg-gradient-to-r from-[#C67C4E] to-[#aa7c11] text-white font-mono font-bold uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  cart.length === 0 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:from-[#aa7c11] hover:to-[#C67C4E] shadow-md cursor-pointer"
                }`}
              >
                <span>Finalize & Bill Print</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>
      ) : (
        /* 3. REPORTING & AUDITING REGISTER SHEET */
        <div className="space-y-4" id="pos-reporting-panel">
          
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-1">
              <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest block">
                Manual Billing Revenue
              </span>
              <div className="text-lg font-serif font-black text-[#C67C4E]">
                ₹{posReports.manualRevenue.toLocaleString()}
              </div>
              <p className="text-[8px] text-stone-400 leading-tight">
                Cumulative revenue itemized from open manual items.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-1">
              <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest block">
                Manual Products Billed
              </span>
              <div className="text-lg font-serif font-black text-stone-900">
                {posReports.manualProducts.reduce((sum, p) => sum + p.qty, 0)} Items
              </div>
              <p className="text-[8px] text-stone-400 leading-tight">
                Unique open items billed to current registers.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-1">
              <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest block">
                Active Billed Terminals
              </span>
              <div className="text-lg font-serif font-black text-stone-900">
                {posReports.staffTally.length} Staff
              </div>
              <p className="text-[8px] text-stone-400 leading-tight">
                Distinct staff registers recorded for checkouts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Manual products billed sheet (8/12) */}
            <div className="lg:col-span-8 bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3">
              <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
                <h4 className="text-xs font-mono font-bold text-stone-900 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-[#C67C4E]" />
                  Itemized Manual Products Billed
                </h4>
                <span className="text-[8px] bg-stone-100 text-stone-500 font-bold px-2 py-0.5 rounded-full uppercase">
                  LEDGER
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] sm:text-[11px] font-sans border-collapse">
                  <thead>
                    <tr className="border-b border-stone-150 font-bold font-mono text-stone-400 text-[9px]">
                      <th className="py-2 pr-2">PRODUCT NAME</th>
                      <th className="py-2 px-2">CATEGORY</th>
                      <th className="py-2 px-2">HSN</th>
                      <th className="py-2 px-2 text-center">QTY</th>
                      <th className="py-2 px-2 text-right">GST</th>
                      <th className="py-2 pl-2 text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-700">
                    {posReports.manualProducts.map((p, idx) => (
                      <tr key={`${p.name}-${idx}`} className="hover:bg-stone-50/50">
                        <td className="py-2 pr-2 font-semibold text-stone-900 truncate max-w-[180px]" title={p.name}>{p.name}</td>
                        <td className="py-2 px-2">
                          <span className="bg-stone-100 text-stone-600 text-[8px] font-bold px-1.5 py-0.2 rounded uppercase whitespace-nowrap">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono text-stone-450 text-[9px]">{p.hsn}</td>
                        <td className="py-2 px-2 text-center font-bold font-mono text-[#C67C4E]">{p.qty}</td>
                        <td className="py-2 px-2 text-right font-mono whitespace-nowrap">₹{p.gst.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                        <td className="py-2 pl-2 text-right font-mono font-bold text-stone-900 whitespace-nowrap">₹{p.revenue.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}

                    {posReports.manualProducts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-stone-400 font-medium">
                          No manual items have been billed yet. All revenue is associated with standard database items.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Staff Billing Tally Ledger (4/12) */}
            <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3">
              <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
                <h4 className="text-xs font-mono font-bold text-stone-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#C67C4E]" />
                  Staff Workstation Tally
                </h4>
              </div>

              <div className="space-y-2.5">
                {posReports.staffTally.map((st, idx) => (
                  <div key={`${st.staff}-${idx}`} className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 space-y-1 flex justify-between items-center">
                    <div>
                      <div className="font-mono font-extrabold text-stone-850 uppercase text-[9px] truncate max-w-[130px]">{st.staff}</div>
                      <div className="text-[8px] text-stone-400">{st.count} bills completed</div>
                    </div>
                    <span className="font-mono font-bold text-xs text-[#C67C4E]">
                      ₹{st.total.toLocaleString()}
                    </span>
                  </div>
                ))}

                {posReports.staffTally.length === 0 && (
                  <div className="py-8 text-center text-stone-400 font-medium text-xs">
                    No active staff register entries.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dine-In Order Merging Reports */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3">
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
              <h4 className="text-xs font-mono font-bold text-stone-900 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#C67C4E]" />
                Dine-In Automatic Order Merging Analytics
              </h4>
              <span className="text-[8px] bg-[#C67C4E]/10 text-[#C67C4E] font-bold px-2 py-0.5 rounded-full uppercase">
                Active & Settled Sessions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] sm:text-[11px] font-sans border-collapse">
                <thead>
                  <tr className="border-b border-stone-150 font-bold font-mono text-stone-400 text-[9px]">
                    <th className="py-2 pr-2">ORDER ID</th>
                    <th className="py-2 px-2">TABLE NO</th>
                    <th className="py-2 px-2">ORDER TIME</th>
                    <th className="py-2 px-2 text-center">ADD-ON MERGES</th>
                    <th className="py-2 px-2 text-center">ADDED LATER</th>
                    <th className="py-2 px-2 text-center">AVG INTERVAL</th>
                    <th className="py-2 pl-2 text-right">BILL TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {posReports.dineInMergeAnalytics.map((o, idx) => (
                    <tr key={`${o.orderId}-${idx}`} className="hover:bg-stone-50/50">
                      <td className="py-2 pr-2 font-mono font-bold text-stone-900">#{o.orderId}</td>
                      <td className="py-2 px-2">
                        <span className="bg-stone-100 text-stone-600 text-[8px] font-extrabold px-1.5 py-0.2 rounded-full">
                          Table #{o.tableNumber}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono text-[9px]">{o.initialTime}</td>
                      <td className="py-2 px-2 text-center font-bold font-mono text-[#C67C4E]">
                        {o.addOnCount}
                      </td>
                      <td className="py-2 px-2 text-center font-mono">
                        {o.totalAddedLater} units
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-stone-500 text-[9px]">
                        {o.averageTimeStr}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-bold text-stone-900">
                        ₹{o.finalBillAmount}
                      </td>
                    </tr>
                  ))}

                  {posReports.dineInMergeAnalytics.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-400 font-medium">
                        No dine-in sessions or merged orders recorded yet in current registers.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL DIALOGS AND SECURITY OVERLAYS */}
      {/* ======================================================== */}

      {/* MODAL 1: ADD MANUAL CULINARY ITEM FORM */}
      <AnimatePresence>
        {showManualModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManualModal(false)}
              className="fixed inset-0 bg-[#0c0a09]/40 z-40 backdrop-blur-xs"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 max-w-md mx-auto my-auto h-fit bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 z-50 shadow-2xl overflow-y-auto max-h-[85vh]"
            >
              <div className="flex justify-between items-start border-b border-stone-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#C67C4E]/10 text-[#C67C4E] rounded-xl">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-stone-900 uppercase tracking-wide">
                      Add Manual Item
                    </h3>
                    <p className="text-[10px] text-stone-400 mt-0.5">Bill a product/service not present in the menu</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="p-1 text-stone-400 hover:text-stone-900 cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              {manualFormErrors.length > 0 && (
                <div className="mb-4 bg-red-50 border border-red-200 p-3.5 rounded-xl text-[10px] text-red-800 space-y-1">
                  <div className="font-bold uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> validation errors found:
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 font-sans">
                    {manualFormErrors.map(e => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              )}

              <form onSubmit={handleAddManualItemSubmit} className="space-y-4 text-xs font-sans text-stone-700">
                {/* Name */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-stone-450 uppercase tracking-widest">
                    ITEM NAME *
                  </label>
                  <input
                    required
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Butter Naan Special Pack"
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-[#C67C4E]"
                  />
                </div>

                {/* Price & Quantity Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-bold text-stone-450 uppercase tracking-widest">
                      UNIT PRICE (INR) *
                    </label>
                    <input
                      required
                      type="number"
                      step="any"
                      min="0.01"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      placeholder="₹250.00"
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-[#C67C4E]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-bold text-stone-450 uppercase tracking-widest">
                      QUANTITY *
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={manualQuantity}
                      onChange={(e) => setManualQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      placeholder="1"
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-[#C67C4E]"
                    />
                  </div>
                </div>

                {/* GST & Discount Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-bold text-stone-450 uppercase tracking-widest">
                      GST RATE *
                    </label>
                    <select
                      value={manualGstRate}
                      onChange={(e) => setManualGstRate(parseInt(e.target.value, 10))}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-[#C67C4E]"
                    >
                      <option value={0}>0% Exempted</option>
                      <option value={5}>5% Standard F&B</option>
                      <option value={12}>12% Butter/Dairy</option>
                      <option value={18}>18% Luxury Surcharge</option>
                      <option value={28}>28% Sin/Cess Rate</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-bold text-stone-450 uppercase tracking-widest">
                      DISCOUNT (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={manualDiscount}
                      onChange={(e) => setManualDiscount(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-[#C67C4E]"
                    />
                  </div>
                </div>

                {/* Category & HSN Code */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-bold text-stone-450 uppercase tracking-widest">
                      CATEGORY (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      placeholder="e.g. Desserts"
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-[#C67C4E]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-bold text-stone-450 uppercase tracking-widest">
                      HSN CODE
                    </label>
                    <input
                      type="text"
                      value={manualHsnCode}
                      onChange={(e) => setManualHsnCode(e.target.value)}
                      placeholder="e.g. 9963"
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-[#C67C4E]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-stone-450 uppercase tracking-widest">
                    CULINARY PREPARATION NOTES
                  </label>
                  <textarea
                    rows={2}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="Provide special tandoor prep notes, packing specifications..."
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-[#C67C4E]"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 pt-3">
                  <button
                    type="submit"
                    className="flex-grow py-3 bg-[#C67C4E] hover:bg-[#aa7c11] text-white font-mono font-semibold tracking-wider text-[10px] uppercase rounded-xl transition-all cursor-pointer"
                  >
                    Add to Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-semibold tracking-wider text-[10px] uppercase rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL 2: MANAGER SECURITY OVERRIDE DIALOG */}
      <ManagerOverrideModal
        isOpen={showOverrideModal}
        context={overrideContext}
        onClose={() => {
          setShowOverrideModal(false);
          setOverrideContext(null);
        }}
        onAuthorized={(manager) => {
          setShowOverrideModal(false);
          setOverrideContext(null);
        }}
      />

      {/* MODAL 3: QUICK SWITCH OPERATOR / LOCK TERMINAL MODAL */}
      <StaffQuickSwitchModal
        isOpen={showStaffSwitchModal}
        onClose={() => setShowStaffSwitchModal(false)}
        onStaffSwitched={(newStaff) => {
          setActiveStaff(newStaff);
        }}
      />

      {/* TABLE TRANSFER & MERGE MODAL */}
      <TransferTableModal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setTransferSourceTable(null);
          setTransferSourceOrder(null);
        }}
        initialSourceTableNumber={transferSourceTable || undefined}
        initialSourceOrder={transferSourceOrder || undefined}
        onTransferSuccess={(src, tgt) => {
          // If the currently selected table in the POS was transferred to tgt, switch selection to tgt
          if (selectedTable === src) {
            setSelectedTable(tgt);
          }
          onOrderPlaced();
        }}
      />

      {/* SPLIT BILL & PAYMENT SETTLEMENT MODAL */}
      {showSplitModal && splitTargetOrder && (
        <SplitBillModal
          isOpen={showSplitModal}
          onClose={() => {
            setShowSplitModal(false);
            setSplitTargetOrder(null);
          }}
          order={splitTargetOrder}
          settings={settings}
          currentUser={currentRole}
          onOrderUpdated={(updatedOrder) => {
            onOrderPlaced();
            setSplitTargetOrder(updatedOrder);
          }}
        />
      )}

      {/* SHIFT & CASH RECONCILIATION MODAL */}
      <ShiftManagementModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        currentRole={currentRole}
        settings={settings}
        onShiftStatusChanged={() => {
          reloadShiftData();
          onOrderPlaced();
        }}
      />

      {/* SHIFT HISTORY & Z-REPORTS ARCHIVE MODAL */}
      <ShiftHistoryModal
        isOpen={showShiftHistoryModal}
        onClose={() => setShowShiftHistoryModal(false)}
        currentRole={currentRole}
        settings={settings}
        onShiftStatusChanged={() => {
          reloadShiftData();
          onOrderPlaced();
        }}
      />
    </div>
  );
}
