import { describe, expect, it } from "vitest";
import { computeFxSetupReadiness, type FxSetupReadinessInput } from "./fxSetupReadiness";

const allAccounts = {
  fxRealizedAccountId: "fx-real",
  fxUnrealizedAccountId: "fx-unreal",
  fxRoundingAccountId: "fx-round",
};

const input = (overrides: Partial<FxSetupReadinessInput> = {}): FxSetupReadinessInput => ({
  enabledCurrencies: ["AED"],
  rateOnFile: new Map([["AED", true]]),
  postingRules: allAccounts,
  canEditSetup: true,
  canWrite: true,
  ...overrides,
});

const step = (result: ReturnType<typeof computeFxSetupReadiness>, id: string) =>
  result.steps.find((s) => s.id === id);

describe("computeFxSetupReadiness", () => {
  it("given a currency, its rate and every FX account, should report ready", () => {
    // Arrange
    const setup = input();

    // Act
    const result = computeFxSetupReadiness(setup);

    // Assert
    expect(result).toMatchObject({ ready: true, started: true, completed: 3 });
  });

  it("given no enabled currency, should block the rate step", () => {
    // Arrange
    const setup = input({ enabledCurrencies: [], rateOnFile: new Map() });

    // Act
    const result = computeFxSetupReadiness(setup);

    // Assert
    expect(result.started).toBe(false);
    expect(step(result, "currencies")?.done).toBe(false);
    expect(step(result, "rates")).toMatchObject({ done: false, blocked: true, pending: false });
  });

  it("given mixed rate lookups, should list missing currencies and stay pending", () => {
    // Arrange
    const setup = input({
      enabledCurrencies: ["AED", "USD", "SAR"],
      rateOnFile: new Map([
        ["AED", true],
        ["USD", false],
        ["SAR", undefined],
      ]),
    });

    // Act
    const result = computeFxSetupReadiness(setup);

    // Assert
    expect(step(result, "rates")).toMatchObject({ done: false, pending: true, missing: ["USD"] });
    expect(result.ready).toBe(false);
  });

  it("given an empty rounding account, should name it as missing", () => {
    // Arrange
    const setup = input({ postingRules: { ...allAccounts, fxRoundingAccountId: null } });

    // Act
    const result = computeFxSetupReadiness(setup);

    // Assert
    expect(step(result, "accounts")).toMatchObject({
      done: false,
      missing: ["fxRoundingAccountId"],
    });
  });

  it("given unloaded posting rules, should mark the accounts step pending, not missing", () => {
    // Arrange
    const setup = input({ postingRules: undefined });

    // Act
    const result = computeFxSetupReadiness(setup);

    // Assert
    expect(step(result, "accounts")).toMatchObject({ done: false, pending: true, missing: [] });
  });

  it("given an accountant without Setup access, should allow only the rate step", () => {
    // Arrange
    const setup = input({ canEditSetup: false, canWrite: true });

    // Act
    const result = computeFxSetupReadiness(setup);

    // Assert
    expect(step(result, "currencies")).toMatchObject({ owner: "admin", canAct: false });
    expect(step(result, "rates")).toMatchObject({ owner: "accountant", canAct: true });
    expect(step(result, "accounts")).toMatchObject({ owner: "admin", canAct: false });
  });
});
