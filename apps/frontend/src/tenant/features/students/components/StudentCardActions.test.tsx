import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { StudentCardActions } from "./StudentCardActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockStudent: Student = {
  id: "std-card-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const defaultProps = {
  student: mockStudent,
  studentId: "std-card-1",
  displayName: "Zayd Harith",
  viewingDeleted: false,
  canWrite: true,
  canDelete: true,
  canWriteMessaging: true,
  onViewStudent: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe("StudentCardActions Component", () => {
  it("renders view profile button and overflow row actions menu", () => {
    const html = renderToStaticMarkup(<StudentCardActions {...defaultProps} />);

    expect(html).toContain("students.actionViewShort");
    expect(html).toContain("students.list.viewProfile - Zayd Harith");
    expect(html).toContain("students.list.actionsAria");
  });
});
