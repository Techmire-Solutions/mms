import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import { StudentArchivedBanner } from "./StudentArchivedBanner";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.date) return `${key}:${params.date}`;
      return key;
    },
  }),
}));

const mockStudent: Student = {
  id: "std-arch-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  deletedAt: "2024-06-01T12:00:00Z",
  deletionReason: "Transferred to other madrasa",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("StudentArchivedBanner Component", () => {
  it("renders archived banner with date and reason when student is deleted", () => {
    const html = renderToStaticMarkup(<StudentArchivedBanner student={mockStudent} />);

    expect(html).toContain("students.detail.archivedBanner");
    expect(html).toContain("Transferred to other madrasa");
    expect(html).toContain("students.deletionReasonLabel");
  });

  it("returns null when student has no deletedAt", () => {
    const html = renderToStaticMarkup(
      <StudentArchivedBanner student={{ ...mockStudent, deletedAt: undefined }} />,
    );

    expect(html).toBe("");
  });
});
