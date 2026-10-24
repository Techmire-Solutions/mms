import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormAddAnotherButton } from "./FormAddAnotherButton";

describe("FormAddAnotherButton", () => {
  it("renders dashed full-width add control with label", () => {
    const html = renderToStaticMarkup(
      <FormAddAnotherButton label="Add phone number" onClick={vi.fn()} />,
    );
    expect(html).toContain("Add phone number");
    expect(html).toContain("border-dashed");
    expect(html).toContain("min-h-11");
  });
});
