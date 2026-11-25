import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_BRANDING_SETTINGS } from "@mms/contracts";
import {
  SettingsBrandingDraftProvider,
  useSettingsBrandingDraft,
} from "@/lib/contexts/SettingsBrandingDraftContext";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";
import { saveBrandingSettings } from "@/lib/db";
import { useThemeSettingsDraft, type UseThemeSettingsDraftResult } from "./useThemeSettingsDraft";

vi.mock("@/lib/db", async () => {
  const shared = await import("@mms/contracts");
  return {
    getBrandingSettings: vi.fn(() =>
      shared.mergeBrandingSettings(shared.DEFAULT_BRANDING_SETTINGS),
    ),
    saveBrandingSettings: vi.fn(async () => ({ ok: true })),
    getGlobalSettings: vi.fn(() => shared.DEFAULT_GLOBAL_SETTINGS),
    getEffectiveGlobalSettings: vi.fn(() => shared.DEFAULT_GLOBAL_SETTINGS),
    saveGlobalSettingsAsync: vi.fn(async () => ({ ok: true })),
  };
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let draftResult: UseThemeSettingsDraftResult | null = null;
let identityDirty = false;

function TestComponent(): React.JSX.Element {
  const draft = useThemeSettingsDraft("Saved", "Success");
  const branding = useSettingsBrandingDraft();
  draftResult = draft;
  identityDirty = branding.isIdentityDirty;
  return <div />;
}

const mockT: TranslationFunction = ((key: string) => key) as unknown as TranslationFunction;

function Harness(): React.JSX.Element {
  return (
    <TranslationContext.Provider
      value={{
        language: "en",
        t: mockT,
        isLoading: false,
        dir: "ltr",
        isRtl: false,
      }}
    >
      <SettingsBrandingDraftProvider
        saveSuccessMessage="Saved"
        saveSuccessDescription="Branding saved"
      >
        <TestComponent />
      </SettingsBrandingDraftProvider>
    </TranslationContext.Provider>
  );
}

async function mount() {
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(<Harness />);
  });
  return {
    root,
  };
}

describe("useThemeSettingsDraft", () => {
  it("initializes with persisted theme values and not dirty", async () => {
    const { root } = await mount();

    expect(draftResult).not.toBeNull();
    expect(draftResult!.displayMode).toBeDefined();
    expect(draftResult!.data.primaryColor).toBe(DEFAULT_BRANDING_SETTINGS.primaryColor);
    expect(draftResult!.isDirty).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("marks as dirty when displayMode changes", async () => {
    const { root } = await mount();

    await act(async () => {
      draftResult!.setDisplayMode(draftResult!.displayMode === "dark" ? "light" : "dark");
    });

    expect(draftResult!.isDirty).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it("resets colors and corner style to defaults upon handleResetToDefaults", async () => {
    const { root } = await mount();

    await act(async () => {
      draftResult!.upd("primaryColor", "#123456");
      draftResult!.upd("cornerStyle", "sharp");
    });

    expect(draftResult!.data.primaryColor).toBe("#123456");
    expect(draftResult!.data.cornerStyle).toBe("sharp");

    await act(async () => {
      draftResult!.handleResetToDefaults();
    });

    expect(draftResult!.data.primaryColor).toBe(DEFAULT_BRANDING_SETTINGS.primaryColor);
    expect(draftResult!.data.cornerStyle).toBe(DEFAULT_BRANDING_SETTINGS.cornerStyle);

    await act(async () => {
      root.unmount();
    });
  });

  it("discards changes back to baseline upon handleDiscardChanges", async () => {
    const { root } = await mount();

    await act(async () => {
      draftResult!.upd("primaryColor", "#ff0077");
    });

    expect(draftResult!.data.primaryColor).toBe("#ff0077");

    await act(async () => {
      draftResult!.handleDiscardChanges();
    });

    expect(draftResult!.data.primaryColor).toBe(DEFAULT_BRANDING_SETTINGS.primaryColor);
    expect(draftResult!.isDirty).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("saves theme fields only and leaves a staged Institution edit dirty", async () => {
    const { root } = await mount();

    await act(async () => {
      draftResult!.upd("madrasaName", "Staged Madrasa");
      draftResult!.upd("primaryColor", "#123456");
    });

    await act(async () => {
      await draftResult!.handleSave();
    });

    const save = vi.mocked(saveBrandingSettings);
    expect(save).toHaveBeenCalledTimes(1);
    const persisted = save.mock.calls[0]?.[0];
    expect(persisted?.primaryColor).toBe("#123456");
    // The staged Institution edit was never part of the theme save payload.
    expect(persisted?.madrasaName).toBe(DEFAULT_BRANDING_SETTINGS.madrasaName);
    expect(draftResult!.data.madrasaName).toBe("Staged Madrasa");
    expect(identityDirty).toBe(true);
    expect(draftResult!.isDirty).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
