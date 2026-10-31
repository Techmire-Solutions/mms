import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ContactConfigProvider, useContactConfig } from "./ContactConfigContext";

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/tenant/features/contacts/hooks/useContactSetupConfig", () => ({
  useContactPreferencesQuery: () => ({ data: undefined }),
  useContactPreferencesMutation: () => ({ mutateAsync: vi.fn() }),
}));

const mockCountryCodes = [{ country: "PK", code: "+92" }];
const mockLookups = {
  genders: ["Male", "Female"],
  socialPlatforms: ["Twitter", "LinkedIn"],
  relationships: ["Parent", "Child"],
  phoneLabels: ["Mobile", "Work"],
  emailLabels: ["Personal", "Work"],
  addressLabels: ["Home", "Office"],
  countryCodes: mockCountryCodes,
  educationDegrees: ["BSc"],
  employmentTypes: ["Full-time"],
  skillCategories: ["IT"],
  skillProficiencies: ["Expert"],
  bankNames: ["Meezan"],
  tags: ["VIP"],
};

vi.mock("@/tenant/features/contacts/hooks/useContactLookups", () => ({
  useContactLookupsQuery: () => ({
    data: mockLookups,
    isLoading: false,
    error: null,
  }),
  useContactLookupMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/tenant/features/contacts/hooks/useContactsQueries", () => ({
  useContactsContractFieldConfig: () => ({
    data: { status: 200, body: {} },
  }),
  useContactsContractUpdateFieldConfig: () => ({ mutateAsync: vi.fn() }),
}));

describe("ContactConfigContext", () => {
  it("provides stable context value across re-renders when data has not changed", () => {
    const observedValues: ReturnType<typeof useContactConfig>[] = [];

    function Consumer() {
      const config = useContactConfig();
      observedValues.push(config);
      return <div>{config.defaultPhoneCountryCode}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <ContactConfigProvider>
          <Consumer />
        </ContactConfigProvider>,
      );
    });

    for (let i = 0; i < 5; i++) {
      act(() => {
        root.render(
          <ContactConfigProvider>
            <Consumer />
          </ContactConfigProvider>,
        );
      });
    }

    expect(observedValues.length).toBeGreaterThan(1);
    const firstVal = observedValues[0];
    for (const val of observedValues) {
      expect(val).toBe(firstVal);
    }

    act(() => {
      root.unmount();
    });
  });
});
