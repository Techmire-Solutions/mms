import { loadBackendEnv } from "../config/loadEnv.js";
import { runDateShapeAudit } from "./dateShapeAudit.js";
import type { DateColumn } from "./dateShapeAudit.js";

loadBackendEnv();

/**
 * Read-only audit for Phase 7 (varchar → date), academic set. Migration 0172 maps empty → NULL and
 * date-time → its date part; it refuses to run while "other" values remain.
 *
 *   pnpm --filter mms-backend audit:date-columns
 */
export const PHASE7_DATE_COLUMNS: ReadonlyArray<DateColumn> = [
  ["sessions", "start_date"],
  ["sessions", "end_date"],
  ["session_classes", "age_calc_date"],
  ["session_class_schedules", "start_date"],
  ["session_class_schedules", "end_date"],
  ["session_class_discounts", "start_date"],
  ["session_class_discounts", "end_date"],
  ["session_class_scholarships", "expiry_date"],
  ["session_class_timetables", "date"],
  ["session_class_refreshments", "date"],
  ["attendance_leaves", "from_date"],
  ["attendance_leaves", "to_date"],
  ["exams", "date"],
  ["attendance", "date"],
  ["enrollments", "enrolled_date"],
  ["students", "registered_date"],
  ["students", "enrollment_date"],
];

await runDateShapeAudit({ label: "audit:date-columns", columns: PHASE7_DATE_COLUMNS });
