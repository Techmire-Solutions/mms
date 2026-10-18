import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PlatformErdPage from "./PlatformErdPage";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "platform.erdTitle": "Database Schema",
        "platform.erdSubtitle": "Explore table relationships",
        "platform.consoleTitle": "Platform Console",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/platform/components/erd/ErdExplorer", () => ({
  ErdExplorer: () => <div data-testid="erd-explorer">ERD Explorer</div>,
}));

describe("PlatformErdPage", () => {
  it("mounts inside ModuleScaffold with SEO metadata and header", () => {
    const html = renderToStaticMarkup(<PlatformErdPage />);

    expect(html).toContain("<title>Database Schema | Platform Console</title>");
    expect(html).toContain('name="description" content="Explore table relationships"');
    expect(html).toContain("Database Schema");
    expect(html).toContain("Explore table relationships");
    expect(html).toContain("ERD Explorer");
  });
});
