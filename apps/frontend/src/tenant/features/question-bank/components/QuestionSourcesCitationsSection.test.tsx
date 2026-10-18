import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionSourcesCitationsSection } from "./QuestionSourcesCitationsSection";

describe("QuestionSourcesCitationsSection", () => {
  it("shows book Plus when canAddBook is enabled", () => {
    const html = renderToStaticMarkup(
      <QuestionSourcesCitationsSection
        sourceBooks={[{ id: "b1", name: "Book", fieldIds: ["sourceBookName"], metadata: {} }]}
        citationEntries={[{ bookId: "", citation: {} }]}
        fieldById={new Map()}
        fieldLabel={(id) => id}
        t={(key) => key}
        canAddBook
        onOpenAddBook={vi.fn()}
        onUpdateCitation={vi.fn()}
        onUpdateCitationField={vi.fn()}
        onAddCitation={vi.fn()}
        onRemoveCitation={vi.fn()}
      />,
    );
    expect(html).toContain('aria-label="questionBank.addSourceBook"');
  });

  it("hides book Plus when canAddBook is false", () => {
    const html = renderToStaticMarkup(
      <QuestionSourcesCitationsSection
        sourceBooks={[{ id: "b1", name: "Book", fieldIds: ["sourceBookName"], metadata: {} }]}
        citationEntries={[{ bookId: "b1", citation: {} }]}
        fieldById={new Map()}
        fieldLabel={(id) => id}
        t={(key) => key}
        onUpdateCitation={vi.fn()}
        onUpdateCitationField={vi.fn()}
        onAddCitation={vi.fn()}
        onRemoveCitation={vi.fn()}
      />,
    );
    expect(html).not.toContain('aria-label="questionBank.addSourceBook"');
  });
});
