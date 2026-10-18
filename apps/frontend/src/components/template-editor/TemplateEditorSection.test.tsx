import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Settings } from "lucide-react";
import { TemplateEditorSection } from "./TemplateEditorSection";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockT = ((key: string) => key) as TranslationFunction;

describe("TemplateEditorSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders collapsed section with hidden='until-found' and aria-expanded='false'", async () => {
    const handleToggle = vi.fn();
    await act(async () => {
      root.render(
        <TemplateEditorSection
          titleKey={"templateEditor.typography" as never}
          icon={Settings}
          isOpen={false}
          onToggle={handleToggle}
          t={mockT}
        >
          <div>Hidden Typography Options</div>
        </TemplateEditorSection>,
      );
    });

    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-expanded")).toBe("false");

    const panel = container.querySelector('[role="group"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
    expect(panel?.getAttribute("hidden")).toBe("until-found");
  });

  it("renders open section without hidden attribute and with aria-expanded='true'", async () => {
    const handleToggle = vi.fn();
    await act(async () => {
      root.render(
        <TemplateEditorSection
          titleKey={"templateEditor.typography" as never}
          icon={Settings}
          isOpen={true}
          onToggle={handleToggle}
          t={mockT}
        >
          <div>Visible Typography Options</div>
        </TemplateEditorSection>,
      );
    });

    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-expanded")).toBe("true");

    const panel = container.querySelector('[role="group"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("aria-hidden")).toBe("false");
    expect(panel?.hasAttribute("hidden")).toBe(false);
  });

  it("triggers onToggle when beforematch event is dispatched on collapsed panel", async () => {
    const handleToggle = vi.fn();
    await act(async () => {
      root.render(
        <TemplateEditorSection
          titleKey={"templateEditor.typography" as never}
          icon={Settings}
          isOpen={false}
          onToggle={handleToggle}
          t={mockT}
        >
          <div>Findable text content</div>
        </TemplateEditorSection>,
      );
    });

    const panel = container.querySelector('[role="group"]') as HTMLElement;
    expect(panel).not.toBeNull();

    await act(async () => {
      panel.dispatchEvent(new Event("beforematch"));
    });

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("does not trigger onToggle on beforematch if section is already open", async () => {
    const handleToggle = vi.fn();
    await act(async () => {
      root.render(
        <TemplateEditorSection
          titleKey={"templateEditor.typography" as never}
          icon={Settings}
          isOpen={true}
          onToggle={handleToggle}
          t={mockT}
        >
          <div>Findable text content</div>
        </TemplateEditorSection>,
      );
    });

    const panel = container.querySelector('[role="group"]') as HTMLElement;
    expect(panel).not.toBeNull();

    await act(async () => {
      panel.dispatchEvent(new Event("beforematch"));
    });

    expect(handleToggle).not.toHaveBeenCalled();
  });
});
