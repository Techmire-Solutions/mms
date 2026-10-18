import { describe, expect, it } from "vitest";
import { ONBOARDING_INITIAL_DATA, ONBOARDING_STEP_DEFS } from "./onboardingWizardTypes";

describe("useOnboardingWizardController Definition & Types", () => {
  it("defines valid initial onboarding state", () => {
    expect(ONBOARDING_INITIAL_DATA.name).toBe("");
    expect(ONBOARDING_INITIAL_DATA.subdomain).toBe("");
    expect(ONBOARDING_INITIAL_DATA.email).toBe("");
    expect(ONBOARDING_INITIAL_DATA.agreedTerms).toBe(false);
    expect(ONBOARDING_INITIAL_DATA.industryType).toBe("madrasa");
  });

  it("contains five onboarding wizard steps", () => {
    expect(ONBOARDING_STEP_DEFS.length).toBe(5);
    expect(ONBOARDING_STEP_DEFS.map((step) => step.id)).toEqual([1, 2, 3, 4, 5]);
    expect(ONBOARDING_STEP_DEFS[0]?.labelKey).toBe("onboarding.stepOrgLabel");
    expect(ONBOARDING_STEP_DEFS[4]?.labelKey).toBe("onboarding.stepCompleteLabel");
  });
});
