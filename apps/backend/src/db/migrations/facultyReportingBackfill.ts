import type { TenantTransaction } from "../tenant-context.js";

/**
 * Quarantined: legacy assignment-edge reporting backfill.
 * Person-level reporting columns and reports_to_assignment_id were dropped in 0146/0147.
 * Org reporting is position-parent based (`organization_positions.parent_position_id`).
 */
export async function backfillFacultyReporting(
  _tx: TenantTransaction,
  tenant: string,
): Promise<void> {
  throw new Error(
    `facultyReportingBackfill is retired after 0147 for workspace ${tenant}. ` +
      "Use organization position parents on faculty_assignments.position_id instead.",
  );
}
