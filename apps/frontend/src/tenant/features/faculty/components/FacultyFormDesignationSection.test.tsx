import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyFormDesignationSection } from "./FacultyFormDesignationSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./FacultyCatalogCreateOverlays", () => ({
  FacultyCatalogCreateOverlays: () => null,
}));

vi.mock("@/tenant/hooks/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => [
    {
      id: "instructor",
      labelKey: "users.role.instructor",
      customLabel: "Instructor",
      permissions: {},
      isSystem: true,
    },
  ],
}));

describe("FacultyFormDesignationSection", () => {
  it("given designation is disabled, should render nothing", () => {
    const html = renderToStaticMarkup(
      <FacultyFormDesignationSection
        facultyDraft={{}}
        errors={{}}
        isFieldEnabled={() => false}
        isFieldRequired={() => false}
        onDraftChange={vi.fn()}
      />,
    );

    expect(html).toBe("");
  });

  it("given designation fields enabled, should render Designation card with Department · Designation · Role options", () => {
    const html = renderToStaticMarkup(
      <FacultyFormDesignationSection
        facultyDraft={{
          department: "Islamic Jurisprudence",
          departmentId: "dept-1",
          designationId: "des-1",
        }}
        errors={{}}
        departmentEntities={[
          {
            id: "dept-1",
            workspaceSubdomain: "tenant",
            name: "Islamic Jurisprudence",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            deletedAt: null,
          },
        ]}
        designationOptions={[
          {
            id: "des-1",
            departmentId: "dept-1",
            departmentName: "Islamic Jurisprudence",
            name: "Head of Department",
            status: "active",
            hierarchyRank: 2,
            assignableRoles: ["instructor", "department_head"],
          },
        ]}
        isFieldEnabled={() => true}
        isFieldRequired={() => true}
        onDraftChange={vi.fn()}
      />,
    );

    expect(html).toContain("faculty.form.designationCard");
    expect(html).toContain("faculty.form.designations.addTenure");
    expect(html).toContain("Islamic Jurisprudence · Head of Department · Instructor");
    expect(html).not.toContain('data-testid="faculty-designation-roles"');
    expect(html).toContain('id="designation-0-designationId"');
    expect(html).toContain('aria-label="faculty.designations.addDesignation"');
    expect(html).toContain("employDesignationStatus");
    expect(html).not.toContain('id="department"');
  });

  it("given showCollectionTitle, should still render the designation section heading", () => {
    const html = renderToStaticMarkup(
      <FacultyFormDesignationSection
        showCollectionTitle
        facultyDraft={{ designationId: "des-1" }}
        errors={{}}
        designationOptions={[
          {
            id: "des-1",
            departmentId: "dept-1",
            name: "Head of Department",
            status: "active",
            hierarchyRank: 2,
            assignableRoles: [],
          },
        ]}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        onDraftChange={vi.fn()}
      />,
    );

    expect(html).toContain("faculty.form.designationCard");
  });
});
