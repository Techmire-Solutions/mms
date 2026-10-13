import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityNotesFormSection } from "./EntityNotesFormSection";

describe("EntityNotesFormSection", () => {
  it("renders notes textarea with title and value", () => {
    const html = renderToStaticMarkup(
      <EntityNotesFormSection
        title="Notes"
        subtitle="Optional context"
        label="Internal notes"
        placeholder="Add notes…"
        value="Existing note text"
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain("Notes");
    expect(html).toContain("Existing note text");
    expect(html).toContain("Internal notes");
  });

  it("shows field error when provided", () => {
    const html = renderToStaticMarkup(
      <EntityNotesFormSection
        title="Notes"
        label="Notes"
        value=""
        error="Notes are required"
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain("Notes are required");
  });
});
