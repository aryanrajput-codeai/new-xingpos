# WebRajya POS — Production Backup & Disaster Recovery Strategy

**Document Version:** 1.0.0  
**Target Environment:** Production (WebRajya Cloud & On-Premises POS Terminals)  
**Security Level:** Confidential / Operations  

---

## 1. Executive Summary

WebRajya POS implements a dual-tier fault-tolerant persistence model:
1. **Tier 1 (Authoritative Cloud Ledger):** Managed Supabase PostgreSQL database enforcing ACID compliance, multi-tenant Row-Level Security (RLS), immutable transaction ledgers, and Continuous Archiving / Point-In-Time Recovery (PITR).
2. **Tier 2 (Edge/Offline Resilience):** Local transactional JSON store (`db-store.json`) providing instant zero-latency POS operation during transient internet outages, with background asynchronous synchronization to Supabase.

---

## 2. Backup Architecture & Policies

### 2.1 Cloud Database (Supabase PostgreSQL)
- **Continuous Write-Ahead Log (WAL) Archiving:** Every database mutation is streamed to redundant object storage in real-time.
- **Point-In-Time Recovery (PITR):** Enables restoration to any microsecond up to 7–30 days in the past.
- **Automated Daily Snapshots:** Full logical backups executed every 24 hours at 03:00 UTC (during low-traffic maintenance window).
- **Retention Schedule:**
  - Hourly restore points: Retained for 7 days.
  - Daily snapshots: Retained for 30 days.
  - Monthly financial archives: Retained for 7 years for GST compliance.

### 2.2 Local Terminal State (`db-store.json`)
- **Atomic File Writes:** Writes to `db-store.json` use a safe atomic write pattern (`write to db-store.json.tmp` -> `fsync` -> atomic `rename`).
- **Hourly Snapshotting:** The server process archives `backups/db-store-YYYY-MM-DD-HH.json` before any heavy batch operations.

---

## 3. Disaster Recovery Runbook: Backup → Failure → Restore → Verification

### Phase A: Backup Snapshot Verification
```bash
# 1. Manual ad-hoc snapshot of local store
cp db-store.json backups/db-store-pre-restore-$(date +%s).json

# 2. Supabase logical dump via CLI (or Dashboard Backup Export)
# pg_dump -h db.xxx.supabase.co -U postgres -d postgres --format=custom -f supabase_prod_backup_$(date +%F).dump
```

### Phase B: Controlled Failure Scenario Simulation
In non-production disaster recovery drills:
1. **Simulated State:** Simulated disk corruption or invalid payload insertion into local or remote store.
2. **Immediate Alert:** API health monitor reports status transition from `HEALTHY` to `DEGRADED` or `FAILED` via `/api/health`.

### Phase C: Restoration Procedure
1. **Stop Incoming Writes:** Set terminal POS to maintenance mode or suspend client mutation ingestion.
2. **Retrieve Verified Recovery Target:**
   - Select point-in-time prior to failure event.
   - For PostgreSQL: In Supabase dashboard: *Project Settings -> Database -> Backups -> Point in Time Recovery* -> Select timestamp -> Confirm Restore.
   - For Local Store: Restore from last validated atomic snapshot.
3. **Verify Integrity Hashes:** Ensure restore file SHA-256 matches the backup manifest.

### Phase D: Verification & Reconciliation
After restoration, the operations team executes the 5-point verification checklist:
1. **Health Diagnostic:** Query `GET /api/health` — must return status `HEALTHY` (HTTP 200).
2. **Multi-Tenant Boundaries:** Verify `business_id` scoping across all active restaurant tenants.
3. **Ledger Balance Formula:**
   $$\text{Current Stock} = \text{Opening} + \text{Purchases} + \text{Adjustments In} + \text{Returns} - \text{Sales Consumption} - \text{Wastage} - \text{Adjustments Out}$$
   Validate **zero drift** ($0.0000$).
4. **Order State Consistency:** Ensure no paid orders reverted to pending, and no duplicate KOT tickets exist.
5. **Resume Traffic:** Switch POS to live status and record an entry in `audit_logs`.
