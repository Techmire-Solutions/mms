import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FacultyBasicSection,
  FacultyContactSection,
  FacultyEmploymentSection,
} from "./FacultyFormSections";
import { FacultyFormDesignationSection } from "./FacultyFormDesignationSection";

vi.mock("@/components/contactLink/ContactPicker", () => ({
  default: () => <div data-testid="contact-picker">contact-picker</div>,
}));

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
      id: "faculty_member",
      labelKey: "users.role.faculty_member",
      customLabel: "Faculty Member",
      permissions: {},
      isSystem: true,
    },
  ],
}));

describe("FacultyFormSections Components", () => {
  it("renders FacultyContactSection with contact picker and contact pills", () => {
    const html = renderToStaticMarkup(
      <FacultyContactSection
        facultyDraft={{ contactId: "cnt-1" }}
        linkedContact={
          {
            id: "cnt-1",
            name: "Ustadh Ali",
            phones: [{ number: "+923001234567" }],
            emails: [{ address: "ali@madrasa.org" }],
            education: [{ degree: "M.A. Islamic Studies", fieldOfStudy: "Hadith" }],
          } as unknown as never
        }
        linkedFacultyContactIds={[]}
        errors={{}}
        fields={{}}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        onDraftChange={vi.fn()}
      />,
    );

    expect(html).toContain("contact-picker");
    expect(html).toContain("3001234567");
    expect(html).toContain("ali@madrasa.org");
    expect(html).toContain("M.A. Islamic Studies");
    expect(html).toContain("Hadith");
  });

  it("renders FacultyBasicSection as null (retired in favor of contact education/skills)", () => {
    const html = renderToStaticMarkup(
      <FacultyBasicSection
        facultyDraft={{ specialization: "Tajweed" }}
        errors={{}}
        fields={{}}
        defaultSpecialization="Tajweed"
        specializationOptions={["Tajweed", "Hifz"]}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        onDraftChange={vi.fn()}
      />,
    );

    expect(html).toBe("");
  });

  it("renders FacultyEmploymentSection employeeId, status, and join date fields", () => {
    const html = renderToStaticMarkup(
      <FacultyEmploymentSection
        autoGenerateId={false}
        errors={{}}
        fields={{}}
        idPrefix="FAC-"
        nextEmployeeId="FAC-002"
        statusOptions={[{ value: "active", label: "Active" }]}
        facultyDraft={{ employeeId: "FAC-001", status: "active" }}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        onDraftChange={vi.fn()}
      />,
    );

    expect(html).toContain("faculty.form.sectionEmployment");
    expect(html).not.toContain("contact-picker");
    expect(html).toContain("faculty.form.employeeIdManualHint");
    expect(html).toContain("FAC-001");
  });

  it("locks auto-generated employee IDs to Setup configuration", () => {
    const html = renderToStaticMarkup(
      <FacultyEmploymentSection
        autoGenerateId
        errors={{}}
        fields={{}}
        idPrefix="FAC"
        nextEmployeeId="FAC20260001"
        statusOptions={[{ value: "active", label: "Active" }]}
        facultyDraft={{ employeeId: "FAC20260001", status: "active" }}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        onDraftChange={vi.fn()}
      />,
    );

    expect(html).toContain("faculty.form.employeeIdSetupHint");
    expect(html).toContain("FAC20260001");
    expect(html).toContain('disabled=""');
  });

  it("renders accessible error attributes on employeeId when errors are present", () => {
    const empHtml = renderToStaticMarkup(
      <FacultyEmploymentSection
        autoGenerateId={false}
        errors={{ employeeId: "Duplicate employee ID" }}
        fields={{}}
        idPrefix="FAC-"
        statusOptions={[{ value: "active", label: "Active" }]}
        facultyDraft={{ employeeId: "FAC-001", status: "active" }}
        isFieldEnabled={() => true}
        isFieldRequired={() => true}
        onDraftChange={vi.fn()}
      />,
    );

    expect(empHtml).toContain('id="employeeId"');
    expect(empHtml).toContain('aria-invalid="true"');
    expect(empHtml).toContain('aria-describedby="employeeId-error"');
    expect(empHtml).toContain("border-destructive");
  });

  it("renders Designation · Role in the designation dropdown option labels", () => {
    const html = renderToStaticMarkup(
      <FacultyFormDesignationSection
        errors={{}}
        facultyDraft={{
          designationId: "senior-faculty",
          department: "Islamic Jurisprudence",
          departmentId: "dept-1",
        }}
        designationOptions={[
          {
            id: "senior-faculty",
            departmentId: "dept-1",
            departmentName: "Islamic Jurisprudence",
            name: "Senior Faculty",
            status: "active",
            hierarchyRank: 3,
            assignableRoles: ["faculty_member"],
          },
        ]}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        onDraftChange={vi.fn()}
      />,
    );

    expect(html).toContain("Islamic Jurisprudence · Senior Faculty · Faculty Member");
    expect(html).toContain("faculty.designations.addDesignation");
    expect(html).toContain("faculty.form.designationCard");
    expect(html).toContain("faculty.form.designations.addTenure");
    expect(html).toContain("employDesignationStatus");
    expect(html).not.toContain('id="department"');
  });

  it("omits department, specialization, and qualification from employment section", () => {
    const html = renderToStaticMarkup(
      <FacultyEmploymentSection
        autoGenerateId={false}
        errors={{}}
        fields={{}}
        idPrefix="FAC-"
        statusOptions={[{ value: "active", label: "Active" }]}
        facultyDraft={{ employeeId: "FAC-001", status: "active" }}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        onDraftChange={vi.fn()}
      />,
    );

    expect(html).not.toContain('id="department"');
    expect(html).not.toContain('id="specialization"');
    expect(html).not.toContain('id="qualification"');
  });
});
