import { describe, expect, it, vi } from "vitest";
import type { WorkshopParticipant } from "@mms/shared";
import {
  buildWorkshopNameBadgesHtml,
  buildWorkshopRosterHtml,
  buildWorkshopSignInSheetHtml,
  MAX_BADGES_PER_PRINT,
  printWorkshopRoster,
} from "./workshopPrintables";

const printHtmlDocument = vi.fn();
vi.mock("@/lib/ui/printHtmlDocument", () => ({
  printHtmlDocument: (...args: unknown[]) => printHtmlDocument(...args),
}));

const workshop = { title: "Calligraphy", startDate: "2099-03-01", endDate: "2099-03-02" };
const labels = {
  rosterTitle: "Roster",
  signInTitle: "Sign in",
  badgesTitle: "Badges",
  name: "Name",
  status: "Status",
  signature: "Signature",
  date: "Date",
  number: "#",
};

const participant = (id: string, name = `Person ${id}`): WorkshopParticipant => ({
  id,
  workshopId: "w1",
  contactId: `c-${id}`,
  contactName: name,
  contactPhone: "",
  status: "registered",
  completedAt: null,
  certificateIssuedAt: null,
  waitlistedAt: null,
  createdAt: "2026-03-01T10:00:00.000Z",
});

describe("workshop printables", () => {
  it("escapes names and keeps the full roster bounded", () => {
    const rows = Array.from({ length: 510 }, (_, index) =>
      participant(`p${index}`, index === 0 ? "<script>alert(1)</script>" : `Person ${index}`),
    );
    const { html, result } = buildWorkshopRosterHtml(workshop, rows, labels);
    expect(result).toEqual({ printed: 500, total: 510 });
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("adds signature/date columns to the sign-in sheet", () => {
    const { html } = buildWorkshopSignInSheetHtml(workshop, [participant("p1")], labels);
    expect(html).toContain("Signature");
    expect(html).toContain("Date");
    expect(html).toContain("Person p1");
  });

  it("bounds name badges and escapes user text", () => {
    const rows = Array.from({ length: MAX_BADGES_PER_PRINT + 5 }, (_, index) =>
      participant(`p${index}`, index === 0 ? "<b>Amina</b>" : `Person ${index}`),
    );
    const { html, result } = buildWorkshopNameBadgesHtml(workshop, rows, labels);
    expect(result.printed).toBe(MAX_BADGES_PER_PRINT);
    expect(result.total).toBe(MAX_BADGES_PER_PRINT + 5);
    expect(html).toContain("&lt;b&gt;Amina&lt;/b&gt;");
  });

  it("prints with the active language and direction", () => {
    printWorkshopRoster({
      workshop,
      participants: [participant("p1")],
      labels,
      language: "ar",
      isRtl: true,
    });
    expect(printHtmlDocument).toHaveBeenCalledWith("Roster", expect.stringContaining("Person p1"), {
      language: "ar",
      isRtl: true,
    });
  });
});
