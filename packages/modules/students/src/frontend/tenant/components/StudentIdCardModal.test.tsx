import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import type { Student } from "@mms/contracts";
import { StudentIdCardModal } from "./StudentIdCardModal";
import { withQueryClient } from "../test/queryClientTestUtils";

const mockRefetchStudents = vi.fn().mockResolvedValue({});

vi.mock("../hooks/useStudentsListQueries", () => ({
  useStudentsByIds: vi.fn().mockImplementation(() => ({
    data: undefined,
    refetch: mockRefetchStudents,
  })),
}));

vi.mock("./card-template/StudentCardTemplateEditor", () => ({
  default: function MockStudentCardTemplateEditor({ onClose }: { onClose: () => void }) {
    return (
      <div data-testid="student-card-template-editor">
        <span>Template Editor Content</span>
        <button type="button" onClick={onClose}>
          Close Editor
        </button>
      </div>
    );
  },
}));

vi.mock("@mms/fe-core/documentTemplates/documentTemplatesApi", () => ({
  fetchDocumentTemplateServer: vi.fn().mockResolvedValue(null),
  saveDocumentTemplateServer: vi.fn().mockImplementation(async (_key, template) => ({
    template,
    updatedAt: "2026-01-01T00:00:00.000Z",
  })),
  deleteDocumentTemplateServer: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `Batch (${params.count})`;
      if (key === "students.cardTemplate.field.photo") return "STUDENT PHOTO";
      return key;
    },
    isRtl: false,
  }),
}));

vi.mock("../host/usePermissions", () => ({
  useModulePermissions: () => ({ canEditSetup: true }),
}));

vi.mock("../host/useBranding", () => ({
  useBranding: () => ({
    madrasaName: "Test Madrasa",
    phone: "+1 555-0000",
    email: "info@testmadrasa.com",
    address: "123 Main St",
  }),
}));

vi.mock("@mms/fe-core/components/Modal", () => ({
  Modal: ({
    open,
    title,
    children,
    footer,
  }: {
    open?: boolean;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => {
    if (open === false) return null;
    return (
      <div data-testid="modal">
        <h1>{title}</h1>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    );
  },
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
  beforeEach(() => {
    vi.clearAllMocks();
    window.print = vi.fn();
  });

  it("renders printable ID card preview with student details, photo placeholder and standard print styles", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
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
      ),
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
    expect(html).toContain("STUDENT PHOTO");
    expect(html).toContain("STUDENT IDENTITY CARD");
    expect(html).toContain("@page");
    expect(html).toContain("size: 324px 204px");
  });

  it("returns null when closed or items empty", () => {
    const htmlClosed = renderToStaticMarkup(
      withQueryClient(<StudentIdCardModal open={false} onClose={vi.fn()} items={[]} />),
    );
    expect(htmlClosed).toBe("");
  });

  it("switches cleanly between FRONT ONLY, BACK ONLY, and BOTH SIDES", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        withQueryClient(
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
        ),
      );
    });

    // Default is FRONT ONLY: shows front content
    expect(container.textContent).toContain("STUDENT IDENTITY CARD");

    // Click BACK ONLY mode
    const backBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("students.idCard.printBackOnly"),
    );
    expect(backBtn?.tagName).toBe("BUTTON");

    await act(async () => {
      backBtn?.click();
    });

    expect(container.textContent).toContain("TERMS & EMERGENCY INSTRUCTIONS");

    // Click BOTH SIDES mode
    const bothBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("students.idCard.printBothSides"),
    );
    expect(bothBtn?.tagName).toBe("BUTTON");

    await act(async () => {
      bothBtn?.click();
    });

    // In BOTH SIDES, both front and back sides are rendered simultaneously
    expect(container.textContent).toContain("STUDENT IDENTITY CARD");
    expect(container.textContent).toContain("TERMS & EMERGENCY INSTRUCTIONS");

    // Switch back to FRONT ONLY mode
    const frontBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("students.idCard.printFrontOnly"),
    );
    expect(frontBtn?.tagName).toBe("BUTTON");

    await act(async () => {
      frontBtn?.click();
    });

    expect(container.textContent).toContain("STUDENT IDENTITY CARD");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("handles empty optional fields cleanly with fallback values", () => {
    const minimalStudent: Student = {
      id: "std-minimal-1",
      contactId: "cnt-minimal-1",
      name: "Minimal Student",
      status: "active",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const html = renderToStaticMarkup(
      withQueryClient(
        <StudentIdCardModal
          open={true}
          onClose={vi.fn()}
          items={[{ student: minimalStudent, sessionNames: [] }]}
        />,
      ),
    );

    expect(html).toContain("Minimal Student");
    expect(html).toContain("STUDENT PHOTO");
    expect(html).toContain("—");
  });
});
