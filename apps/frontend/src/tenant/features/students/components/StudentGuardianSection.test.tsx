import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { STUDENT_PARENT_RELATIONSHIP_LABEL } from "@mms/shared";
import { StudentGuardianSection } from "./StudentGuardianSection";

vi.mock("@/tenant/hooks/collections/contacts", () => ({
  useContactsByIds: () => ({
    data: [
      {
        id: "cnt-father",
        name: "Abu Zayd",
        gender: "male",
        phones: [{ number: "+1 555-0199", isPrimary: true }],
      },
    ],
  }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({ canWrite: true }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/contactLink/ContactEditModal", () => ({
  default: () => null,
}));

describe("StudentGuardianSection Component", () => {
  it("renders empty state when no student contact is selected", () => {
    const html = renderToStaticMarkup(
      <StudentGuardianSection
        formInstanceId="inst-1"
        studentDraft={{}}
        isFieldEnabled={() => true}
      />,
    );

    expect(html).toContain("students.form.guardiansSection");
    expect(html).toContain("students.form.guardiansNeedContact");
  });

  it("renders guardian cards when relationships exist on linkedContact", () => {
    const html = renderToStaticMarkup(
      <StudentGuardianSection
        formInstanceId="inst-1"
        studentDraft={{ contactId: "cnt-std" }}
        linkedContact={{
          id: "cnt-std",
          name: "Zayd Harith",
          firstName: "Zayd",
          lastName: "Harith",
          type: "student",
          status: "active",
          relationships: [
            {
              contactId: "cnt-father",
              relationship: STUDENT_PARENT_RELATIONSHIP_LABEL,
            },
          ],
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        }}
        isFieldEnabled={() => true}
      />,
    );

    expect(html).toContain("students.form.guardiansSection");
    expect(html).toContain("Abu Zayd");
    expect(html).toContain("+1 555-0199");
  });

  it("returns null when contactRelationships field is disabled", () => {
    const html = renderToStaticMarkup(
      <StudentGuardianSection
        formInstanceId="inst-1"
        studentDraft={{ contactId: "cnt-std" }}
        isFieldEnabled={() => false}
      />,
    );

    expect(html).toBe("");
  });
});
