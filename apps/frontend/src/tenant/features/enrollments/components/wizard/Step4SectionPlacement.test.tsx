import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Step4SectionPlacement, defaultSectionId } from "./Step4SectionPlacement";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    section: { singular: "Section", plural: "Sections" },
  }),
}));

const sessionClass = {
  id: "cls-1",
  name: "Class 1",
  sections: [
    { id: "sec-full", name: "A", status: "active", enrolled: 20, capacity: 20 },
    { id: "sec-unlimited", name: "B", status: "active", enrolled: 5, capacity: 0 },
  ],
} as unknown as React.ComponentProps<typeof Step4SectionPlacement>["sessionClass"];

describe("Step4SectionPlacement", () => {
  it("disables full sections and renders capacity 0 as unlimited", () => {
    const html = renderToStaticMarkup(
      <Step4SectionPlacement
        sessionClass={sessionClass}
        value={{ sectionId: "sec-unlimited", rollNo: "" }}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('value="sec-full"');
    expect(html).toContain('value="sec-unlimited"');
    expect(html).toContain("20/20");
    expect(html).toContain("5/∞");
    // The full option is selectable in markup? It must carry the disabled attribute.
    const fullOption = html.slice(
      html.indexOf('value="sec-full"'),
      html.indexOf('value="sec-unlimited"'),
    );
    expect(fullOption).toContain("disabled");
  });

  it("defaults to the first section that still has seats (unlimited counts as open)", () => {
    expect(defaultSectionId(sessionClass)).toBe("sec-unlimited");
    expect(
      defaultSectionId({
        ...sessionClass,
        sections: [{ id: "sec-only", name: "A", status: "active", enrolled: 20, capacity: 20 }],
      } as never),
    ).toBe("sec-only");
  });
});
