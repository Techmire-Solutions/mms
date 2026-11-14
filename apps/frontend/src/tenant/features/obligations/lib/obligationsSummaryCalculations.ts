import { allocateWakalaSplits, formatMonthYear, moneyToCents } from "@mms/shared";
import type {
  ObligationCollection,
  ObligationDistribution,
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
} from "@/lib/data/obligationsData";
import type { RepSummaryEntry } from "../components/ObligationsRepDuesSection";
import type {
  MonthlyTrendEntry,
  TypeBreakdownEntry,
} from "../components/ObligationsSummaryChartsSection";
import type { WakalaSummaryEntry } from "../components/ObligationsWakalaSummarySection";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

/** Cents → a 2-dp amount, the exact representation every total in this module uses. */
function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Sums 2-dp amounts in integer cents.
 *
 * A plain `reduce((sum, c) => sum + c.amount, 0)` accumulates float error (`50000.1 + 50000.2`
 * is not `100000.3`), which then feeds the breakdown percentages and section totals. Every total in
 * this module goes through cents; the summary model was the one place that did not (frontend audit).
 */
export function sumAmounts(values: readonly number[]): number {
  let cents = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    cents += Math.round(value * 100);
  }
  return centsToAmount(cents);
}

export function buildWakalaSummary(
  filtered: ObligationCollection[],
  reps: MujtahidRep[],
  mujtahids: Mujtahid[],
  wakalaTypes: WakalaType[],
  obligationTypes: ObligationType[],
  distributions: ObligationDistribution[],
  t: TranslationFunction,
): WakalaSummaryEntry[] {
  const wakalaSummaryByKey: Record<string, WakalaSummaryEntry> = {};
  filtered.forEach((collection) => {
    const rep = reps.find(
      (candidateRep) => candidateRep.id === collection.mujtahid_representative_id,
    );
    const mujtahid = rep
      ? mujtahids.find((candidateMujtahid) => candidateMujtahid.id === rep.mujtahid_id)
      : null;
    const wakalaType = wakalaTypes.find(
      (candidateWakalaType) =>
        candidateWakalaType.mujtahid_representative_id === collection.mujtahid_representative_id &&
        candidateWakalaType.obligation_type_id === collection.obligation_type_id,
    );
    const key = wakalaType?.id || `no-wakala-${collection.mujtahid_representative_id}`;
    const label = wakalaType
      ? `${rep?.name ?? "?"} – ${obligationTypes.find((obligationType) => obligationType.id === collection.obligation_type_id)?.name ?? "?"}`
      : `${rep?.name ?? t("obligations.summary.noRep")} (${t("obligations.summary.noWakalaShort")})`;
    if (!wakalaSummaryByKey[key]) {
      wakalaSummaryByKey[key] = {
        key,
        label,
        repName: rep?.name ?? "—",
        mujtahidName: mujtahid?.name ?? "—",
        obligationType:
          obligationTypes.find(
            (obligationType) => obligationType.id === collection.obligation_type_id,
          )?.name ?? "—",
        count: 0,
        total: 0,
        hasWakala: !!wakalaType,
        distributions: wakalaType
          ? distributions.filter((distribution) => distribution.wakala_type_id === wakalaType.id)
          : [],
      };
    }
    wakalaSummaryByKey[key].count++;
    wakalaSummaryByKey[key].total = centsToAmount(
      moneyToCents(wakalaSummaryByKey[key].total) + moneyToCents(collection.amount),
    );
  });
  return Object.values(wakalaSummaryByKey).sort((a, b) => b.total - a.total);
}

