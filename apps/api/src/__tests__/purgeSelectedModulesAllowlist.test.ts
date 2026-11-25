import { describe, expect, it } from "vitest";
import {
  PURGE_MODULE_TABLES,
  assertPurgeAllowlistSafe,
  isBlacklistedTable,
  quoteIdent,
} from "../scripts/purgeSelectedModulesAllowlist.js";

describe("purgeSelectedModulesAllowlist", () => {
  it("contains no blacklisted tables", () => {
    expect(() => assertPurgeAllowlistSafe()).not.toThrow();
    for (const table of PURGE_MODULE_TABLES) {
      expect(isBlacklistedTable(table)).toBe(false);
    }
  });

  it("flags contacts, finance, accounting, users, platform, audit", () => {
    expect(isBlacklistedTable("contacts")).toBe(true);
    expect(isBlacklistedTable("contact_phones")).toBe(true);
    expect(isBlacklistedTable("finance_invoices")).toBe(true);
    expect(isBlacklistedTable("accounting_accounts")).toBe(true);
    expect(isBlacklistedTable("tenant_users")).toBe(true);
    expect(isBlacklistedTable("workspaces")).toBe(true);
    expect(isBlacklistedTable("platform_users")).toBe(true);
    expect(isBlacklistedTable("audit_trail_events")).toBe(true);
    expect(isBlacklistedTable("outbox_events")).toBe(true);
  });

  it("rejects unsafe identifiers", () => {
    expect(quoteIdent("students")).toBe('"students"');
    expect(() => quoteIdent("students; drop")).toThrow(/Unsafe/);
  });

  it("keeps required module tables in child-before-parent order", () => {
    const idx = (name: string) => PURGE_MODULE_TABLES.indexOf(name);
    expect(idx("task_assignees")).toBeLessThan(idx("tasks"));
    expect(idx("message_logs")).toBeLessThan(idx("message_templates"));
    expect(idx("assessment_answers")).toBeLessThan(idx("assessment_results"));
    expect(idx("exam_results")).toBeLessThan(idx("exams"));
    expect(idx("question_options")).toBeLessThan(idx("questions"));
    expect(idx("hasanat_redemptions")).toBeLessThan(idx("hasanat_denoms"));
    expect(idx("attendance")).toBeLessThan(idx("attendance_lookups"));
    expect(idx("enrollment_timeline_events")).toBeLessThan(idx("enrollments"));
    expect(idx("session_classes")).toBeLessThan(idx("sessions"));
    expect(idx("student_enrolled_sessions")).toBeLessThan(idx("students"));
    expect(idx("obligation_collections")).toBeLessThan(idx("obligation_types"));
    expect(idx("faculty_assignments")).toBeLessThan(idx("faculty"));
    expect(idx("faculty")).toBeLessThan(idx("faculty_designations"));
  });

  it("refuses an allowlist that includes finance", () => {
    expect(() => assertPurgeAllowlistSafe(["students", "finance_invoices"])).toThrow(/blacklisted/);
  });
});
