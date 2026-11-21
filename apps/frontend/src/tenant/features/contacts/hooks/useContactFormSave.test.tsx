import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";
import { useContactFormSave } from "./useContactFormSave";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  getApiValidationErrors: vi.fn(),
  getApiValidationMessage: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    fields: {},
    isTabFieldRequired: () => false,
    fieldConfigVersion: 1,
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ language: "en" }),
}));

vi.mock("@/lib/contacts/useContactValidation", () => ({
  useContactValidation: () => () => ({}),
}));

vi.mock("@/tenant/features/contacts/hooks/contactFormDraftValidator", () => ({
  validateContactDraftErrors: () => [],
}));

vi.mock("@/lib/apiValidationMessage", () => ({
  getApiValidationErrors: (...args: unknown[]) => mocks.getApiValidationErrors(...args),
  getApiValidationMessage: (...args: unknown[]) => mocks.getApiValidationMessage(...args),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    error: (...args: unknown[]) => mocks.notifyError(...args),
    success: (...args: unknown[]) => mocks.notifySuccess(...args),
  },
}));

// Pure identity helpers from the shared package would only add noise here; the
// hook's own error/form-banner contract is the subject under test.
vi.mock("@mms/shared", () => ({
  applyTitleCaseToContact: (contact: unknown) => contact,
  composeContactName: (first: string, last: string) => `${first} ${last}`.trim(),
  cleanContactDraft: (draft: unknown) => draft,
  stripAbsentContactCollections: (draft: unknown) => draft,
  syncContactScalarFields: (contact: unknown) => contact,
  normalizeToE164: (countryCode: string, number: string) => `+${countryCode}${number}`,
  parsePhoneNumber: (number: string, countryCode: string) => ({ countryCode, number }),
  isContactDeleted: () => false,
  formatSocialPlatformUrl: (_platform: string, url: string) => url,
  todayISO: () => "2026-01-01",
  uuidv7: () => "generated-id",
}));

type HookResult = ReturnType<typeof useContactFormSave>;

function baseProps(overrides: Partial<Parameters<typeof useContactFormSave>[0]> = {}) {
  return {
    contact: undefined,
    contactDraft: { firstName: "Zayd", lastName: "Harith" } as Partial<Contact>,
    defaultCountryCode: "92",
    onSave: vi.fn(async () => undefined),
    onClose: vi.fn(),
    onValidationTab: vi.fn(),
    onBaselineReset: vi.fn(),
    ...overrides,
  };
}

describe("useContactFormSave", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: HookResult;

  function renderHook(props = baseProps()): void {
    function TestComponent() {
      result = useContactFormSave(props);
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.getApiValidationErrors.mockReturnValue(null);
    mocks.getApiValidationMessage.mockReturnValue("");
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("collapses two synchronous saves into one onSave call", async () => {
    let release: (value: void) => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderHook(baseProps({ onSave }));

    let first: Promise<boolean> | undefined;
    let second: boolean | undefined;
    await act(async () => {
      first = result.handleSave();
      second = await result.handleSave();
      release();
      await first;
    });

    expect(second).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("keeps a field-error rejection inline and leaves the banner empty", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("Invalid contact"));
    mocks.getApiValidationErrors.mockReturnValue([
      { fieldId: "firstName", tabId: "basic", message: "First name is required" },
    ]);
    mocks.getApiValidationMessage.mockReturnValue("Invalid contact");
    renderHook(baseProps({ onSave }));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.handleSave();
    });

    expect(saved).toBe(false);
    expect(result.validationErrors).toEqual([
      { fieldId: "firstName", tabId: "basic", message: "First name is required" },
    ]);
    expect(result.formError).toBeNull();
  });

  it("puts a non-field failure in the banner", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("Server exploded"));
    mocks.getApiValidationMessage.mockReturnValue("Server exploded");
    renderHook(baseProps({ onSave }));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.handleSave();
    });

    expect(saved).toBe(false);
    expect(result.formError).toBe("Server exploded");
  });

  it("uses the conflict copy for a 409", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("Stale write"), { status: 409 }));
    mocks.getApiValidationMessage.mockReturnValue("Someone else saved first");
    renderHook(baseProps({ onSave }));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.handleSave();
    });

    expect(saved).toBe(false);
    expect(result.formError).toBe("contacts.form.saveConflict");
  });

  it("handles stringified Zod phone validation errors cleanly with field error mapping", async () => {
    const rawZodJson = JSON.stringify([
      {
        code: "custom",
        message: "Pakistan (+92) phone number must be exactly 10 digits",
        path: ["phones", 0, "number"],
      },
    ]);
    const onSave = vi.fn().mockRejectedValueOnce(new Error(rawZodJson));
    mocks.getApiValidationErrors.mockReturnValueOnce([
      {
        tabId: "phones",
        fieldId: "number",
        index: 0,
        message: "Pakistan (+92) phone number must be exactly 10 digits",
      },
    ]);
    mocks.getApiValidationMessage.mockReturnValueOnce(
      "Pakistan (+92) phone number must be exactly 10 digits",
    );
    const onValidationTab = vi.fn();
    renderHook(baseProps({ onSave, onValidationTab }));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.handleSave();
    });

    expect(saved).toBe(false);
    expect(result.validationErrors).toEqual([
      {
        tabId: "phones",
        fieldId: "number",
        index: 0,
        message: "Pakistan (+92) phone number must be exactly 10 digits",
      },
    ]);
    expect(onValidationTab).toHaveBeenCalledWith("phones", "number", 0);
    expect(mocks.notifyError).toHaveBeenCalledWith("contacts.form.pleaseFixErrors", {
      description: "Pakistan (+92) phone number must be exactly 10 digits",
    });
  });
});
