import { summarizeFxExposure, sumStoredAmounts, type FxReport, type FxReportQuery } from "@mms/shared";
import type { FxRevaluationDeps } from "./fxRevaluationUseCases.js";
import { lookupClosingRate } from "./fxRevaluationUseCases.js";

export interface FxReportDeps extends Pick<FxRevaluationDeps, "fx" | "listBalances" | "listRuns"> {
  listRealized: (tenant: string, from: string, to: string) => Promise<FxReport["realized"]>;
}

/** Exposure at `asOf` closing rates, realized FX in the period, and posted revaluations. */
export async function buildFxReport(deps: FxReportDeps, tenant: string, query: FxReportQuery): Promise<FxReport> {
  const { functionalCurrency } = await deps.fx.getCurrencySettings(tenant);
  const [balances, realized, runs] = await Promise.all([
    deps.listBalances(tenant, query.asOf, functionalCurrency),
    deps.listRealized(tenant, query.from, query.asOf),
    deps.listRuns(tenant),
  ]);
  const rates = new Map<string, string>();
  for (const currency of new Set(balances.map((balance) => balance.currency))) {
    const rate = await lookupClosingRate(deps.fx, tenant, currency, functionalCurrency, query.asOf);
    if (rate) rates.set(currency, rate);
  }
  return {
    from: query.from,
    asOf: query.asOf,
    functionalCurrency,
    exposure: summarizeFxExposure(balances, rates, functionalCurrency),
    realized: realized.map((row) => ({ ...row, realized: sumStoredAmounts([row.realized], functionalCurrency) })),
    totalRealized: sumStoredAmounts(
      realized.map((row) => row.realized),
      functionalCurrency,
    ),
    revaluations: runs
      .filter((run) => run.revaluationDate >= query.from && run.revaluationDate <= query.asOf)
      .map((run) => ({
        revaluationDate: run.revaluationDate,
        totalUnrealized: sumStoredAmounts([run.totalUnrealized], functionalCurrency),
      })),
  };
}
