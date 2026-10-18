import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING_SETTINGS } from "@mms/shared";
import { SettingsBrandingDraftProvider } from "@/lib/contexts/SettingsBrandingDraftContext";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useThemeSettingsDraft, type UseThemeSettingsDraftResult } from "./useThemeSettingsDraft";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let draftResult: UseThemeSettingsDraftResult | null = null;

function TestComponent(): React.JSX.Element {
  const draft = useThemeSettingsDraft("Saved", "Success");
  draftResult = draft;
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
});
