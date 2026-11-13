import { describe, expect, it } from "vitest";
import type { TemplateElement } from "@mms/shared";
import { resolveElementText } from "./templateDataResolution";
import { interpolateTemplateTokens } from "./templateEditorUtils";

const el = (over: Partial<TemplateElement>): TemplateElement =>
  ({ id: "e1", type: "text", label: "", x: 0, y: 0, w: 10, h: 10, ...over }) as TemplateElement;

describe("resolveElementText", () => {
  it("prints an unresolved label token as empty, never as {{token}}", () => {
    const text = el({ type: "text", label: "Roll: {{rollNumber}}" });
    const printed = resolveElementText(text, {}, "print", interpolateTemplateTokens);
    expect(printed).toBe("Roll: ");
    expect(printed).not.toContain("{{");
  });

  it("keeps the token visible in the editor so the designer can bind it", () => {
    const text = el({ type: "text", label: "Roll: {{rollNumber}}" });
    expect(resolveElementText(text, {}, "edit", interpolateTemplateTokens)).toBe(
      "Roll: {{rollNumber}}",
    );
  });

  it("interpolates a present value in both modes", () => {
    const text = el({ type: "text", label: "Roll: {{rollNumber}}" });
    expect(
      resolveElementText(text, { rollNumber: "EX-1" }, "print", interpolateTemplateTokens),
    ).toBe("Roll: EX-1");
  });
});
