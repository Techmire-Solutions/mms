import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopCompletionRow, WorkshopEvent } from "@mms/shared";
import { WorkshopCompletionSection } from "./WorkshopCompletionSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const issueMutateAsync = vi.fn();
const printHtmlDocument = vi.fn();
let rows: WorkshopCompletionRow[] = [];

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", dir: "ltr", isRtl: false }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/contexts/BrandingPaletteContext", () => ({
  useBrandPalette: () => ({ primary: "#7a5a00" }),
}));
vi.mock("@/lib/ui/printHtmlDocument", () => ({
  printHtmlDocument: (...args: unknown[]) => printHtmlDocument(...args),
}));
vi.mock("../hooks/useWorkshopsCompletionApi", () => ({
  useWorkshopCompletion: () => ({ data: rows, isError: false, refetch: vi.fn() }),
  useEvaluateWorkshopCompletion: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useIssueWorkshopCertificates: () => ({ mutateAsync: issueMutateAsync, isPending: false }),
}));

const workshop: WorkshopEvent = {
  id: "w1",
  title: "Calligraphy",
  description: "",
  startDate: "2099-03-01",
  endDate: "2099-03-02",
  registrationDeadline: null,
  capacity: null,
  fee: null,
  programId: null,
  subjectId: null,
  minAttendancePct: 50,
  minScorePct: 60,
  participantCount: 3,
};

const row = (
  participantId: string,
  fields: Partial<WorkshopCompletionRow>,
): WorkshopCompletionRow => ({
  participantId,
  contactName: participantId,
  attendancePct: 100,
  scorePct: 80,
  status: "completed",
  shortfalls: [],
  completedAt: "2099-03-02T10:00:00.000Z",
  certificateIssuedAt: null,
  ...fields,
});

describe("WorkshopCompletionSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    issueMutateAsync.mockReset().mockResolvedValue({ issued: [], rows: [] });
    printHtmlDocument.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("given issue-all, should issue only uncertified completions and print every completion", async () => {
    // Arrange
    rows = [
      row("Amina", {}),
      row("Bilal", { certificateIssuedAt: "2099-03-03T09:00:00.000Z" }),
      row("Sara", { status: "attended", completedAt: null, shortfalls: ["score_below"] }),
    ];
    await act(async () => {
      root.render(<WorkshopCompletionSection workshop={workshop} canWrite />);
    });
    const issueAll = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("workshops.certificate.issueAll"),
    );

    // Act
    await act(async () => issueAll?.click());

    // Assert
    expect(issueMutateAsync).toHaveBeenCalledWith({ id: "w1", participantIds: ["Amina"] });
    expect(printHtmlDocument).toHaveBeenCalledTimes(1);
    const html = String(printHtmlDocument.mock.calls[0]?.[1]);
    expect(html).toContain("Amina");
    expect(html).toContain("Bilal");
    expect(html).not.toContain("Sara");
  });

  it("given a participant short of the criteria, should explain why and offer no print", async () => {
    rows = [row("Sara", { status: "attended", completedAt: null, shortfalls: ["score_below"] })];
    await act(async () => {
      root.render(<WorkshopCompletionSection workshop={workshop} canWrite />);
    });
    expect(container.textContent).toContain("workshops.shortfall.scoreBelow");
    expect(container.querySelector('[aria-label="workshops.certificate.printNamed"]')).toBeNull();
    expect(container.textContent).not.toContain("workshops.certificate.issueAll");
  });
});
