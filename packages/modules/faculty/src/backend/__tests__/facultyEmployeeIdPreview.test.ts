import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  previewNextEmployeeId,
  previewNextFacultyEmployeeId,
} from "../use-cases/facultyEmployeeIdPreview.js";
import { withTenantRead, type TenantTransaction } from "@mms/db/context";

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenantRead: vi.fn(),
}));

vi.mock("@mms/be-core/datetime", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  workspaceTodayIso: vi.fn(async () => `${new Date().getFullYear()}-01-01`),
}));

const TENANT = "tenant-faculty-preview";
const CURRENT_YEAR = new Date().getFullYear();

function extractSqlValues(item: unknown, visited = new Set<unknown>()): string[] {
  if (!item || typeof item !== "object" || visited.has(item)) return [];
  visited.add(item);
  const results: string[] = [];
  if (Array.isArray(item)) {
    for (const i of item) results.push(...extractSqlValues(i, visited));
  } else if (
    "queryChunks" in item &&
    Array.isArray((item as { queryChunks: unknown[] }).queryChunks)
  ) {
    for (const chunk of (item as { queryChunks: unknown[] }).queryChunks) {
      if (typeof chunk === "string") results.push(chunk);
      else results.push(...extractSqlValues(chunk, visited));
    }
  }
  return results;
}

function createMockTx(
  row: Record<string, unknown> | null,
  existingEmployeeIds: string[] = [],
): TenantTransaction {
  return {
    select: vi.fn().mockImplementation((projection?: Record<string, unknown>) => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation((condition?: unknown) => {
          if (projection && "prefix" in projection) {
            return Promise.resolve(row ? [row] : []);
          }
          const values = extractSqlValues(condition).map((v) => v.toLowerCase());
          const matched = existingEmployeeIds.filter((id) => values.includes(id.toLowerCase()));
          return {
            limit: vi.fn().mockResolvedValue(matched.map((id) => ({ id: `facemp-${id}` }))),
          };
        }),
      })),
    })),
  } as unknown as TenantTransaction;
}

describe("facultyEmployeeIdPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("given database failure, should return fallback preview with sequence 1 and current year", async () => {
    // Arrange
    vi.mocked(withTenantRead).mockRejectedValue(new Error("Database disconnected"));

    // Act
    const result = await previewNextFacultyEmployeeId(TENANT);

    // Assert
    expect(result.nextEmployeeId).toBe(`FAC${CURRENT_YEAR}0001`);
    expect(result.config.currentSequence).toBe(0);
    expect(result.config.lastYear).toBe(CURRENT_YEAR);
    expect(result.config.prefix).toBe("FAC");
    expect(result.config.sequenceDigits).toBe(4);
  });

  it("given existing config row in current calendar year, should increment sequence by 1", async () => {
    // Arrange
    const mockTx = createMockTx({
      prefix: "FAC",
      yearFormat: "YYYY",
      sequenceDigits: 4,
      delimiter: "",
      currentSequence: 12,
      lastYear: CURRENT_YEAR,
    });
    vi.mocked(withTenantRead).mockImplementation((_subdomain, callback) => callback(mockTx));

    // Act
    const result = await previewNextFacultyEmployeeId(TENANT);

    // Assert
    expect(result.nextEmployeeId).toBe(`FAC${CURRENT_YEAR}0013`);
    expect(result.config.currentSequence).toBe(12);
  });

  it("given existing config row from previous calendar year, should reset sequence to 1", async () => {
    // Arrange
    const mockTx = createMockTx({
      prefix: "FAC",
      yearFormat: "YYYY",
      sequenceDigits: 4,
      delimiter: "",
      currentSequence: 95,
      lastYear: CURRENT_YEAR - 1,
    });
    vi.mocked(withTenantRead).mockImplementation((_subdomain, callback) => callback(mockTx));

    // Act
    const result = await previewNextFacultyEmployeeId(TENANT);

    // Assert
    expect(result.nextEmployeeId).toBe(`FAC${CURRENT_YEAR}0001`);
  });

  it("given custom formatting config with delimiter, YY year, and 3 digits, should format properly", async () => {
    // Arrange
    const twoDigitYear = String(CURRENT_YEAR).slice(-2);
    const mockTx = createMockTx({
      prefix: "STAFF",
      yearFormat: "YY",
      sequenceDigits: 3,
      delimiter: "-",
      currentSequence: 7,
      lastYear: CURRENT_YEAR,
    });
    vi.mocked(withTenantRead).mockImplementation((_subdomain, callback) => callback(mockTx));

    // Act
    const result = await previewNextFacultyEmployeeId(TENANT);

    // Assert
    expect(result.nextEmployeeId).toBe(`STAFF-${twoDigitYear}-008`);
    expect(result.config.delimiter).toBe("-");
    expect(result.config.yearFormat).toBe("YY");
  });

  it("given candidate employee ID already exists in faculty_employments, should advance sequence to next unused ID", async () => {
    // Arrange: config currentSequence is 0, so next sequence would normally be 1 (FAC20260001).
    // But FAC20260001 already exists in faculty_employments!
    const mockTx = createMockTx(
      {
        prefix: "FAC",
        yearFormat: "YYYY",
        sequenceDigits: 4,
        delimiter: "",
        currentSequence: 0,
        lastYear: CURRENT_YEAR,
      },
      [`FAC${CURRENT_YEAR}0001`],
    );
    vi.mocked(withTenantRead).mockImplementation((_subdomain, callback) => callback(mockTx));

    // Act
    const result = await previewNextFacultyEmployeeId(TENANT);

    // Assert: must skip FAC20260001 and return FAC20260002
    expect(result.nextEmployeeId).toBe(`FAC${CURRENT_YEAR}0002`);
  });

  it("given previewNextEmployeeId alias, should export the exact same function", () => {
    expect(previewNextEmployeeId).toBe(previewNextFacultyEmployeeId);
  });
});
