// ====================================================================
// WEBRAJYA POS - PURCHASE & SUPPLIER MANAGEMENT (PHASE 4)
// ====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Building2,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  Edit3,
  Trash2,
  RotateCcw,
  FileText,
  TrendingUp,
  Eye,
  Calendar,
  Hash,
  User,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  ShoppingBag,
  ShieldCheck,
  Percent
} from 'lucide-react';
import {
  Purchase,
  PurchaseItem,
  PurchaseItemDTO,
  CreatePurchaseDTO,
  UpdatePurchaseDTO,
  Supplier,
  CreateSupplierDTO,
  UpdateSupplierDTO,
  Ingredient,
  InventoryImpactSummary,
  IngredientUnit
} from '../types/inventory';
import { PurchaseService } from '../lib/purchaseService';
import { SupplierService } from '../lib/supplierService';
import { IngredientService } from '../lib/ingredientService';
import {
  SupportedUnit,
  SUPPORTED_UNITS,
  areUnitsCompatible,
  convertQuantity,
  getUnitDimension
} from '../lib/unitConversion';
import { RBACService } from '../lib/rbac';
import { InventoryDemoEnvironmentBanner } from './InventoryDemoEnvironmentBanner';

interface PurchaseManagementTabProps {
  initialSubTab?: 'purchases' | 'suppliers';
  businessId?: string;
}

