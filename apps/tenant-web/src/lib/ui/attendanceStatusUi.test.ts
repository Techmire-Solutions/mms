import { describe, expect, it } from "vitest";
import { attendanceStatusLabel } from "@/lib/ui/attendanceStatusUi";

describe("attendanceStatusLabel", () => {
  it("returns the translated label when a translation exists", () => {
    const t = (key: string) => (key === "attendance.status.present" ? "Present" : key);
    expect(attendanceStatusLabel({ id: "present", label: "Present" }, t)).toBe("Present");
  });

  it("falls back to the config label when no translation exists", () => {
    const t = (key: string) => key;
    expect(attendanceStatusLabel({ id: "late", label: "Late" }, t)).toBe("Late");
  });
});
