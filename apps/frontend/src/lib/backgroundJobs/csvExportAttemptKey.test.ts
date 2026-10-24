import { describe, expect, it } from "vitest";
import { csvExportAttemptSignature, nextCsvExportAttempt } from "./csvExportAttemptKey";

describe("nextCsvExportAttempt", () => {
  it("retains the key while the signature is unchanged", () => {
    const first = nextCsvExportAttempt(null, "filtereda", () => "key-1");
    expect(first).toEqual({ key: "key-1", signature: "filtereda" });
    expect(nextCsvExportAttempt(first, "filtereda", () => "key-2")).toBe(first);
  });

  it("rotates the key when the export scope changes", () => {
    const first = nextCsvExportAttempt(null, "filtereda", () => "key-1");
    expect(nextCsvExportAttempt(first, "selectiona", () => "key-2").key).toBe("key-2");
  });
});

describe("csvExportAttemptSignature", () => {
  it("is order-insensitive for filter maps", () => {
    expect(csvExportAttemptSignature("filtered", { search: "ali", gender: "male" })).toBe(
      csvExportAttemptSignature("filtered", { gender: "male", search: "ali" }),
    );
  });

  it("distinguishes different filters, selections, and scopes", () => {
    const base = csvExportAttemptSignature("filtered", { search: "ali" });
    expect(base).not.toBe(csvExportAttemptSignature("filtered", { search: "sara" }));
    expect(base).not.toBe(csvExportAttemptSignature("selection", { search: "ali" }));
    expect(csvExportAttemptSignature("selection", ["c1"])).not.toBe(
      csvExportAttemptSignature("selection", ["c2"]),
    );
  });

  it("ignores undefined entries so an unset filter does not fork the key", () => {
    expect(csvExportAttemptSignature("filtered", { search: undefined, gender: "male" })).toBe(
      csvExportAttemptSignature("filtered", { gender: "male" }),
    );
  });
});
