import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { DocumentTemplate } from "@mms/shared";
import { TermReportCardModal } from "./TermReportCardModal";
import type { StudentExamPaper } from "../lib/studentExamPapers";
import { EXAMINATION_TEMPLATE_STORAGE_KEY } from "../lib/examinationTemplateData";
import { fetchDocumentTemplateServer } from "@/lib/templates/documentTemplatesApi";
import { writeCachedDocumentTemplate } from "@/lib/templates/documentTemplateCache";
import { notify } from "@/lib/notify";
import { withQueryClient } from "@/test/queryClientTestUtils";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", isRtl: false }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({ madrasaName: "Test Madrasa", logoUrl: null }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/templates/documentTemplatesApi", () => ({
  fetchDocumentTemplateServer: vi.fn().mockResolvedValue(null),
  saveDocumentTemplateServer: vi.fn().mockImplementation(async (_key, template) => ({
    template,
    updatedAt: "2026-01-01T00:00:00.000Z",
  })),
  deleteDocumentTemplateServer: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({ children, footer }: { children?: React.ReactNode; footer?: React.ReactNode }) => (
    <div data-testid="modal">
      {children}
      {footer}
    </div>
  ),
}));

const template: DocumentTemplate = {
  pageSize: "A6",
  orientation: "portrait",
  elements: [
    { id: "title", type: "static", label: "TERM CARD", x: 10, y: 10, w: 300, h: 20 },
    {
      id: "subjects",
      type: "table",
      label: "Subjects",
      x: 10,
      y: 40,
      w: 360,
      h: 200,
      columns: [{ header: "Subject", field: "name" }],
    },
  ],
};

function exam(id: string, name: string, subject: string, date: string, totalMarks = 100) {
  return {
    id,
    name,
    subject,
    totalMarks,
    date,
    passingMarks: 50,
    duration: 60,
    classIds: ["cls-1"],
    status: "completed" as const,
    description: "",
  };
}

const papers: StudentExamPaper[] = [
  {
    exam: exam("ex-1", "Mid-Term", "Quran", "2026-01-01") as never,
    result: { id: "r1", examId: "ex-1", studentId: "s1", marksObtained: 90 } as never,
  },
  {
    exam: exam("ex-2", "Mid-Term", "Tajweed", "2026-01-02", 50) as never,
    result: { id: "r2", examId: "ex-2", studentId: "s1", marksObtained: 40 } as never,
  },
  {
    exam: exam("ex-3", "Final-Term", "Fiqh", "2026-06-01") as never,
    result: { id: "r3", examId: "ex-3", studentId: "s1", marksObtained: 70 } as never,
  },
];

const result = {
  pct: 87,
  marksObtained: 130,
  grade: { label: "A" },
  student: { name: "Zaid Khan", rollNo: "GR-001" },
  cls: { name: "Class 1A" },
};

function fakePrintWindow() {
  return {
    opener: null as unknown,
    document: { write: vi.fn(), close: vi.fn() },
    addEventListener: vi.fn(),
    focus: vi.fn(),
    print: vi.fn(),
  };
}

let mountedRoot: { root: Root; container: HTMLDivElement } | null = null;

async function renderModal(): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoot = { root, container };
  await act(async () => {
    root.render(
      withQueryClient(
        <TermReportCardModal
          result={result}
          papers={papers}
          currentExamId="ex-1"
          onClose={vi.fn()}
        />,
      ),
    );
  });
  return container;
}

describe("TermReportCardModal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    writeCachedDocumentTemplate(EXAMINATION_TEMPLATE_STORAGE_KEY, {
      template,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(fetchDocumentTemplateServer).mockResolvedValue({
      template,
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);
  });

  afterEach(async () => {
    if (mountedRoot) {
      await act(async () => {
        mountedRoot?.root.unmount();
      });
      mountedRoot.container.remove();
      mountedRoot = null;
    }
  });

  it("preselects the current paper and papers sharing its exam name", async () => {
    const container = await renderModal();

    const text = container.textContent ?? "";
    // The checklist lists every paper; "Fiqh" appears once, but not in either preview
    // (visible + offscreen print copy) because it is not preselected.
    expect(text).toContain("Quran");
    expect(text).toContain("Tajweed");
    expect((text.match(/Fiqh/g) ?? []).length).toBe(1);
  });

  it("includes a newly selected paper in the preview and the print document", async () => {
    const win = fakePrintWindow();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    const container = await renderModal();

    const checkboxes = Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"]'));
    // Index 0 is "select all"; papers follow in date order.
    expect(checkboxes.length).toBe(4);

    await act(async () => {
      checkboxes[3]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(((container.textContent ?? "").match(/Fiqh/g) ?? []).length).toBe(3);

    const printButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("examinations.termReportCard.print"),
    );
    expect(printButton).toBeTruthy();

    await act(async () => {
      printButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const written = win.document.write.mock.calls[0]?.[0] as string;
    expect(written).toContain("Quran");
    expect(written).toContain("Tajweed");
    expect(written).toContain("Fiqh");
    openSpy.mockRestore();
  });

  it("disables printing when no papers are selected", async () => {
    const container = await renderModal();
    const checkboxes = Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"]'));

    // Select-all first selects every paper; a second press clears the set.
    await act(async () => {
      checkboxes[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      checkboxes[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const printButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("examinations.termReportCard.print"),
    );
    expect(printButton).toBeTruthy();
    expect(
      printButton!.hasAttribute("disabled") || printButton!.getAttribute("aria-disabled"),
    ).toBe(true);
  });

  it("reports a blocked print popup", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const container = await renderModal();

    const printButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("examinations.termReportCard.print"),
    );
    await act(async () => {
      printButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(notify.error).toHaveBeenCalledWith("templateEditor.exportFailed");
    openSpy.mockRestore();
  });
});
