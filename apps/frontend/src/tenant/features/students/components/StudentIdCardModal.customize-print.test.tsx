import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import type { Student } from "@mms/contracts";
import { StudentIdCardModal } from "./StudentIdCardModal";
import { withQueryClient } from "@/test/queryClientTestUtils";

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

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canEditSetup: true }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
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

describe("StudentIdCardModal Customize & Print", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.print = vi.fn();
  });

  it("opens template editor and hides modal when Customize Design is clicked", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        withQueryClient(
          <StudentIdCardModal
            open={true}
            onClose={vi.fn()}
            items={[{ student: mockStudent, sessionNames: [] }]}
          />,
        ),
      );
    });

    expect(container.querySelector('[data-testid="modal"]')?.tagName).toBe("DIV");

    const customizeBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("students.idCard.customize"),
    );
    expect(customizeBtn?.tagName).toBe("BUTTON");

    await act(async () => {
      customizeBtn?.click();
    });

    // Modal is hidden and Template Editor is displayed
    expect(container.querySelector('[data-testid="modal"]')).toBe(null);
    expect(container.textContent).toContain("Template Editor Content");

    // Clicking close in editor restores modal
    const closeEditorBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Close Editor",
    );
    expect(closeEditorBtn?.tagName).toBe("BUTTON");

    await act(async () => {
      closeEditorBtn?.click();
    });

    expect(container.querySelector('[data-testid="modal"]')?.tagName).toBe("DIV");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("auto-fetches student data when Print ID Card button is clicked", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        withQueryClient(
          <StudentIdCardModal
            open={true}
            onClose={vi.fn()}
            items={[{ student: mockStudent, sessionNames: [] }]}
          />,
        ),
      );
    });

    expect(mockRefetchStudents).toHaveBeenCalledTimes(1);

    let activeDuringPrint = false;
    window.print = vi.fn().mockImplementation(() => {
      activeDuringPrint = document.body.getAttribute("data-print-modal-active") === "true";
    });

    const printBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "students.idCard.print",
    );
    expect(printBtn?.tagName).toBe("BUTTON");

    await act(async () => {
      printBtn?.click();
    });

    expect(mockRefetchStudents).toHaveBeenCalledTimes(2);
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(activeDuringPrint).toBe(true);
    expect(document.body.hasAttribute("data-print-modal-active")).toBe(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("emits clean print stylesheet with valid @page size and overlay unclamp rules", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        <StudentIdCardModal
          open={true}
          onClose={vi.fn()}
          items={[{ student: mockStudent, sessionNames: [] }]}
        />,
      ),
    );

    expect(html).toContain(
      "@page {\n          size: 324px 204px;\n          margin: 0;\n        }",
    );
    expect(html).toContain('body > :not([data-slot="overlay-root"]):not([data-print-unclamp])');
    expect(html).toContain('[data-slot="overlay-root"],\n        [data-print-unclamp] {');
    expect(html).toContain(".id-card-print-page {");
  });
});
