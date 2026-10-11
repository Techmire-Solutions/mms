import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FacultyDepartmentEntity, FacultyDesignationDefinition } from "@mms/shared";
import { FacultyDepartmentSelectField } from "./FacultyDepartmentSelectField";
import { FacultyDesignationSelectField } from "./FacultyDesignationSelectField";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const dept = (overrides: Partial<FacultyDepartmentEntity> = {}): FacultyDepartmentEntity => ({
  id: "dept-1",
  workspaceSubdomain: "demo",
  name: "Hifz",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const desig = (
  overrides: Partial<FacultyDesignationDefinition> = {},
): FacultyDesignationDefinition => ({
  id: "des-1",
  departmentId: "dept-1",
  name: "Principal",
  status: "active",
  assignableRoles: [],
  ...overrides,
});

describe("FacultyDynamicSelectFields", () => {
  it("renders dynamic department dropdown without Plus when canAdd is omitted", () => {
    const html = renderToStaticMarkup(
      <FacultyDepartmentSelectField value="" departmentEntities={[dept()]} onChange={vi.fn()} />,
    );

    expect(html).toContain('id="department"');
    expect(html).toContain("Hifz");
    expect(html).not.toContain('aria-label="faculty.setup.addDepartment"');
    expect(html).not.toContain("faculty.setup.addDepartmentSubtitle");
  });

  it("shows Plus when canAdd and onOpenAdd are set", () => {
    const html = renderToStaticMarkup(
      <FacultyDepartmentSelectField
        value=""
        canAdd
        onOpenAdd={vi.fn()}
        departmentEntities={[dept()]}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('aria-label="faculty.setup.addDepartment"');
  });

  it("omits inactive departments unless they are the current selection", () => {
    const html = renderToStaticMarkup(
      <FacultyDepartmentSelectField
        value="Hifz"
        departmentId="dept-1"
        departmentEntities={[
          dept(),
          dept({ id: "dept-2", name: "Archived Dept", status: "inactive" }),
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain("Hifz");
    expect(html).not.toContain("Archived Dept");
  });

  it("does not render edit or delete buttons even when department is selected", () => {
    const html = renderToStaticMarkup(
      <FacultyDepartmentSelectField
        value="Hifz"
        departmentId="dept-1"
        departmentEntities={[dept()]}
        onChange={vi.fn()}
      />,
    );

    expect(html).not.toContain('title="common.edit"');
    expect(html).not.toContain('title="common.delete"');
  });

  it("renders designation dropdown without add/edit/delete buttons and lists all active options", () => {
    const html = renderToStaticMarkup(
      <FacultyDesignationSelectField
        designationOptions={[
          desig({ id: "des-1", name: "Principal", assignableRoles: ["admin"] }),
          desig({ id: "des-2", name: "Lecturer", assignableRoles: ["instructor"] }),
          desig({ id: "des-3", name: "Archived Title", status: "inactive" }),
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('id="designationId"');
    expect(html).toContain("Principal");
    expect(html).toContain("Lecturer");
    expect(html).not.toContain("Archived Title");
    expect(html).not.toContain('aria-label="faculty.designations.addDesignation"');
    expect(html).not.toContain('title="common.edit"');
    expect(html).not.toContain('title="common.delete"');
  });

  it("shows designation Plus when canAdd is enabled", () => {
    const html = renderToStaticMarkup(
      <FacultyDesignationSelectField
        canAdd
        onOpenAdd={vi.fn()}
        designationOptions={[desig({ assignableRoles: ["admin"] })]}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('aria-label="faculty.designations.addDesignation"');
  });

  it("keeps the currently selected inactive designation available in the list", () => {
    const html = renderToStaticMarkup(
      <FacultyDesignationSelectField
        designationId="des-3"
        designationOptions={[desig({ id: "des-3", name: "Archived Title", status: "inactive" })]}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain("Archived Title");
    expect(html).not.toContain("common.add");
    expect(html).not.toContain('title="common.edit"');
    expect(html).not.toContain('title="common.delete"');
  });
});
