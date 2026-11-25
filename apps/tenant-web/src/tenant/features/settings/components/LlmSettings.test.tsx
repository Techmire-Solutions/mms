import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LlmSettings from "./LlmSettings";

let mockCanWrite = true;
let mockIsDirty = false;

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (_perm: string) => mockCanWrite }),
}));

const mockHandleSaveGlobal = vi.fn();

vi.mock("../hooks/useLlmSettingsController", () => ({
  useLlmSettingsController: () => ({
    t: (k: string) => k,
    isGlobalDirty: mockIsDirty,
    saving: false,
    saved: false,
    handleSaveGlobal: mockHandleSaveGlobal,
    configListProps: { configs: [] },
    sandboxProps: { models: [] },
    modalProps: { open: false },
  }),
}));

vi.mock("@/components/llm/LlmConfigListSection", () => ({
  LlmConfigListSection: () => <div data-testid="llm-config-list">ConfigList</div>,
}));

vi.mock("./LlmSandboxPanel", () => ({
  LlmSandboxPanel: () => <div data-testid="llm-sandbox">Sandbox</div>,
}));

vi.mock("@/components/llm/LlmConfigModal", () => ({
  LlmConfigModal: () => <div data-testid="llm-modal">Modal</div>,
}));

describe("LlmSettings", () => {
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
      root.render(<LlmSettings />);
    });
    expect(container.textContent).toContain("settings.adminOnly");
  });

  it("renders config list, sandbox, and modal when user has write permission", async () => {
    mockCanWrite = true;
    mockIsDirty = false;
    await act(async () => {
      root.render(<LlmSettings />);
    });
    expect(container.querySelector('[data-testid="llm-config-list"]')).toBeInstanceOf(
      HTMLDivElement,
    );
    expect(container.querySelector('[data-testid="llm-sandbox"]')).toBeInstanceOf(HTMLDivElement);
    expect(container.querySelector('[data-testid="llm-modal"]')).toBeInstanceOf(HTMLDivElement);
    expect(container.textContent).toContain("global.saveSettings");
  });
});
