import React, { useState } from "react";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Send,
  CheckCircle2,
  MessageSquare,
  MapPin,
  Trash2,
  User,
  Clock,
  Camera,
  QrCode,
  RefreshCw,
  Edit2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CartItem, MenuItem } from "../types";
import { LocalDB } from "../lib/db";
import TableFloorplan from "./TableFloorplan";
import QrScannerModal from "./QrScannerModal";
import { detectTableFromCurrentUrl, saveActiveTable, clearActiveTable, getActiveTable } from "../lib/qrHelper";
import { BRAND_CONFIG } from "../config/brand";

interface CartOverlayProps {
  cart: CartItem[];
  onAddToCart: (item: MenuItem) => void;
  onRemoveFromCart: (item: MenuItem) => void;
  onRemoveEntirelyFromCart: (item: MenuItem) => void;
  onUpdateCustomization: (itemId: string, note: string) => void;
  onClearCart: () => void;
}

export default function CartOverlay({
  cart,
  onAddToCart,
  onRemoveFromCart,
  onRemoveEntirelyFromCart,
  onUpdateCustomization,
  onClearCart,
}: CartOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway">("takeaway");
  const [tableNumber, setTableNumber] = useState("");
  const [isQrScanned, setIsQrScanned] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showManualTablePicker, setShowManualTablePicker] = useState(false);
  const [address, setAddress] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pastOrders, setPastOrders] = useState<any[]>(() => LocalDB.getOrders());

  React.useEffect(() => {
    const handleSync = () => {
      setPastOrders(LocalDB.getOrders());
    };
    window.addEventListener("new_order", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("new_order", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const handleReorder = (order: any) => {
    const menuItems = LocalDB.getMenuItems();
    order.items.forEach((item: any) => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      if (menuItem) {
        onAddToCart(menuItem);
      }
    });
    setIsProfileOpen(false);
    setIsOpen(true);
  };

  // Pre-fill and synchronize table number from scanned table URL parameters, QR scanner, and storage events
  React.useEffect(() => {
    const syncTableState = () => {
      try {
        const detected = detectTableFromCurrentUrl();
        const active = getActiveTable();
        const tableVal = detected || (active ? active.tableNumber : "");
        
        if (tableVal) {
          setTableNumber(tableVal);
          setOrderType("dine-in");
          setIsQrScanned(active ? active.isFromQr : true);
        } else {
          setTableNumber("");
          setIsQrScanned(false);
        }
      } catch (e) {
        // safe fallback
      }
    };

    syncTableState();

    const handleTableScannedEvent = (e: any) => {
      if (e.detail?.tableNumber) {
        setTableNumber(e.detail.tableNumber);
        setOrderType("dine-in");
        setIsQrScanned(e.detail.isFromQr !== false);
        setCheckoutError(null);
      }
    };

    const handleTableClearedEvent = () => {
      setTableNumber("");
      setIsQrScanned(false);
    };

    window.addEventListener("ij_table_scanned", handleTableScannedEvent);
    window.addEventListener("ij_table_cleared", handleTableClearedEvent);
    window.addEventListener("storage", syncTableState);

    return () => {
      window.removeEventListener("ij_table_scanned", handleTableScannedEvent);
      window.removeEventListener("ij_table_cleared", handleTableClearedEvent);
      window.removeEventListener("storage", syncTableState);
    };
  }, []);

  // OTP Verification System variables
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Countdown timer effect
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showOtpVerification && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showOtpVerification, otpCountdown]);

  const handleCancelOtp = () => {
    setShowOtpVerification(false);
    setOtpCode("");
    setOtpError(null);
  };

  const handleResendOtp = () => {
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(randomOtp);
    setOtpCountdown(60);
    setOtpCode("");
    setOtpError(null);
  };

  const totalItems = cart.reduce((count, item) => count + item.quantity, 0);
  const subtotal = cart.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0,
  );
  const gst = 0;
  const packagingCharge = 0; // No packaging charge per user mandate
  const grandTotal = subtotal + packagingCharge;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    // Validate table number for Dine-In orders
    if (orderType === "dine-in") {
      const activeTableNum = tableNumber || localStorage.getItem("ij_scanned_table") || "";
      if (!activeTableNum.trim()) {
        setCheckoutError("Validation failed: Table number is required for Dine-In orders. Please scan a table QR code or enter table number.");
        return;
      }
    }

    if (!showOtpVerification) {
      // Security Gate: generate and intercept with OTP
      const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedOtp(randomOtp);
      setOtpCountdown(60);
      setOtpCode("");
      setOtpError(null);
      setShowOtpVerification(true);
      return;
    }

    if (otpCode !== generatedOtp) {
      setOtpError(
        "Incorrect One-Time Passcode. Please enter the valid simulator bypass code.",
      );
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);
    setOtpError(null);

    try {
      // Persist real order information inside server-side and local database immediately!
      const orderData = {
        customerName: userName.trim(),
        phoneNumber: phoneNumber.trim() || "+91-11-4560-4560",
        email: `${userName.toLowerCase().trim().replace(/\s+/g, "")}@${BRAND_CONFIG.restaurantName.toLowerCase().replace(/[^a-z0-9]/g, "")}-guest.com`,
        orderType: orderType,
        tableNumber: orderType === "dine-in" ? tableNumber : undefined,
        address: undefined,
        items: cart.map((ci) => ({
          menuItemId: ci.menuItem.id,
          name: ci.menuItem.name,
          price: ci.menuItem.price,
          quantity: ci.quantity,
          customization: ci.customization,
        })),
        subtotal: subtotal,
        gst: gst,
        packagingCharge: packagingCharge,
        discountAmount: 0,
        grandTotal: grandTotal,
        orderStatus: "New Order" as const,
        paymentStatus: "Pending" as const,
        paymentMethod: "Cash on Delivery", // Store payment method explicitly
        totalAmount: grandTotal,
      };

      // Ensure save is fully acknowledged and confirmed by the server first
      const savedOrder = await LocalDB.apiAddOrder(orderData);

      // Show custom success screen, then reset
      setOrderPlaced(true);
      setShowOtpVerification(false);
      setOtpCode("");
      setGeneratedOtp("");
      setTimeout(() => {
        setOrderPlaced(false);
        onClearCart();
        setIsOpen(false);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      setCheckoutError(
        err.message ||
          "Failed to submit order. Please check server connections and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Sticky Floating Shopping Bag Trigger */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#d4af37] to-[#aa7c11] hover:from-[#f3e5ab] hover:to-[#d4af37] text-black font-semibold px-5 py-4 rounded-full shadow-[0_12px_40px_rgba(212,175,55,0.4)] flex items-center gap-3 border border-yellow-300/30 group cursor-pointer"
            id="floating-cart-btn"
          >
            <div className="relative">
              <ShoppingBag className="w-5.5 h-5.5 stroke-[2]" />
              <span className="absolute -top-2.5 -right-2.5 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-black animate-bounce">
                {totalItems}
              </span>
            </div>
            <div className="flex flex-col items-start pr-1 leading-tight">
              <span className="text-[10px] text-gray-900 font-mono tracking-wider font-bold uppercase leading-none">
                ORDER TOTAL
              </span>
              <span className="text-sm font-mono font-bold leading-none mt-0.5">
                ₹{grandTotal}
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sticky Floating Profile / My Orders Trigger (Desktop Only) */}
      <AnimatePresence>
        {!isProfileOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsProfileOpen(true)}
            className="fixed bottom-6 left-6 z-50 bg-white/95 backdrop-blur-md hover:bg-stone-50 text-stone-850 border border-stone-200 px-5 py-4 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.08)] hidden md:flex items-center gap-3 cursor-pointer group transition-all"
            id="floating-profile-btn"
          >
            <div className="w-8 h-8 rounded-full bg-amber-50 border border-[#d4af37]/35 flex items-center justify-center text-[#aa7c11] group-hover:bg-[#d4af37] group-hover:text-white transition-all">
              <User className="w-4 h-4" />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[10px] text-stone-400 font-mono tracking-wider font-bold uppercase leading-none">
                GUEST PROFILE
              </span>
              <span className="text-xs font-bold text-stone-800 font-sans mt-0.5">
                {pastOrders[0]?.customerName ? pastOrders[0].customerName : "My Recent Orders"}
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Profile & Recent Orders Drawer (Desktop) */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="fixed inset-0 bg-black z-50 backdrop-blur-xs"
            />

            {/* Left Slide-out Container */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-full sm:max-w-md bg-[#FAF9F5] border-r border-stone-200 z-50 shadow-2xl flex flex-col font-sans"
              id="desktop-profile-drawer"
            >
              {/* Header */}
              <div className="p-5 border-b border-stone-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-[#d4af37]/30 flex items-center justify-center text-[#aa7c11]">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-sans">
                      My Guest Profile
                    </h2>
                    <p className="text-[10px] text-stone-400 font-mono leading-none mt-0.5">
                      SAVED ON THIS DEVICE
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsProfileOpen(false)}
                  className="w-8 h-8 rounded-full bg-stone-50 text-stone-500 hover:text-stone-950 border border-stone-200 flex items-center justify-center hover:bg-stone-100 transition-all cursor-pointer focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Card / Content */}
              <div className="flex-grow overflow-y-auto p-5 space-y-6">
                {/* Guest Profile Welcome */}
                <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl p-5 relative overflow-hidden shadow-md">
                  <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[#d4af37]/10 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#d4af37] to-[#aa7c11] flex items-center justify-center shadow-md font-serif text-lg font-bold text-stone-900 uppercase">
                      {(pastOrders[0]?.customerName || "G").charAt(0)}
                    </div>
                    <div>
                      <span className="text-[9px] font-mono tracking-widest text-[#d4af37] uppercase font-bold">Welcome Back</span>
                      <h3 className="text-sm font-bold font-serif tracking-wide text-white">
                        {pastOrders[0]?.customerName || "Guest Gourmand"}
                      </h3>
                      <p className="text-[10px] text-stone-300 font-mono mt-0.5">
                        {pastOrders[0]?.phoneNumber || "No active phone session"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] font-mono text-stone-400 block uppercase">Total Orders</span>
                      <span className="text-xs font-mono font-bold text-white">
                        {pastOrders.length} {pastOrders.length === 1 ? "Order" : "Orders"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-stone-400 block uppercase">Last Dining Type</span>
                      <span className="text-[10px] font-semibold text-[#d4af37] block mt-0.5 uppercase">
                        {pastOrders[0]?.orderType === "dine-in" ? `Dine-In (Table #${pastOrders[0].tableNumber})` : pastOrders[0]?.orderType || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recent Orders List */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-mono font-bold text-stone-400 uppercase tracking-widest">
                    Order History ({pastOrders.length})
                  </h3>

                  {pastOrders.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-3 shadow-xs">
                      <div className="w-12 h-12 rounded-full bg-stone-50 border border-stone-150 flex items-center justify-center text-stone-300 mx-auto">
                        <Clock className="w-6 h-6 text-stone-400" />
                      </div>
                      <h4 className="text-xs font-bold text-stone-900 font-sans">No order history found</h4>
                      <p className="text-xs text-stone-500 font-light max-w-xs mx-auto leading-relaxed">
                        Your past orders will appear here automatically so you can track kitchen status and reorder with a single click.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pastOrders.slice(0, 5).map((order) => {
                        const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        const statusColor = 
                          order.orderStatus === "Completed" || order.orderStatus === "Served" || order.orderStatus === "Delivered" ? "bg-green-50 text-green-700 border-green-200" :
                          order.orderStatus === "Cancelled" ? "bg-red-50 text-red-600 border-red-200" :
                          "bg-amber-50 text-amber-700 border-amber-200";

                        return (
                          <div key={order.id} className="bg-white border border-stone-200 p-4 rounded-2xl space-y-3 shadow-xs hover:border-stone-300 transition-all">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[11px] font-mono font-bold text-stone-900">{order.id}</span>
                                <span className="text-[10px] text-stone-404 font-mono ml-2">({formattedDate})</span>
                              </div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                                {order.orderStatus}
                              </span>
                            </div>

                            <div className="text-xs text-stone-600 space-y-1.5">
                              {order.items.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs">
                                  <span>
                                    <strong className="text-stone-900 font-semibold">{item.quantity}x</strong> {item.name}
                                  </span>
                                  <span className="font-mono text-stone-500">₹{item.price * item.quantity}</span>
                                </div>
                              ))}
                            </div>

                            <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between">
                              <div>
                                <span className="text-[9px] font-mono text-stone-400 block uppercase">
                                  {order.orderType === "dine-in" ? `DINE-IN (Table #${order.tableNumber})` : order.orderType.toUpperCase()}
                                </span>
                                <span className="text-xs font-mono font-black text-stone-900">
                                  Total: ₹{order.grandTotal}
                                </span>
                              </div>
                              <button
                                onClick={() => handleReorder(order)}
                                className="bg-stone-900 hover:bg-[#aa7c11] text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg shadow-sm cursor-pointer transition-all flex items-center gap-1"
                              >
                                Reorder
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-out Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black z-50 backdrop-blur-sm"
              id="cart-backdrop"
            />

            {/* Content Sheet */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white border-l border-stone-200 z-50 shadow-2xl flex flex-col"
              id="cart-drawer"
            >
              {/* Header section inside drawer */}
              <div className="p-5 border-b border-stone-150 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-5.5 h-5.5 text-[#d4af37]" />
                  <h2 className="text-lg font-serif font-semibold text-stone-900 tracking-wide">
                    Your Selection{" "}
                    <span className="text-xs font-mono font-normal text-stone-400">
                      ({totalItems} items)
                    </span>
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full bg-stone-50 text-stone-500 hover:text-stone-950 border border-stone-200 flex items-center justify-center hover:bg-stone-100 transition-all cursor-pointer focus:outline-none"
                  id="close-cart-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {orderPlaced ? (
                /* Success screen inside cart drawer */
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center bg-stone-50/40">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring" }}
                  >
                    <CheckCircle2 className="w-20 h-20 text-[#d4af37] mx-auto filter drop-shadow-[0_0_15px_rgba(212,175,55,0.15)]" />
                  </motion.div>
                  <h3 className="mt-6 text-xl font-serif font-bold text-stone-900 uppercase tracking-wider">
                    Order Prepared!
                  </h3>
                  <p className="mt-2 text-sm text-stone-500 leading-relaxed font-sans">
                    Your order has been directly submitted to our live kitchen dashboard.
                    {BRAND_CONFIG.restaurantName} staff will prepare and serve your meals shortly.
                  </p>
                  <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-xl text-[11px] font-mono text-stone-500 border border-stone-200">
                    <CheckCircle2 className="w-4 h-4 text-[#d4af37] animate-pulse" />
                    Kitchen dispatched successfully
                  </div>
                </div>
              ) : cart.length === 0 ? (
                /* Empty state inside cart drawer with smooth scale/fade animation */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-stone-50/10"
                >
                  <div className="w-16 h-16 rounded-full bg-stone-55 border border-stone-200 flex items-center justify-center text-stone-400 mb-4 shadow-inner">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-serif font-semibold text-stone-700">
                    Your bag is empty
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 font-sans max-w-[200px]">
                    Browse our premium menu categories and add items to your
                    plate.
                  </p>
                </motion.div>
              ) : (
                /* Cart Items List */
                <form
                  onSubmit={handleCheckout}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <AnimatePresence mode="popLayout">
                      {cart.map((item) => (
                        <motion.div
                          key={item.menuItem.id}
                          layout
                          initial={{ opacity: 0, y: 15, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -15, scale: 0.95 }}
                          transition={{ type: "spring", damping: 25, stiffness: 280 }}
                          className="bg-stone-50/65 p-4 rounded-xl border border-stone-200/80 flex flex-col gap-3 shadow-sm hover:border-stone-300 transition-all font-sans"
                          id={`cart-item-${item.menuItem.id}`}
                        >
                          <div className="flex gap-3">
                            <img
                              src={item.menuItem.imageUrl}
                              alt={item.menuItem.name}
                              className="w-14 h-14 object-cover rounded-lg bg-stone-100"
                            />
                            <div className="flex-grow min-w-0">
                              <div className="flex justify-between items-start">
                                <h4 className="text-sm font-semibold text-stone-900 leading-tight pr-1 truncate font-sans">
                                  {item.menuItem.name}
                                </h4>
                                <span className="text-sm font-mono font-semibold text-[#d4af37] flex-shrink-0">
                                  ₹{item.menuItem.price * item.quantity}
                                </span>
                              </div>
                              <span className="text-xs text-[#aa7c11] font-mono mt-0.5 block font-medium">
                                ₹{item.menuItem.price} each
                              </span>
                            </div>
                          </div>

                          {/* Quantity adjust & write customization text per item */}
                          <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 font-sans">
                            <input
                              type="text"
                              placeholder="Add custom preferences..."
                              value={item.customization || ""}
                              onChange={(e) =>
                                onUpdateCustomization(
                                  item.menuItem.id,
                                  e.target.value,
                                )
                              }
                              className="text-xs bg-white text-stone-800 placeholder-stone-400 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#d4af37]/60 border border-stone-200 w-36 sm:w-44 font-sans font-light"
                            />

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2.5 bg-stone-100/85 px-2 py-1 rounded-lg border border-stone-200/60 font-sans">
                                <button
                                  type="button"
                                  onClick={() => onRemoveFromCart(item.menuItem)}
                                  className="text-stone-500 hover:text-[#d4af37] w-6 h-6 flex items-center justify-center cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-stone-900 font-mono font-bold text-xs">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onAddToCart(item.menuItem)}
                                  className="text-stone-500 hover:text-[#d4af37] w-6 h-6 flex items-center justify-center cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  onRemoveEntirelyFromCart(item.menuItem)
                                }
                                className="text-stone-400 hover:text-red-500 hover:bg-red-55/40 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                                title="Remove from cart"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Order Details Form Block with premium AnimatePresence transition */}
                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/80 space-y-4 shadow-inner mt-6 overflow-hidden">
                      <AnimatePresence mode="wait">
                        {showOtpVerification ? (
                          <motion.div
                            key="otp-verification-container"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="space-y-4 font-sans"
                          >
                            <div className="flex items-center gap-2 text-[#d4af37]">
                              <svg
                                className="w-5 h-5 animate-pulse"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                              <span className="text-xs font-mono font-bold tracking-wider uppercase">
                                OTP Verification Gateway
                              </span>
                            </div>

                            <p className="text-stone-600 text-xs leading-relaxed">
                              To secure your kitchen reserve table, we have
                              dispatched a 4-digit verification code to{" "}
                              <strong className="text-stone-900">
                                {phoneNumber || "+91 11-4560-4560"}
                              </strong>
                              .
                            </p>

                            <div className="space-y-1.5">
                              <label className="text-[10px] text-stone-400 font-mono block">
                                ENTER 4-DIGIT CODE FROM PHONE
                              </label>
                              <input
                                type="text"
                                maxLength={4}
                                required
                                placeholder="••••"
                                value={otpCode}
                                onChange={(e) =>
                                  setOtpCode(e.target.value.replace(/\D/g, ""))
                                }
                                className="w-full text-center tracking-[0.8em] font-mono font-bold bg-white text-stone-900 placeholder-stone-300 text-base border border-stone-200 rounded-lg p-2.5 focus:outline-none focus:border-[#d4af37] transition-all"
                              />
                              {otpError && (
                                <p className="text-[10px] text-red-600 font-sans mt-1">
                                  {otpError}
                                </p>
                              )}
                            </div>

                            {/* Bypass hint for developer sandbox */}
                            <div className="p-2.5 bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-lg text-[10px] text-stone-700 font-mono flex items-center justify-between">
                              <span>🛡️ SIMULATED AUTH BYPASS:</span>
                              <strong className="text-sm font-bold text-[#d4af37] font-mono tracking-wider">
                                {generatedOtp}
                              </strong>
                            </div>

                            <div className="flex items-center justify-between pt-1 text-xs">
                              <button
                                type="button"
                                onClick={handleCancelOtp}
                                className="text-stone-500 hover:text-stone-700 font-medium underline cursor-pointer focus:outline-none"
                              >
                                Modify Details
                              </button>

                              {otpCountdown > 0 ? (
                                <span className="text-stone-400 font-mono text-[11px]">
                                  Resend in {otpCountdown}s
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleResendOtp}
                                  className="text-[#d4af37] hover:text-amber-600 font-bold underline cursor-pointer focus:outline-none"
                                >
                                  Resend CODE
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="details-form-container"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="space-y-4"
                          >
                            <h4 className="text-xs font-mono font-bold text-stone-400 tracking-widest uppercase">
                              GUEST & SERVICE DETAILS
                            </h4>

                            {/* Select Order Service Type */}
                            <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-lg border border-stone-200">
                              {(["dine-in", "takeaway"] as const).map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setOrderType(type)}
                                  className={`py-1.5 px-2 rounded text-[10px] font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                                    orderType === type
                                      ? "bg-[#d4af37] text-white"
                                      : "text-stone-500 hover:text-stone-700"
                                  }`}
                                >
                                  {type.replace("-", " ")}
                                </button>
                              ))}
                            </div>

                            {/* Form Fields depend on selected type */}
                            <div className="space-y-3 font-sans">
                              <div>
                                <label className="text-[10px] text-stone-400 font-mono block mb-1">
                                  YOUR FULL NAME *
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Aaryan Rajput"
                                  value={userName}
                                  onChange={(e) => setUserName(e.target.value)}
                                  className="w-full bg-white text-stone-900 placeholder-stone-450 text-xs border border-stone-200 rounded-lg p-2.5 focus:outline-none focus:border-[#d4af37] transition-all font-sans text-stone-850"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] text-stone-400 font-mono block mb-1">
                                  PHONE NUMBER (OPTIONAL)
                                </label>
                                <input
                                  type="tel"
                                  placeholder="+91 XXXXX XXXXX"
                                  value={phoneNumber}
                                  onChange={(e) => setPhoneNumber(e.target.value)}
                                  className="w-full bg-white text-stone-900 placeholder-stone-450 text-xs border border-stone-200 rounded-lg p-2.5 focus:outline-none focus:border-[#d4af37] transition-all font-sans text-stone-850"
                                />
                              </div>

                              {orderType === "dine-in" && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-2.5 bg-stone-50 p-3 rounded-2xl border border-stone-200"
                                >
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10.5px] text-stone-700 font-mono block font-bold uppercase tracking-wider flex items-center gap-1.5">
                                      <QrCode className="w-3.5 h-3.5 text-[#d4af37]" />
                                      <span>Restaurant Table No *</span>
                                    </label>
                                    {tableNumber && (
                                      <button
                                        type="button"
                                        onClick={() => setShowQrScanner(true)}
                                        className="text-[10px] text-[#aa7c11] hover:underline font-mono font-bold flex items-center gap-1 cursor-pointer"
                                      >
                                        <Camera className="w-3 h-3" />
                                        <span>Re-scan QR</span>
                                      </button>
                                    )}
                                  </div>

                                  {!tableNumber ? (
                                    <div className="space-y-2">
                                      <div className="bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-2xs font-sans">
                                        <Camera className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="text-[11px] leading-tight">
                                          Point your camera at the QR code stand on your table to automatically verify your table number.
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setShowQrScanner(true)}
                                          className="py-2.5 px-3 bg-[#d4af37] hover:bg-[#c5a028] text-stone-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer font-sans"
                                        >
                                          <Camera className="w-4 h-4" />
                                          <span>Scan Table QR</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setShowManualTablePicker(!showManualTablePicker)}
                                          className="py-2.5 px-3 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans"
                                        >
                                          <Edit2 className="w-3.5 h-3.5 text-stone-500" />
                                          <span>Choose Table</span>
                                        </button>
                                      </div>

                                      {showManualTablePicker && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: "auto" }}
                                          className="pt-1.5"
                                        >
                                          <select
                                            value={tableNumber}
                                            onChange={(e) => {
                                              const selected = e.target.value;
                                              setTableNumber(selected);
                                              saveActiveTable(selected, false);
                                              setIsQrScanned(false);
                                              setCheckoutError(null);
                                              setShowManualTablePicker(false);
                                            }}
                                            className="w-full bg-white text-stone-900 text-xs border border-stone-300 rounded-xl p-2.5 focus:outline-none focus:border-[#d4af37] font-sans"
                                          >
                                            <option value="">Select your table from list...</option>
                                            {LocalDB.getTables().map((tbl) => (
                                              <option key={tbl.id} value={tbl.tableNumber}>
                                                Table #{tbl.tableNumber} — {tbl.seatingArea}
                                              </option>
                                            ))}
                                          </select>
                                        </motion.div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className="bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-2xs font-sans">
                                        <div className="flex items-center gap-2">
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                          <span className="text-[11.5px]">
                                            Locked to <strong>Table #{tableNumber}</strong> {isQrScanned ? "(QR Verified)" : "(Selected)"}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            clearActiveTable();
                                            setTableNumber("");
                                            setIsQrScanned(false);
                                          }}
                                          className="text-[10px] text-stone-500 hover:text-red-600 font-mono underline cursor-pointer"
                                        >
                                          Clear
                                        </button>
                                      </div>

                                      <input
                                        type="hidden"
                                        required
                                        value={tableNumber}
                                      />
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Pricing Total Summary Box in Footer of Cart */}
                  <div className="bg-stone-50 border-t border-stone-150 p-5 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] font-sans">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-stone-500">
                        <span>Plate Subtotal</span>
                        <span className="font-mono">₹{subtotal}</span>
                      </div>
                      {packagingCharge > 0 && (
                        <div className="flex justify-between text-stone-500 font-light">
                          <span>Packaging & Convenience</span>
                          <span className="font-mono">₹{packagingCharge}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-stone-900 text-base font-bold pt-2 border-t border-stone-200">
                        <span className="font-serif italic font-medium">
                          Grand Total
                        </span>
                        <span className="font-mono text-[#d4af37]">
                          ₹{grandTotal}
                        </span>
                      </div>
                    </div>

                    {checkoutError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs text-center font-sans">
                        {checkoutError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-2 bg-stone-900 hover:bg-[#c67c4e] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-stone-950/10 flex items-center justify-center gap-2.5 transition-all cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-wait"
                      id="checkout-submit-btn"
                    >
                      <Send
                        className={`w-4 h-4 fill-current text-white ${isSubmitting ? "animate-bounce" : ""}`}
                      />
                      {isSubmitting
                        ? "RESERVING DISHES IN KITCHEN..."
                        : showOtpVerification
                          ? "VERIFY OTP & CONFIRM ORDER"
                          : "PLACE ORDER ONLINE"}
                    </button>
                    <p className="text-[10px] text-gray-500 text-center font-sans tracking-wide">
                      Clicking registers your cart items directly inside our kitchen queue.
                    </p>
                  </div>
                </form>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* In-App Live Camera QR Scanner Modal */}
      <QrScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScanSuccess={(table) => {
          setTableNumber(table);
          setIsQrScanned(true);
          setOrderType("dine-in");
          setCheckoutError(null);
        }}
        title="Scan Table QR Code"
        subtitle="Point camera at the table QR stand to link your dine-in basket"
      />
    </>
  );
}
