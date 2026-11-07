import { describe, expect, it } from "vitest";
import { escapeIcalText, foldIcalLine, streamIcalCalendar } from "../lib/icalFormat.js";
import { addIsoDays, formatIcalUtc, zonedDateTimeToUtc } from "../lib/zonedTime.js";

describe("iCalendar formatting", () => {
  it("escapes TEXT metacharacters and CRLF so user text cannot inject properties", () => {
    expect(escapeIcalText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("folds long lines at 75 octets without splitting UTF-8 sequences", () => {
    const folded = foldIcalLine(`SUMMARY:${"a".repeat(100)}`);
    expect(folded).toContain("\r\n ");
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"a".repeat(100)}`);
    const urdu = foldIcalLine(`SUMMARY:${"سلام".repeat(30)}`);
    expect(urdu).not.toContain("\uFFFD");
  });

  it("emits CRLF calendar lines and safe event values", () => {
    const ics = streamIcalCalendar({ name: "Calendar, test", timeZone: "Asia/Karachi" }, [
      {
        uid: "e1",
        startOn: "2026-01-01",
        endOn: "2026-01-03",
        summary: "Holiday\r\nATTENDEE:mailto:evil@example.com",
        categories: ["holiday"],
      },
    ]);
    const text = Array.from(ics).join("");
    expect(text).toContain("\r\n");
    expect(text).toContain("BEGIN:VEVENT");
    expect(text).toContain("DTSTART;VALUE=DATE:20260101");
    expect(text).toContain("DTEND;VALUE=DATE:20260104");
    expect(text).toContain("Holiday\\nATTENDEE:mailto:evil@example.com");
    // The escaped newline must not create a real ATTENDEE property line.
    expect(text.split("\r\n").some((line) => line.startsWith("ATTENDEE:"))).toBe(false);
  });

  it("emits UTC timestamps and converts a workspace wall time across DST", () => {
    const winter = zonedDateTimeToUtc({
      date: "2026-01-15",
      time: "09:00",
      timeZone: "America/New_York",
    });
    const summer = zonedDateTimeToUtc({
      date: "2026-07-01",
      time: "09:00",
      timeZone: "America/New_York",
    });
    expect(formatIcalUtc(winter)).toBe("20260115T140000Z");
    expect(formatIcalUtc(summer)).toBe("20260701T130000Z");
    expect(addIsoDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
