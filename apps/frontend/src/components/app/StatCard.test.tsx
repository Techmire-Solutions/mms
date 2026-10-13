import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Users } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { resolveAccent } from "@/components/ui/statCardAccent";
import { SEMANTIC_BG, SEMANTIC_TEXT } from "@/lib/semanticTone";

describe("statCardAccent resolveAccent", () => {
  it("resolves default accent to primary when omitted", () => {
    const accent = resolveAccent();
    expect(accent.iconBg).toBe(SEMANTIC_BG.primary);
    expect(accent.iconText).toBe(SEMANTIC_TEXT.primary);
  });

  it("resolves semantic tones properly", () => {
    expect(resolveAccent("success").iconBg).toBe(SEMANTIC_BG.success);
    expect(resolveAccent("destructive").iconBg).toBe(SEMANTIC_BG.destructive);
    expect(resolveAccent("warning").iconBg).toBe(SEMANTIC_BG.warning);
    expect(resolveAccent("info").iconBg).toBe(SEMANTIC_BG.info);
    expect(resolveAccent("secondary").iconBg).toBe(SEMANTIC_BG.secondary);
    expect(resolveAccent("muted").iconBg).toBe(SEMANTIC_BG.mutedSolid);
  });

  it("handles color aliases correctly", () => {
    expect(resolveAccent("emerald").iconBg).toBe(SEMANTIC_BG.success);
    expect(resolveAccent("rose").iconBg).toBe(SEMANTIC_BG.destructive);
    expect(resolveAccent("amber").iconBg).toBe(SEMANTIC_BG.warning);
    expect(resolveAccent("purple").iconBg).toBe(SEMANTIC_BG.secondary);
  });
});

describe("StatCard Component", () => {
  it("renders label, value, and subtitle correctly", () => {
    const html = renderToStaticMarkup(
      <StatCard
        label="Total Students"
        value={1250}
        sub="+12 this week"
        icon={Users}
        accent="primary"
      />,
    );

    expect(html).toContain("Total Students");
    expect(html).toContain("1,250");
    expect(html).toContain("+12 this week");
    // Ensure no ms-0.5 offset on icon container
    expect(html).not.toContain("ms-0.5");
  });

  it("renders trend percentage and indicator", () => {
    const html = renderToStaticMarkup(<StatCard label="Attendance" value="94%" trend={5} />);

    expect(html).toContain("5%");
  });

  it("handles compact variant", () => {
    const html = renderToStaticMarkup(
      <StatCard
        label="Compact Metric"
        value="42"
        variant="compact"
        icon={Users}
        accent="secondary"
      />,
    );

    expect(html).toContain("Compact Metric");
    expect(html).toContain("42");
    // Ensure no ms-0.5 offset on icon container
    expect(html).not.toContain("ms-0.5");
  });

  it("supports interactive button mode with aria-pressed", () => {
    const html = renderToStaticMarkup(
      <StatCard label="Interactive Card" value="100" onClick={() => {}} isActive={true} />,
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('type="button"');
  });
});
