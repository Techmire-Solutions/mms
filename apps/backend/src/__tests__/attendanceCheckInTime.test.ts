import { describe, expect, it } from "vitest";
import { parseCheckInTime } from "@mms/shared";

/** Device timestamp normalisation: wall clock, ISO with offset, epoch; bounds and ambiguity. */

const OPTIONS = { timeZone: "Asia/Karachi", today: "2026-03-10", maxAgeDays: 7 };

describe("parseCheckInTime", () => {
  it("accepts a bare HH:mm with an explicit date", () => {
    expect(parseCheckInTime("08:05", "2026-03-09", OPTIONS)).toEqual({
      ok: true,
      value: { date: "2026-03-09", time: "08:05" },
    });
    expect(parseCheckInTime("7:05", "2026-03-09", OPTIONS)).toMatchObject({
      ok: true,
      value: { time: "07:05" },
    });
  });

  it("refuses a bare clock without a date", () => {
    expect(parseCheckInTime("08:05", undefined, OPTIONS)).toMatchObject({
      ok: false,
      code: "ambiguous_time",
    });
  });

  it("rejects impossible clock values", () => {
    for (const raw of ["24:00", "08:60", "08:05:99", "not-a-time", ""]) {
      expect(parseCheckInTime(raw, "2026-03-09", OPTIONS)).toMatchObject({ ok: false });
    }
  });

  it("converts an ISO timestamp to the workspace day and clock", () => {
    const result = parseCheckInTime("2026-03-09T03:05:00Z", undefined, OPTIONS);
    // 03:05Z is 08:05 in Asia/Karachi (UTC+5).
    expect(result).toEqual({ ok: true, value: { date: "2026-03-09", time: "08:05" } });
  });

  it("refuses an ISO timestamp whose workspace day disagrees with the supplied date", () => {
    expect(parseCheckInTime("2026-03-09T23:30:00Z", "2026-03-09", OPTIONS)).toMatchObject({
      ok: false,
      code: "ambiguous_time",
    });
  });

  it("accepts epoch milliseconds", () => {
    const result = parseCheckInTime("1773000000000", undefined, OPTIONS);
    expect(result.ok).toBe(true);
  });

  it("refuses future and over-age check-ins", () => {
    expect(parseCheckInTime("08:00", "2026-03-11", OPTIONS)).toMatchObject({
      ok: false,
      code: "date_in_future",
    });
    expect(parseCheckInTime("08:00", "2026-03-01", OPTIONS)).toMatchObject({
      ok: false,
      code: "date_too_old",
    });
  });
});
