import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ModuleSettingsNavGrid from "./ModuleSettingsNavGrid";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: "en",
  }),
}));

describe("ModuleSettingsNavGrid platform locks", () => {
  it("renders a managed badge and no toggle for platform-disabled modules", () => {
    const html = renderToStaticMarkup(
      <ModuleSettingsNavGrid
        enabledModules={{ faculty: true, tasks: true }}
        platformDisabledModules={new Set(["tasks"])}
        onToggleModule={vi.fn()}
      />,
    );

    expect(html).toContain("module.system.platformManaged");
    expect(html).toContain("module.system.platformManagedHint");
    expect(html).not.toContain('id="module-toggle-tasks"');
    expect(html).toContain('id="module-toggle-faculty"');
  });
});
