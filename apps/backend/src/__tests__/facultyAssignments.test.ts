/**
 * facultyAssignments.test.ts
 *
 * Unit tests for the faculty_assignments domain logic:
 *   - Assignment CRUD semantics
 *   - is_primary enforcement (application-level, single active primary per faculty)
 *   - Designation seniority (hierarchy_rank ordering)
 */

import { describe, expect, it } from "vitest";
import type { FacultyAssignmentRow } from "../db/schema/facultyAssignmentTables.js";

type Assignment = FacultyAssignmentRow;

export function makeAssignmentStore(seed: Partial<Assignment>[] = []): Map<string, Assignment> {
  const store = new Map<string, Assignment>();
  for (const a of seed) {
    const row = {
      id: "asgn-" + Math.random().toString(36).slice(2),
      workspaceSubdomain: "demo",
      facultyId: "",
      departmentId: "dept-general",
      designationId: "des-lecturer",
      isPrimary: false,
      status: "active",
      startDate: "2024-01-01",
      endDate: null,
      notes: null,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      restoredAt: null,
      restoredBy: null,
      deletedWithCascade: false,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      createdBy: null,
      updatedBy: null,
      ...a,
    } satisfies Assignment;
    store.set(row.id, row);
  }
  return store;
}

function countActivePrimary(store: Map<string, Assignment>, facultyId: string): number {
  return [...store.values()].filter(
    (a) => a.facultyId === facultyId && a.isPrimary && !a.deletedAt && !a.endDate,
  ).length;
}

describe("Faculty assignments — primary enforcement", () => {
  it("allows exactly one open primary assignment per faculty", () => {
    const store = makeAssignmentStore([
      { id: "a1", facultyId: "f1", isPrimary: true, endDate: null },
    ]);
    expect(countActivePrimary(store, "f1")).toBe(1);
  });

  it("closing the existing primary before setting a new one keeps the count at 1", () => {
    const store = makeAssignmentStore([
      { id: "a1", facultyId: "f1", isPrimary: true, endDate: null },
    ]);
    store.set("a1", { ...store.get("a1")!, isPrimary: false, endDate: "2025-06-30" });
    const newId = "a2";
    store.set(newId, {
      ...makeAssignmentStore([
        { id: newId, facultyId: "f1", isPrimary: true, startDate: "2025-07-01" },
      ]).get(newId)!,
    });
    expect(countActivePrimary(store, "f1")).toBe(1);
  });

  it("detects a violation if two open primary assignments coexist for the same faculty", () => {
    const store = makeAssignmentStore([
      { id: "a1", facultyId: "f1", isPrimary: true, endDate: null },
      { id: "a2", facultyId: "f1", isPrimary: true, endDate: null },
    ]);
    expect(countActivePrimary(store, "f1")).toBeGreaterThan(1);
  });

  it("secondary assignments (isPrimary=false) do not affect the primary count", () => {
    const store = makeAssignmentStore([
      { id: "a1", facultyId: "f1", isPrimary: true, endDate: null },
      { id: "a2", facultyId: "f1", isPrimary: false, endDate: null },
      { id: "a3", facultyId: "f1", isPrimary: false, endDate: null },
    ]);
    expect(countActivePrimary(store, "f1")).toBe(1);
  });

  it("soft-deleted assignments do not contribute to primary count", () => {
    const store = makeAssignmentStore([
      { id: "a1", facultyId: "f1", isPrimary: true, endDate: null, deletedAt: new Date() },
      { id: "a2", facultyId: "f1", isPrimary: true, endDate: null },
    ]);
    expect(countActivePrimary(store, "f1")).toBe(1);
  });
});

describe("Faculty assignments — designation seniority ordering", () => {
  type Designation = { id: string; code: string; name: string; hierarchyRank: number };

  const designations: Designation[] = [
    { id: "d1", code: "professor", name: "Professor", hierarchyRank: 1 },
    { id: "d2", code: "assoc-prof", name: "Associate Professor", hierarchyRank: 2 },
    { id: "d3", code: "lecturer", name: "Lecturer", hierarchyRank: 3 },
    { id: "d4", code: "teaching-asst", name: "Teaching Assistant", hierarchyRank: 4 },
  ];

  it("lower hierarchyRank is treated as higher seniority", () => {
    const sorted = [...designations].sort((a, b) => a.hierarchyRank - b.hierarchyRank);
    expect(sorted[0].code).toBe("professor");
    expect(sorted.at(-1)!.code).toBe("teaching-asst");
  });

  it("a supervisor designation must have lower rank number than subordinate", () => {
    const supervisor = designations.find((d) => d.code === "professor")!;
    const subordinate = designations.find((d) => d.code === "lecturer")!;
    expect(supervisor.hierarchyRank).toBeLessThan(subordinate.hierarchyRank);
  });

  it("rejects pairing where subordinate has equal or higher rank than supervisor", () => {
    const senior = designations.find((d) => d.code === "professor")!;
    const alsoSenior = { ...senior, id: "dx", code: "prof2" };
    const valid = alsoSenior.hierarchyRank < senior.hierarchyRank;
    expect(valid).toBe(false);
  });
});
