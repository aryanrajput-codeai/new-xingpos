# WebRajya POS — First Restaurant Go-Live Standard Operating Procedure (SOP)

**Scope:** Production Deployment Checklist for First Onboarded Restaurant Venue  
**Status:** Mandatory Quality Gate  
**Rule:** Only when **all 15 steps** are verified and signed off may the restaurant status be marked: **PRODUCTION READY**.

---

## 15-Step Go-Live Sequence

### Step 1: Create Restaurant / Business Entity
- Navigate to SuperAdmin / Venue Onboarding.
- Register legal business name (e.g., *IDLI JUNCTION / Sagar Ratna*).
- Configure GSTIN, FSSAI license number, address, phone number, and default currency (INR ₹).
- Verify unique `business_id` UUID generated in database.

### Step 2: Create Primary Admin Account
- Provision venue Owner/Admin account with verified email.
- Assign `Owner` role with complete bypass and governance permissions.
- Issue secure initial credentials and verify mandatory password change on first login.

### Step 3: Create Staff Accounts & Role-Based Permissions (RBAC)
- Create staff member logins:
  - **Manager:** Financial oversight, discounts, cash adjustments, void authorization.
  - **Cashier:** POS billing, payment settlement, split-bills, daily shift close.
  - **Kitchen / Chef:** KOT display, ticket mark preparing/ready.
  - **Waiter:** Table selection, item ordering, punch KOT.
  - **Inventory Manager:** Purchase entries, wastage logging, physical stocktaking.
- Verify staff accounts cannot access restricted settings or unauthorized tabs.

### Step 4: Configure Menu Categories & Items Catalog
- Set up item categories: Breakfast, Dosa, Idli, Beverages, Desserts, Thali, Combos.
- Import menu catalog with standard selling price, veg/non-veg flags, tax (GST) rates, and kitchen routing tags.
- Verify active status and pricing display in POS interface.

### Step 5: Create Master Raw Material Ingredients
- Register kitchen raw materials in the inventory catalog.
- Specify exact primary measurement units (`kg`, `g`, `l`, `ml`, `pcs`).
- Configure Minimum Alert Thresholds (e.g., 5 kg) and Reorder Quantities.
- Assign storage types (`DRY`, `CHILLED`, `FROZEN`, `AMBIENT`).

### Step 6: Configure Dish Recipes (Bills of Materials)
- Configure recipe formulation for each core selling dish (e.g., *Paneer Butter Masala: 200g Paneer, 30g Butter, 100g Gravy*).
- Define portion yield and wastage allowance.
- Verify theoretical portion food cost calculations and initial gross margins.

### Step 7: Enter Opening Stock & Initial Valuation
- Perform physical kitchen audit to verify opening inventory quantities.
- Record opening stock values with verified supplier unit costs.
- Verify initial inventory ledger transaction generated with type `OPENING_BALANCE`.

### Step 8: Configure Physical POS & KOT Printers
- Set up 80mm thermal receipt printer (USB, Network LAN, or Browser System Dialog).
- Configure Kitchen Order Ticket (KOT) printer for kitchen prep stations.
- Perform test print page; verify paper cutting, character encoding, barcode/QR generation, and font size.

### Step 9: Execute Pilot Test Order
- Open POS terminal, assign table (e.g., *Table 4*).
- Add 2 menu items with special preparation instruction note (e.g., *Less spicy*).
- Verify total price, tax breakdown, and itemization.

### Step 10: Verify KOT Output & Kitchen Display
- Send order to kitchen.
- Verify KOT prints with correct table number, order time, item names, and notes.
- Verify KOT appears on Kitchen Display System (KDS).

### Step 11: Verify Bill Generation & Item Layout
- Request guest bill.
- Confirm bill format displays legal GSTIN, restaurant address, itemized subtotal, 5% GST breakdown, and grand total.
- Verify typography fits 80mm thermal paper without line wrapping anomalies.

### Step 12: Verify Payment Settlement & Tender Types
- Tender payment using mixed/split methods (Cash, UPI QR, or Card).
- Settle bill and verify change computation.
- Confirm payment status moves to `Paid`.

### Step 13: Verify Automatic Inventory Deduction
- Inspect inventory balance immediately after order settlement.
- Confirm raw materials linked to ordered dishes are deducted precisely according to recipes.
- Verify an immutable `SALE_CONSUMPTION` ledger entry is appended.

### Step 14: Verify Financial & Inventory Reports
- Check Shift Register / Day End Summary: verify sales matches payments collected.
- Check Stock Valuation Report: verify closing balance reflects theoretical stock.
- Check Wastage and Margin reports.

### Step 15: Verify Audit Logs & Security Trails
- Open Administrative Audit Log.
- Verify test order, payment settlement, inventory movement, and user actions are timestamped with operator identity and IP address.

---

## Sign-Off Gate
Upon successful completion of Steps 1 through 15:
- Mark Venue Status: **`PRODUCTION READY`**
- Sign-Off Operations Lead: Verified & Operational
- Handover to Restaurant General Manager
