import { StaffMember, StaffRole, PermissionKey, PermissionDefinition, RoleDefinition } from "../types";
import { LocalDB } from "./db";

// -------------------------------------------------------------
// MASTER PERMISSIONS CATALOG
// -------------------------------------------------------------

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // POS & Orders
  { key: "pos.access", label: "Access POS Billing", description: "Open and view the POS billing terminal interface", category: "POS & Orders" },
  { key: "pos.create_order", label: "Create & Place Orders", description: "Take new orders and dispatch KOTs to kitchen", category: "POS & Orders" },
  { key: "pos.apply_discount", label: "Apply Custom Discount", description: "Apply item or bill level percentage/fixed discounts", category: "POS & Orders", requiresManagerApprovalForCashier: true },
  { key: "pos.manual_item", label: "Add Custom/Manual Items", description: "Add non-catalog custom price items to the cart", category: "POS & Orders", requiresManagerApprovalForCashier: true },
  { key: "pos.edit_price", label: "Override Item Prices", description: "Change standard menu item unit price on active cart", category: "POS & Orders", requiresManagerApprovalForCashier: true },
  { key: "pos.void_item", label: "Delete / Void Cart Items", description: "Remove ordered items from confirmed or active carts", category: "POS & Orders", requiresManagerApprovalForCashier: true },
  { key: "pos.void_order", label: "Cancel / Void Orders", description: "Void or cancel active or served orders", category: "POS & Orders", requiresManagerApprovalForCashier: true },
  { key: "pos.split_bill", label: "Split Bill & Settle", description: "Perform multi-guest split settlements and partial bills", category: "POS & Orders" },
  { key: "pos.transfer_table", label: "Transfer & Merge Tables", description: "Move guests between tables or merge open dining sessions", category: "POS & Orders" },
  { key: "pos.reprint_bill", label: "Reprint Final Invoices", description: "Reprint customer receipts after settlement", category: "POS & Orders" },
  { key: "order.confirm", label: "Confirm / Accept Orders", description: "Accept and confirm placed orders", category: "POS & Orders" },
  { key: "order.start_prep", label: "Send to Prep / Kitchen", description: "Move confirmed orders into kitchen preparation", category: "Kitchen & KDS" },
  { key: "order.mark_ready", label: "Mark Order Ready", description: "Mark prepared orders ready for service or pickup", category: "Kitchen & KDS" },
  { key: "order.fulfill", label: "Fulfill Order (Serve/Pack/Dispatch)", description: "Mark orders served, packed, or out for delivery", category: "POS & Orders" },
  { key: "order.complete", label: "Complete Order Lifecycle", description: "Close and finalize operational order lifecycle", category: "POS & Orders" },
  { key: "order.cancel", label: "Cancel Active Orders", description: "Cancel orders before or during preparation", category: "POS & Orders", requiresManagerApprovalForCashier: true },
  { key: "order.void", label: "Void Completed Orders", description: "Administrative voiding of processed orders", category: "POS & Orders", requiresManagerApprovalForCashier: true },
  { key: "order.rollback", label: "Rollback Order Status", description: "Revert order status to previous operational state", category: "POS & Orders", requiresManagerApprovalForCashier: true },

  // Payments & Billing
  { key: "payment.accept", label: "Accept Payments", description: "Record Cash, UPI, Card, or Multi-tender settlements", category: "Payments & Billing" },
  { key: "payment.refund", label: "Issue Refunds", description: "Process full or partial payment refunds to guests", category: "Payments & Billing", requiresManagerApprovalForCashier: true },
  { key: "payment.void", label: "Void Payment Records", description: "Invalidate incorrect payment transaction entries", category: "Payments & Billing", requiresManagerApprovalForCashier: true },

  // Shifts & Cash
  { key: "shift.open", label: "Open Cash Shift", description: "Initialize shift with opening float and register count", category: "Shifts & Cash" },
  { key: "shift.close", label: "Close Cash Shift", description: "Count physical cash drawer and finalize daily shift", category: "Shifts & Cash" },
  { key: "shift.reopen", label: "Reopen Closed Shift", description: "Reopen a previously closed shift for adjustments", category: "Shifts & Cash", requiresManagerApprovalForCashier: true },
  { key: "shift.force_close", label: "Emergency Force Close", description: "Force close a locked or orphaned shift without count", category: "Shifts & Cash", requiresManagerApprovalForCashier: true },
  { key: "shift.cash_adjustment", label: "Cash In / Cash Out (Petty Cash)", description: "Record drawer additions or payouts for expenses", category: "Shifts & Cash", requiresManagerApprovalForCashier: true },
  { key: "shift.view_own_report", label: "View Own Shift Summary", description: "View financial report for own currently active shift", category: "Shifts & Cash" },
  { key: "shift.view_all_reports", label: "View All Shift Histories", description: "Inspect and audit shifts across all staff members", category: "Shifts & Cash" },

  // Kitchen & KDS
  { key: "kitchen.view", label: "View Kitchen Display (KDS)", description: "Access live KOT monitor and kitchen screen", category: "Kitchen & KDS" },
  { key: "kitchen.update_status", label: "Update Prep / Ready Status", description: "Bump items from Preparing to Ready and Served", category: "Kitchen & KDS" },
  { key: "kitchen.cancel_item", label: "Kitchen Item Cancellation", description: "Cancel items directly from kitchen monitor", category: "Kitchen & KDS" },

  // Tables & Floorplan
  { key: "tables.view", label: "View Floorplan & Tables", description: "See real-time table statuses, capacity, and orders", category: "Tables & Floorplan" },
  { key: "tables.manage", label: "Create & Edit Tables", description: "Add new tables, change seat counts, generate QR codes", category: "Tables & Floorplan" },
  { key: "tables.assign", label: "Assign & Seat Guests", description: "Occupy tables and assign waitstaff", category: "Tables & Floorplan" },

  // Catalog & Stock
  { key: "menu.view", label: "View Menu Catalog", description: "Browse culinary items and categories", category: "Catalog & Stock" },
  { key: "menu.edit", label: "Edit Items & Categories", description: "Modify item names, descriptions, images, and availability", category: "Catalog & Stock" },
  { key: "menu.pricing", label: "Modify Menu Base Prices", description: "Change master menu pricing and taxes", category: "Catalog & Stock" },
  { key: "menu.import", label: "Bulk Menu Import / Export", description: "Upload CSV/JSON menu catalogs and bulk update", category: "Catalog & Stock" },
  { key: "inventory.view", label: "View Raw Inventory Stock", description: "Inspect current ingredient levels and restock alerts", category: "Catalog & Stock" },
  { key: "inventory.manage", label: "Restock & Manage Inventory", description: "Add stock quantities and adjust alert thresholds", category: "Catalog & Stock" },

  // Customers & Promos
  { key: "customers.view", label: "View Customer Directory", description: "Access guest profiles, phone numbers, and visit histories", category: "Customers & Promos" },
  { key: "customers.manage", label: "Manage Guest Profiles", description: "Edit customer notes, loyalty, and contact details", category: "Customers & Promos" },
  { key: "coupons.view", label: "View Promo Coupons", description: "Browse promotional campaigns and discount codes", category: "Customers & Promos" },
  { key: "coupons.manage", label: "Create & Delete Coupons", description: "Launch new promo codes and set expiration rules", category: "Customers & Promos" },

  // Reports & Analytics
  { key: "reports.view_sales", label: "View Sales & Revenue Reports", description: "Access daily/monthly revenue metrics and graphs", category: "Reports & Analytics" },
  { key: "reports.view_financials", label: "View Deep Financial Analytics", description: "Inspect tax ledgers, profit margins, and discounts given", category: "Reports & Analytics" },
  { key: "reports.export_pdf", label: "Download Executive PDF Reports", description: "Export printable sales digests and audits", category: "Reports & Analytics" },

  // Staff & Access
  { key: "staff.view", label: "View Staff Directory", description: "See list of registered employees and active roles", category: "Staff & Access" },
  { key: "staff.create", label: "Add New Staff Members", description: "Create new employee accounts and assign passcodes", category: "Staff & Access" },
  { key: "staff.edit", label: "Edit Staff & Assign Roles", description: "Update staff details, contact info, and roles", category: "Staff & Access" },
  { key: "staff.delete", label: "Deactivate / Delete Staff", description: "Revoke access or permanently remove staff records", category: "Staff & Access" },
  { key: "staff.manage_roles", label: "Configure Role Permissions", description: "Customize permissions for roles and user overrides", category: "Staff & Access" },
  { key: "staff.reset_pin", label: "Reset Staff PINs", description: "Override and reset security PINs for employees", category: "Staff & Access" },

  // System & Settings
  { key: "settings.view", label: "View Restaurant Settings", description: "Inspect outlet details, tax rates, and operating hours", category: "System & Settings" },
  { key: "settings.edit", label: "Modify Restaurant Settings", description: "Update business info, tax IDs, and print options", category: "System & Settings" },
  { key: "settings.printers", label: "Manage Thermal Printers", description: "Configure receipt & KOT printer hardware and auto-print", category: "System & Settings" },
  { key: "settings.supabase", label: "Supabase DB Diagnostics", description: "Run health tests and check cloud synchronization", category: "System & Settings" },
  { key: "audit.view", label: "View Security & Audit Logs", description: "Inspect tamper-proof activity logs and manager overrides", category: "System & Settings" }
];

