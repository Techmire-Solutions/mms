import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { StudentDetailQuickActions } from "./StudentDetailQuickActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.phone) return `${key}:${params.phone}`;
      return key;
    },
  }),
}));

const mockStudent: Student = {
  id: "std-qa-1",
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

describe("StudentDetailQuickActions Component", () => {
  it("renders quick action channels when phone and email are provided", () => {
    const html = renderToStaticMarkup(
      <StudentDetailQuickActions
        student={mockStudent}
        primaryPhone="+1 555-0100"
        primaryEmail="zayd@example.com"
        hasWhatsAppContact={true}
        openComposer={vi.fn()}
      />,
    );

    expect(html).toContain("students.detail.call");
    expect(html).toContain("students.list.actionWhatsApp");
    expect(html).toContain("students.list.actionSms");
    expect(html).toContain("students.list.actionEmail");
  });
});
