import { describe, expect, it } from "vitest";
import { formatDeterministicEmployeeId } from "@mms/shared";
import {
  getFacultySetupConfig,
  updateFacultySetupConfig,
  previewNextFacultyEmployeeId,
  generateNextFacultyEmployeeId,
  previewNextEmployeeId,
  generateNextEmployeeId,
} from "../faculty/use-cases/facultyEmployeeIdService.js";
import type { FacultySetupConfigRow } from "../db/schema/faculty.js";

describe("facultyEmployeeIdService - formatDeterministicEmployeeId", () => {
  it("formats deterministic employee ID with default options", () => {
    const id = formatDeterministicEmployeeId(1, {}, new Date(2025, 0, 15));
    expect(id).toBe("FAC20250001");
  });

  it("formats deterministic employee ID with custom prefix, delimiter, and 4 digits", () => {
    const id = formatDeterministicEmployeeId(
      42,
      {
        prefix: "TCH",
        yearFormat: "YYYY",
        sequenceDigits: 4,
        delimiter: "-",
      },
      new Date(2025, 5, 20),
    );
    expect(id).toBe("TCH-2025-0042");
  });

  it("supports 2-digit year format (YY)", () => {
    const id = formatDeterministicEmployeeId(
      7,
      {
        prefix: "FAC",
        yearFormat: "YY",
        sequenceDigits: 4,
        delimiter: "",
      },
      new Date(2026, 8, 1),
    );
    expect(id).toBe("FAC260007");
  });

  it("supports variable sequence digit padding from 2 to 6 digits", () => {
    const id2 = formatDeterministicEmployeeId(
      5,
      { prefix: "EMP", sequenceDigits: 2, delimiter: "/" },
      new Date(2025, 0, 1),
    );
    expect(id2).toBe("EMP/2025/05");

    const id6 = formatDeterministicEmployeeId(
      123,
      { prefix: "STAFF", sequenceDigits: 6, delimiter: "." },
      new Date(2025, 0, 1),
    );
    expect(id6).toBe("STAFF.2025.000123");
  });

  it("handles overflow sequence numbers without truncating digits", () => {
    const id = formatDeterministicEmployeeId(
      10000,
      { prefix: "FAC", sequenceDigits: 4, delimiter: "" },
      new Date(2025, 0, 1),
    );
    expect(id).toBe("FAC202510000");
  });
});

describe("facultyEmployeeIdService - DB operations and rollover logic", () => {
  const currentYear = new Date().getFullYear();

  it("returns default fallback config when no DB connection or table row exists", async () => {
    const config = await getFacultySetupConfig("demo");
    expect(config.workspaceSubdomain).toBe("demo");
    expect(config.prefix).toBe("FAC");
    expect(config.yearFormat).toBe("YYYY");
    expect(config.sequenceDigits).toBe(4);
    expect(config.delimiter).toBe("");
    expect(config.currentSequence).toBe(0);
  });

  it("previews next employee ID without incrementing state", async () => {
    const preview = await previewNextFacultyEmployeeId("demo");
    expect(preview.nextEmployeeId).toContain("FAC");
    expect(preview.config.prefix).toBe("FAC");
    expect(preview.config.sequenceDigits).toBe(4);
  });

  it("atomically increments sequence within the same calendar year", async () => {
    let storedConfig: FacultySetupConfigRow = {
      workspaceSubdomain: "demo",
      prefix: "FAC",
      yearFormat: "YYYY",
      sequenceDigits: 4,
      delimiter: "",
      currentSequence: 99,
      lastYear: currentYear,
      updatedAt: new Date(),
    };

    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => [storedConfig],
          }),
        }),
      }),
      update: () => ({
        set: (patch: Partial<FacultySetupConfigRow>) => ({
          where: () => {
            storedConfig = { ...storedConfig, ...patch };
            return [storedConfig];
          },
        }),
      }),
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => [],
        }),
      }),
    };

    const result = await generateNextFacultyEmployeeId("demo", mockTx as never);

    expect(result.sequence).toBe(100);
    expect(result.year).toBe(currentYear);
    const expectedId = `FAC${currentYear}0100`;
    expect(result.employeeId).toBe(expectedId);
    expect(storedConfig.currentSequence).toBe(100);
    expect(storedConfig.lastYear).toBe(currentYear);
  });

  it("handles annual rollover: resets sequence to 1 when year transitions", async () => {
    const previousYear = currentYear - 1;
    let storedConfig: FacultySetupConfigRow = {
      workspaceSubdomain: "demo",
      prefix: "FAC",
      yearFormat: "YYYY",
      sequenceDigits: 4,
      delimiter: "",
      currentSequence: 999,
      lastYear: previousYear,
      updatedAt: new Date(),
    };

    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => [storedConfig],
          }),
        }),
      }),
      update: () => ({
        set: (patch: Partial<FacultySetupConfigRow>) => ({
          where: () => {
            storedConfig = { ...storedConfig, ...patch };
            return [storedConfig];
          },
        }),
      }),
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => [],
        }),
      }),
    };

    const result = await generateNextFacultyEmployeeId("demo", mockTx as never);

    // Sequence must reset to 1 on year transition (FAC20240999 -> FAC20250001)
    expect(result.sequence).toBe(1);
    expect(result.year).toBe(currentYear);
    const expectedId = `FAC${currentYear}0001`;
    expect(result.employeeId).toBe(expectedId);
    expect(storedConfig.currentSequence).toBe(1);
    expect(storedConfig.lastYear).toBe(currentYear);
  });

  it("updates faculty setup config correctly with fallback", async () => {
    const updated = await updateFacultySetupConfig("demo", {
      employeeIdPrefix: "USTADH",
      employeeIdYearFormat: "YY",
      employeeIdSequenceDigits: 3,
      employeeIdDelimiter: "-",
    });

    expect(updated.prefix).toBe("USTADH");
    expect(updated.yearFormat).toBe("YY");
    expect(updated.sequenceDigits).toBe(3);
    expect(updated.delimiter).toBe("-");
  });

  it("supports preview and configuration retrieval for faculty setup config", async () => {
    const config = await getFacultySetupConfig("demo");
    expect(config.prefix).toBe("FAC");
    const preview = await previewNextEmployeeId("demo");
    expect(preview.config.prefix).toBe("FAC");
    const updated = await updateFacultySetupConfig("demo", { employeeIdPrefix: "PROF" });
    expect(updated.prefix).toBe("PROF");
    expect(typeof generateNextEmployeeId).toBe("function");
  });
});
