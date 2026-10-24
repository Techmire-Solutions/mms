import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { ParentNamesSubtitle } from "./ParentNamesSubtitle";

const mockT = ((key: string) => {
  const dictionary: Record<string, string> = {
    "students.detail.father": "Father",
    "students.detail.mother": "Mother",
    "students.idCard.guardian": "Guardian",
  };
  return dictionary[key] ?? key;
}) as unknown as TranslationFunction;

describe("ParentNamesSubtitle Component", () => {
  it("renders both father and mother when both are present", () => {
    const html = renderToStaticMarkup(
      <ParentNamesSubtitle
        fatherName="Muhammad Ali"
        motherName="Fatima Zahra"
        guardianName="Zaid"
        t={mockT}
      />,
    );

    expect(html).toContain("Father:");
    expect(html).toContain("Muhammad Ali");
    expect(html).toContain("Mother:");
    expect(html).toContain("Fatima Zahra");
    // Guardian should NOT be shown when father or mother is present
    expect(html).not.toContain("Guardian:");
    expect(html).not.toContain("Zaid");
  });

  it("renders only father when mother and guardian are absent", () => {
    const html = renderToStaticMarkup(<ParentNamesSubtitle fatherName="Muhammad Ali" t={mockT} />);

    expect(html).toContain("Father:");
    expect(html).toContain("Muhammad Ali");
    expect(html).not.toContain("Mother:");
    expect(html).not.toContain("Guardian:");
  });

  it("renders only mother when father and guardian are absent", () => {
    const html = renderToStaticMarkup(<ParentNamesSubtitle motherName="Fatima Zahra" t={mockT} />);

    expect(html).toContain("Mother:");
    expect(html).toContain("Fatima Zahra");
    expect(html).not.toContain("Father:");
    expect(html).not.toContain("Guardian:");
  });

  it("renders guardian fallback when both father and mother are absent", () => {
    const html = renderToStaticMarkup(<ParentNamesSubtitle guardianName="Uncle Tariq" t={mockT} />);

    expect(html).toContain("Guardian:");
    expect(html).toContain("Uncle Tariq");
    expect(html).not.toContain("Father:");
    expect(html).not.toContain("Mother:");
  });

  it("renders null (empty) when all names are absent or whitespace", () => {
    const html = renderToStaticMarkup(
      <ParentNamesSubtitle fatherName="   " motherName="" guardianName="   " t={mockT} />,
    );

    expect(html).toBe("");
  });
});
