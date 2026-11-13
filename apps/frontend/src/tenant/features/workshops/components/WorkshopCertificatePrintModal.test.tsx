import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopCompletionRow, WorkshopEvent } from "@mms/shared";
import { WorkshopCertificatePrintModal } from "./WorkshopCertificatePrintModal";
import { DEFAULT_WORKSHOP_CERTIFICATE_TEMPLATE } from "../lib/workshopCertificateTemplate";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const printTemplateDocument = vi.fn();
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: "ar",
    dir: "rtl",
    isRtl: true,
  }),
}));
vi.mock("@/lib/notify", () => ({ notify: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/templates/useDocumentTemplates", () => ({
  useDocumentTemplate: () => ({ template: DEFAULT_WORKSHOP_CERTIFICATE_TEMPLATE }),
}));
vi.mock("@/components/template-editor/templateDocumentPrint", () => ({
  printTemplateDocument: (...args: unknown[]) => printTemplateDocument(...args),
}));
vi.mock("@/components/template-editor/TemplateDocumentPreview", () => ({
  TemplateDocumentPreview: ({ data }: { data: { recipientName: string } }) => (
    <div data-testid="certificate-preview">{data.recipientName}</div>
  ),
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
  minAttendancePct: null,
  minScorePct: null,
  participantCount: 60,
  waitlistEnabled: false,
  status: "completed",
  phase: "completed",
};

const row = (index: number): WorkshopCompletionRow => ({
  participantId: `p${index}`,
  contactName: `Person ${index}`,
  attendancePct: 100,
  scorePct: 80,
  status: "completed",
  shortfalls: [],
  completedAt: "2099-03-02T10:00:00.000Z",
  certificateIssuedAt: "2099-03-03T09:00:00.000Z",
});

describe("WorkshopCertificatePrintModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    printTemplateDocument.mockReset().mockReturnValue(true);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders at most 50 certificates per batch and pages through the rest", async () => {
    const rows = Array.from({ length: 60 }, (_, index) => row(index));
    await act(async () => {
      root.render(
        <WorkshopCertificatePrintModal workshop={workshop} rows={rows} onClose={() => {}} />,
      );
    });
    expect(document.querySelectorAll('[data-testid="certificate-preview"]')).toHaveLength(50);
    expect(document.body.textContent).toContain("workshops.certificate.printBatch");

    const next = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("common.next"),
    );
    await act(async () => next?.click());
    expect(document.querySelectorAll('[data-testid="certificate-preview"]')).toHaveLength(10);
  });

  it("prints with the active language and RTL direction", async () => {
    await act(async () => {
      root.render(
        <WorkshopCertificatePrintModal workshop={workshop} rows={[row(1)]} onClose={() => {}} />,
      );
    });
    const print = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("workshops.certificate.print"),
    );
    await act(async () => print?.click());
    expect(printTemplateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ language: "ar", isRtl: true }),
    );
  });
});
