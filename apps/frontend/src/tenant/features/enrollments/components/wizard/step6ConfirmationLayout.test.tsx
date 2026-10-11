import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { User } from "lucide-react";
import { Step6ConfirmationRow, Step6ConfirmationSection } from "./step6ConfirmationLayout";

describe("step6ConfirmationLayout Components", () => {
  it("renders Step6ConfirmationRow with label and value", () => {
    const html = renderToStaticMarkup(
      <Step6ConfirmationRow label="Student Name" value="Bilal Ahmad" />,
    );

    expect(html).toContain("Student Name");
    expect(html).toContain("Bilal Ahmad");
  });

  it("renders Step6ConfirmationSection with icon, title, and children", () => {
    const html = renderToStaticMarkup(
      <Step6ConfirmationSection icon={User} title="Student Details">
        <p>Section Content</p>
      </Step6ConfirmationSection>,
    );

    expect(html).toContain("Student Details");
    expect(html).toContain("Section Content");
  });
});
