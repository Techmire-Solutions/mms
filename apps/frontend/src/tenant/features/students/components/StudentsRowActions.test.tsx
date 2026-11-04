import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { StudentsRowActions } from "./StudentsRowActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockStudent: Student = {
  id: "std-act-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  phone: "+1 555-0100",
  email: "zayd@example.com",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("StudentsRowActions Component", () => {
  it("renders row actions menu trigger button with accessible label", () => {
    const html = renderToStaticMarkup(
      <StudentsRowActions
        student={mockStudent}
        studentId="std-act-1"
        viewingDeleted={false}
        canWrite={true}
        canDelete={true}
        triggerClassName="trigger-cls"
        contentClassName="content-cls"
        iconClassName="icon-cls"
        onViewStudent={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).toContain("students.list.actionsAria");
  });
});
