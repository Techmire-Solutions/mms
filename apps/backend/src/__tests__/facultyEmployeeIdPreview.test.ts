import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  previewNextEmployeeId,
  previewNextFacultyEmployeeId,
} from "../faculty/use-cases/facultyEmployeeIdPreview.js";
import { withTenantRead, type TenantTransaction } from "../db/tenant-context.js";

vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: vi.fn(),
}));

const TENANT = "tenant-faculty-preview";
const CURRENT_YEAR = new Date().getFullYear();

function createMockTx(row: Record<string, unknown> | null): TenantTransaction {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(row ? [row] : []),
      }),
    }),
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

  it("given previewNextEmployeeId alias, should export the exact same function", () => {
    expect(previewNextEmployeeId).toBe(previewNextFacultyEmployeeId);
  });
});
