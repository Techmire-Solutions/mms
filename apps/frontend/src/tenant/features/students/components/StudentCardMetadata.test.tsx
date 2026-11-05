import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_STUDENT_COLUMN_REGISTRY, type Student } from "@mms/shared";
import { StudentCardMetadata } from "./StudentCardMetadata";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockStudent: Student = {
  id: "std-meta-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  dob: "2015-05-10",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("StudentCardMetadata Component", () => {
  it("renders non-face metadata tiles for visible columns", () => {
    const html = renderToStaticMarkup(
      <StudentCardMetadata
        student={mockStudent}
        statusBadgeConfig={{ active: { label: "Active", cls: "bg-success" } }}
        isColumnVisible={() => true}
        columnRegistry={DEFAULT_STUDENT_COLUMN_REGISTRY}
      />,
    );

    expect(html).toContain("Active");
  });

  it("returns null when no metadata columns are visible", () => {
    const html = renderToStaticMarkup(
      <StudentCardMetadata
        student={mockStudent}
        statusBadgeConfig={{}}
        isColumnVisible={() => false}
        columnRegistry={DEFAULT_STUDENT_COLUMN_REGISTRY}
      />,
    );

    expect(html).toBe("");
  });
});
