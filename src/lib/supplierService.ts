// ====================================================================
// WEBRAJYA POS - SUPPLIER SERVICE
// Single Restaurant Architecture - Direct Supabase Source of Truth
// ====================================================================

import { Supplier, CreateSupplierDTO, UpdateSupplierDTO } from '../types/inventory';
import { RBACService } from './rbac';
import { supabase } from './db';

export const STORAGE_KEY_SUPPLIERS = 'wr_suppliers';

export class SupplierService {
  // Legacy stubs for backward compatibility
  public static getCurrentBusinessId(): string {
    return '';
  }

  public static setCurrentBusinessId(_id: string): void {}

  public static enforceTenantIsolation(_entityBusinessId?: string, _requestedBusinessId?: string): void {}

  public static checkViewPermission(): void {
    if (!RBACService.hasPermission('inventory.view')) {
      throw new Error("Unauthorized: Missing required permission 'inventory.view'.");
    }
  }

  public static checkManagePermission(): void {
    if (!RBACService.hasPermission('inventory.manage')) {
      throw new Error("Unauthorized: Missing required permission 'inventory.manage'.");
    }
  }

  // ====================================================================
  // DATABASE MAPPER (Exact 10 columns for suppliers)
  // ====================================================================

  public static mapDatabaseSupplier(row: any): Supplier {
    return {
      id: row.id,
      name: row.name || 'Unnamed Supplier',
      contactPerson: row.contact_person || '',
      contact_person: row.contact_person || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      gstNumber: row.gst_number || '',
      gst_number: row.gst_number || '',
      gstin: row.gst_number || '',
      notes: '',
      paymentTerms: 'Net 30',
      isActive: row.is_active ?? true,
      is_active: row.is_active ?? true,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    };
  }

  // ====================================================================
  // CRUD OPERATIONS
  // ====================================================================

  public static async getSuppliers(_businessId?: string, _includeInactive?: boolean): Promise<Supplier[]> {
    this.checkViewPermission();

    try {
      let query = supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });

      if (_includeInactive === false) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[SupplierService] getSuppliers error:', error.message);
        const cached = localStorage.getItem(STORAGE_KEY_SUPPLIERS);
        return cached ? JSON.parse(cached) : [];
      }

      const suppliers = (data || []).map(this.mapDatabaseSupplier);
      localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(suppliers));
      return suppliers;
    } catch (e: any) {
      console.error('[SupplierService] getSuppliers exception:', e);
      const cached = localStorage.getItem(STORAGE_KEY_SUPPLIERS);
      return cached ? JSON.parse(cached) : [];
    }
  }

  public static async getSupplierById(id: string, _businessId?: string): Promise<Supplier | null> {
    this.checkViewPermission();

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[SupplierService] getSupplierById error:', error);
      throw new Error(`Failed to fetch supplier: ${error.message}`);
    }

    if (!data) return null;
    return this.mapDatabaseSupplier(data);
  }

  public static async createSupplier(
    dto: CreateSupplierDTO,
    _actorName?: string,
    _businessId?: string
  ): Promise<Supplier> {
    this.checkManagePermission();

    const name = dto.name?.trim();
    if (!name) {
      throw new Error('Supplier name is required.');
    }

    const payload = {
      name,
      contact_person: dto.contactPerson?.trim() || null,
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim() || null,
      address: dto.address?.trim() || null,
      gst_number: (dto.gstNumber || dto.gstin)?.trim() || null,
      is_active: dto.isActive !== undefined ? dto.isActive : true
    };

    const { data, error } = await supabase
      .from('suppliers')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[SupplierService] createSupplier error:', error);
      throw new Error(`Database error creating supplier: ${error.message}`);
    }

    const supplier = this.mapDatabaseSupplier(data);
    this.dispatchUpdateEvent('suppliers_updated');
    return supplier;
  }

  public static async updateSupplier(
    id: string,
    dto: UpdateSupplierDTO,
    _actorName?: string,
    _businessId?: string
  ): Promise<Supplier> {
    this.checkManagePermission();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new Error('Supplier name cannot be empty.');
      updatePayload.name = name;
    }

    if (dto.contactPerson !== undefined) {
      updatePayload.contact_person = dto.contactPerson.trim() || null;
    }

    if (dto.phone !== undefined) {
      updatePayload.phone = dto.phone.trim() || null;
    }

    if (dto.email !== undefined) {
      updatePayload.email = dto.email.trim() || null;
    }

    if (dto.address !== undefined) {
      updatePayload.address = dto.address.trim() || null;
    }

    if (dto.gstNumber !== undefined || dto.gstin !== undefined) {
      updatePayload.gst_number = (dto.gstNumber || dto.gstin)?.trim() || null;
    }

    if (dto.isActive !== undefined) {
      updatePayload.is_active = !!dto.isActive;
    }

    const { data, error } = await supabase
      .from('suppliers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[SupplierService] updateSupplier error:', error);
      throw new Error(`Database error updating supplier: ${error.message}`);
    }

    const supplier = this.mapDatabaseSupplier(data);
    this.dispatchUpdateEvent('suppliers_updated');
    return supplier;
  }

  public static async deleteSupplier(id: string, _businessId?: string): Promise<void> {
    this.checkManagePermission();

    const { count } = await supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id);

    if (count && count > 0) {
      throw new Error(`Cannot delete supplier: ${count} purchase order(s) reference this supplier. Deactivate instead.`);
    }

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupplierService] deleteSupplier error:', error);
      throw new Error(`Database error deleting supplier: ${error.message}`);
    }

    this.dispatchUpdateEvent('suppliers_updated');
  }

  public static async toggleSupplierActive(
    id: string,
    _actorName?: string,
    _businessId?: string
  ): Promise<Supplier> {
    const current = await this.getSupplierById(id);
    if (!current) throw new Error(`Supplier '${id}' not found.`);
    return this.updateSupplier(id, { isActive: !current.isActive });
  }

  public static async getSupplierPurchaseSummary(
    supplierId: string,
    _businessId?: string
  ): Promise<{
    totalPurchases: number;
    totalAmount: number;
    lastPurchaseDate: string | null;
  }> {
    const { data, error } = await supabase
      .from('purchases')
      .select('id, total, purchase_date')
      .eq('supplier_id', supplierId)
      .order('purchase_date', { ascending: false });

    if (error || !data) {
      return { totalPurchases: 0, totalAmount: 0, lastPurchaseDate: null };
    }

    const totalPurchases = data.length;
    const totalAmount = data.reduce((sum, p) => sum + Number(p.total ?? 0), 0);
    const lastPurchaseDate = data.length > 0 ? data[0].purchase_date : null;

    return {
      totalPurchases,
      totalAmount: Number(totalAmount.toFixed(2)),
      lastPurchaseDate
    };
  }

  private static dispatchUpdateEvent(name: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(name));
      window.dispatchEvent(new Event('storage'));
    }
  }
}
