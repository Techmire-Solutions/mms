import { describe, it, expect } from "vitest";
import {
  getAllModuleTransferCoverage,
  getModuleTransferCoverage,
  getModuleTransferSchema,
  isModuleTransferImplemented,
  createModuleTransferSchema,
  registerModuleTransferSchema,
} from "../dataTransfer/index.js";
import { contactsTransferSchema } from "../contacts/contactsTransferSchema.js";

describe("moduleTransferRegistry (Coverage & Catalog)", () => {
  it("catalogs all 15 form-containing modules across the workspace", () => {
    const coverage = getAllModuleTransferCoverage();
    expect(coverage.length).toBe(15);

    const moduleIds = coverage.map((c) => c.moduleId);
    // P1 Core
    expect(moduleIds).toContain("contacts");
    expect(moduleIds).toContain("students");
    expect(moduleIds).toContain("faculty");
    expect(moduleIds).toContain("sessions");
    expect(moduleIds).toContain("enrollments");

    // P2 Academic & Financial
    expect(moduleIds).toContain("users");
    expect(moduleIds).toContain("questionBank");
    expect(moduleIds).toContain("accounting");
    expect(moduleIds).toContain("finance");

    // P3 Operational & Supporting
    expect(moduleIds).toContain("attendance");
    expect(moduleIds).toContain("examinations");
    expect(moduleIds).toContain("hasanat");
    expect(moduleIds).toContain("obligations");
    expect(moduleIds).toContain("tasks");
    expect(moduleIds).toContain("messaging");
  });

  it("marks contacts as implemented with active schema", () => {
    expect(isModuleTransferImplemented("contacts")).toBe(true);

    const schema = getModuleTransferSchema("contacts");
    expect(schema).toBe(contactsTransferSchema);

    const record = getModuleTransferCoverage("contacts");
    expect(record).toBeDefined();
    expect(record?.status).toBe("implemented");
    expect(record?.migrationPriority).toBe("P1");
    expect(record?.formSurfaces.length).toBeGreaterThan(0);
  });

  it("correctly tracks all 15 modules as implemented with active schemas", () => {
    const studentRecord = getModuleTransferCoverage("students");
    expect(studentRecord).toBeDefined();
    expect(studentRecord?.status).toBe("implemented");
    expect(studentRecord?.migrationPriority).toBe("P1");
    expect(studentRecord?.formSurfaces).toContain("Guardians");
    expect(isModuleTransferImplemented("students")).toBe(true);

    const attendanceRecord = getModuleTransferCoverage("attendance");
    expect(attendanceRecord).toBeDefined();
    expect(attendanceRecord?.status).toBe("implemented");
    expect(attendanceRecord?.migrationPriority).toBe("P3");
    expect(isModuleTransferImplemented("attendance")).toBe(true);

    // Verify all 15 modules are implemented
    const allCoverage = getAllModuleTransferCoverage();
    const implementedCount = allCoverage.filter((c) => c.status === "implemented").length;
    expect(implementedCount).toBe(15);
  });

  it("allows registering a dynamic transfer schema and updates coverage status", () => {
    const customSchema = createModuleTransferSchema({
      moduleId: "tasks",
      entityNounPlural: "tasks",
      fields: [
        { key: "title", label: "Task Title", required: true },
        { key: "status", label: "Task Status" },
      ],
    });

    registerModuleTransferSchema(customSchema);

    expect(isModuleTransferImplemented("tasks")).toBe(true);
    const retrieved = getModuleTransferSchema("tasks");
    expect(retrieved?.moduleId).toBe("tasks");

    const updatedRecord = getModuleTransferCoverage("tasks");
    expect(updatedRecord?.status).toBe("implemented");
  });
});