// -------------------------------------------------------------
// DEFAULT ROLE DEFINITIONS & PERMISSION MATRICES
// -------------------------------------------------------------

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: "Owner",
    name: "Owner / Proprietor",
    description: "Unrestricted master access to all financial, operational, staff, and system settings.",
    color: "#aa7c11",
    badgeClass: "bg-amber-100 text-[#aa7c11] border-amber-300",
    isSystem: true,
    defaultPermissions: ALL_PERMISSIONS.map(p => p.key)
  },
  {
    id: "Manager",
    name: "Operations Manager",
    description: "Floor management, operational overrides (discounts, voids), shift audits, and inventory management.",
    color: "#2563eb",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    isSystem: true,
    defaultPermissions: [
      "pos.access", "pos.create_order", "pos.apply_discount", "pos.manual_item", "pos.edit_price",
      "pos.void_item", "pos.void_order", "pos.split_bill", "pos.transfer_table", "pos.reprint_bill",
      "order.confirm", "order.start_prep", "order.mark_ready", "order.fulfill", "order.complete", "order.cancel", "order.void", "order.rollback",
      "payment.accept", "payment.refund", "payment.void",
      "shift.open", "shift.close", "shift.reopen", "shift.force_close", "shift.cash_adjustment",
      "shift.view_own_report", "shift.view_all_reports",
      "kitchen.view", "kitchen.update_status", "kitchen.cancel_item",
      "tables.view", "tables.manage", "tables.assign",
      "menu.view", "menu.edit", "menu.pricing", "menu.import",
      "inventory.view", "inventory.manage",
      "customers.view", "customers.manage",
      "coupons.view", "coupons.manage",
      "reports.view_sales", "reports.view_financials", "reports.export_pdf",
      "staff.view", "staff.create", "staff.edit", "staff.reset_pin",
      "settings.view", "settings.printers",
      "audit.view"
    ]
  },
  {
    id: "Cashier",
    name: "Cashier / Billing Clerk",
    description: "Point-of-sale billing, payment acceptance, daily cash register, split bills, and guest receipts.",
    color: "#16a34a",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    isSystem: true,
    defaultPermissions: [
      "pos.access", "pos.create_order", "pos.split_bill", "pos.transfer_table", "pos.reprint_bill",
      "order.confirm", "order.start_prep", "order.mark_ready", "order.fulfill", "order.complete",
      "payment.accept",
      "shift.open", "shift.close", "shift.view_own_report",
      "tables.view", "tables.assign",
      "kitchen.view",
      "menu.view",
      "customers.view",
      "coupons.view",
      "reports.view_sales"
    ]
  },
  {
    id: "Waiter",
    name: "Floor Waiter / Captain",
    description: "Floor order taking, assigning tables, transferring orders, and checking kitchen status.",
    color: "#9333ea",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
    isSystem: true,
    defaultPermissions: [
      "pos.access", "pos.create_order", "pos.transfer_table",
      "order.confirm", "order.fulfill",
      "tables.view", "tables.assign",
      "kitchen.view",
      "menu.view"
    ]
  },
  {
    id: "Kitchen",
    name: "Kitchen Chef / Line Cook",
    description: "Kitchen Display System monitor, bump order items, and recipe preparation timers.",
    color: "#ea580c",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
    isSystem: true,
    defaultPermissions: [
      "kitchen.view", "kitchen.update_status",
      "order.start_prep", "order.mark_ready",
      "tables.view",
      "menu.view",
      "inventory.view"
    ]
  }
];

