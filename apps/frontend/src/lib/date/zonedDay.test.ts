import { describe, expect, it } from "vitest";
import { dateInTimeZone, endOfDayInstant, startOfDayInstant } from "./zonedDay";

describe("workspace zoned day helpers", () => {
  it("converts local day boundaries across a DST change", () => {
    expect(startOfDayInstant("2026-03-08", "America/New_York")).toBe("2026-03-08T05:00:00.000Z");
    expect(endOfDayInstant("2026-03-08", "America/New_York")).toBe("2026-03-09T03:59:59.000Z");
  });

  it("formats instants in the workspace zone", () => {
    expect(dateInTimeZone("2026-03-08T02:00:00.000Z", "Asia/Karachi")).toBe("2026-03-08");
    expect(dateInTimeZone("2026-03-07T22:00:00.000Z", "Pacific/Kiritimati")).toBe("2026-03-08");
  });
});
