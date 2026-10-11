import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EligibilityCheck } from "./EligibilityCheck";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [{ id: "ses-1", name: "Spring 2025" }],
}));

vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsByIds: () => ({
    data: [],
  }),
}));

vi.mock("@/tenant/components/selectors/RegistryPersonSelect", () => ({
  RegistryPersonSelect: ({ label }: { label: string }) => (
    <div data-testid="person-select">{label}</div>
  ),
}));

vi.mock("@/components/ui/FormSelect", () => ({
  FormSelect: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="form-select">{placeholder}</div>
  ),
}));

describe("EligibilityCheck Component", () => {
  it("renders student and session selectors", () => {
    const html = renderToStaticMarkup(<EligibilityCheck />);
    expect(html).toContain("enrollments.eligibility.title");
    expect(html).toContain("enrollments.eligibility.student");
    expect(html).toContain("enrollments.eligibility.session");
  });
});
