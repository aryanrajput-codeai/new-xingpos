import React, { useState, useEffect } from "react";
import { Globe, QrCode, Printer, Bell, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { FeatureFlags, FeatureFlagsManager } from "../lib/featureFlags";
import { LocalDB } from "../lib/db";

interface FeatureQuickToggleStripProps {
  onOpenFullMatrix?: () => void;
  isMatrixOpen?: boolean;
}

export default function FeatureQuickToggleStrip({ onOpenFullMatrix, isMatrixOpen }: FeatureQuickToggleStripProps) {
  const [flags, setFlags] = useState<FeatureFlags>(() => FeatureFlagsManager.getFlags());

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setFlags(e.detail);
      }
    };
    window.addEventListener("xings-features-changed", handleUpdate);
    return () => window.removeEventListener("xings-features-changed", handleUpdate);
  }, []);

  const handleToggle = (key: keyof FeatureFlags, name: string) => {
    const nextVal = !flags[key];
    const updated = FeatureFlagsManager.setFlag(key, nextVal);
    setFlags(updated);
    LocalDB.addAuditLog(
      "Feature Toggled",
      `${name} quickly turned ${nextVal ? "ON" : "OFF"} via top bar`,
      "Admin Hub"
    );
  };

  const quickFeatures: { key: keyof FeatureFlags; label: string; icon: React.ReactNode }[] = [
    { key: "onlineOrdering", label: "Online Ordering", icon: <Globe className="w-3.5 h-3.5" /> },
    { key: "tableQrOrdering", label: "Table QR", icon: <QrCode className="w-3.5 h-3.5" /> },
    { key: "autoPrintKot", label: "Auto KOT", icon: <Printer className="w-3.5 h-3.5" /> },
    { key: "soundAlerts", label: "Order Chimes", icon: <Bell className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-white border border-stone-200/90 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 shadow-2xs font-sans">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#aa7c11]">
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </div>
        <span className="text-[11px] font-mono font-bold text-stone-700 uppercase tracking-wider">
          LIVE FEATURE TOGGLES:
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {quickFeatures.map(({ key, label, icon }) => {
          const isEnabled = Boolean(flags[key]);
          return (
            <div
              key={key}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                isEnabled
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : "bg-stone-50 border-stone-200 text-stone-400"
              }`}
            >
              <span className={isEnabled ? "text-emerald-600" : "text-stone-400"}>{icon}</span>
              <span className="text-[11px] font-medium">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                onClick={() => handleToggle(key, label)}
                className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-1 ${
                  isEnabled ? "bg-emerald-600" : "bg-stone-300"
                }`}
                title={`Toggle ${label} ${isEnabled ? "OFF" : "ON"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    isEnabled ? "translate-x-3" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}

        {onOpenFullMatrix && (
          <button
            type="button"
            onClick={onOpenFullMatrix}
            className="text-[11px] font-bold text-[#aa7c11] hover:text-[#8a630c] px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>{isMatrixOpen ? "Hide Panel" : "All Features (14)"}</span>
            {isMatrixOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}
