import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@mms/fe-core/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/fe-core/tenant")>();
  return {
    ...actual,

    useReducedMotion: () => true,
  };
});

describe("CommandPalette Component", () => {
  it("renders null when closed", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CommandPalette open={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(html).toBe("");
  });

  it("renders search input, dialog, and command list when open", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CommandPalette open={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('id="tenant-command-listbox"');
  });
});
