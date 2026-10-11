import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("PasswordStrengthMeter", () => {
  it.each([
    ["lowercase", 1, "account.passwordStrengthVeryWeak"],
    ["Lowercase1", 3, "account.passwordStrengthMedium"],
    ["Lowercase1!", 4, "account.passwordStrengthStrong"],
    ["k9Q$2mT!vR7#nW4x", 5, "account.passwordStrengthVeryStrong"],
  ])("presents the shared score for %s", (password, score, label) => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<PasswordStrengthMeter password={password} />);
    const meter = container.querySelector('[role="meter"]');
    expect(meter?.getAttribute("aria-valuenow")).toBe(String(score));
    expect(meter?.getAttribute("aria-valuemax")).toBe("5");
    expect(meter?.getAttribute("aria-valuetext")).toBe(label);
    expect(meter?.children).toHaveLength(5);
  });

  it("hides the meter for empty passwords and retains optional requirement checks", () => {
    expect(renderToStaticMarkup(<PasswordStrengthMeter password="" />)).toBe("");
    const html = renderToStaticMarkup(<PasswordStrengthMeter password="Lowercase1!" showChecks />);
    expect(html).toContain("auth.passwordCheckLength");
    expect(html).toContain("auth.passwordCheckUpper");
    expect(html).toContain("auth.passwordCheckNumber");
    expect(html).toContain("auth.passwordCheckSymbol");
  });
});
