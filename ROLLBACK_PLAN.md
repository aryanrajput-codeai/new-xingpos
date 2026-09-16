# WebRajya POS — Production Rollback & Incident Recovery Plan

**Purpose:** Provide rapid, deterministic recovery procedures in the event of production failure during deployment or daily operations.  
**Severity Levels:**
- **P0 (Catastrophic):** Total POS failure, cannot punch orders, data corruption, payment gateway failure.
- **P1 (Critical):** Inventory deduction failure, printing failure on all stations, partial UI crash.
- **P2 (Medium):** Report generation latency, non-critical styling or display glitches.
- **P3 (Minor):** Cosmetic discrepancies, minor logging omissions.

---

## 1. Scenario A: Frontend Deployment Failure
*Triggers: JavaScript bundle runtime exception, blank white screen, assets 404, breaking UI regression.*

### Rollback Procedure:
1. **Immediate Action:** Revert container/CDN routing to previous tagged release commit or previous Docker image tag.
2. **Cloud Run / Container Rollback:**
   ```bash
   # Revert to previous healthy revision
   gcloud run services update-traffic webrajya-pos --to-revisions=webrajya-pos-PREV_TAG=100
   ```
3. **Local Terminal Recovery:** If running local desktop browser, force hard refresh: `Ctrl + Shift + R` (or `Cmd + Shift + R`) to purge stale service worker / cached bundle.
4. **Validation:** Open POS login page in incognito window, verify assets load with HTTP 200 and console displays zero uncaught exceptions.

---

## 2. Scenario B: Database Migration Failure
*Triggers: DDL migration times out, locked tables, constraint violations, missing columns.*

### Rollback Procedure:
1. **Stop Application Writes:** Switch POS to Offline/Maintenance mode to avoid partial schema writes.
2. **Execute Down-Migration Script:**
   - Every migration script in WebRajya POS is designed with idempotent/additive guards (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
   - If a destructive DDL migration must be undone, apply the corresponding down-migration script:
   ```sql
   -- Example: Reverting a newly added table
   -- DROP TABLE IF EXISTS public.failed_feature_table CASCADE;
   ```
3. **Database Restore (Point-in-Time Recovery):**
   - If data corruption occurred, navigate to Supabase Dashboard -> Project Settings -> Database -> Backups.
   - Select point-in-time 5 minutes prior to migration start.
   - Initiate PITR restoration.
4. **Verification:** Run schema validation tests (`npx tsx test_menu_schema.ts`) to confirm table structure and RLS integrity.

---

## 3. Scenario C: Critical POS Runtime Bug
*Triggers: Table lock, inability to add items to cart, order status stuck in "Preparing", billing crash.*

### Rollback Procedure:
1. **Activate Offline Fallback Mode:**
   - WebRajya POS contains a built-in local store engine (`LocalDB` in `src/lib/db.ts`) that functions completely decoupled from cloud connectivity.
   - If cloud API fails, switch POS to local mode. All orders are queued locally in `db-store.json`.
2. **Emergency Hotfix / Revert:**
   - Check git history for last known stable tag (e.g., `git checkout tags/v1.0.0-stable`).
   - Run `npm run build && npm run start`.
3. **Clear Local Terminal State (if corrupted):**
   - If local storage state is corrupted, restore `db-store.json` from `backups/db-store-pre-restore-*.json`.
   - Restart server: `npm run start`.

---

## 4. Scenario D: Inventory Discrepancy
*Triggers: Stock count does not match physical kitchen reality, negative stock recorded, incorrect recipe deduction.*

### Mandatory Architectural Rule:
> **DO NOT MANUALLY EDIT CURRENT STOCK IN THE DATABASE.**  
> Directly mutating the `current_stock` column without a ledger entry destroys financial audit compliance and violates GST audit trail standards.

### Deterministic Reconciliation Procedure:
1. **Identify Cause of Discrepancy:**
   - Query `inventory_transactions` for the affected ingredient ID.
   - Compare recorded transactions against actual kitchen events (e.g., unrecorded wastage, missing purchase invoice, wrong portion size in recipe).
2. **Execute Compensating Transaction via Official Service:**
   - **If Physical Count differs:** Use `StockAdjustmentService.createAdjustment({ type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT', reason: 'PHYSICAL_COUNT_DISCREPANCY' })`.
   - **If Spoiled Goods were unrecorded:** Use `WastageService.recordWastage({ reason: 'SPOILAGE' })`.
   - **If Wrong POS Deduction occurred:** Use `InventoryConsumptionService.reverseOrderConsumption(orderId)`.
3. **Verify Ledger Balance:**
   - Run `computeStockIntegrity()` from `InventoryReportsService`.
   - Confirm calculated stock from transactions matches current stored stock with **zero drift** ($0.0000$).