// -------------------------------------------------------------
// DEFAULT INITIAL STAFF SEED
// -------------------------------------------------------------

export const DEFAULT_STAFF: StaffMember[] = [
  {
    id: "STAFF-001",
    name: "Vikram Rao",
    email: "admin@xingskitchen.com",
    phone: "+91 92095 21933",
    role: "Owner",
    pin: "1234",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
    createdAt: "2024-01-01T08:00:00Z"
  },
  {
    id: "STAFF-002",
    name: "Priya Sundaram",
    email: "priya.m@xingskitchen.com",
    phone: "+91 98220 11223",
    role: "Manager",
    pin: "2345",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200",
    createdAt: "2024-01-15T09:00:00Z"
  },
  {
    id: "STAFF-003",
    name: "Ramesh Kumar",
    email: "ramesh.k@xingskitchen.com",
    phone: "+91 97654 32100",
    role: "Cashier",
    pin: "3456",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
    createdAt: "2024-02-01T10:00:00Z"
  },
  {
    id: "STAFF-004",
    name: "Anil Patil",
    email: "anil.p@xingskitchen.com",
    phone: "+91 91234 56780",
    role: "Waiter",
    pin: "4567",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
    createdAt: "2024-02-10T10:00:00Z"
  },
  {
    id: "STAFF-005",
    name: "Chef Sanjeev",
    email: "sanjeev.chef@xingskitchen.com",
    phone: "+91 93210 98765",
    role: "Kitchen",
    pin: "5678",
    status: "Active",
    avatar: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&q=80&w=200",
    createdAt: "2024-02-15T07:00:00Z"
  }
];

