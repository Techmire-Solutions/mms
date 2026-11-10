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

describe("parseCheckInTime day boundaries", () => {
  it("rolls an evening UTC instant onto the next workspace day", () => {
    // 22:30Z is 03:30 the next morning in Asia/Karachi (UTC+5): the mark belongs to 03-11.
    expect(
      parseCheckInTime("2026-03-10T22:30:00Z", undefined, {
        ...OPTIONS,
        // The workspace has already rolled over to the 11th when the device uploads.
        today: "2026-03-11",
      }),
    ).toEqual({
      ok: true,
      value: { date: "2026-03-11", time: "03:30" },
    });
  });

  it("keeps a UTC instant just after midnight on the same workspace day", () => {
    expect(parseCheckInTime("2026-03-10T00:30:00Z", undefined, OPTIONS)).toEqual({
      ok: true,
      value: { date: "2026-03-10", time: "05:30" },
    });
  });

  it("refuses a mark dated in the future relative to the workspace day", () => {
    expect(parseCheckInTime("08:00", "2026-03-11", OPTIONS)).toMatchObject({
      ok: false,
      code: "date_in_future",
    });
  });

  it("refuses a mark older than the late-upload window", () => {
    expect(parseCheckInTime("08:00", "2026-03-01", OPTIONS)).toMatchObject({
      ok: false,
      code: "date_too_old",
    });
  });

  it("follows the DST transition in a zone that observes it", () => {
    const newYork = { timeZone: "America/New_York", today: "2026-03-09", maxAgeDays: 7 };
    // 2026-03-08 is the US spring-forward day: 07:30Z is 03:30 EDT (UTC-4), not 02:30.
    expect(parseCheckInTime("2026-03-08T07:30:00Z", undefined, newYork)).toEqual({
      ok: true,
      value: { date: "2026-03-08", time: "03:30" },
    });
    // The day before, the same wall clock is EST (UTC-5).
    expect(parseCheckInTime("2026-03-07T07:30:00Z", undefined, newYork)).toEqual({
      ok: true,
      value: { date: "2026-03-07", time: "02:30" },
    });
  });
});
