import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { studentSequenceConfig, studentLookups, students } from "../db/schema/index.js";
import { statusExpr } from "../db/repositories/studentRepositoryListQuery.js";
import {
  bulkSoftDeleteStudentsSql,
  bulkRestoreStudentsSql,
} from "../db/repositories/studentRepositorySoftDelete.js";
import { studentWriteValues } from "../db/repositories/studentRepositoryPersist.js";
import { studentRowToRecord } from "../db/repositories/studentRepositoryMappers.js";

describe("students DB improvements", () => {
  it("exports studentSequenceConfig table with workspace primary key", () => {
    expect(studentSequenceConfig).toBeDefined();
    expect(studentSequenceConfig.workspaceSubdomain).toBeDefined();
    expect(studentSequenceConfig.currentSequence).toBeDefined();
    expect(studentSequenceConfig.lastYear).toBeDefined();
  });

  it("exports audit columns on studentLookups schema", () => {
    expect(studentLookups.createdAt).toBeDefined();
    expect(studentLookups.createdBy).toBeDefined();
    expect(studentLookups.updatedBy).toBeDefined();
  });

  it("statusExpr uses COALESCE for typed column contract and index alignment", () => {
    const expr = statusExpr();
    expect(expr).toBeDefined();
    const queryFile = readFileSync(
      join(process.cwd(), "src/db/repositories/studentRepositoryListQuery.ts"),
      "utf8",
    );
    expect(queryFile).toContain("COALESCE(${students.status}, 'active')");
  });

  it("exposes bulkSoftDeleteStudentsSql and bulkRestoreStudentsSql functions", () => {
    expect(typeof bulkSoftDeleteStudentsSql).toBe("function");
    expect(typeof bulkRestoreStudentsSql).toBe("function");
  });

  it("migration 0165 defines lock_timeout, index hardening, and audit columns", () => {
    const migrationPath = join(
      process.cwd(),
      "src/db/migrations_drizzle/0165_students_db_improvements.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("SET LOCAL lock_timeout = '2s'");
    expect(sql).toContain("btrim(\"gr_number\") <> ''");
    expect(sql).toContain("btrim(\"student_id\") <> ''");
    expect(sql).toContain("students_workspace_status_coalesce_updated_at_active_idx");
    expect(sql).toContain("students_workspace_contact_deleted_idx");
    expect(sql).toContain("created_by");
    expect(sql).toContain("updated_by");
  });

  it("registers migration 0165 in meta/_journal.json", () => {
    const journalPath = join(process.cwd(), "src/db/migrations_drizzle/meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    const entry = journal.entries.find(
      (e: { tag: string }) => e.tag === "0165_students_db_improvements",
    );
    expect(entry).toBeDefined();
    expect(entry.idx).toBe(165);
  });

  it("defines customFields on students Drizzle schema", () => {
    expect(students.customFields).toBeDefined();
  });

  it("studentWriteValues extracts and preserves custom fields into customFields", () => {
    const values = studentWriteValues("demo", {
      id: "st-1",
      contactId: "c-1",
      bloodGroup: "B+",
      emergencyPhone: "+923001234567",
      customFields: { hafizStatus: "completed" },
    } as never);
    expect(values.customFields).toEqual({
      bloodGroup: "B+",
      emergencyPhone: "+923001234567",
      hafizStatus: "completed",
    });
  });

  it("studentRowToRecord hydrates custom fields into record and customFields property", () => {
    const record = studentRowToRecord({
      id: "st-1",
      workspaceSubdomain: "demo",
      contactId: "c-1",
      fatherContactId: null,
      motherContactId: null,
      guardianContactId: null,
      fatherName: null,
      motherName: null,
      guardianName: null,
      grNumber: "GR-1",
      studentId: "SID-1",
      status: "active",
      registeredDate: "2026-01-01",
      enrollmentDate: "2026-01-01",
      discountType: null,
      discountPct: null,
      registrationType: null,
      notes: null,
      customFields: { bloodGroup: "B+", emergencyPhone: "+923001234567" },
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      restoredAt: null,
      restoredBy: null,
      deletedWithCascade: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "u-1",
      updatedBy: "u-1",
    });
    expect(record.bloodGroup).toBe("B+");
    expect(record.emergencyPhone).toBe("+923001234567");
    expect(record.customFields).toEqual({ bloodGroup: "B+", emergencyPhone: "+923001234567" });
  });
});