export const PurchaseManagementTab: React.FC<PurchaseManagementTabProps> = ({
  initialSubTab = 'purchases',
  businessId
}) => {
  const activeBusinessId = businessId || PurchaseService.getCurrentBusinessId();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>(initialSubTab);

  // Data states
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<string>('ALL');

  // Modals
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [purchaseImpact, setPurchaseImpact] = useState<InventoryImpactSummary[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null);
  const [supplierSummary, setSupplierSummary] = useState<{
    totalPurchases: number;
    purchaseCount: number;
    finalizedCount: number;
    recentPurchases: Purchase[];
  } | null>(null);

  // Confirm Finalize / Cancel Modals
  const [confirmFinalizePurchase, setConfirmFinalizePurchase] = useState<Purchase | null>(null);
  const [confirmCancelPurchase, setConfirmCancelPurchase] = useState<Purchase | null>(null);
  const [cancelReason, setCancelReason] = useState('Damaged goods or return to vendor');

  // Form states for Purchase Modal
  const [purchaseFormSupplierId, setPurchaseFormSupplierId] = useState('');
  const [purchaseFormDate, setPurchaseFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseFormInvoice, setPurchaseFormInvoice] = useState('');
  const [purchaseFormNotes, setPurchaseFormNotes] = useState('');
  const [purchaseFormTax, setPurchaseFormTax] = useState<number>(0);
  const [purchaseFormDiscount, setPurchaseFormDiscount] = useState<number>(0);
  const [purchaseFormItems, setPurchaseFormItems] = useState<
    Array<{
      id?: string;
      ingredientId: string;
      quantity: number | '';
      unit: SupportedUnit;
      unitCost: number | '';
      batchNumber?: string;
      expiryDate?: string;
    }>
  >([
    { ingredientId: '', quantity: '', unit: 'kg', unitCost: '' }
  ]);

  // Form states for Supplier Modal
  const [supplierFormName, setSupplierFormName] = useState('');
  const [supplierFormContact, setSupplierFormContact] = useState('');
  const [supplierFormPhone, setSupplierFormPhone] = useState('');
  const [supplierFormEmail, setSupplierFormEmail] = useState('');
  const [supplierFormAddress, setSupplierFormAddress] = useState('');
  const [supplierFormGstin, setSupplierFormGstin] = useState('');
  const [supplierFormPaymentTerms, setSupplierFormPaymentTerms] = useState('Net 30');
  const [supplierFormNotes, setSupplierFormNotes] = useState('');
  const [supplierFormActive, setSupplierFormActive] = useState(true);

  // RBAC Permission Check
  const canManage = RBACService.hasPermission('inventory.manage');

  // Load all master data
  const loadData = async () => {
    try {
      setLoading(true);
      const [pList, sList, iList] = await Promise.all([
        PurchaseService.getPurchases(undefined, activeBusinessId),
        SupplierService.getSuppliers(activeBusinessId, true),
        IngredientService.getIngredients(activeBusinessId)
      ]);
      setPurchases(pList);
      setSuppliers(sList);
      setIngredients(iList);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load procurement data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('purchases_updated', handleUpdate);
    window.addEventListener('suppliers_updated', handleUpdate);
    window.addEventListener('ingredients_updated', handleUpdate);

    return () => {
      window.removeEventListener('purchases_updated', handleUpdate);
      window.removeEventListener('suppliers_updated', handleUpdate);
      window.removeEventListener('ingredients_updated', handleUpdate);
    };
  }, [activeBusinessId]);

  // Flash toast auto-dismiss
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // ------------------------------------------------------------------
  // METRICS & COMPUTATIONS
  // ------------------------------------------------------------------
  const stats = useMemo(() => {
    const finalized = purchases.filter((p) => p.status === 'FINALIZED');
    const drafts = purchases.filter((p) => p.status === 'DRAFT');
    const totalSpent = finalized.reduce((sum, p) => sum + (p.grandTotal || p.totalAmount || 0), 0);
    const activeSuppliersCount = suppliers.filter((s) => s.isActive).length;

    return {
      totalSpent: Number(totalSpent.toFixed(2)),
      finalizedCount: finalized.length,
      draftsCount: drafts.length,
      activeSuppliersCount
    };
  }, [purchases, suppliers]);

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    let list = [...purchases];

    if (statusFilter !== 'ALL') {
      list = list.filter((p) => p.status === statusFilter);
    }

    if (supplierFilter !== 'ALL') {
      list = list.filter((p) => p.supplierId === supplierFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.purchaseNumber.toLowerCase().includes(q) ||
          (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
          (p.supplier && p.supplier.name.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
      );
    }

    return list;
  }, [purchases, statusFilter, supplierFilter, searchQuery]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    let list = [...suppliers];

    if (supplierStatusFilter === 'ACTIVE') {
      list = list.filter((s) => s.isActive);
    } else if (supplierStatusFilter === 'INACTIVE') {
      list = list.filter((s) => !s.isActive);
    }

    if (supplierSearchQuery.trim()) {
      const q = supplierSearchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.gstin && s.gstin.toLowerCase().includes(q))
      );
    }

    return list;
  }, [suppliers, supplierStatusFilter, supplierSearchQuery]);

  // Dynamic calculated totals in Purchase Form
  const purchaseFormTotals = useMemo(() => {
    let subtotal = 0;
    purchaseFormItems.forEach((it) => {
      const q = Number(it.quantity) || 0;
      const r = Number(it.unitCost) || 0;
      subtotal += q * r;
    });

    subtotal = Number(subtotal.toFixed(2));
    const tax = Number((purchaseFormTax || 0).toFixed(2));
    const discount = Number((purchaseFormDiscount || 0).toFixed(2));
    const grandTotal = Math.max(0, Number((subtotal + tax - discount).toFixed(2)));

    return { subtotal, tax, discount, grandTotal };
  }, [purchaseFormItems, purchaseFormTax, purchaseFormDiscount]);

  // ------------------------------------------------------------------
  // PURCHASE MODAL HANDLERS
  // ------------------------------------------------------------------
  const handleOpenCreatePurchase = () => {
    setEditingPurchase(null);
    const activeSuppliers = suppliers.filter((s) => s.isActive);
    setPurchaseFormSupplierId(activeSuppliers.length > 0 ? activeSuppliers[0].id : '');
    setPurchaseFormDate(new Date().toISOString().split('T')[0]);
    setPurchaseFormInvoice('');
    setPurchaseFormNotes('');
    setPurchaseFormTax(0);
    setPurchaseFormDiscount(0);

    const firstIng = ingredients.length > 0 ? ingredients[0] : null;
    setPurchaseFormItems([
      {
        ingredientId: firstIng ? firstIng.id : '',
        quantity: '',
        unit: firstIng ? (firstIng.unit as SupportedUnit) : 'kg',
        unitCost: firstIng ? firstIng.costPerUnit : ''
      }
    ]);
    setShowPurchaseModal(true);
  };

  const handleOpenEditPurchase = (purchase: Purchase) => {
    if (purchase.status !== 'DRAFT') {
      setErrorMessage('Only draft purchases can be edited.');
      return;
    }
    setEditingPurchase(purchase);
    setPurchaseFormSupplierId(purchase.supplierId);
    setPurchaseFormDate(purchase.purchaseDate);
    setPurchaseFormInvoice(purchase.invoiceNumber || '');
    setPurchaseFormNotes(purchase.notes || '');
    setPurchaseFormTax(purchase.tax || 0);
    setPurchaseFormDiscount(purchase.discount || 0);

    const items = (purchase.items || []).map((it) => ({
      id: it.id,
      ingredientId: it.ingredientId,
      quantity: it.quantity,
      unit: it.unit as SupportedUnit,
      unitCost: it.unitCost,
      batchNumber: it.batchNumber || '',
      expiryDate: it.expiryDate || ''
    }));

    setPurchaseFormItems(
      items.length > 0
        ? items
        : [{ ingredientId: '', quantity: '', unit: 'kg', unitCost: '' }]
    );
    setShowPurchaseModal(true);
  };

  const handleAddPurchaseItemRow = () => {
    const firstIng = ingredients.length > 0 ? ingredients[0] : null;
    setPurchaseFormItems([
      ...purchaseFormItems,
      {
        ingredientId: firstIng ? firstIng.id : '',
        quantity: '',
        unit: firstIng ? (firstIng.unit as SupportedUnit) : 'kg',
        unitCost: firstIng ? firstIng.costPerUnit : ''
      }
    ]);
  };

  const handleRemovePurchaseItemRow = (index: number) => {
    if (purchaseFormItems.length === 1) {
      setErrorMessage('A purchase order must contain at least one item.');
      return;
    }
    const updated = [...purchaseFormItems];
    updated.splice(index, 1);
    setPurchaseFormItems(updated);
  };

  const handleItemIngredientChange = (index: number, ingId: string) => {
    const updated = [...purchaseFormItems];
    const ing = ingredients.find((i) => i.id === ingId);
    updated[index].ingredientId = ingId;
    if (ing) {
      updated[index].unit = ing.unit as SupportedUnit;
      updated[index].unitCost = ing.costPerUnit;
    }
    setPurchaseFormItems(updated);
  };

  const handleSavePurchase = async (finalizeDirectly = false) => {
    try {
      if (!purchaseFormSupplierId) {
        setErrorMessage('Please select a supplier.');
        return;
      }

      // Validate items
      const preparedItems: PurchaseItemDTO[] = [];
      for (let i = 0; i < purchaseFormItems.length; i++) {
        const item = purchaseFormItems[i];
        if (!item.ingredientId) {
          setErrorMessage(`Item #${i + 1}: Please select an ingredient.`);
          return;
        }
        const qty = Number(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          setErrorMessage(`Item #${i + 1}: Quantity must be greater than 0.`);
          return;
        }
        const rate = Number(item.unitCost);
        if (isNaN(rate) || rate < 0) {
          setErrorMessage(`Item #${i + 1}: Rate cannot be negative.`);
          return;
        }

        preparedItems.push({
          id: item.id,
          ingredientId: item.ingredientId,
          quantity: qty,
          unit: item.unit,
          unitCost: rate,
          batchNumber: item.batchNumber?.trim(),
          expiryDate: item.expiryDate || null
        });
      }

      setActionLoading(true);

      if (editingPurchase) {
        // Update existing draft
        await PurchaseService.updatePurchase(
          editingPurchase.id,
          {
            supplierId: purchaseFormSupplierId,
            purchaseDate: purchaseFormDate,
            invoiceNumber: purchaseFormInvoice,
            notes: purchaseFormNotes,
            tax: purchaseFormTax,
            discount: purchaseFormDiscount,
            items: preparedItems
          },
          'Store Manager',
          activeBusinessId
        );

        if (finalizeDirectly) {
          await PurchaseService.finalizePurchase(
            editingPurchase.id,
            'Store Manager',
            activeBusinessId
          );
          setSuccessMessage(
            `Purchase '${editingPurchase.purchaseNumber}' updated and finalized! Stock and weighted average costs updated.`
          );
        } else {
          setSuccessMessage(`Purchase draft '${editingPurchase.purchaseNumber}' updated successfully.`);
        }
      } else {
        // Create new purchase
        const result = await PurchaseService.createPurchase(
          {
            businessId: activeBusinessId,
            supplierId: purchaseFormSupplierId,
            purchaseDate: purchaseFormDate,
            invoiceNumber: purchaseFormInvoice,
            notes: purchaseFormNotes,
            status: finalizeDirectly ? 'FINALIZED' : 'DRAFT',
            tax: purchaseFormTax,
            discount: purchaseFormDiscount,
            items: preparedItems
          },
          'Store Manager',
          activeBusinessId
        );

        if (finalizeDirectly) {
          setSuccessMessage(
            `Purchase '${result.purchase.purchaseNumber}' finalized! Added inward stock & updated average costs.`
          );
        } else {
          setSuccessMessage(
            `Draft purchase '${result.purchase.purchaseNumber}' saved. Stock remains untouched until finalization.`
          );
        }
      }

      setShowPurchaseModal(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save purchase.');
    } finally {
      setActionLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // FINALIZATION & REVERSAL ACTIONS
  // ------------------------------------------------------------------
  const handleConfirmFinalize = async () => {
    if (!confirmFinalizePurchase) return;
    try {
      setActionLoading(true);
      const result = await PurchaseService.finalizePurchase(
        confirmFinalizePurchase.id,
        'Store Manager',
        activeBusinessId
      );
      setSuccessMessage(
        `Purchase '${confirmFinalizePurchase.purchaseNumber}' finalized successfully! Stock increased for ${result.inventoryImpact.length} ingredients.`
      );
      setConfirmFinalizePurchase(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Finalization failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!confirmCancelPurchase) return;
    try {
      setActionLoading(true);
      const result = await PurchaseService.cancelFinalizedPurchase(
        confirmCancelPurchase.id,
        cancelReason,
        'Store Manager',
        activeBusinessId
      );
      setSuccessMessage(
        `Purchase '${confirmCancelPurchase.purchaseNumber}' reversed! ${result.reversedCount} reversal ledger entries created.`
      );
      setConfirmCancelPurchase(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Cancellation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDraft = async (purchase: Purchase) => {
    if (purchase.status !== 'DRAFT') {
      setErrorMessage('Only draft purchases can be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete draft purchase '${purchase.purchaseNumber}'?`)) {
      return;
    }
    try {
      setActionLoading(true);
      await PurchaseService.deletePurchase(purchase.id, 'Store Manager', activeBusinessId);
      setSuccessMessage(`Draft '${purchase.purchaseNumber}' deleted.`);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Delete failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewPurchaseDetails = async (purchase: Purchase) => {
    try {
      setViewingPurchase(purchase);
      if (purchase.status === 'FINALIZED') {
        const impact = await PurchaseService.getPurchaseInventoryImpact(purchase.id, activeBusinessId);
        setPurchaseImpact(impact);
      } else {
        setPurchaseImpact([]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to inspect purchase.');
    }
  };

  // ------------------------------------------------------------------
  // SUPPLIER MODAL HANDLERS
  // ------------------------------------------------------------------
  const handleOpenCreateSupplier = () => {
    setEditingSupplier(null);
    setSupplierFormName('');
    setSupplierFormContact('');
    setSupplierFormPhone('');
    setSupplierFormEmail('');
    setSupplierFormAddress('');
    setSupplierFormGstin('');
    setSupplierFormPaymentTerms('Net 30');
    setSupplierFormNotes('');
    setSupplierFormActive(true);
    setShowSupplierModal(true);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierFormName(supplier.name);
    setSupplierFormContact(supplier.contactPerson || '');
    setSupplierFormPhone(supplier.phone || '');
    setSupplierFormEmail(supplier.email || '');
    setSupplierFormAddress(supplier.address || '');
    setSupplierFormGstin(supplier.gstin || '');
    setSupplierFormPaymentTerms(supplier.paymentTerms || 'Net 30');
    setSupplierFormNotes(supplier.notes || '');
    setSupplierFormActive(supplier.isActive);
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async () => {
    try {
      const name = supplierFormName.trim();
      if (!name) {
        setErrorMessage('Supplier name is required.');
        return;
      }

      setActionLoading(true);

      if (editingSupplier) {
        await SupplierService.updateSupplier(
          editingSupplier.id,
          {
            name,
            contactPerson: supplierFormContact,
            phone: supplierFormPhone,
            email: supplierFormEmail,
            address: supplierFormAddress,
            gstin: supplierFormGstin,
            paymentTerms: supplierFormPaymentTerms,
            notes: supplierFormNotes,
            isActive: supplierFormActive
          },
          'Store Manager',
          activeBusinessId
        );
        setSuccessMessage(`Supplier '${name}' updated successfully.`);
      } else {
        await SupplierService.createSupplier(
          {
            businessId: activeBusinessId,
            name,
            contactPerson: supplierFormContact,
            phone: supplierFormPhone,
            email: supplierFormEmail,
            address: supplierFormAddress,
            gstin: supplierFormGstin,
            paymentTerms: supplierFormPaymentTerms,
            notes: supplierFormNotes,
            isActive: supplierFormActive
          },
          'Store Manager',
          activeBusinessId
        );
        setSuccessMessage(`Supplier '${name}' registered successfully.`);
      }

      setShowSupplierModal(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save supplier.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSupplierActive = async (supplier: Supplier) => {
    try {
      setActionLoading(true);
      const updated = await SupplierService.toggleSupplierActive(
        supplier.id,
        'Store Manager',
        activeBusinessId
      );
      setSuccessMessage(
        `Supplier '${updated.name}' is now ${updated.isActive ? 'Active' : 'Inactive'}.`
      );
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to toggle supplier status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenSupplierHistory = async (supplier: Supplier) => {
    try {
      setHistorySupplier(supplier);
      const summary = await SupplierService.getSupplierPurchaseSummary(supplier.id, activeBusinessId);
      setSupplierSummary(summary);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch supplier history.');
    }
  };

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-12">
      {/* Isolated Demo & QA Environment Control Banner */}
      <InventoryDemoEnvironmentBanner onRefreshNeeded={loadData} />

      {/* Toast Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 font-medium text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 font-medium text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Procurement Inward
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">₹{stats.totalSpent.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 mt-1">Total finalized inventory value</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Finalized Purchases
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.finalizedCount}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">Stocks posted to ledger</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Drafts
            </p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.draftsCount}</p>
            <p className="text-xs text-slate-500 mt-1">Pending verification & stock-in</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Suppliers
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.activeSuppliersCount}</p>
            <p className="text-xs text-slate-500 mt-1">Verified commercial vendors</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* HEADER CONTROLS & SUB-TABS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Purchasing & Vendor Management</h2>
              <p className="text-xs text-slate-500">
                Supplier orders, stock-in ledger, and automatic weighted average costing
              </p>
            </div>
          </div>

          {/* Tab Switcher & CTA */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-lg flex items-center">
              <button
                id="btn-tab-purchases"
                onClick={() => setActiveTab('purchases')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === 'purchases'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Purchases ({purchases.length})</span>
              </button>

              <button
                id="btn-tab-suppliers"
                onClick={() => setActiveTab('suppliers')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === 'suppliers'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Suppliers ({suppliers.length})</span>
              </button>
            </div>

            {canManage && activeTab === 'purchases' && (
              <button
                id="btn-new-purchase"
                onClick={handleOpenCreatePurchase}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Purchase</span>
              </button>
            )}

            {canManage && activeTab === 'suppliers' && (
              <button
                id="btn-new-supplier"
                onClick={handleOpenCreateSupplier}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Supplier</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================== */}
        {/* SUB-TAB 1: PURCHASES LIST */}
        {/* ========================================================== */}
        {activeTab === 'purchases' && (
          <div>
            {/* Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search PO#, invoice, supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Drafts (Pending)</option>
                  <option value="FINALIZED">Finalized (Stock Posted)</option>
                  <option value="CANCELLED">Cancelled (Reversed)</option>
                </select>
              </div>

              <div>
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Purchases Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-xs font-semibold uppercase text-slate-600">
                    <th className="py-3 px-4">PO & Invoice</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                        Loading purchase orders...
                      </td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">No purchase records found</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Click "New Purchase" to record inventory inward stock or create a draft.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((purchase) => {
                      const itemCount = (purchase.items || []).length;
                      return (
                        <tr key={purchase.id} className="hover:bg-slate-50/75 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{purchase.purchaseNumber}</div>
                            {purchase.invoiceNumber ? (
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Hash className="w-3 h-3" /> Inv: {purchase.invoiceNumber}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400">No invoice #</div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">
                              {purchase.supplier?.name || 'Unknown Supplier'}
                            </div>
                            {purchase.supplier?.phone && (
                              <div className="text-xs text-slate-500">{purchase.supplier.phone}</div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{purchase.purchaseDate}</span>
                            </div>
                            {purchase.finalizedAt && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                Finalized {new Date(purchase.finalizedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-700">{itemCount} items</span>
                            <div className="text-xs text-slate-400 truncate max-w-[180px]">
                              {(purchase.items || [])
                                .map((it) => it.ingredient?.name || 'Item')
                                .slice(0, 2)
                                .join(', ')}
                              {itemCount > 2 && ` +${itemCount - 2} more`}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            ₹{(purchase.grandTotal || purchase.totalAmount || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {purchase.status === 'FINALIZED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                <CheckCircle className="w-3 h-3" />
                                Finalized
                              </span>
                            )}
                            {purchase.status === 'DRAFT' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                <Clock className="w-3 h-3" />
                                Draft
                              </span>
                            )}
                            {purchase.status === 'CANCELLED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                                <X className="w-3 h-3" />
                                Cancelled
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* View Details */}
                              <button
                                onClick={() => handleViewPurchaseDetails(purchase)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                title="View Purchase Details & Ledger Impact"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* DRAFT ACTIONS: Finalize, Edit, Delete */}
                              {purchase.status === 'DRAFT' && canManage && (
                                <>
                                  <button
                                    onClick={() => setConfirmFinalizePurchase(purchase)}
                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                                    title="Finalize & Post to Stock"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditPurchase(purchase)}
                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                                    title="Edit Draft"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDraft(purchase)}
                                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors"
                                    title="Delete Draft"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}

                              {/* FINALIZED ACTIONS: Safe Reversal / Cancel */}
                              {purchase.status === 'FINALIZED' && canManage && (
                                <button
                                  onClick={() => setConfirmCancelPurchase(purchase)}
                                  className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                                  title="Reverse / Cancel Finalized Purchase"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* SUB-TAB 2: SUPPLIERS DIRECTORY */}
        {/* ========================================================== */}
        {activeTab === 'suppliers' && (
          <div>
            {/* Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search suppliers by name, phone, GSTIN..."
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <select
                  value={supplierStatusFilter}
                  onChange={(e) => setSupplierStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Vendors</option>
                  <option value="ACTIVE">Active Vendors Only</option>
                  <option value="INACTIVE">Inactive Vendors</option>
                </select>

                <button
                  onClick={loadData}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Suppliers Grid */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500">
                  <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No suppliers registered</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Click "Add Supplier" to register your vendor directory.
                  </p>
                </div>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">{supplier.name}</h3>
                          {supplier.contactPerson && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{supplier.contactPerson}</span>
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => canManage && handleToggleSupplierActive(supplier)}
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            supplier.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          title="Click to toggle active/inactive"
                        >
                          {supplier.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                        {supplier.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{supplier.email}</span>
                          </div>
                        )}
                        {supplier.gstin && (
                          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-700">
                            <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>GSTIN: {supplier.gstin}</span>
                          </div>
                        )}
                        {supplier.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 text-slate-500">{supplier.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        {supplier.paymentTerms || 'Net 30'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenSupplierHistory(supplier)}
                          className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                          History
                        </button>
                        {canManage && (
                          <button
                            onClick={() => handleOpenEditSupplier(supplier)}
                            className="p-1 text-slate-500 hover:text-slate-900 rounded-md"
                            title="Edit Supplier"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* MODAL: CREATE / EDIT PURCHASE ORDER (FAST RESTAURANT DATA ENTRY) */}
      {/* ========================================================== */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col my-auto animate-fade-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingPurchase ? `Edit Draft Purchase (${editingPurchase.purchaseNumber})` : 'New Purchase Order & Stock Inward'}
                </h3>
                <p className="text-xs text-slate-500">
                  Enter supplier invoice lines. Quantities will automatically update ingredient stock & average costs upon finalization.
                </p>
              </div>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier / Vendor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={purchaseFormSupplierId}
                    onChange={(e) => setPurchaseFormSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers
                      .filter((s) => s.isActive || s.id === purchaseFormSupplierId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {!s.isActive ? '(Inactive)' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={purchaseFormDate}
                    onChange={(e) => setPurchaseFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice / Bill Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-981"
                    value={purchaseFormInvoice}
                    onChange={(e) => setPurchaseFormInvoice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Purchase Items ({purchaseFormItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddPurchaseItemRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1 px-2 rounded-md hover:bg-indigo-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Ingredient Row
                  </button>
                </div>

                <div className="space-y-3">
                  {purchaseFormItems.map((item, idx) => {
                    const ing = ingredients.find((i) => i.id === item.ingredientId);
                    const qty = Number(item.quantity) || 0;
                    const rate = Number(item.unitCost) || 0;
                    const lineTotal = Number((qty * rate).toFixed(2));

                    // Compatible unit options
                    const ingDim = ing ? getUnitDimension(ing.unit) : null;
                    const compatibleUnits = SUPPORTED_UNITS.filter(
                      (u) => !ingDim || getUnitDimension(u) === ingDim
                    );

                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                      >
                        {/* Ingredient Select */}
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Ingredient
                          </label>
                          <select
                            value={item.ingredientId}
                            onChange={(e) => handleItemIngredientChange(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          >
                            <option value="">Select ingredient...</option>
                            {ingredients.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name} (Stock: {i.currentStock} {i.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            placeholder="0"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...purchaseFormItems];
                              updated[idx].quantity = e.target.value === '' ? '' : Number(e.target.value);
                              setPurchaseFormItems(updated);
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>

                        {/* Unit */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Unit
                          </label>
                          <select
                            value={item.unit}
                            onChange={(e) => {
                              const updated = [...purchaseFormItems];
                              updated[idx].unit = e.target.value as SupportedUnit;
                              setPurchaseFormItems(updated);
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          >
                            {compatibleUnits.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Rate / Unit Price */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Rate (₹/{item.unit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            value={item.unitCost}
                            onChange={(e) => {
                              const updated = [...purchaseFormItems];
                              updated[idx].unitCost = e.target.value === '' ? '' : Number(e.target.value);
                              setPurchaseFormItems(updated);
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>

                        {/* Line Total & Remove */}
                        <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-3 pt-4 sm:pt-0">
                          <div className="text-right">
                            <span className="block text-[10px] uppercase font-semibold text-slate-400">
                              Amount
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              ₹{lineTotal.toFixed(2)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePurchaseItemRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes & Financial Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order / Delivery Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Batch information, quality check notes, delivery remarks..."
                    value={purchaseFormNotes}
                    onChange={(e) => setPurchaseFormNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-900">
                      ₹{purchaseFormTotals.subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span className="flex items-center gap-1">Tax / GST (₹):</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={purchaseFormTax}
                      onChange={(e) => setPurchaseFormTax(Number(e.target.value) || 0)}
                      className="w-24 text-right px-2 py-1 bg-white border border-slate-300 rounded text-sm font-semibold"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Discount (₹):</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={purchaseFormDiscount}
                      onChange={(e) => setPurchaseFormDiscount(Number(e.target.value) || 0)}
                      className="w-24 text-right px-2 py-1 bg-white border border-slate-300 rounded text-sm font-semibold text-emerald-600"
                    />
                  </div>

                  <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-bold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-indigo-600 text-lg">
                      ₹{purchaseFormTotals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">Save as Draft</span> preserves order without modifying stock. <span className="font-medium text-emerald-700">Finalize</span> immediately updates inventory & recalculates weighted average costs.
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSavePurchase(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSavePurchase(true)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Finalize & Update Stock</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: VIEW PURCHASE DETAILS & INVENTORY IMPACT */}
      {/* ========================================================== */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col my-auto animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    Purchase {viewingPurchase.purchaseNumber}
                  </h3>
                  {viewingPurchase.status === 'FINALIZED' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      Finalized
                    </span>
                  )}
                  {viewingPurchase.status === 'DRAFT' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      Draft
                    </span>
                  )}
                  {viewingPurchase.status === 'CANCELLED' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                      Cancelled
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supplier: <strong className="text-slate-700">{viewingPurchase.supplier?.name}</strong> • Date: {viewingPurchase.purchaseDate}
                </p>
              </div>
              <button
                onClick={() => setViewingPurchase(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Invoice & Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="block text-slate-400">Invoice Number</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {viewingPurchase.invoiceNumber || 'None recorded'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Created By</span>
                  <span className="font-semibold text-slate-900">{viewingPurchase.createdBy}</span>
                </div>
                <div>
                  <span className="block text-slate-400">Finalized Date</span>
                  <span className="font-semibold text-slate-900">
                    {viewingPurchase.finalizedAt
                      ? new Date(viewingPurchase.finalizedAt).toLocaleDateString()
                      : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Finalized By</span>
                  <span className="font-semibold text-slate-900">
                    {viewingPurchase.finalizedBy || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2">Purchase Invoice Items</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-100/75 border-b border-slate-200 text-xs font-semibold uppercase text-slate-600">
                        <th className="py-2.5 px-3">Ingredient</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Purchase Rate</th>
                        <th className="py-2.5 px-3 text-right">Line Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(viewingPurchase.items || []).map((it) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-slate-900">
                              {it.ingredient?.name || 'Ingredient'}
                            </span>
                            {it.batchNumber && (
                              <span className="block text-[11px] text-slate-400">
                                Batch: {it.batchNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            ₹{it.unitCost.toFixed(2)}/{it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ₹{(it.totalCost || it.quantity * it.unitCost).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200 text-xs">
                        <td colSpan={3} className="py-2 px-3 text-right font-semibold text-slate-600">
                          Subtotal:
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          ₹{viewingPurchase.subtotal?.toFixed(2)}
                        </td>
                      </tr>
                      {Boolean(viewingPurchase.tax) && (
                        <tr className="bg-slate-50 text-xs">
                          <td colSpan={3} className="py-1 px-3 text-right text-slate-500">
                            Tax:
                          </td>
                          <td className="py-1 px-3 text-right font-medium text-slate-800">
                            +₹{viewingPurchase.tax.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {Boolean(viewingPurchase.discount) && (
                        <tr className="bg-slate-50 text-xs">
                          <td colSpan={3} className="py-1 px-3 text-right text-slate-500">
                            Discount:
                          </td>
                          <td className="py-1 px-3 text-right font-medium text-emerald-600">
                            -₹{viewingPurchase.discount.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 border-t border-slate-200 text-sm">
                        <td colSpan={3} className="py-2 px-3 text-right font-bold text-slate-900">
                          Grand Total:
                        </td>
                        <td className="py-2 px-3 text-right font-extrabold text-indigo-700 text-base">
                          ₹{(viewingPurchase.grandTotal || viewingPurchase.totalAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* REAL STOCK IMPACT (Immutable Ledger) */}
              {viewingPurchase.status === 'FINALIZED' && purchaseImpact.length > 0 && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Real Stock & Weighted Average Cost Impact</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Calculated atomically using normalized base quantities and master ledger transactions:
                  </p>

                  <div className="space-y-2">
                    {purchaseImpact.map((imp) => (
                      <div
                        key={imp.ingredientId}
                        className="bg-white p-3 rounded-lg border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 text-sm">{imp.ingredientName}</span>
                          <span className="block text-slate-500">
                            Added: <strong className="text-emerald-700">+{imp.quantityAdded} {imp.unit}</strong> (Stock went from {imp.stockBefore} → {imp.stockAfter} {imp.unit})
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-slate-400 block">New Weighted Avg Cost</span>
                          <span className="font-bold text-emerald-700 text-sm">
                            ₹{imp.newAverageCost.toFixed(2)}/{imp.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setViewingPurchase(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: CONFIRM FINALIZE PURCHASE */}
      {/* ========================================================== */}
      {confirmFinalizePurchase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="p-3 bg-emerald-100 rounded-full">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Finalize Purchase Order?</h3>
                <p className="text-xs text-slate-500">
                  {confirmFinalizePurchase.purchaseNumber} • ₹{confirmFinalizePurchase.grandTotal.toFixed(2)}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Finalizing will <strong className="text-slate-900">immediately add inventory stock</strong>, record immutable PURCHASE ledger transactions, and update the <strong className="text-slate-900">weighted average cost</strong> for all included ingredients.
            </p>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800">
              <strong>Notice:</strong> This action is idempotent and protected against double-counting.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmFinalizePurchase(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleConfirmFinalize}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                Confirm & Finalize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: CONFIRM CANCEL / REVERSAL */}
      {/* ========================================================== */}
      {confirmCancelPurchase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-100 rounded-full">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reverse Purchase Order?</h3>
                <p className="text-xs text-slate-500">{confirmCancelPurchase.purchaseNumber}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              This will create <strong className="text-slate-900">PURCHASE_REVERSAL</strong> inventory transactions in the ledger and deduct the inward stock without deleting the historical order record.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Reversal
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Damaged goods, billing correction"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmCancelPurchase(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Go Back
              </button>
              <button
                disabled={actionLoading}
                onClick={handleConfirmCancel}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                Execute Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: ADD / EDIT SUPPLIER */}
      {/* ========================================================== */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col my-auto animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingSupplier ? `Edit Supplier (${editingSupplier.name})` : 'Register New Supplier'}
                </h3>
                <p className="text-xs text-slate-500">
                  Manage vendor details, commercial contact info, and payment terms.
                </p>
              </div>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fresh Dairy Co-Op"
                  value={supplierFormName}
                  onChange={(e) => setSupplierFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Patel"
                    value={supplierFormContact}
                    onChange={(e) => setSupplierFormContact(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98200 12345"
                    value={supplierFormPhone}
                    onChange={(e) => setSupplierFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="orders@vendor.com"
                    value={supplierFormEmail}
                    onChange={(e) => setSupplierFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GSTIN (15 characters)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 24AAACF1234F1Z5"
                    value={supplierFormGstin}
                    onChange={(e) => setSupplierFormGstin(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Market yard, street, city, postal code..."
                  value={supplierFormAddress}
                  onChange={(e) => setSupplierFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Net 15, Net 30, COD"
                    value={supplierFormPaymentTerms}
                    onChange={(e) => setSupplierFormPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={supplierFormActive}
                      onChange={(e) => setSupplierFormActive(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      Active Supplier
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleSaveSupplier}
                className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: SUPPLIER PURCHASE HISTORY */}
      {/* ========================================================== */}
      {historySupplier && supplierSummary && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col my-auto animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {historySupplier.name} — Procurement History
                </h3>
                <p className="text-xs text-slate-500">
                  Lifetime purchase overview and recent transaction breakdown
                </p>
              </div>
              <button
                onClick={() => {
                  setHistorySupplier(null);
                  setSupplierSummary(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
                  <span className="block text-xs font-semibold text-slate-500 uppercase">
                    Total Finalized
                  </span>
                  <span className="text-xl font-bold text-indigo-700 mt-1 block">
                    ₹{supplierSummary.totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
                  <span className="block text-xs font-semibold text-slate-500 uppercase">
                    Total Orders
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block">
                    {supplierSummary.purchaseCount}
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
                  <span className="block text-xs font-semibold text-slate-500 uppercase">
                    Finalized
                  </span>
                  <span className="text-xl font-bold text-emerald-600 mt-1 block">
                    {supplierSummary.finalizedCount}
                  </span>
                </div>
              </div>

              {/* Recent Orders */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2">Recent Purchase Orders</h4>
                {supplierSummary.recentPurchases.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-lg">
                    No purchases recorded yet for this supplier.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">PO#</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Invoice</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {supplierSummary.recentPurchases.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {p.purchaseNumber}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{p.purchaseDate}</td>
                            <td className="py-2 px-3 text-slate-500">{p.invoiceNumber || '—'}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              ₹{(p.grandTotal || p.totalAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  p.status === 'FINALIZED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : p.status === 'DRAFT'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => {
                  setHistorySupplier(null);
                  setSupplierSummary(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PurchaseManagementTab;
