import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentsBulkEnrollModal } from "./StudentsBulkEnrollModal";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `Enrolling ${params.count} students`;
      return key;
    },
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessions: () => ({ isLoading: false }),
  useSessionsCollection: () => [
    { id: "ses-1", name: "Morning Hifz", type: "academic" },
    { id: "ses-2", name: "Evening Tajweed", type: "short_course" },
  ],
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="modal">
      <h1>{title}</h1>
      <div>{children}</div>
    </div>
  ),
}));

describe("StudentsBulkEnrollModal Component", () => {
  it("renders bulk enroll modal with sessions and modes", () => {
    const html = renderToStaticMarkup(
      <StudentsBulkEnrollModal
        open={true}
        onClose={vi.fn()}
        selectedCount={5}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain("students.bulkEnrollTitle");
    expect(html).toContain("Enrolling 5 students");
    expect(html).toContain("Morning Hifz");
    expect(html).toContain("Evening Tajweed");
    expect(html).toContain("students.bulkEnrollModeAdd");
  });

  it("returns null when open is false", () => {
    const htmlClosed = renderToStaticMarkup(
      <StudentsBulkEnrollModal
        open={false}
        onClose={vi.fn()}
        selectedCount={0}
        onConfirm={vi.fn()}
      />,
    );

    expect(htmlClosed).toBe("");
  });
});
