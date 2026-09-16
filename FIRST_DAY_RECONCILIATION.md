# WebRajya POS — First-Day Reconciliation & Day-End Closing Checklist

**Intended Users:** Restaurant General Manager, Head Cashier, Inventory In-Charge  
**Cadence:** Daily at Kitchen/Counter Closing (EOD)  

---

## Daily Operational Reconciliation Flow

```
[POS Active Sessions] ➔ [Shift Close] ➔ [Cash Drawer Reconciliation] ➔ [Inventory Audit] ➔ [EOD Signoff]
```

### 1. Sales & Revenue Reconciliation
| Checklist Item | Description | System Target | Physical / Actual | Variance |
| :--- | :--- | :--- | :--- | :--- |
| **Total Orders** | Total completed dine-in, takeaway, delivery orders | Count from POS | Bill Copies | Must be 0 |
| **Gross Sales** | Sum of all ordered item values before discounts/tax | ₹ Report | - | - |
| **Discounts** | Authorized manager discounts & promo coupons | ₹ Report | Voucher Slips | Authorized |
| **Net Sales** | Gross sales minus discounts | ₹ Report | - | - |
| **Taxes Collected** | 5% GST (2.5% CGST + 2.5% SGST) | ₹ Report | Tax Ledger | Verified |
| **Grand Total** | Total revenue collected across all tenders | ₹ Report | Bank/Cash Sum | Must match |

### 2. Tender & Payment Method Balancing
| Payment Tender | System Total | Actual Count / Settlement | Notes / Slip Verification |
| :--- | :--- | :--- | :--- |
| **Cash in Drawer** | ₹ System Cash | ₹ Physical Currency Count | Count cash, minus opening float |
| **UPI (PhonePe / GPay)** | ₹ System UPI | ₹ Merchant App Settlements | Match QR transaction log |
| **Credit / Debit Cards** | ₹ System Card | ₹ EDC Terminal Batch Report | Match EDC swipe settlement slips |
| **Third-Party / Delivery** | ₹ Aggregator | ₹ Partner Portal Orders | Match aggregator orders |
| **Total Tendered** | **₹ Total** | **₹ Total Collected** | **Variance = Actual - System** |

### 3. Order Exceptions & Loss Prevention
- [ ] **Cancelled Orders:** Review all cancelled orders during shift; verify reason code and manager authorization signature.
- [ ] **Voided Items:** Inspect items removed after KOT generation; ensure items were not actually prepared or consumed.
- [ ] **Complimentary / Chef Special:** Review unbilled items for marketing or customer recovery.
- [ ] **Pending Bills:** Confirm zero open/unsettled tables remain active in the dining area.

### 4. Kitchen & Inventory Reconciliation
- [ ] **KOT Count:** Total printed KOT count equals system generated KOT tickets.
- [ ] **Daily Wastage:** Inspect raw materials logged as spoiled, burnt, or expired; confirm reason code.
- [ ] **Opening Stock:** Verified from morning handover.
- [ ] **Day Purchases:** All received supplier deliveries entered with invoice number and finalized.
- [ ] **Theoretical Stock Balance:**
  $$\text{Closing Balance} = \text{Opening} + \text{Purchases} - \text{Sales Consumption} - \text{Wastage} \pm \text{Adjustments}$$
- [ ] **Spot Check Physical Count:** Perform physical count of top 5 high-value ingredients (e.g., Paneer, Ghee, Dairy, Basmati Rice, Saffron) against theoretical system stock. Record variance if $\pm 2\%$.

### 5. Day-End Sign-Off
- **Cashier Name & Signature:** ____________________________
- **Store Manager Name & Signature:** ____________________________
- **System Audit Confirmation ID:** `EOD-CLOSE-${Date}`
