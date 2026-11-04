import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldDefinition, ValidationError } from "@mms/shared";
import { useContactValidation } from "./useContactValidation";
import { getDefaultContactConfigContextValue } from "./defaultContactConfigValue";
import type { ContactConfigContextType } from "./contactConfigContextTypes";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUseContactConfig = vi.fn();

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => mockUseContactConfig(),
}));
vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ language: "en" }),
}));
vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ role: "admin" }),
}));

function field(overrides: Partial<FieldDefinition>): FieldDefinition {
  return {
    key: "name",
    label: "Name",
    type: "text",
    enabled: true,
    order: 1,
    ...overrides,
  } as FieldDefinition;
}

function configWith(overrides: Partial<ContactConfigContextType>): ContactConfigContextType {
  return { ...getDefaultContactConfigContextValue(), ...overrides };
}

/** Mounts the hook and returns one validation call against `draft`. */
function validateWith(
  config: ContactConfigContextType,
  draft: Record<string, unknown>,
): ValidationError[] {
  mockUseContactConfig.mockReturnValue(config);
  let validator: ((value: unknown) => ValidationError[]) | null = null;

  function Probe() {
    validator = useContactValidation();
    return null;
  }

  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(<Probe />);
  });
  act(() => {
    root.unmount();
  });

  if (!validator) throw new Error("validator was not captured");
  return (validator as (value: unknown) => ValidationError[])(draft);
}

describe("useContactValidation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    mockUseContactConfig.mockReset();
  });

  it("accepts a minimal valid draft against the seed configuration", () => {
    const errors = validateWith(getDefaultContactConfigContextValue(), {
      firstName: "Aisha",
      name: "Aisha",
      gender: "female",
    });

    expect(errors).toEqual([]);
  });

  it("enforces the tenant-required list tab (required tab missing)", () => {
    const config = configWith({
      fields: {
        basic: [field({ key: "firstName", required: true })],
        phones: [field({ key: "number", label: "Number", required: true })],
      },
      enabledTabIds: new Set(["basic", "phones"]),
      requiredTabIds: new Set(["phones"]),
      formTabs: [
        { key: "basic", label: "Basic", enabled: true, order: 1 },
        { key: "phones", label: "Phones", enabled: true, order: 2 },
      ],
    } as Partial<ContactConfigContextType>);

    const errors = validateWith(config, { firstName: "Aisha", name: "Aisha" });

    expect(errors).toEqual(expect.arrayContaining([expect.objectContaining({ tabId: "phones" })]));
  });

  it("enforces a configured required field inside an enabled tab", () => {
    const config = configWith({
      fields: {
        basic: [
          field({ key: "firstName", required: true }),
          field({ key: "lastName", required: true }),
        ],
      },
      enabledTabIds: new Set(["basic"]),
      requiredTabIds: new Set(["basic"]),
      formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 1 }],
    } as Partial<ContactConfigContextType>);

    const errors = validateWith(config, { firstName: "Aisha", name: "Aisha" });

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ fieldId: "lastName", tabId: "basic" })]),
    );
  });

  it("does not flag an absent optional field", () => {
    const config = configWith({
      fields: {
        basic: [field({ key: "firstName", required: true })],
      },
      enabledTabIds: new Set(["basic"]),
      requiredTabIds: new Set(["basic"]),
      formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 1 }],
    } as Partial<ContactConfigContextType>);

    const errors = validateWith(config, { firstName: "Aisha", name: "Aisha" });

    expect(errors).toEqual([]);
  });

  it("keeps the static wire-shape guard (e.g. non-string scalar)", () => {
    const errors = validateWith(getDefaultContactConfigContextValue(), {
      firstName: "Aisha",
      name: "Aisha",
      cnic: 123,
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
