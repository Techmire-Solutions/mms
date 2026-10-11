import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Step1SelectStudent } from "./Step1SelectStudent";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.age) return `Age ${params.age}`;
      return key;
    },
  }),
}));

vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsContractList: () => ({
    data: {
      body: {
        students: [
          {
            id: "std-1",
            name: "Bilal Ahmad",
            grNumber: "GR-001",
            dob: "2015-01-01",
            gender: "male",
            status: "active",
          },
        ],
        hasMore: false,
      },
    },
    isFetching: false,
  }),
  useStudentsByIds: () => ({ data: [] }),
}));

vi.mock("@/components/ui/SearchBar", () => ({
  SearchBar: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="search-bar">{placeholder}</div>
  ),
}));

describe("Step1SelectStudent Component", () => {
  it("renders student selection options", () => {
    const html = renderToStaticMarkup(<Step1SelectStudent value={null} onChange={vi.fn()} />);

    expect(html).toContain("enrollments.wizard.step1Title");
    expect(html).toContain("Bilal Ahmad");
    expect(html).toContain("GR-001");
  });
});
