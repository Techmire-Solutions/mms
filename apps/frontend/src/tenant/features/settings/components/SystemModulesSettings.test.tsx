import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GLOBAL_SETTINGS } from "@mms/shared";
import SystemModulesSettings from "./SystemModulesSettings";

let mockCanWrite = true;
let mockIsDirty = false;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (_perm: string) => mockCanWrite }),
}));

const mockUpd = vi.fn();
const mockHandleSaveModules = vi.fn();
const mockHandleDiscardModules = vi.fn();
const mockClearSaved = vi.fn();

vi.mock("@/lib/contexts/SettingsGlobalDraftContext", () => ({
  useSettingsGlobalDraft: () => ({
    data: {
      ...DEFAULT_GLOBAL_SETTINGS,
      enabledModules: {
        students: true,
        finance: true,
        inventory: false,
      },
    },
    isModulesDirty: mockIsDirty,
    saved: false,
    saving: false,
    upd: mockUpd,
    handleSaveModules: mockHandleSaveModules,
    handleDiscardModules: mockHandleDiscardModules,
    clearSaved: mockClearSaved,
  }),
}));

vi.mock("@/tenant/hooks/useModuleAccess", () => ({
  useModuleAccess: () => ({
    availability: {
      students: { granted: true },
      finance: { granted: true },
      inventory: { granted: false },
    },
  }),
}));

vi.mock("@/tenant/features/settings/components/modules/ModuleSettingsNavGrid", () => ({
  default: ({
    onToggleModule,
  }: {
    enabledModules: Record<string, boolean>;
    grantedModules?: Record<string, boolean>;
    onToggleModule: (id: string, enabled: boolean) => void;
  }) => (
    <div data-testid="nav-grid">
      <button
        type="button"
        data-testid="toggle-inventory"
        onClick={() => onToggleModule("inventory", true)}
      >
        Toggle Inventory
      </button>
    </div>
  ),
}));

describe("SystemModulesSettings", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockCanWrite = true;
    mockIsDirty = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders admin-only notice when user lacks write permission", async () => {
    mockCanWrite = false;
    await act(async () => {
      root.render(<SystemModulesSettings />);
    });
    expect(container.textContent).toContain("settings.adminOnly");
  });

  it("renders system modules settings panel and nav grid", async () => {
    mockCanWrite = true;
    mockIsDirty = false;
    await act(async () => {
      root.render(<SystemModulesSettings />);
    });
    expect(container.querySelector('[data-testid="nav-grid"]')).toBeInstanceOf(HTMLDivElement);
    expect(container.textContent).toContain("module.system.save");
  });

  it("toggles non-required module and clears saved state", async () => {
    mockCanWrite = true;
    mockIsDirty = false;
    await act(async () => {
      root.render(<SystemModulesSettings />);
    });

    const toggleBtn = container.querySelector(
      '[data-testid="toggle-inventory"]',
    ) as HTMLButtonElement;
    expect(toggleBtn).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      toggleBtn.click();
    });

    expect(mockUpd).toHaveBeenCalledWith(
      "enabledModules",
      expect.objectContaining({ inventory: true }),
    );
    expect(mockClearSaved).toHaveBeenCalledTimes(1);
  });
});
