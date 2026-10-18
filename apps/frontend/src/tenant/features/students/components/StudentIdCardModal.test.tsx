import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { StudentIdCardModal } from "./StudentIdCardModal";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `Batch (${params.count})`;
      return key;
    },
  }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canEditSetup: true }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({
    madrasaName: "Test Madrasa",
    logoUrl: "https://example.com/logo.png",
  }),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({
    title,
    children,
    footer,
  }: {
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div data-testid="modal">
      <h1>{title}</h1>
      <div>{children}</div>
      <div>{footer}</div>
    </div>
  ),
}));

const mockStudent: Student = {
  id: "std-idcard-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  grNumber: "GR-001",
  status: "active",
  fatherName: "Harith",
  phone: "+1 555-0100",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("StudentIdCardModal Component", () => {
  it("renders printable ID card preview with student details", () => {
    const html = renderToStaticMarkup(
      <StudentIdCardModal
        open={true}
        onClose={vi.fn()}
        items={[
          {
            student: mockStudent,
            sessionNames: ["Quran Hifz 2025"],
            guardianName: "Abu Zayd",
            bloodGroup: "O+",
          },
        ]}
      />,
    );

    expect(html).toContain("students.idCard.title");
    expect(html).toContain("students.idCard.customize");
    expect(html).toContain("students.idCard.printFrontOnly");
    expect(html).toContain("students.idCard.printBackOnly");
    expect(html).toContain("students.idCard.printBothSides");
    expect(html).toContain("students.idCard.cutGuides");
    expect(html).toContain("Zayd Harith");
    expect(html).toContain("GR-001");
    expect(html).toContain("Quran Hifz 2025");
    expect(html).toContain("Abu Zayd");
    expect(html).toContain("O+");
  });

  it("returns null when closed or items empty", () => {
    const htmlClosed = renderToStaticMarkup(
      <StudentIdCardModal open={false} onClose={vi.fn()} items={[]} />,
    );
    expect(htmlClosed).toBe("");
  });
});
