import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { StudentResultCard, type StudentResultItem } from "./StudentResultCard";
import type { Exam } from "@/lib/data/examinationData";
import { withQueryClient } from "@/test/queryClientTestUtils";

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({ madrasaName: "Test Madrasa", logoUrl: null }),
}));

vi.mock("@/lib/templates/documentTemplatesApi", () => ({
  fetchDocumentTemplateServer: vi.fn().mockResolvedValue(null),
  saveDocumentTemplateServer: vi.fn().mockImplementation(async (_key, template) => template),
  deleteDocumentTemplateServer: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({
    children,
    title,
    subtitle,
    footer,
  }: {
    children?: React.ReactNode;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div data-testid="modal">
      <h2>{title}</h2>
      <h3>{subtitle}</h3>
      {children}
      {footer}
    </div>
  ),
}));

const mockExam: Exam = {
  id: "ex-1",
  name: "Tajweed Test",
  subject: "Tajweed",
  date: "2025-01-01",
  duration: 60,
  totalMarks: 100,
  passingMarks: 50,
  classIds: ["cls-1"],
  status: "completed",
  description: "",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const mockResult: StudentResultItem = {
  pct: 95,
  grade: {
    label: "A+",
    color: "#10b981",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    tone: "success",
  },
  rank: 1,
  marksObtained: 95,
  passed: true,
  student: {
    name: "Zaid Khan",
    rollNo: "GR-001",
  },
  cls: {
    name: "Class 1A",
  },
};

describe("StudentResultCard Component", () => {
  it("renders student result card modal with score, rank, and details", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        <StudentResultCard
          result={mockResult}
          exam={mockExam}
          allResults={[mockResult]}
          onClose={vi.fn()}
          onCertificate={vi.fn()}
        />,
      ),
    );

    expect(html).toContain("Zaid Khan");
    expect(html).toContain("Class 1A · GR-001");
    expect(html).toContain("95/100");
    expect(html).toContain("Tajweed Test");
    expect(html).toContain("examinations.resultCard.certificate");
  });

  it("prints the saved report-card template instead of the browser's modal print", async () => {
    const win = {
      opener: null as unknown,
      document: { write: vi.fn(), close: vi.fn() },
      addEventListener: vi.fn(),
      focus: vi.fn(),
      print: vi.fn(),
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        withQueryClient(
          <StudentResultCard
            result={mockResult}
            exam={mockExam}
            allResults={[mockResult]}
            onClose={vi.fn()}
            onCertificate={vi.fn()}
          />,
        ),
      );
    });

    const printButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("examinations.resultCard.print"),
    );
    expect(printButton).toBeTruthy();

    await act(async () => {
      printButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const written = win.document.write.mock.calls[0]?.[0] as string;
    expect(written).toContain("Zaid Khan");
    expect(written).toContain("Tajweed");
    expect(written).toContain("@page { size: 794px 1123px portrait; margin: 0; }");

    await act(async () => {
      root.unmount();
    });
    container.remove();
    openSpy.mockRestore();
  });
});
