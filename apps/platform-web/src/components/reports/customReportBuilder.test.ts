import { describe, expect, it } from "vitest";
import {
  AGGREGATE_FNS,
  buildContactsCustomReportFieldCatalog,
  buildCustomReportFieldCatalog,
  getAggregateFunctionOptions,
  getInitialDataSource,
  getInitialSelectedFields,
  getReportDataSourceOptions,
  getSelectedFieldsForSource,
  normalizeCustomReportSelectedFields,
  resolveCustomReportFieldLabel,
  type DataSource,
} from "./customReportBuilderFields";
import { compilePreviewFieldExtractor, toCamelCase } from "./customReportBuilderExtractor";

const t = (key: string) => key;

describe("customReportBuilderFields", () => {
  it("resolves initial data sources and selected fields across all sources", () => {
    const sources: DataSource[] = [
      "students",
      "contacts",
      "attendance",
      "financial",
      "academic",
      "hasanat",
      "sessions",
      "faculty",
    ];
    for (const source of sources) {
      expect(getInitialDataSource(source)).toBe(source);
      expect(getInitialSelectedFields(source).length).toBeGreaterThan(0);
      expect(getSelectedFieldsForSource(source).length).toBeGreaterThan(0);
    }
    expect(getInitialDataSource("unknown")).toBe("students");
    expect(getInitialSelectedFields("unknown").length).toBeGreaterThan(0);
    expect(normalizeCustomReportSelectedFields(["Teacher", "Name"])).toEqual(["Faculty", "Name"]);
  });

  it("builds field catalogs, labels, data sources, and aggregate options", () => {
    expect(
      buildCustomReportFieldCatalog("contacts", ["fullName"], [{ id: "fullName" }, { id: "city" }]),
    ).toEqual(["city"]);
    expect(buildCustomReportFieldCatalog("faculty", ["Faculty Name"], [])).not.toContain(
      "Faculty Name",
    );

    expect(resolveCustomReportFieldLabel("students", "Name", {} as never, t as never)).toBe(
      "reports.fields.name",
    );
    expect(resolveCustomReportFieldLabel("students", "CustomCol", {} as never, t as never)).toBe(
      "CustomCol",
    );
    expect(
      resolveCustomReportFieldLabel("contacts", "fullName", {} as never, t as never),
    ).toBeTruthy();

    expect(buildContactsCustomReportFieldCatalog({} as never, [] as never, undefined)).toEqual([]);
    expect(getReportDataSourceOptions(t as never)).toHaveLength(8);
    expect(getAggregateFunctionOptions(t as never)).toHaveLength(AGGREGATE_FNS.length);
  });
});

describe("customReportBuilderExtractor", () => {
  it("compiles extractors for standard, computed, date, and fallback fields", () => {
    expect(toCamelCase("Student Name!")).toBe("studentName");

    const row = {
      name: "Ali",
      status: "active",
      classes: [{ name: "Hifz" }],
      session: "Fall",
      room: "101",
      time: "09:00",
      days: ["Mon", "Wed"],
      discountType: "Scholarship",
      discountPct: 10,
      finalAmt: 900,
      capacity: 20,
      enrolled: 15,
      registeredDate: "2026-01-01",
      rollNo: "R-12",
      customfallback: "fallback-val",
    };

    const run = (field: string, r: Record<string, unknown>, src: DataSource = "students") =>
      compilePreviewFieldExtractor(field, src, { yes: "Yes", no: "No" }, "PKR", (f) => f).extract(
        r,
      );

    expect(run("Name", row)).toBe("Ali");
    expect(run("Student Name", { studentName: "Sara" })).toBe("Sara");
    expect(run("Faculty Name", { facultyName: "Ustad" })).toBe("Ustad");
    expect(run("Faculty", { faculty: "Shaykh" })).toBe("Shaykh");
    expect(run("Name", {})).toBe("—");
    expect(run("Status", row)).toBe("active");
    expect(run("Status", {})).toBe("—");
    expect(run("Class", row)).toBe("Hifz");
    expect(run("Class", {})).toBe("—");
    expect(run("Session", row)).toBe("Fall");
    expect(run("Session", {})).toBe("—");
    expect(run("Room", row)).toBe("101");
    expect(run("Room", {})).toBe("—");
    expect(run("Time", row)).toBe("09:00");
    expect(run("Time", {})).toBe("—");
    expect(run("Days", row)).toBe("Mon, Wed");
    expect(run("Days", { days: "Daily" })).toBe("Daily");
    expect(run("Days", {})).toBe("—");
    expect(run("Discount Type", row)).toBe("Scholarship");
    expect(run("Discount Type", {})).toBe("None");
    expect(run("Discount %", row)).toBe("10%");
    expect(run("Discount", { discountAmt: 50 })).toBe("PKR 50");
    expect(run("Discount", {})).toBe("0");
    expect(run("Final Amount", row)).toBe("PKR 900");
    expect(run("Final Amount", {})).toBe("0");
    expect(run("Utilisation %", row)).toBe("75%");
    expect(run("Rate %", { rate: 88 })).toBe("88%");
    expect(run("Rate %", {})).toBe("100%");
    expect(run("Registration Date", row)).toBe("2026-01-01");
    expect(run("Issued Date", { issuedDate: "2026-02-01" })).toBe("2026-02-01");
    expect(run("Due Date", { dueDate: "2026-03-01" })).toBe("2026-03-01");
    expect(run("Date", { date: "2026-04-01" })).toBe("2026-04-01");
    expect(run("Last Marked", { lastMarked: "2026-05-01" })).toBe("2026-05-01");
    expect(run("Last Awarded", {})).toBe("—");
    expect(run("Roll No", row)).toBe("R-12");
    expect(run("Custom Fallback", row)).toBe("fallback-val");
    expect(run("Missing Col", row)).toBe("—");
  });
});
