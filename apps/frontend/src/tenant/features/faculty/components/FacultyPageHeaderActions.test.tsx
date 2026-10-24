import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyPageHeaderActions } from "./FacultyPageHeaderActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

describe("FacultyPageHeaderActions", () => {
  it("renders import/export choosers and Add Faculty / Add Department / Add Designation", () => {
    const html = renderToStaticMarkup(
      <FacultyPageHeaderActions
        canExport={true}
        canWrite={true}
        viewingDeleted={false}
        onExportEntity={vi.fn()}
        onImportEntity={vi.fn()}
        onAddFaculty={vi.fn()}
        onAddDepartment={vi.fn()}
        onAddDesignation={vi.fn()}
      />,
    );

    expect(html).toContain("faculty.io.export");
    expect(html).toContain("faculty.io.import");
    expect(html).toContain("faculty.tabs.faculties");
    expect(html).toContain("faculty.tabs.designations");
    expect(html).toContain("action.addFaculty");
    expect(html).toContain("faculty.setup.addDepartment");
    expect(html).toContain("faculty.designations.addDesignation");
  });

  it("omits onAddDepartment when prop is not supplied", () => {
    const html = renderToStaticMarkup(
      <FacultyPageHeaderActions
        canExport={true}
        canWrite={true}
        viewingDeleted={false}
        onExportEntity={vi.fn()}
        onImportEntity={vi.fn()}
        onAddFaculty={vi.fn()}
        onAddDesignation={vi.fn()}
      />,
    );

    expect(html).not.toContain("faculty.setup.addDepartment");
    expect(html).toContain("action.addFaculty");
    expect(html).toContain("faculty.designations.addDesignation");
  });

  it("hides actions when viewingDeleted is true", () => {
    const html = renderToStaticMarkup(
      <FacultyPageHeaderActions
        canExport={true}
        canWrite={true}
        viewingDeleted={true}
        onExportEntity={vi.fn()}
        onImportEntity={vi.fn()}
        onAddFaculty={vi.fn()}
        onAddDesignation={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });
});
