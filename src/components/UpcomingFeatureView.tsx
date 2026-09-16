import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Clock, CheckCircle2, Bell, ChevronRight, Eye, Layers } from "lucide-react";

export interface UpcomingFeatureHighlight {
  title: string;
  description: string;
  tag?: string;
}

interface UpcomingFeatureViewProps {
  id: string;
  icon: React.ReactNode;
  featureTitle: string;
  category: string;
  description: string;
  highlights: UpcomingFeatureHighlight[];
  estimatedRelease?: string;
  children?: React.ReactNode;
}

export default function UpcomingFeatureView({
  id,
  icon,
  featureTitle,
  category,
  description,
  highlights,
  estimatedRelease = "Upcoming in Next Production Update",
  children
}: UpcomingFeatureViewProps) {
  const [isNotified, setIsNotified] = useState(false);
  const [showPreviewSandbox, setShowPreviewSandbox] = useState(false);

  return (
    <motion.div
      id={`upcoming-feature-${id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 max-w-5xl mx-auto font-sans"
    >
      {/* Hero Showcase Card */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-bl from-amber-100/40 via-stone-50/20 to-transparent rounded-full pointer-events-none blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-[#aa7c11] flex-shrink-0 shadow-xs">
              {React.cloneElement(icon as React.ReactElement, { className: "w-7 h-7" })}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#aa7c11] bg-amber-50 border border-amber-250/70 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#aa7c11] animate-ping" />
                  Upcoming Feature
                </span>
                <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">
                  • {category}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 tracking-wide">
                {featureTitle}
              </h2>

              <p className="text-xs sm:text-sm text-stone-600 font-sans font-light leading-relaxed max-w-2xl pt-1">
                {description}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsNotified(!isNotified)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs border ${
                isNotified
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-[#d4af37] hover:bg-[#aa7c11] border-[#aa7c11] text-white"
              }`}
            >
              {isNotified ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Subscribed to Release</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Notify When Live</span>
                </>
              )}
            </button>

            {children && (
              <button
                type="button"
                onClick={() => setShowPreviewSandbox(!showPreviewSandbox)}
                className="px-4 py-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-stone-500" />
                <span>{showPreviewSandbox ? "Hide Prototype" : "Preview Sandbox"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Timeline banner */}
        <div className="mt-6 pt-5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-stone-500 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-[#aa7c11]" />
            <span>Status: <strong className="text-stone-800 font-semibold">{estimatedRelease}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-stone-400 font-mono text-[10px]">
            <Layers className="w-3 h-3" />
            <span>Engineered for seamless integration with POS & Kitchen Display</span>
          </div>
        </div>
      </div>

      {/* Planned Capabilities Grid */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="w-4 h-4 text-[#aa7c11]" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
            Planned Capabilities in this Module
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {highlights.map((item, index) => (
            <div
              key={index}
              className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs hover:border-stone-300 transition-colors flex flex-col justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-[#aa7c11] flex-shrink-0" />
                    <span>{item.title}</span>
                  </h4>
                  {item.tag && (
                    <span className="text-[9px] font-mono text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded font-medium">
                      {item.tag}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed font-sans pl-5">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Development sandbox view if toggled */}
      <AnimatePresence>
        {showPreviewSandbox && children && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden pt-4 space-y-4"
          >
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="font-mono font-bold text-[10px] tracking-wide uppercase">
                  Preview Mode: Unreleased Engineering Tools Active
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewSandbox(false)}
                className="text-[10px] font-mono uppercase underline text-amber-900 hover:text-amber-950 font-bold cursor-pointer"
              >
                Close Sandbox
              </button>
            </div>
            <div className="opacity-95">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