export function buildRepSummary(
  filtered: ObligationCollection[],
  reps: MujtahidRep[],
  mujtahids: Mujtahid[],
  wakalaTypes: WakalaType[],
  obligationTypes: ObligationType[],
  distributions: ObligationDistribution[],
  t: TranslationFunction,
): RepSummaryEntry[] {
  const repSummaryByKey: Record<string, RepSummaryEntry> = {};
  filtered.forEach((collection) => {
    const rep = reps.find(
      (candidateRep) => candidateRep.id === collection.mujtahid_representative_id,
    );
    const mujtahid = rep
      ? mujtahids.find((candidateMujtahid) => candidateMujtahid.id === rep.mujtahid_id)
      : null;
    const key = collection.mujtahid_representative_id || "none";
    if (!repSummaryByKey[key]) {
      repSummaryByKey[key] = {
        key,
        repName: rep?.name ?? t("obligations.summary.noRep"),
        mujtahidName: mujtahid?.name ?? "—",
        count: 0,
        total: 0,
        due: 0,
        byType: {},
      };
    }
    const amountCents = moneyToCents(collection.amount);
    repSummaryByKey[key].count++;
    repSummaryByKey[key].total = centsToAmount(
      moneyToCents(repSummaryByKey[key].total) + amountCents,
    );
    const wakalaType = wakalaTypes.find(
      (candidateWakalaType) =>
        candidateWakalaType.mujtahid_representative_id === collection.mujtahid_representative_id &&
        candidateWakalaType.obligation_type_id === collection.obligation_type_id,
    );
    if (wakalaType) {
      // Same allocation the ledger posts (obligationSplitAllocation), so the dues figure on
      // screen and the liability actually posted cannot diverge.
      const rules = distributions.filter(
        (distribution) => distribution.wakala_type_id === wakalaType.id,
      );
      const allocated = allocateWakalaSplits(
        amountCents,
        rules.map((distribution) => distribution.percentage),
      );
      const liabilityCents = rules.reduce(
        (sum, distribution, index) =>
          distribution.type === "Liability" ? sum + (allocated[index] ?? 0) : sum,
        0,
      );
      repSummaryByKey[key].due = centsToAmount(
        moneyToCents(repSummaryByKey[key].due) + liabilityCents,
      );
    } else {
      repSummaryByKey[key].due = centsToAmount(
        moneyToCents(repSummaryByKey[key].due) + amountCents,
      );
    }
    const typeName =
      obligationTypes.find((obligationType) => obligationType.id === collection.obligation_type_id)
        ?.name ?? t("obligations.summary.other");
    repSummaryByKey[key].byType[typeName] = centsToAmount(
      moneyToCents(repSummaryByKey[key].byType[typeName] ?? 0) + amountCents,
    );
  });
  return Object.values(repSummaryByKey).sort((a, b) => b.total - a.total);
}

export function buildTypeBreakdown(
  filtered: ObligationCollection[],
  obligationTypes: ObligationType[],
  t: TranslationFunction,
): TypeBreakdownEntry[] {
  const typeBreakdownByName: Record<string, TypeBreakdownEntry> = {};
  filtered.forEach((collection) => {
    const name =
      obligationTypes.find((obligationType) => obligationType.id === collection.obligation_type_id)
        ?.name ?? t("obligations.summary.other");
    if (!typeBreakdownByName[name]) typeBreakdownByName[name] = { name, total: 0, count: 0 };
    typeBreakdownByName[name].total = centsToAmount(
      moneyToCents(typeBreakdownByName[name].total) + moneyToCents(collection.amount),
    );
    typeBreakdownByName[name].count++;
  });
  return Object.values(typeBreakdownByName).sort((a, b) => b.total - a.total);
}

export function buildMonthlyTrend(
  filtered: ObligationCollection[],
  t: TranslationFunction,
): MonthlyTrendEntry[] {
  const monthlyTrendByMonth: Record<string, Omit<MonthlyTrendEntry, "label">> = {};
  filtered.forEach((collection) => {
    const month = collection.received_date?.slice(0, 7) ?? t("obligations.summary.unknown");
    if (!monthlyTrendByMonth[month]) monthlyTrendByMonth[month] = { month, total: 0, count: 0 };
    monthlyTrendByMonth[month].total = centsToAmount(
      moneyToCents(monthlyTrendByMonth[month].total) + moneyToCents(collection.amount),
    );
    monthlyTrendByMonth[month].count++;
  });
  return Object.values(monthlyTrendByMonth)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((monthlyEntry) => ({
      ...monthlyEntry,
      label: formatMonthYear(monthlyEntry.month + "-01"),
    }));
}
