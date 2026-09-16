import React from "react";
import { RESTAURANT_BRANDING } from "../config/branding";

export default function PoweredByBar() {
  return (
    <div
      id="powered-by-webrajya-bar"
      className="w-full bg-stone-950 text-stone-400 border-b border-stone-850/80 py-1.5 px-4 text-center z-50 select-none transition-colors"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-sans tracking-wide">
        <span className="text-stone-400">Powered by</span>
        <span className="font-semibold text-stone-200 tracking-wider">
          {RESTAURANT_BRANDING.poweredBy}
        </span>
      </div>
    </div>
  );
}
