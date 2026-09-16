import React, { useState } from "react";
import { Users, Lock, KeyRound, CheckCircle, X, AlertCircle, Shield, Sparkles, UserCheck, ArrowRightLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StaffMember, StaffRole } from "../types";
import { RBACService } from "../lib/rbac";
import { LocalDB } from "../lib/db";

interface StaffQuickSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffSwitched?: (staff: StaffMember) => void;
}

export default function StaffQuickSwitchModal({
  isOpen,
  onClose,
  onStaffSwitched
}: StaffQuickSwitchModalProps) {
  const staffList = RBACService.getStaff().filter(s => s.status === "Active");
  const activeStaff = RBACService.getActiveStaff();
  
  const [selectedStaff, setSelectedStaff] = useState<StaffMember>(activeStaff);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectStaff = (s: StaffMember) => {
    setSelectedStaff(s);
    setPin("");
    setError(null);
    setSuccessMsg(null);
  };

  const handleKeypadPress = (val: string) => {
    setError(null);
    if (pin.length < 8) {
      const nextPin = pin + val;
      setPin(nextPin);
      // If PIN length matches target PIN length, auto verify
      if (selectedStaff && nextPin.length === selectedStaff.pin.length) {
        verifyAndSwitch(nextPin, selectedStaff);
      }
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

  const verifyAndSwitch = (testPin: string, staffTarget: StaffMember) => {
    if (!testPin.trim()) {
      setError("Please enter the 4-digit PIN.");
      return;
    }

    // Check if test PIN matches target staff PIN OR is master admin password
    const isMaster = testPin === "admin123" || testPin === "password123" || testPin === "9999";
    if (staffTarget.pin === testPin.trim() || isMaster) {
      RBACService.setActiveStaff(staffTarget);
      setSuccessMsg(`Authenticated as ${staffTarget.name} (${staffTarget.role})`);
      
      LocalDB.addAuditLog(
        "Staff Switch / Login",
        `Terminal active operator switched to ${staffTarget.name} [${staffTarget.role}].`,
        staffTarget.name
      );

      setTimeout(() => {
        onStaffSwitched?.(staffTarget);
        onClose();
        setPin("");
        setError(null);
        setSuccessMsg(null);
      }, 500);
    } else {
      setError("Incorrect PIN for " + staffTarget.name + ". Please try again.");
      setPin("");
    }
  };

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    verifyAndSwitch(pin, selectedStaff);
  };

  const handleLockTerminal = () => {
    RBACService.lockTerminal();
    onClose();
  };

  const getRoleBadge = (role: StaffRole) => {
    switch (role) {
      case "Owner":
        return "bg-amber-100 text-[#aa7c11] border-amber-300";
      case "Manager":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Cashier":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Waiter":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "Kitchen":
        return "bg-orange-100 text-orange-800 border-orange-300";
      default:
        return "bg-stone-100 text-stone-700 border-stone-300";
    }
  };

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
          className="relative w-full max-w-lg bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden z-10"
        >
          {/* Header Bar */}
          <div className="bg-stone-900 px-6 py-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                <ArrowRightLeft className="w-5 h-5 text-[#d4af37]" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-white tracking-wide">
                  Switch Active Staff Operator
                </h3>
                <p className="text-xs text-stone-400 font-mono">SHARED TERMINAL ACCESS & PIN LOGIN</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Staff Selector Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">
                  Select Staff Profile
                </span>
                <span className="text-[10px] text-stone-400 font-mono">
                  Currently Active: <strong className="text-stone-800">{activeStaff.name}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {staffList.map((s) => {
                  const isSelected = selectedStaff?.id === s.id;
                  const isCurrent = activeStaff.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStaff(s)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-2 ${
                        isSelected
                          ? "bg-amber-50/80 border-[#aa7c11] shadow-sm ring-2 ring-amber-300/60"
                          : "bg-white border-stone-200 hover:bg-stone-50 text-stone-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-xs text-stone-700 shrink-0 overflow-hidden">
                          {s.avatar ? (
                            <img src={s.avatar} alt={s.name} className="w-full h-full object-cover" />
                          ) : (
                            s.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-xs text-stone-900 truncate">
                            {s.name}
                          </div>
                          <div className="text-[9px] text-stone-400 font-mono">PIN: {s.pin}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${getRoleBadge(s.role)}`}>
                          {s.role}
                        </span>
                        {isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Session" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PIN Entry Display & Keypad */}
            {selectedStaff && (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#aa7c11]" />
                    <span className="text-xs font-mono font-bold text-stone-700 uppercase">
                      Enter PIN for {selectedStaff.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPin(selectedStaff.pin);
                      verifyAndSwitch(selectedStaff.pin, selectedStaff);
                    }}
                    className="text-[10px] font-mono text-[#aa7c11] hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                  >
                    <Sparkles className="w-3 h-3" />
                    Auto-Fill PIN ({selectedStaff.pin})
                  </button>
                </div>

                <form onSubmit={handleDirectSubmit} className="space-y-3">
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      setError(null);
                    }}
                    placeholder="••••"
                    maxLength={8}
                    className="w-full text-center text-2xl tracking-[0.6em] font-mono font-bold py-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-[#aa7c11] text-stone-900"
                    autoFocus
                  />

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
                        className={`h-10 rounded-xl font-mono text-base font-bold transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center justify-center ${
                          btn === "C"
                            ? "bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold"
                            : btn === "⌫"
                            ? "bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold"
                            : "bg-white hover:bg-stone-100 border border-stone-200 text-stone-900"
                        }`}
                      >
                        {btn}
                      </button>
                    ))}
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs flex items-center gap-2 font-mono">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {successMsg && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl text-xs flex items-center gap-2 font-mono font-semibold">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-[#aa7c11] hover:bg-[#8e670c] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      Authenticate & Switch
                    </button>
                    <button
                      type="button"
                      onClick={handleLockTerminal}
                      className="px-3 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-700 font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
