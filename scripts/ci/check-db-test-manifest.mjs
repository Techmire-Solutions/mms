#!/usr/bin/env node
/**
 * Enrollment + attendance + hasanat + workshops + finance/accounting DB test manifest ratchet.
 *
 * Counting cases from source keeps this dependency-free and makes an accidental deletion or
 * skip-as-comment visible. Counts may grow freely; they may only drop with a reviewed baseline
 * update (`--update`) in the same change.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "apps/backend/src/__tests__/db-integration");
const BASELINE = {
  "enrollmentConcurrencyDb.integration.test.ts": 6,
  "enrollmentIntegrityDb.integration.test.ts": 7,
  "enrollmentLifecycleDb.integration.test.ts": 3,
  "enrollmentLifecycleJourneyDb.integration.test.ts": 2,
  "enrollmentLifecycleRulesDb.integration.test.ts": 6,
  "enrollmentOperationsDb.integration.test.ts": 4,
  "enrollmentSsotDb.integration.test.ts": 2,
  "enrollmentsSubsystemsDb.integration.test.ts": 14,
  "registrationDb.integration.test.ts": 4,
  // Attendance: the status domain, OCC/atomicity, concurrency, day submission, specialised subsystems.
  "attendanceConcurrencyDb.integration.test.ts": 2,
  "attendanceDaySubmissionDb.integration.test.ts": 8,
  "attendanceIntegrityDb.integration.test.ts": 10,
  "attendanceNotificationDedupeDb.integration.test.ts": 3,
  "attendanceOccConcurrencyDb.integration.test.ts": 4,
  "attendanceSpecializedSubsystemsDb.integration.test.ts": 13,
  "attendanceStatusParityDb.integration.test.ts": 4,
  "attendanceUpdateMoveDb.integration.test.ts": 4,
  // Hasanat: one-winner concurrency (redeem/void/issue/OCC/stock/quota) and DDL lifecycle guarantees.
  "hasanatConcurrencyDb.integration.test.ts": 7,
  "hasanatLifecycleCascadeDb.integration.test.ts": 7,
  // Examinations: marks/OCC/publication integrity, specialised subsystems, repeated races.
  "examinationIntegrityDb.integration.test.ts": 31,
  "examinationSubsystemsDb.integration.test.ts": 21,
  "examinationsConcurrencyDb.integration.test.ts": 4,
  // Workshops: lifecycle, completion gating, waitlist/capacity races, tenancy, audit, import.
  "workshopsDb.integration.test.ts": 14,
  "workshopsCompletionDb.integration.test.ts": 5,
  "workshopsCompletionEligibilityDb.integration.test.ts": 6,
  "workshopsCompletionConcurrencyDb.integration.test.ts": 5,
  "workshopsLifecycleDb.integration.test.ts": 10,
  "workshopsCapacityConcurrencyDb.integration.test.ts": 8,
  "workshopsWaitlistDb.integration.test.ts": 14,
  "workshopsTenantIsolationDb.integration.test.ts": 6,
  "workshopsAuditDb.integration.test.ts": 9,
  "workshopsImportDb.integration.test.ts": 3,
  "workshopsJourneyDb.integration.test.ts": 3,

  // Finance / Accounting: concurrency, voucher numbering, FX/hedges/IAS 29,
  // period locks, reports and tenant/audit integrity. Deleting one of these
  // suites (or most of its cases) must fail CI.
  "accountingBalanceInvariantDb.integration.test.ts": 9,
  "accountingCloseConcurrencyDb.integration.test.ts": 2,
  "accountingConcurrencyDb.integration.test.ts": 6,
  "accountingFxDb.integration.test.ts": 5,
  "accountingFxExchangeabilityDb.integration.test.ts": 3,
  "accountingFxRevaluationDb.integration.test.ts": 6,
  "accountingHedgesDb.integration.test.ts": 7,
  "accountingIas29Db.integration.test.ts": 9,
  "accountingListFiltersDb.integration.test.ts": 9,
  "accountingOpeningBalancesDb.integration.test.ts": 2,
  "accountingPeriodLockDb.integration.test.ts": 10,
  "accountingPersistDb.integration.test.ts": 3,
  "accountingPersistSoftDeleteDb.integration.test.ts": 1,
  "accountingPostedLedgerGuardsDb.integration.test.ts": 7,
  "accountingReportDb.integration.test.ts": 5,
  "accountingReportEndpointsDb.integration.test.ts": 5,
  "accountingReportIndexPlanDb.integration.test.ts": 3,
  "accountingReportPrecisionDb.integration.test.ts": 1,
  "accountingSeedDb.integration.test.ts": 6,
  "accountingVoucherCountersDb.integration.test.ts": 13,
  "financeCollectConcurrencyDb.integration.test.ts": 3,
  "financeDateColumnsDb.integration.test.ts": 7,
  "financeEnumParityDb.integration.test.ts": 2,
  "financeFxDb.integration.test.ts": 3,
  "financeGeneratedInvoiceFxDb.integration.test.ts": 6,
  "financeInvoiceAtomicityDb.integration.test.ts": 2,
  "financePaymentConcurrencyDb.integration.test.ts": 2,
  "financePersistSoftDeleteDb.integration.test.ts": 2,
  "financeSecurityDb.integration.test.ts": 8,
  "fiscalYearOverlapDb.integration.test.ts": 5,
};

const update = process.argv.includes("--update");
const counts = {};
for (const name of Object.keys(BASELINE)) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) {
    console.error(`✗ Missing required DB suite: ${name}`);
    process.exit(1);
  }
  const source = fs.readFileSync(file, "utf8");
  counts[name] = (source.match(/^\s{2}it\(/gm) ?? []).length;
}

if (update) {
  console.log(JSON.stringify(counts, null, 2));
  process.exit(0);
}

let failed = false;
for (const [name, floor] of Object.entries(BASELINE)) {
  const actual = counts[name];
  if (actual < floor) {
    console.error(
      `✗ ${name}: ${actual} cases (baseline ${floor}). A required DB test disappeared.`,
    );
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(
  `✅ Enrollment DB test manifest held (${Object.values(counts).reduce((a, b) => a + b, 0)} cases).`,
);
