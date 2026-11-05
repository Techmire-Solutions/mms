import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExportToolbar } from "./ExportToolbar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

const columns = [{ header: "Name", key: "name" }];
const rows = [{ name: "Amina" }];

describe("ExportToolbar", () => {
  it("renders the compact variant as a brand-primary roving toolbar", () => {
    const html = renderToStaticMarkup(
      <ExportToolbar title="Students" variant="compact" columns={columns} rows={rows} />,
    );
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="Export tools"');
    expect(html).toContain("bg-primary");
    expect(html).not.toContain("bg-success");
    expect(html).not.toContain("bg-destructive");
    expect(html).toContain("focus-visible:ring-offset-2");
    expect(html).toContain("rounded-s-lg");
    expect(html).toContain("rounded-e-lg");
    expect(html).not.toContain("overflow-x-auto");
  });

  it("renders the default variant with a labelled toolbar and closed disclosure", () => {
    const html = renderToStaticMarkup(
      <ExportToolbar title="Students" columns={columns} rows={rows} />,
    );
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="Export tools"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("rounded-s-lg");
    expect(html).toContain("rounded-e-lg");
    expect(html).toContain("focus-visible:ring-offset-2");
    expect(html).not.toContain("text-success");
    expect(html).not.toContain("text-destructive");
  });

  describe("settings disclosure", () => {
    let container: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });
    afterEach(async () => {
      await act(async () => root.unmount());
      container.remove();
    });

    it("wires aria-expanded/controls to the labelled panel", async () => {
      await act(async () => {
        root.render(<ExportToolbar title="Students" columns={columns} rows={rows} />);
      });
      const settings = container.querySelector<HTMLButtonElement>(
        'button[title="PDF Export Settings"]',
      );
      await act(async () => {
        settings?.click();
      });
      expect(settings?.getAttribute("aria-expanded")).toBe("true");
      const controls = settings?.getAttribute("aria-controls");
      expect(controls).toMatch(/^export-.+-pdf-settings$/);
      const panel = container.querySelector(`#${controls}`);
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute("role")).toBe("group");
      expect(panel?.getAttribute("aria-label")).toBe("PDF Export Settings");
    });
  });
});
