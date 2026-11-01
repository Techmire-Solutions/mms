import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "./StatusBadge";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    language: "en",
    t: (key: string) => {
      const labels: Record<string, string> = {
        "statusBadge.active": "Active",
      };
      return labels[key] ?? key;
    },
    isLoading: false,
    dir: "ltr" as const,
    isRtl: false,
  }),
}));

describe("StatusBadge Component", () => {
  it("renders default label for active status", () => {
    const html = renderToStaticMarkup(<StatusBadge status="active" />);
    expect(html).toContain("Active");
    expect(html).toContain("font-bold");
  });

  it("renders custom config mapping when supplied", () => {
    const customConfig = {
      enrolled: { label: "Enrolled in Hifz", cls: "bg-success/10 text-success" },
    };

    const html = renderToStaticMarkup(<StatusBadge status="enrolled" config={customConfig} />);
    expect(html).toContain("Enrolled in Hifz");
    expect(html).toContain("bg-success/10");
  });

  it("falls back gracefully to status string for unknown status", () => {
    const html = renderToStaticMarkup(<StatusBadge status="unknown_status" />);
    expect(html).toContain("unknown_status");
  });

  it("does not inherit the primary hover fill over a semantic status tone", () => {
    // 2026-11-01: the default Badge variant's `hover:bg-primary/80` survived
    // class merging, turning a green status badge gold on hover (1.68:1).
    const html = renderToStaticMarkup(<StatusBadge status="active" />);
    expect(html).not.toContain("hover:bg-primary");
    expect(html).toContain("bg-success/10");
  });

  it("applies small size styling when size is sm", () => {
    const html = renderToStaticMarkup(<StatusBadge status="active" size="sm" />);
    expect(html).toContain("text-xs");
  });
});
