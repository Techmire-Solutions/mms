import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HasanatSettings } from "./HasanatSettings";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const panelState = vi.hoisted(() => ({
  pointsPerUnit: 10 as number,
  isPrefsDirty: false,
  handleSave: vi.fn(),
  upd: vi.fn(),
}));

vi.mock("@/tenant/features/hasanat/hooks/useHasanatSetupPanelState", () => ({
  useHasanatSetupPanelState: () => ({
    settingsDraft: {
      pointsPerUnit: panelState.pointsPerUnit,
      autoApprovePayouts: true,
      defaultViewLayout: "list",
      awardScope: "tenant",
    },
    saved: true,
    saving: false,
    isPrefsDirty: panelState.isPrefsDirty,
    isDirty: panelState.isPrefsDirty,
    upd: panelState.upd,
    handleSave: panelState.handleSave,
  }),
}));

vi.mock("@/components/app/SectionCard", () => ({
  SectionCard: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <div data-testid="section-card">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: ({ onSave }: { onSave?: () => void }) => (
    <button data-testid="save-footer" type="button" onClick={onSave}>
      Save Footer
    </button>
  ),
}));

describe("HasanatSettings Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    panelState.pointsPerUnit = 10;
    panelState.isPrefsDirty = false;
    panelState.handleSave.mockClear();
    panelState.upd.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the preferences with the standard select control", () => {
    act(() => {
      root.render(<HasanatSettings />);
    });
    expect(container.textContent).toContain("hasanat.settings.titlePreferences");
    // Enum control family: a native select (FormSelect), not a custom popover.
    const scope = container.querySelector("select#award-scope") as HTMLSelectElement | null;
    expect(scope).not.toBeNull();
    expect(scope?.value).toBe("tenant");
  });

  it("renders the points value verbatim instead of masking zero as ten", () => {
    panelState.pointsPerUnit = 0;
    act(() => {
      root.render(<HasanatSettings />);
    });
    const input = container.querySelector("#points-per-unit") as HTMLInputElement;
    expect(input.value).toBe("0");
  });

  it("blocks the save and shows an error when the points value is not finite", () => {
    panelState.pointsPerUnit = Number.NaN;
    act(() => {
      root.render(<HasanatSettings />);
    });

    const saveButton = container.querySelector('[data-testid="save-footer"]') as HTMLButtonElement;
    act(() => {
      saveButton.click();
    });

    expect(panelState.handleSave).not.toHaveBeenCalled();
    expect(container.querySelector("#points-per-unit-error")).not.toBeNull();
  });

  it("saves a valid preferences draft", () => {
    act(() => {
      root.render(<HasanatSettings />);
    });
    const saveButton = container.querySelector('[data-testid="save-footer"]') as HTMLButtonElement;
    act(() => {
      saveButton.click();
    });
    expect(panelState.handleSave).toHaveBeenCalledOnce();
  });
});
