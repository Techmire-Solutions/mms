import { formatMonthYear } from "@mms/shared";
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
    wakalaSummaryByKey[key].total += collection.amount;
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
    const amount = collection.amount;
    repSummaryByKey[key].count++;
    repSummaryByKey[key].total += amount;
    const wakalaType = wakalaTypes.find(
      (candidateWakalaType) =>
        candidateWakalaType.mujtahid_representative_id === collection.mujtahid_representative_id &&
        candidateWakalaType.obligation_type_id === collection.obligation_type_id,
    );
    if (wakalaType) {
      const liabilityDistributions = distributions.filter(
        (distribution) =>
          distribution.wakala_type_id === wakalaType.id && distribution.type === "Liability",
      );
      const totalLiabilityPct = liabilityDistributions.reduce(
        (sum, distribution) => sum + distribution.percentage,
        0,
      );
      repSummaryByKey[key].due += amount * (totalLiabilityPct / 100);
    } else {
      repSummaryByKey[key].due += amount;
    }
    const typeName =
      obligationTypes.find((obligationType) => obligationType.id === collection.obligation_type_id)
        ?.name ?? t("obligations.summary.other");
    repSummaryByKey[key].byType[typeName] = (repSummaryByKey[key].byType[typeName] ?? 0) + amount;
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
    typeBreakdownByName[name].total += collection.amount;
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
    monthlyTrendByMonth[month].total += collection.amount;
    monthlyTrendByMonth[month].count++;
  });
  return Object.values(monthlyTrendByMonth)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((monthlyEntry) => ({
      ...monthlyEntry,
      label: formatMonthYear(monthlyEntry.month + "-01"),
    }));
}
