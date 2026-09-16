import React, { useState } from "react";
import { ShieldAlert, KeyRound, CheckCircle, X, AlertCircle, Sparkles, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PermissionKey, StaffMember, ManagerOverrideContext } from "../types";
import { RBACService } from "../lib/rbac";
import { LocalDB } from "../lib/db";

interface ManagerOverrideModalProps {
  isOpen: boolean;
  context: ManagerOverrideContext | null;
  onClose: () => void;
  onAuthorized: (manager: StaffMember, reason: string) => void;
}

export default function ManagerOverrideModal({
  isOpen,
  context,
  onClose,
  onAuthorized
}: ManagerOverrideModalProps) {
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !context) return null;

  const handleKeypadPress = (val: string) => {
    setError(null);
    if (pin.length < 8) {
      setPin(prev => prev + val);
    }
  };

  const handleBackspace = () => {
    setError(null);
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPin("");
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!pin.trim()) {
      setError("Please enter a manager passcode or PIN.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = RBACService.authorizeManagerOverride(pin, context.requiredPermission);
      if (!res.success || !res.manager) {
        setError(res.error || "Invalid manager authorization PIN.");
        setIsSubmitting(false);
        return;
      }

      // Log the authorized override in audit ledger
      const actionDesc = `${context.actionLabel}${context.targetDetails ? ` (${context.targetDetails})` : ""}`;
      LocalDB.addAuditLog(
        "Manager Override Authorized",
        `Manager ${res.manager.name} (${res.manager.role}) authorized action: "${actionDesc}". Justification: "${reason.trim() || 'Direct operational authorization'}"`,
        res.manager.name
      );

      // Trigger success callback
      onAuthorized(res.manager, reason.trim() || "Manager PIN Authorization");
      setPin("");
      setReason("");
      setError(null);
    } catch (err: any) {
      setError(err.message || "Authorization failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pre-fill quick demo profiles for fast testing
  const allStaff = RBACService.getStaff();
  const eligibleManagers = allStaff.filter(s => s.status === "Active" && (s.role === "Owner" || s.role === "Manager"));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden z-10"
        >
          {/* Header Bar with Alert Styling */}
          <div className="bg-gradient-to-r from-red-600 to-amber-600 px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                  <ShieldAlert className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-white tracking-wide">
                    Manager Authorization
                  </h3>
                  <p className="text-xs text-white/80 font-mono">RESTRICTED PRIVILEGE ELEVATION</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Restricted Action Notice */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-stone-500 font-semibold mb-1">
                Requested Action
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-900 text-sm">
                  {context.actionLabel}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-100 text-red-700 border border-red-200">
                  {context.requiredPermission}
                </span>
              </div>
              {context.targetDetails && (
                <p className="text-xs text-stone-600 mt-1.5 font-mono">
                  {context.targetDetails}
                </p>
              )}
            </div>

            {/* Quick Demo Pickers for instant approval */}
            {eligibleManagers.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-stone-450 uppercase tracking-widest flex items-center justify-between">
                  <span>Quick Test Select (Managers)</span>
                  <Sparkles className="w-3 h-3 text-amber-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {eligibleManagers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPin(m.pin);
                        setError(null);
                      }}
                      className={`px-3 py-2 rounded-xl text-left border text-xs transition-all cursor-pointer flex items-center justify-between ${
                        pin === m.pin
                          ? "bg-amber-50 border-amber-400 text-amber-900 font-semibold ring-2 ring-amber-200"
                          : "bg-white border-stone-200 hover:bg-stone-50 text-stone-700"
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-medium truncate">{m.name}</div>
                        <div className="text-[10px] text-stone-400 font-mono">{m.role} • PIN: {m.pin}</div>
                      </div>
                      <UserCheck className="w-3.5 h-3.5 opacity-40 shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PIN Entry Display */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-widest text-center">
                Enter Manager Security PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  placeholder="••••"
                  maxLength={8}
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold py-3 bg-stone-100 border border-stone-300 rounded-2xl focus:outline-none focus:border-red-500 focus:bg-white transition-all text-stone-900"
                  autoFocus
                />
              </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => {
                    if (btn === "C") handleClear();
                    else if (btn === "⌫") handleBackspace();
                    else handleKeypadPress(btn);
                  }}
                  className={`h-11 rounded-xl font-mono text-base font-bold transition-all cursor-pointer active:scale-95 shadow-xs flex items-center justify-center ${
                    btn === "C"
                      ? "bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm"
                      : btn === "⌫"
                      ? "bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm"
                      : "bg-white hover:bg-stone-100 border border-stone-200 text-stone-800 text-lg"
                  }`}
                >
                  {btn}
                </button>
              ))}
            </div>

            {/* Optional Justification Note */}
            <div className="space-y-1">
              <label className="block text-[10px] font-mono text-stone-500 uppercase tracking-widest">
                Authorization Note / Justification (Optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer goodwill discount, spilled item replacement"
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#aa7c11]"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>Authorize Action</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
