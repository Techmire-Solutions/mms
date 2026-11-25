import { describe, expect, it } from "vitest";
import { auditPartitionName } from "../services/auditPartitionService.js";

/**
 * The partition name format is a contract with two other places:
 * `detach-audit-partition.ts` (which validates `/^audit_trail_events_y\d{4}m\d{2}$/`)
 * and the `0102_modern_audit_trail.sql` baseline. These tests pin the format so a
 * change here cannot silently orphan detached-archive lookups.
 */
describe("auditPartitionName", () => {
  it("produces the y<YYYY>m<MM> form the detach script validates", () => {
    expect(auditPartitionName(2026, 9)).toBe("audit_trail_events_y2026m09");
    expect(auditPartitionName(2026, 11)).toBe("audit_trail_events_y2026m11");
    expect(auditPartitionName(2027, 12)).toBe("audit_trail_events_y2027m12");
  });

  it("zero-pads single-digit months and matches the detach script regex", () => {
    for (const month of [1, 2, 9, 10, 12]) {
      const name = auditPartitionName(2026, month);
      expect(name).toMatch(/^audit_trail_events_y\d{4}m\d{2}$/);
    }
  });
});
