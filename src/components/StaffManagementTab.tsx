import React, { useState, useMemo, useEffect } from "react";
import { 
  Users, Shield, ShieldCheck, KeyRound, Plus, Edit2, Trash2, Check, X, 
  Search, Filter, Lock, Unlock, Sparkles, AlertCircle, CheckCircle, 
  RotateCcw, Eye, ShieldAlert, Award, FileText, ChevronRight, UserPlus,
  ToggleLeft, ToggleRight, Phone, Mail, Clock, Calendar, Hash, ArrowRightLeft
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StaffMember, StaffRole, PermissionKey, PermissionCategory, PermissionDefinition, RoleDefinition } from "../types";
import { RBACService, ALL_PERMISSIONS, DEFAULT_ROLES } from "../lib/rbac";
import { LocalDB, Order } from "../lib/db";
import { RESTAURANT_BRANDING } from "../config/branding";

interface StaffManagementTabProps {
  orders: Order[];
  onStaffUpdated?: () => void;
}

export default function StaffManagementTab({ orders, onStaffUpdated }: StaffManagementTabProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>(() => RBACService.getStaff());
  const [roles, setRoles] = useState<RoleDefinition[]>(() => RBACService.getRoles());
  const [activeSubTab, setActiveSubTab] = useState<"directory" | "roles" | "overrides" | "audit">("directory");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Form States for Add/Edit
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>("Cashier");
  const [formPin, setFormPin] = useState("");
  const [formCustomPerms, setFormCustomPerms] = useState<Partial<Record<PermissionKey, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Sync with RBAC events
  useEffect(() => {
    const refreshData = () => {
      setStaffList(RBACService.getStaff());
      setRoles(RBACService.getRoles());
    };
    window.addEventListener("staff_updated", refreshData);
    window.addEventListener("roles_updated", refreshData);
    window.addEventListener("storage", refreshData);
    return () => {
      window.removeEventListener("staff_updated", refreshData);
      window.removeEventListener("roles_updated", refreshData);
      window.removeEventListener("storage", refreshData);
    };
  }, []);

  const activeStaff = RBACService.getActiveStaff();

  // Generate random 4-digit PIN
  const generateRandomPin = () => {
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    setFormPin(random);
  };

  const handleOpenAdd = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("+91 ");
    setFormRole("Cashier");
    setFormCustomPerms({});
    setFormError(null);
    const randPin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormPin(randPin);
    setShowAddModal(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setFormName(staff.name);
    setFormEmail(staff.email);
    setFormPhone(staff.phone);
    setFormRole(staff.role);
    setFormPin(staff.pin);
    setFormCustomPerms(staff.customPermissions || {});
    setFormError(null);
    setShowEditModal(true);
  };

  const handleOpenResetPin = (staff: StaffMember) => {
    setSelectedStaff(staff);
    const randPin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormPin(randPin);
    setFormError(null);
    setShowResetPinModal(true);
  };

  const handleSaveNewStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      RBACService.addStaff({
        name: formName,
        email: formEmail,
        phone: formPhone,
        role: formRole,
        pin: formPin,
        customPermissions: Object.keys(formCustomPerms).length > 0 ? formCustomPerms : undefined,
        createdByStaff: activeStaff
      });
      setStaffList(RBACService.getStaff());
      setShowAddModal(false);
      onStaffUpdated?.();
    } catch (err: any) {
      setFormError(err.message || "Failed to add staff member.");
    }
  };

  const handleSaveEditStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setFormError(null);
    try {
      RBACService.updateStaff(
        selectedStaff.id,
        {
          name: formName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          role: formRole,
          pin: formPin.trim(),
          customPermissions: Object.keys(formCustomPerms).length > 0 ? formCustomPerms : undefined
        },
        activeStaff
      );
      setStaffList(RBACService.getStaff());
      setShowEditModal(false);
      setSelectedStaff(null);
      onStaffUpdated?.();
    } catch (err: any) {
      setFormError(err.message || "Failed to update staff member.");
    }
  };

  const handleSaveResetPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setFormError(null);
    try {
      RBACService.updateStaff(
        selectedStaff.id,
        { pin: formPin.trim() },
        activeStaff
      );
      LocalDB.addAuditLog(
        "Staff PIN Reset",
        `Security PIN reset for #${selectedStaff.id} (${selectedStaff.name}) by ${activeStaff.name}.`,
        activeStaff.name
      );
      setStaffList(RBACService.getStaff());
      setShowResetPinModal(false);
      setSelectedStaff(null);
      onStaffUpdated?.();
    } catch (err: any) {
      setFormError(err.message || "Failed to reset PIN.");
    }
  };

  const handleToggleStatus = (staff: StaffMember) => {
    if (staff.role === "Owner") {
      alert("The Owner account cannot be deactivated.");
      return;
    }
    const nextStatus = staff.status === "Active" ? "Inactive" : "Active";
    try {
      RBACService.updateStaff(staff.id, { status: nextStatus }, activeStaff);
      setStaffList(RBACService.getStaff());
      onStaffUpdated?.();
    } catch (err: any) {
      alert(err.message || "Failed to toggle status.");
    }
  };

  const handleDeleteStaff = (staff: StaffMember) => {
    if (staff.role === "Owner") {
      alert("The Owner account cannot be deleted.");
      return;
    }
    if (window.confirm(`Are you sure you want to permanently remove ${staff.name} (${staff.role})?`)) {
      try {
        RBACService.deleteStaff(staff.id, activeStaff);
        setStaffList(RBACService.getStaff());
        onStaffUpdated?.();
      } catch (err: any) {
        alert(err.message || "Failed to delete staff member.");
      }
    }
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      const matchQuery = 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.includes(searchQuery) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchRole = filterRole === "all" || s.role === filterRole;
      const matchStatus = filterStatus === "all" || s.status === filterStatus;
      return matchQuery && matchRole && matchStatus;
    });
  }, [staffList, searchQuery, filterRole, filterStatus]);

  // Compute staff sales stats from orders
  const staffSalesStats = useMemo(() => {
    const map: Record<string, { orderCount: number; totalSales: number }> = {};
    orders.forEach(o => {
      if (o.orderStatus !== "Cancelled") {
        const staffKey = (o as any).billedBy || "POS System Master";
        if (!map[staffKey]) {
          map[staffKey] = { orderCount: 0, totalSales: 0 };
        }
        map[staffKey].orderCount += 1;
        map[staffKey].totalSales += o.grandTotal || 0;
      }
    });
    return map;
  }, [orders]);

  // Grouped permissions by category
  const permissionsByCategory = useMemo(() => {
    const groups: Record<PermissionCategory, PermissionDefinition[]> = {} as any;
    ALL_PERMISSIONS.forEach(p => {
      if (!groups[p.category]) {
        groups[p.category] = [];
      }
      groups[p.category].push(p);
    });
    return groups;
  }, []);

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
    <div className="space-y-6" id="staff-management-tab">
      {/* Top Header & Stat Counters */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-amber-50 border border-amber-200 rounded-xl text-[#aa7c11]">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-serif font-bold text-stone-900">
              Staff, Roles & Access Control (RBAC)
            </h2>
          </div>
          <p className="text-xs text-stone-500 font-sans">
            Centralized employee directory, multi-tier role authorization, PIN credentials & granular permission matrices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-[#aa7c11] hover:bg-[#8e670c] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-stone-200 gap-2 overflow-x-auto pb-px">
        {[
          { id: "directory", label: "Staff Directory", icon: Users, count: staffList.length },
          { id: "roles", label: "Role & Permission Matrix", icon: ShieldCheck },
          { id: "overrides", label: "Custom User Overrides", icon: KeyRound },
          { id: "audit", label: "Authorization Audit Trail", icon: ShieldAlert }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "border-[#aa7c11] text-[#aa7c11] bg-amber-50/50 rounded-t-xl"
                  : "border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50 rounded-t-xl"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  isActive ? "bg-[#aa7c11] text-white" : "bg-stone-200 text-stone-700"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUBTAB 1: STAFF DIRECTORY */}
      {activeSubTab === "directory" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, email, phone, ID..."
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#aa7c11]"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5">
                <Filter className="w-3.5 h-3.5 text-stone-500" />
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="bg-transparent text-xs font-mono font-semibold text-stone-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="Owner">Owner</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Waiter">Waiter</option>
                  <option value="Kitchen">Kitchen</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-transparent text-xs font-mono font-semibold text-stone-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active Only</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Staff Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map((staff) => {
              const isCurrent = activeStaff.id === staff.id;
              const permCount = RBACService.getEffectivePermissions(staff).length;
              return (
                <motion.div
                  key={staff.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white border rounded-3xl p-5 shadow-xs transition-all relative flex flex-col justify-between ${
                    isCurrent ? "border-[#aa7c11] ring-2 ring-amber-200/60" : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  {/* Top Row: Avatar, Name, Status */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-base text-stone-700 overflow-hidden shrink-0 shadow-inner">
                          {staff.avatar ? (
                            <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" />
                          ) : (
                            staff.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-stone-900">
                              {staff.name}
                            </h4>
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[9px] font-mono font-bold">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-stone-400 font-mono mt-0.5">{staff.id}</p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${getRoleBadge(staff.role)}`}>
                        {staff.role}
                      </span>
                    </div>

                    {/* Details Info */}
                    <div className="space-y-1.5 text-xs text-stone-600 bg-stone-50 rounded-2xl p-3 border border-stone-150">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">{staff.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>{staff.phone}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 mt-1">
                        <div className="flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-[#aa7c11]" />
                          <span className="font-mono text-[11px] font-bold text-stone-800">
                            PIN: •••• ({staff.pin})
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-stone-400">
                          {permCount} Permissions
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-between pt-4 mt-3 border-t border-stone-100 gap-2">
                    <button
                      onClick={() => handleToggleStatus(staff)}
                      disabled={staff.role === "Owner"}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        staff.status === "Active"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                          : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${staff.status === "Active" ? "bg-emerald-500" : "bg-stone-400"}`} />
                      <span>{staff.status}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenResetPin(staff)}
                        title="Reset PIN"
                        className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(staff)}
                        title="Edit Profile & Permissions"
                        className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {staff.role !== "Owner" && (
                        <button
                          onClick={() => handleDeleteStaff(staff)}
                          title="Delete Staff"
                          className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: ROLE & PERMISSION MATRIX */}
      {activeSubTab === "roles" && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-150 pb-4">
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">
                System Role Permission Matrix
              </h3>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                Overview of permissions granted across all operational roles in {RESTAURANT_BRANDING.name}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-3 py-1 rounded-full border border-stone-200 font-semibold">
                {ALL_PERMISSIONS.length} Granular Security Keys
              </span>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="py-3 px-4 font-mono font-bold text-stone-600 uppercase tracking-wider w-2/5">
                    Permission Scope & Module
                  </th>
                  {roles.map(r => (
                    <th key={r.id} className="py-3 px-3 font-mono font-bold text-center uppercase tracking-wider">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] border ${getRoleBadge(r.id)}`}>
                        {r.id}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(Object.entries(permissionsByCategory) as [PermissionCategory, PermissionDefinition[]][]).map(([category, perms]) => (
                  <React.Fragment key={category}>
                    {/* Category Header Row */}
                    <tr className="bg-stone-100/60 font-mono font-bold text-[11px] text-stone-800">
                      <td colSpan={roles.length + 1} className="py-2 px-4 uppercase tracking-widest text-[#aa7c11]">
                        {category} ({perms.length})
                      </td>
                    </tr>

                    {/* Permissions in Category */}
                    {perms.map(p => (
                      <tr key={p.key} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-stone-900">{p.label}</div>
                          <div className="text-[10px] text-stone-400 font-mono">{p.key} • {p.description}</div>
                        </td>
                        {roles.map(r => {
                          const hasPerm = r.id === "Owner" || r.defaultPermissions.includes(p.key);
                          return (
                            <td key={r.id} className="py-2.5 px-3 text-center">
                              {hasPerm ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-stone-350">
                                  <X className="w-3 h-3" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: CUSTOM USER OVERRIDES */}
      {activeSubTab === "overrides" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Staff Selector Column */}
          <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-xs space-y-3">
            <h3 className="font-serif font-bold text-sm text-stone-900 uppercase tracking-wide">
              Select Staff Member
            </h3>
            <p className="text-xs text-stone-500 font-sans">
              Grant or revoke specific individual permissions regardless of role defaults.
            </p>

            <div className="space-y-2 mt-2">
              {staffList.map((s) => {
                const isSelected = selectedStaff?.id === s.id;
                const overrideCount = Object.keys(s.customPermissions || {}).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStaff(s)}
                    className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-50 border-[#aa7c11] shadow-xs ring-1 ring-amber-300"
                        : "bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-800"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-stone-900">{s.name}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{s.role} • {s.id}</div>
                    </div>
                    {overrideCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#aa7c11] text-white">
                        {overrideCount} Overrides
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Overrides Editor Column */}
          <div className="lg:col-span-2 bg-white border border-stone-200 rounded-3xl p-6 shadow-xs space-y-4">
            {selectedStaff ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-stone-150 pb-4">
                  <div>
                    <h3 className="font-serif font-bold text-base text-stone-900">
                      Permission Overrides for {selectedStaff.name}
                    </h3>
                    <p className="text-xs text-stone-500 font-mono">
                      Role: <strong className="text-stone-800">{selectedStaff.role}</strong> • Status: {selectedStaff.status}
                    </p>
                  </div>

                  {selectedStaff.role === "Owner" && (
                    <span className="px-3 py-1 bg-amber-100 text-[#aa7c11] border border-amber-300 rounded-full text-[10px] font-mono font-bold">
                      Owner Has Master Bypass
                    </span>
                  )}
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {(Object.entries(permissionsByCategory) as [PermissionCategory, PermissionDefinition[]][]).map(([cat, perms]) => (
                    <div key={cat} className="space-y-2">
                      <div className="text-[11px] font-mono font-bold text-[#aa7c11] uppercase tracking-wider bg-stone-100/80 px-3 py-1.5 rounded-xl">
                        {cat}
                      </div>

                      <div className="space-y-1.5">
                        {perms.map((p) => {
                          const customVal = selectedStaff.customPermissions?.[p.key];
                          const roleDefault = RBACService.getRoles().find(r => r.id === selectedStaff.role)?.defaultPermissions.includes(p.key);
                          const isExplicitGrant = customVal === true;
                          const isExplicitRevoke = customVal === false;
                          const isDefault = customVal === undefined;

                          const handleToggleOverride = (mode: "default" | "grant" | "revoke") => {
                            const current = { ...(selectedStaff.customPermissions || {}) };
                            if (mode === "default") {
                              delete current[p.key];
                            } else if (mode === "grant") {
                              current[p.key] = true;
                            } else {
                              current[p.key] = false;
                            }

                            const updated = RBACService.updateStaff(selectedStaff.id, {
                              customPermissions: Object.keys(current).length > 0 ? current : undefined
                            }, activeStaff);
                            setSelectedStaff(updated);
                            setStaffList(RBACService.getStaff());
                          };

                          return (
                            <div
                              key={p.key}
                              className="flex items-center justify-between p-2.5 rounded-xl border border-stone-150 bg-stone-50/50 hover:bg-stone-50 text-xs"
                            >
                              <div className="max-w-[65%]">
                                <span className="font-semibold text-stone-800">{p.label}</span>
                                <p className="text-[10px] text-stone-400 font-mono truncate">{p.description}</p>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleOverride("default")}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                                    isDefault
                                      ? "bg-stone-200 text-stone-800 font-bold"
                                      : "bg-white border border-stone-200 text-stone-500 hover:bg-stone-100"
                                  }`}
                                >
                                  Inherit ({roleDefault ? "Yes" : "No"})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleOverride("grant")}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                                    isExplicitGrant
                                      ? "bg-emerald-500 text-white font-bold"
                                      : "bg-white border border-stone-200 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  + Grant
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleOverride("revoke")}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                                    isExplicitRevoke
                                      ? "bg-red-500 text-white font-bold"
                                      : "bg-white border border-stone-200 text-red-700 hover:bg-red-50"
                                  }`}
                                >
                                  - Revoke
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-stone-400 space-y-2">
                <Users className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-xs font-mono">Select a staff member from the left panel to inspect or edit permission overrides.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: AUTHORIZATION AUDIT TRAIL */}
      {activeSubTab === "audit" && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-150 pb-4">
            <div>
              <h3 className="font-serif font-bold text-base text-stone-900">
                Staff & Security Activity Audit Ledger
              </h3>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                Tamper-proof real-time log of staff logins, manager overrides, PIN changes, and role assignments.
              </p>
            </div>
          </div>

          <div className="divide-y divide-stone-100 max-h-[500px] overflow-y-auto">
            {LocalDB.getAuditLogs()
              .filter(l => 
                l.action.includes("Staff") || 
                l.action.includes("Override") || 
                l.action.includes("PIN") || 
                l.action.includes("Login") || 
                l.action.includes("Admin")
              )
              .map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900">{log.action}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-stone-100 text-stone-600 border border-stone-200">
                        {log.user}
                      </span>
                    </div>
                    <p className="text-stone-600 text-xs font-sans">{log.details}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-stone-400 block">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[9px] font-mono text-stone-400">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW STAFF MEMBER */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden z-10 p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-stone-150 pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#aa7c11]" />
                  <h3 className="font-serif font-bold text-lg text-stone-900">Add New Staff Member</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-stone-400 hover:text-stone-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs flex items-center gap-2 font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveNewStaff} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#aa7c11]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">Role Assignment *</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as StaffRole)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:border-[#aa7c11] cursor-pointer"
                    >
                      <option value="Manager">Manager</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Waiter">Waiter</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Owner">Owner</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">4-Digit PIN *</label>
                      <button
                        type="button"
                        onClick={generateRandomPin}
                        className="text-[9px] font-mono text-[#aa7c11] hover:underline cursor-pointer"
                      >
                        🎲 Randomize
                      </button>
                    </div>
                    <input
                      required
                      type="text"
                      maxLength={6}
                      value={formPin}
                      onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="1234"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold text-center tracking-[0.3em] text-stone-900 focus:outline-none focus:border-[#aa7c11]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">Email Address</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. staff@xingskitchen.com"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#aa7c11]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">Phone Contact</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#aa7c11]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#aa7c11] hover:bg-[#8e670c] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Save & Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT STAFF PROFILE */}
      <AnimatePresence>
        {showEditModal && selectedStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden z-10 p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-stone-150 pb-3">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-[#aa7c11]" />
                  <h3 className="font-serif font-bold text-lg text-stone-900">Edit Staff Profile</h3>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-1 rounded-lg text-stone-400 hover:text-stone-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs flex items-center gap-2 font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEditStaff} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#aa7c11]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">Role Assignment</label>
                    <select
                      value={formRole}
                      disabled={selectedStaff.role === "Owner"}
                      onChange={(e) => setFormRole(e.target.value as StaffRole)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:border-[#aa7c11] cursor-pointer disabled:opacity-50"
                    >
                      <option value="Manager">Manager</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Waiter">Waiter</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Owner">Owner</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">PIN Code</label>
                    <input
                      required
                      type="text"
                      maxLength={6}
                      value={formPin}
                      onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold text-center tracking-[0.3em] text-stone-900 focus:outline-none focus:border-[#aa7c11]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">Email</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#aa7c11]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">Phone</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#aa7c11]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#aa7c11] hover:bg-[#8e670c] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: RESET PIN */}
      <AnimatePresence>
        {showResetPinModal && selectedStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetPinModal(false)}
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden z-10 p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-stone-150 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-[#aa7c11]" />
                  <h3 className="font-serif font-bold text-base text-stone-900">Reset Security PIN</h3>
                </div>
                <button onClick={() => setShowResetPinModal(false)} className="p-1 rounded-lg text-stone-400 hover:text-stone-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-stone-600 font-sans">
                Set a new 4-digit numeric login PIN for <strong className="text-stone-900">{selectedStaff.name}</strong> ({selectedStaff.role}).
              </p>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs font-mono">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveResetPin} className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">New PIN</label>
                    <button
                      type="button"
                      onClick={generateRandomPin}
                      className="text-[9px] font-mono text-[#aa7c11] hover:underline cursor-pointer"
                    >
                      🎲 Generate Random
                    </button>
                  </div>
                  <input
                    required
                    type="text"
                    maxLength={6}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3.5 py-3 bg-stone-50 border border-stone-200 rounded-xl text-lg font-mono font-bold text-center tracking-[0.4em] text-stone-900 focus:outline-none focus:border-[#aa7c11]"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#aa7c11] hover:bg-[#8e670c] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Confirm PIN Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetPinModal(false)}
                    className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
