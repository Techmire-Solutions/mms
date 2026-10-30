import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ListPagination } from "./ListPagination";

const MESSAGES: Record<string, string> = {
  "common.previous": "Previous",
  "common.next": "Next",
  "common.pagination.label": "Pagination",
  "common.pagination.pageOf": "Page {page} of {totalPages}",
  "common.pagination.range": "Showing {from} to {to} of {total}",
  "common.pagination.summary": "{count} items · Page {page} of {totalPages}",
};

const translate = (key: string, params?: Record<string, string | number>): string => {
  const template = MESSAGES[key];
  if (!template) return key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params?.[name];
    return value === undefined ? match : String(value);
  });
};

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: translate,
    language: "en",
    dir: "ltr",
    isRtl: false,
    isLoading: false,
  }),
}));

describe("ListPagination", () => {
  it("given a module namespace without pagination keys, should fall back to the shared labels when rendered", () => {
    // Act
    const html = renderToStaticMarkup(
      <ListPagination
        page={1}
        total={25}
        limit={10}
        onPageChange={() => {}}
        i18nNamespace="tasks"
      />,
    );

    // Assert
    expect(html).toContain("Showing 1 to 10 of 25");
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain('aria-label="Previous"');
    expect(html).not.toContain("tasks.pagination.range");
  });

  it("given a summary variant without a namespace summary key, should render the shared summary when rendered", () => {
    // Act
    const html = renderToStaticMarkup(
      <ListPagination
        page={2}
        total={25}
        limit={10}
        variant="summary"
        onPageChange={() => {}}
        i18nNamespace="attendance"
      />,
    );

    // Assert
    expect(html).toContain("25 items · Page 2 of 3");
    expect(html).not.toContain("attendance.pagination.summary");
  });
});
