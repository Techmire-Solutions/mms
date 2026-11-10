import { describe, expect, it, vi } from "vitest";
import {
  HASANAT_EXPORT_COLUMNS,
  buildHasanatExportCsvChunk,
} from "../services/hasanatExportService.js";
import { resolveImportRows } from "../hasanat/use-cases/hasanatImportResolve.js";
import type { Denomination, Distribution, HasanatTransferEntity } from "@mms/shared";

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

const DENOM: Denomination = {
  id: "den1",
  name: "Gold",
  points: 50,
  color: "amber",
  description: "",
  icon: "Star",
  active: true,
};

const CARD: Distribution = {
  id: "hd1",
  batchId: "bat1",
  denominationId: "den1",
  denominationName: "Gold",
  recipientType: "student",
  recipientStudentId: "stu1",
  recipientName: "Fatima",
  recipientClass: "Class A",
  quantity: 1,
  pointsSnapshot: 50,
  status: "active",
  issuedDate: "2026-11-10",
  reason: "Excellent recitation",
  issuedBy: "Ustadha",
  expiresOn: null,
};

const students = new Map([["fatima", [{ studentId: "stu1", studentName: "Fatima" }]]]);
const batches = [{ id: "bat1", denominationId: "den1", remaining: 10 }];

function resolve(row: Partial<HasanatTransferEntity>) {
  return resolveImportRows(
    [{ title: "Hifz", category: "Gold", targetPerson: "Fatima", ...row }],
    [DENOM],
    batches,
    students,
    "2026-11-10",
  );
}

describe("hasanat CSV export cells", () => {
  it("neutralises spreadsheet formula injection in free text", () => {
    const chunk = buildHasanatExportCsvChunk(
      [{ ...CARD, recipientName: "=SUM(A1:A9)", reason: "  @import" }],
      HASANAT_EXPORT_COLUMNS,
    );
    expect(chunk).toContain(`"'=SUM(A1:A9)"`);
    expect(chunk).toContain(`"'  @import"`);
  });

  it("exports the stamped points, not the deed's current value", () => {
    const chunk = buildHasanatExportCsvChunk(
      [{ ...CARD, pointsSnapshot: 25 }],
      HASANAT_EXPORT_COLUMNS,
    );
    // One data row per call; the stream factory emits the header. Columns are escaped/quoted, so
    // split on the quoted boundaries rather than commas.
    const cells = chunk
      .trim()
      .split('","')
      .map((cell) => cell.replace(/^"|"$/g, ""));
    const pointsIndex = HASANAT_EXPORT_COLUMNS.findIndex((column) => column.id === "points");
    expect(cells[pointsIndex]).toBe("25");
    expect(cells[0]).toBe("hd1");
  });

  it("keeps card ids unique per row in the QR-relevant column", () => {
    const chunk = buildHasanatExportCsvChunk(
      [CARD, { ...CARD, id: "hd2" }],
      HASANAT_EXPORT_COLUMNS,
    );
    expect(chunk).toContain(`"hd1"`);
    expect(chunk).toContain(`"hd2"`);
  });
});

describe("hasanat import row validation", () => {
  it("resolves a row without points or date", () => {
    const { resolved, errors } = resolve({});
    expect(errors).toEqual([]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].item.issuedDate).toBe("2026-11-10");
  });

  it("rejects a points value that contradicts the denomination", () => {
    const { resolved, errors } = resolve({ points: 10 });
    expect(resolved).toHaveLength(0);
    expect(errors[0].reason).toMatch(/defined by the denomination/i);
  });

  it("accepts a matching points value and blank cells", () => {
    expect(resolve({ points: 50 }).errors).toEqual([]);
    // CSV cells arrive as strings even though the transfer type declares a number.
    expect(resolve({ points: "" as unknown as number }).errors).toEqual([]);
  });

  it("rejects a non-numeric points cell", () => {
    const { errors } = resolve({ points: "fifty" as unknown as number });
    expect(errors[0].reason).toMatch(/Invalid points/i);
  });

  it("rejects an invalid date per row instead of failing the whole import", () => {
    const { resolved, errors } = resolve({ date: "10/11/2026" });
    expect(resolved).toHaveLength(0);
    expect(errors[0].reason).toMatch(/Invalid date/i);

    expect(resolve({ date: "2026-02-30" }).errors[0].reason).toMatch(/Invalid date/i);
    expect(resolve({ date: "2026-11-10" }).errors).toEqual([]);
  });
});
