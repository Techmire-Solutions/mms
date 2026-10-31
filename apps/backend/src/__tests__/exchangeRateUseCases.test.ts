import { describe, expect, it, vi } from "vitest";
import type { AccountingFxRepository } from "../accounting/repository/accountingFxRepository.js";
import { upsertExchangeRates } from "../accounting/use-cases/exchangeRateUseCases.js";

function makeDeps() {
  const fx = {
    listExchangeability: vi.fn().mockResolvedValue([
      {
        currency: "ARS",
        assessedOn: "2026-05-01",
        estimationMethod: "Parallel market rate",
        reason: "",
      },
    ]),
    upsertExchangeRates: vi.fn().mockResolvedValue([]),
  } as unknown as AccountingFxRepository;
  return { fx, recordAudit: vi.fn() };
}

const actor = { tenant: "demo", userId: "u1" };
const rate = (rateDate: string, overrideReason?: string) => ({
  fromCurrency: "ARS",
  toCurrency: "PKR",
  rateDate,
  rateType: "SPOT" as const,
  rate: "0.21",
  ...(overrideReason ? { overrideReason } : {}),
});

describe("upsertExchangeRates (IAS 21 lack of exchangeability)", () => {
  it("given an estimate for a non-exchangeable currency without a method, should reject it", async () => {
    // Arrange
    const deps = makeDeps();

    // Act
    const result = upsertExchangeRates(deps, actor, [rate("2026-06-30")]);

    // Assert
    await expect(result).rejects.toMatchObject({ statusCode: 400 });
    expect(deps.fx.upsertExchangeRates).not.toHaveBeenCalled();
  });

  it("given a described estimate or a date before the assessment, should save it", async () => {
    // Arrange
    const deps = makeDeps();

    // Act
    await upsertExchangeRates(deps, actor, [
      rate("2026-06-30", "Parallel 0.20 + 5% spread"),
      rate("2026-04-01"),
    ]);

    // Assert
    expect(deps.fx.upsertExchangeRates).toHaveBeenCalledTimes(1);
  });
});
