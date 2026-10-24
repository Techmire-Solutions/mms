import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BookOpen } from "lucide-react";
import { FacultyDetailAttributeRow } from "./FacultyDetailAttributeRow";

describe("FacultyDetailAttributeRow Component", () => {
  it("renders label and value with icon", () => {
    const html = renderToStaticMarkup(
      <FacultyDetailAttributeRow icon={BookOpen} label="Department" value="Islamic Studies" />,
    );

    expect(html).toContain("Department");
    expect(html).toContain("Islamic Studies");
  });
});
