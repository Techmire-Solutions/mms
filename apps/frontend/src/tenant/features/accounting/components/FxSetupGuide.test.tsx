import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountingNavigationContext,
  type AccountingNavigate,
} from "@/tenant/features/accounting/hooks/useAccountingNavigation";
import type { FxSetupGuideState } from "@/tenant/features/accounting/hooks/useFxSetupGuide";
import { computeFxSetupReadiness, type FxSetupReadinessInput } from "../lib/fxSetupReadiness";
import { FxSetupGuide } from "./FxSetupGuide";

const guideState = vi.hoisted(() => ({ current: null as FxSetupGuideState | null }));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useFxSetupGuide", () => ({
  useFxSetupGuide: () => guideState.current,
}));

function stateFor(overrides: Partial<FxSetupReadinessInput>): FxSetupGuideState {
  const input: FxSetupReadinessInput = {
    enabledCurrencies: ["AED"],
    rateOnFile: new Map([["AED", false]]),
    postingRules: {
      fxRealizedAccountId: "r",
      fxUnrealizedAccountId: null,
      fxRoundingAccountId: "x",
    },
    canEditSetup: false,
    canWrite: true,
    ...overrides,
  };
  return {
    readiness: computeFxSetupReadiness(input),
    functionalCurrency: "PKR",
    enabledCurrencies: [...input.enabledCurrencies],
    isLoading: false,
    isError: false,
  };
}

async function mountGuide(navigate: AccountingNavigate | null): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(
      <AccountingNavigationContext value={navigate}>
        <FxSetupGuide />
      </AccountingNavigationContext>,
    );
  });
  return container;
}

const buttonNamed = (container: HTMLElement, label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(label));

describe("FxSetupGuide", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    guideState.current = null;
  });

  it("given an accountant mid-setup, should offer the rate step and send admin steps to an admin", async () => {
    // Arrange
    guideState.current = stateFor({});

    // Act
    const container = await mountGuide(vi.fn());

    // Assert
    expect(container.textContent).toContain("accounting.fxGuide.step.rates.missing");
    expect(buttonNamed(container, "accounting.fxGuide.step.rates.action")).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(buttonNamed(container, "accounting.fxGuide.step.accounts.action")).toBeUndefined();
    expect(container.textContent).toContain("accounting.fxGuide.needsAdmin");
    expect(container.textContent).toContain("accounting.fxGuide.step.accounts.ask");
  });

  it("given the rate action is clicked, should navigate to Period-end exchange rates", async () => {
    // Arrange
    guideState.current = stateFor({});
    const navigate = vi.fn<AccountingNavigate>();
    const container = await mountGuide(navigate);

    // Act
    await act(async () => {
      buttonNamed(container, "accounting.fxGuide.step.rates.action")?.click();
    });

    // Assert
    expect(navigate).toHaveBeenCalledWith({
      tab: "work",
      subTab: "periodEnd",
      anchorId: "accounting-fx-rates-heading",
    });
  });

  it("given nothing is enabled yet, should collapse the steps behind Show steps", async () => {
    // Arrange
    guideState.current = stateFor({ enabledCurrencies: [], rateOnFile: new Map() });

    // Act
    const container = await mountGuide(vi.fn());

    // Assert
    expect(container.textContent).toContain("accounting.fxGuide.notStarted");
    expect(container.querySelector("ol")).toBeNull();
    expect(
      buttonNamed(container, "accounting.fxGuide.showSteps")?.getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("given an admin with every step done, should show the ready summary only", async () => {
    // Arrange
    guideState.current = stateFor({
      rateOnFile: new Map([["AED", true]]),
      postingRules: {
        fxRealizedAccountId: "r",
        fxUnrealizedAccountId: "u",
        fxRoundingAccountId: "x",
      },
      canEditSetup: true,
    });

    // Act
    const container = await mountGuide(vi.fn());

    // Assert
    expect(container.textContent).toContain("accounting.fxGuide.ready");
    expect(container.querySelector("ol")).toBeNull();
  });
});
