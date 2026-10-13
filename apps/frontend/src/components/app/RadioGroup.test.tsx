import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RadioGroup, RadioGroupItem } from "@/components/app/RadioGroup";

describe("RadioGroup", () => {
  it("renders radio group items with proper accessibility attributes", () => {
    const html = renderToStaticMarkup(
      <RadioGroup value="opt1" name="test-group">
        <RadioGroupItem id="opt1" value="opt1" aria-label="Option 1" />
        <RadioGroupItem id="opt2" value="opt2" aria-label="Option 2" />
      </RadioGroup>,
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="Option 1"');
    expect(html).toContain('aria-label="Option 2"');
  });
});
