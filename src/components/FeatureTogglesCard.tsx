import React, { useState, useEffect } from "react";
import {
  Globe,
  QrCode,
  Printer,
  Bell,
  Zap,
  Ticket,
  Truck,
  ShoppingBag,
  Boxes,
  Star,
  LayoutGrid,
  FileText,
  Flame,
  Receipt,
  Sliders,
  Check,
  RotateCcw,
  Power,
  Search,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { FeatureFlags, FeatureFlagsManager, FEATURE_METADATA, DEFAULT_FEATURE_FLAGS } from "../lib/featureFlags";
import { LocalDB } from "../lib/db";

interface FeatureTogglesCardProps {
  onFlagsChanged?: (newFlags: FeatureFlags) => void;
  className?: string;
}

export default function FeatureTogglesCard({ onFlagsChanged, className = "" }: FeatureTogglesCardProps) {
  const [flags, setFlags] = useState<FeatureFlags>(() => FeatureFlagsManager.getFlags());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "ordering" | "kitchen" | "pos" | "guest">("all");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" } | null>(null);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setFlags(e.detail);
      }
    };
    window.addEventListener("xings-features-changed", handleUpdate);
    return () => window.removeEventListener("xings-features-changed", handleUpdate);
  }, []);

  const handleToggle = (key: keyof FeatureFlags) => {
    const nextVal = !flags[key];
    const updated = FeatureFlagsManager.setFlag(key, nextVal);
    setFlags(updated);
    
    const meta = FEATURE_METADATA[key];
    LocalDB.addAuditLog(
      "Feature Toggled",
      `${meta.name} switched ${nextVal ? "ON" : "OFF"} by Manager`,
      "Admin Hub"
    );

    setNotification({
      message: `${meta.name} is now ${nextVal ? "ENABLED" : "DISABLED"}`,
      type: nextVal ? "success" : "info",
    });

    if (onFlagsChanged) {
      onFlagsChanged(updated);
    }

    setTimeout(() => {
      setNotification(null);
    }, 3200);
  };

  const handleResetDefaults = () => {
    const reset = FeatureFlagsManager.resetToDefaults();
    setFlags(reset);
    LocalDB.addAuditLog("Features Reset", "All operational feature flags reset to system defaults", "Admin Hub");
    setNotification({ message: "All features reset to recommended defaults", type: "info" });
    if (onFlagsChanged) onFlagsChanged(reset);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleToggleAll = (enabled: boolean) => {
    const updated = FeatureFlagsManager.setAll(enabled);
    setFlags(updated);
    LocalDB.addAuditLog(
      "Features Bulk Action",
      `All operational features switched ${enabled ? "ON" : "OFF"}`,
      "Admin Hub"
    );
    setNotification({
      message: `All restaurant features have been turned ${enabled ? "ON" : "OFF"}`,
      type: enabled ? "success" : "info",
    });
    if (onFlagsChanged) onFlagsChanged(updated);
    setTimeout(() => setNotification(null), 3000);
  };

  const getFeatureIcon = (iconName: string) => {
    switch (iconName) {
      case "Globe": return <Globe className="w-4 h-4" />;
      case "QrCode": return <QrCode className="w-4 h-4" />;
      case "Printer": return <Printer className="w-4 h-4" />;
      case "Bell": return <Bell className="w-4 h-4" />;
      case "Zap": return <Zap className="w-4 h-4" />;
      case "Ticket": return <Ticket className="w-4 h-4" />;
      case "Truck": return <Truck className="w-4 h-4" />;
      case "ShoppingBag": return <ShoppingBag className="w-4 h-4" />;
      case "Boxes": return <Boxes className="w-4 h-4" />;
      case "Star": return <Star className="w-4 h-4" />;
      case "LayoutGrid": return <LayoutGrid className="w-4 h-4" />;
      case "FileText": return <FileText className="w-4 h-4" />;
      case "Flame": return <Flame className="w-4 h-4" />;
      case "Receipt": return <Receipt className="w-4 h-4" />;
      default: return <Sliders className="w-4 h-4" />;
    }
  };

  const allKeys = Object.keys(FEATURE_METADATA) as (keyof FeatureFlags)[];

  const filteredKeys = allKeys.filter((key) => {
    const meta = FEATURE_METADATA[key];
    const matchesCategory = activeCategory === "all" || meta.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      meta.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meta.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeCount = Object.values(flags).filter(Boolean).length;
  const totalCount = allKeys.length;

  return (
    <div className={`bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 text-left ${className}`} id="feature-toggles-container">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-[#aa7c11] flex-shrink-0 mt-0.5">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-serif font-bold text-stone-900 uppercase tracking-wider">
                Operational Feature Toggles
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold">
                {activeCount} / {totalCount} Active
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5 font-sans">
              Instantly toggle live restaurant services, ordering channels, and automation features.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleToggleAll(true)}
            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
            title="Turn on all features"
          >
            <Power className="w-3 h-3 text-emerald-600" />
            <span>Enable All</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleAll(false)}
            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
            title="Turn off all features"
          >
            <Power className="w-3 h-3 text-rose-600" />
            <span>Disable All</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
            title="Reset all toggles to factory default"
          >
            <RotateCcw className="w-3 h-3 text-stone-500" />
            <span>Defaults</span>
          </button>
        </div>
      </div>

      {/* Floating Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl text-xs flex items-center gap-2.5 font-sans border ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Category Filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "All Features" },
            { id: "ordering", label: "Ordering" },
            { id: "kitchen", label: "Kitchen & KDS" },
            { id: "pos", label: "POS & Floor" },
            { id: "guest", label: "Guest & Loyalty" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as any)}
              className={`text-[11px] px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-[#d4af37] text-white font-bold shadow-xs"
                  : "bg-stone-100 hover:bg-stone-200/80 text-stone-600"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#d4af37] font-sans"
          />
        </div>
      </div>

      {/* Feature Toggles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {filteredKeys.map((key) => {
          const meta = FEATURE_METADATA[key];
          const isEnabled = Boolean(flags[key]);

          return (
            <div
              key={key}
              className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                isEnabled
                  ? "bg-white border-stone-200 hover:border-[#d4af37]/60 shadow-xs"
                  : "bg-stone-50/70 border-stone-200/60 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                      isEnabled
                        ? "bg-amber-50 text-[#aa7c11] border border-amber-200/60"
                        : "bg-stone-200/60 text-stone-400"
                    }`}
                  >
                    {getFeatureIcon(meta.icon)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-bold text-stone-900 leading-tight">
                        {meta.name}
                      </h4>
                      {meta.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-500 border border-stone-250/50">
                          {meta.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 leading-normal mt-1 font-sans">
                      {meta.description}
                    </p>
                  </div>
                </div>

                {/* The Toggle Switch */}
                <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    id={`toggle-${key}`}
                    onClick={() => handleToggle(key)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEnabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-stone-300 hover:bg-stone-400"
                    }`}
                    title={`Click to turn ${isEnabled ? "OFF" : "ON"} ${meta.name}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase ${
                      isEnabled ? "text-emerald-700" : "text-stone-400"
                    }`}
                  >
                    {isEnabled ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredKeys.length === 0 && (
        <div className="text-center py-8 text-stone-400 font-sans text-xs">
          No features match your search query "{searchQuery}".
        </div>
      )}
    </div>
  );
}