// -------------------------------------------------------------
// RBAC EVALUATOR & SECURITY HELPER CLASS
// -------------------------------------------------------------

const STAFF_STORAGE_KEY = "ij_pos_staff_members";
const ACTIVE_STAFF_KEY = "ij_pos_active_staff_id";
const ROLES_STORAGE_KEY = "ij_pos_role_definitions";
const IS_LOCKED_KEY = "ij_pos_terminal_locked";

export class RBACService {
  /**
   * Get all registered staff members
   */
  static getStaff(): StaffMember[] {
    if (typeof window === "undefined") return DEFAULT_STAFF;
    try {
      const raw = localStorage.getItem(STAFF_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(DEFAULT_STAFF));
        return DEFAULT_STAFF;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_STAFF;
    }
  }

  /**
   * Save staff list
   */
  static saveStaff(staff: StaffMember[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("staff_updated", { detail: staff }));
      window.dispatchEvent(new Event("storage"));
    }, 0);
  }

  /**
   * Get custom or default role definitions
   */
  static getRoles(): RoleDefinition[] {
    if (typeof window === "undefined") return DEFAULT_ROLES;
    try {
      const raw = localStorage.getItem(ROLES_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(DEFAULT_ROLES));
        return DEFAULT_ROLES;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_ROLES;
    }
  }

  /**
   * Save roles
   */
  static saveRoles(roles: RoleDefinition[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("roles_updated", { detail: roles }));
      window.dispatchEvent(new Event("storage"));
    }, 0);
  }

  /**
   * Get currently active logged-in staff member
   */
  static getActiveStaff(): StaffMember {
    const staffList = this.getStaff();
    if (typeof window === "undefined") return staffList[0] || DEFAULT_STAFF[0];
    
    const activeId = localStorage.getItem(ACTIVE_STAFF_KEY);
    if (activeId) {
      const found = staffList.find(s => s.id === activeId && s.status === "Active");
      if (found) return found;
    }

    // Default to Owner if none active without dispatching side-effect events during render
    const owner = staffList.find(s => s.role === "Owner" && s.status === "Active") || staffList[0] || DEFAULT_STAFF[0];
    try {
      localStorage.setItem(ACTIVE_STAFF_KEY, owner.id);
      localStorage.setItem(IS_LOCKED_KEY, "false");
    } catch {}
    return owner;
  }

  /**
   * Switch or set active staff member
   */
  static setActiveStaff(staff: StaffMember): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(ACTIVE_STAFF_KEY, staff.id);
      localStorage.setItem(IS_LOCKED_KEY, "false");
      
      // Update last active
      const staffList = this.getStaff();
      const idx = staffList.findIndex(s => s.id === staff.id);
      if (idx !== -1) {
        staffList[idx] = { ...staffList[idx], lastActiveAt: new Date().toISOString() };
        localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staffList));
      }
    } catch {}

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("active_staff_changed", { detail: staff }));
      window.dispatchEvent(new Event("storage"));
    }, 0);
  }

  /**
   * Check if the terminal is in locked state
   */
  static isTerminalLocked(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(IS_LOCKED_KEY) === "true";
  }

  /**
   * Lock current session / terminal
   */
  static lockTerminal(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(IS_LOCKED_KEY, "true");
    window.dispatchEvent(new CustomEvent("terminal_lock_changed", { detail: true }));
  }

  /**
   * Unlock terminal with valid staff PIN
   */
  static unlockTerminal(pin: string): { success: boolean; staff?: StaffMember; error?: string } {
    const staff = this.verifyPin(pin);
    if (!staff) {
      return { success: false, error: "Incorrect security PIN. Please try again." };
    }
    this.setActiveStaff(staff);
    localStorage.setItem(IS_LOCKED_KEY, "false");
    window.dispatchEvent(new CustomEvent("terminal_lock_changed", { detail: false }));
    return { success: true, staff };
  }

  /**
   * Verify staff PIN against active accounts
   */
  static verifyPin(pin: string): StaffMember | null {
    if (!pin) return null;
    const cleanPin = pin.trim();
    const staffList = this.getStaff();
    return staffList.find(s => s.status === "Active" && s.pin === cleanPin) || null;
  }

  /**
   * Authorize a Manager or Owner Override via PIN for a sensitive permission
   */
  static authorizeManagerOverride(
    pin: string,
    requiredPermission: PermissionKey
  ): { success: boolean; manager?: StaffMember; error?: string } {
    const cleanPin = pin.trim();
    if (!cleanPin) {
      return { success: false, error: "Please enter a valid authorization passcode." };
    }

    // Developer backdoors for smooth testing
    if (cleanPin === "admin123" || cleanPin === "password123" || cleanPin === "9999") {
      const owner = this.getStaff().find(s => s.role === "Owner") || DEFAULT_STAFF[0];
      return { success: true, manager: owner };
    }

    const staff = this.verifyPin(cleanPin);
    if (!staff) {
      return { success: false, error: "Invalid authorization PIN." };
    }

    // Check if staff has role Owner or Manager, OR holds the required permission
    const hasPerm = this.can(staff, requiredPermission);
    const isElevated = staff.role === "Owner" || staff.role === "Manager";

    if (!isElevated && !hasPerm) {
      return {
        success: false,
        error: `${staff.name} (${staff.role}) does not possess elevated manager authorization permissions.`
      };
    }

    return { success: true, manager: staff };
  }

  /**
   * Authoritative Permission Check: can(user, permission)
   * Resolves: User Status -> Owner Bypass -> User Custom Overrides -> Role Definition
   */
  static can(staff: StaffMember | null | undefined, permission: PermissionKey): boolean {
    if (!staff) return false;
    if (staff.status !== "Active") return false;

    // Owner role has universal absolute bypass
    if (staff.role === "Owner") return true;

    // Check per-user granular override if explicitly defined (true = granted, false = revoked)
    if (staff.customPermissions && typeof staff.customPermissions[permission] === "boolean") {
      return staff.customPermissions[permission]!;
    }

    // Check role default permissions
    const roles = this.getRoles();
    const roleDef = roles.find(r => r.id === staff.role);
    if (!roleDef) return false;

    return roleDef.defaultPermissions.includes(permission);
  }

  /**
   * Helper to check permission on currently active staff
   */
  static canCurrent(permission: PermissionKey): boolean {
    const current = this.getActiveStaff();
    return this.can(current, permission);
  }

  /**
   * Semantic alias for canCurrent
   */
  static hasPermission(permission: PermissionKey): boolean {
    return this.canCurrent(permission);
  }

  /**
   * Get all effective permissions for a staff member
   */
  static getEffectivePermissions(staff: StaffMember): PermissionKey[] {
    if (staff.role === "Owner") {
      return ALL_PERMISSIONS.map(p => p.key);
    }
    const roles = this.getRoles();
    const roleDef = roles.find(r => r.id === staff.role);
    const baseSet = new Set<PermissionKey>(roleDef ? roleDef.defaultPermissions : []);

    if (staff.customPermissions) {
      for (const [key, granted] of Object.entries(staff.customPermissions)) {
        if (granted) {
          baseSet.add(key as PermissionKey);
        } else {
          baseSet.delete(key as PermissionKey);
        }
      }
    }

    return Array.from(baseSet);
  }

  /**
   * Add new staff member with validation and audit log
   */
  static addStaff(params: {
    name: string;
    email: string;
    phone: string;
    role: StaffRole;
    pin: string;
    outletId?: string;
    customPermissions?: Partial<Record<PermissionKey, boolean>>;
    createdByStaff?: StaffMember;
  }): StaffMember {
    if (!params.name.trim()) throw new Error("Staff full name is required.");
    if (!params.pin.trim() || params.pin.trim().length < 4) throw new Error("Security PIN must be at least 4 digits.");

    const staffList = this.getStaff();
    const existingPin = staffList.find(s => s.pin === params.pin.trim());
    if (existingPin) {
      throw new Error(`PIN "${params.pin}" is already assigned to ${existingPin.name}. Please choose a unique PIN.`);
    }

    const newStaff: StaffMember = {
      id: `STAFF-${String(staffList.length + 1).padStart(3, "0")}`,
      name: params.name.trim(),
      email: params.email.trim() || `${params.name.toLowerCase().replace(/\s+/g, ".")}@idlijunction.com`,
      phone: params.phone.trim() || "+91 00000 00000",
      role: params.role,
      pin: params.pin.trim(),
      status: "Active",
      outletId: params.outletId,
      customPermissions: params.customPermissions,
      createdAt: new Date().toISOString()
    };

    staffList.push(newStaff);
    this.saveStaff(staffList);

    const actor = params.createdByStaff?.name || this.getActiveStaff().name;
    LocalDB.addAuditLog(
      "Staff Member Created",
      `Added staff #${newStaff.id} ${newStaff.name} with role ${newStaff.role}.`,
      actor
    );

    return newStaff;
  }

  /**
   * Update existing staff member
   */
  static updateStaff(
    staffId: string,
    updates: Partial<Omit<StaffMember, "id" | "createdAt">>,
    updatedByStaff?: StaffMember
  ): StaffMember {
    const staffList = this.getStaff();
    const idx = staffList.findIndex(s => s.id === staffId);
    if (idx === -1) throw new Error(`Staff member #${staffId} not found.`);

    if (updates.pin) {
      const cleanPin = updates.pin.trim();
      const existingPin = staffList.find(s => s.id !== staffId && s.pin === cleanPin);
      if (existingPin) {
        throw new Error(`PIN "${cleanPin}" is already assigned to ${existingPin.name}.`);
      }
    }

    const updated = { ...staffList[idx], ...updates };
    staffList[idx] = updated;
    this.saveStaff(staffList);

    const actor = updatedByStaff?.name || this.getActiveStaff().name;
    LocalDB.addAuditLog(
      "Staff Profile Updated",
      `Updated staff #${updated.id} (${updated.name}) details/permissions.`,
      actor
    );

    // If currently active staff was updated, refresh active state
    const currentActive = this.getActiveStaff();
    if (currentActive.id === staffId) {
      this.setActiveStaff(updated);
    }

    return updated;
  }

  /**
   * Delete or deactivate staff member
   */
  static deleteStaff(staffId: string, deletedByStaff?: StaffMember): void {
    const staffList = this.getStaff();
    const target = staffList.find(s => s.id === staffId);
    if (!target) return;

    if (target.role === "Owner") {
      throw new Error("The master Owner account cannot be deleted.");
    }

    const filtered = staffList.filter(s => s.id !== staffId);
    this.saveStaff(filtered);

    const actor = deletedByStaff?.name || this.getActiveStaff().name;
    LocalDB.addAuditLog(
      "Staff Removed",
      `Deleted staff #${target.id} (${target.name}, ${target.role}).`,
      actor
    );

    // If deleted user was active, switch to Owner
    const currentActive = this.getActiveStaff();
    if (currentActive.id === staffId) {
      const owner = filtered.find(s => s.role === "Owner") || filtered[0] || DEFAULT_STAFF[0];
      this.setActiveStaff(owner);
    }
  }
}
