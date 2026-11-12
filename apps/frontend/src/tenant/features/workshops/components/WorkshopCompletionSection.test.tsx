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
const printRows = vi.fn();
let rows: WorkshopCompletionRow[] = [];
let loading = false;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", dir: "ltr", isRtl: false }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./WorkshopCertificatePrintModal", () => ({
  WorkshopCertificatePrintModal: ({ rows: targets }: { rows: WorkshopCompletionRow[] }) => {
    printRows(targets.map((row) => row.contactName));
    return null;
  },
}));
vi.mock("../hooks/useWorkshopsCompletionApi", () => ({
  useWorkshopCompletion: () => ({
    data: loading ? undefined : rows,
    isLoading: loading,
    isError: false,
    refetch: vi.fn(),
  }),
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
  waitlistEnabled: false,
  status: "completed",
  phase: "completed",
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
    printRows.mockReset();
    loading = false;
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
    expect(printRows).toHaveBeenCalledWith(["Amina", "Bilal"]);
  });

  it("given a pending completion query, should show loading instead of a false empty roster", async () => {
    loading = true;
    rows = [];
    await act(async () => {
      root.render(<WorkshopCompletionSection workshop={workshop} canWrite />);
    });
    expect(document.body.textContent).not.toContain("workshops.noParticipants");
    expect(document.body.textContent).toContain("common.loading");
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
