import { useState } from "react";
import type {
  ObligationCollection,
  ObligationDistribution,
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
} from "@/lib/data/obligationsData";
import { useMergedObligationUsers } from "@/tenant/features/obligations/hooks/useObligationLookups";
import { useDebounce } from "@/hooks/useDebounce";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useTranslation } from "@/hooks/useTranslation";

import {
  buildWakalaSummary,
  buildRepSummary,
  buildTypeBreakdown,
  buildMonthlyTrend,
} from "./obligationsSummaryCalculations";

export interface ObligationsSummaryFilterState {
  dateFrom: string;
  dateTo: string;
  repFilter: string;
  typeFilter: string;
  userFilter: string;
  search: string;
}

export function useObligationsSummaryModel(
  collections: ObligationCollection[] | null = [],
  obligationTypes: ObligationType[] | null = [],
  reps: MujtahidRep[] | null = [],
  mujtahids: Mujtahid[] | null = [],
  wakalaTypes: WakalaType[] | null = [],
  distributions: ObligationDistribution[] | null = [],
) {
  collections = Array.isArray(collections) ? collections : [];
  obligationTypes = Array.isArray(obligationTypes) ? obligationTypes : [];
  reps = Array.isArray(reps) ? reps : [];
  mujtahids = Array.isArray(mujtahids) ? mujtahids : [];
  wakalaTypes = Array.isArray(wakalaTypes) ? wakalaTypes : [];
  distributions = Array.isArray(distributions) ? distributions : [];
  const { t } = useTranslation();
  const receiverIds = (() => collections.map((collection) => collection.received_by))();
  const usersRaw = useMergedObligationUsers(receiverIds);
  const users = Array.isArray(usersRaw) ? usersRaw : [];
  const { primary, secondary, charts } = useBrandPalette();
  const COLORS = (() => [primary, charts[3], secondary, charts[4], charts[0], charts[2]])();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [repFilter, setRepFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const filtered = (() =>
    collections.filter((collection) => {
      if (typeFilter !== "all" && collection.obligation_type_id !== typeFilter) return false;
      if (repFilter !== "all" && collection.mujtahid_representative_id !== repFilter) return false;
      if (userFilter !== "all" && collection.received_by !== userFilter) return false;
      if (dateFrom && (collection.received_date || "") < dateFrom) return false;
      if (dateTo && (collection.received_date || "") > dateTo) return false;
      if (debouncedSearch) {
        const searchQuery = debouncedSearch.toLowerCase();
        const repName =
          reps
            .find((rep) => rep.id === collection.mujtahid_representative_id)
            ?.name?.toLowerCase() || "";
        const typeName =
          obligationTypes
            .find((obligationType) => obligationType.id === collection.obligation_type_id)
            ?.name?.toLowerCase() || "";
        if (
          !collection.receipt_no.toLowerCase().includes(searchQuery) &&
          !repName.includes(searchQuery) &&
          !typeName.includes(searchQuery)
        )
          return false;
      }
      return true;
    }))();

  const totalAmount = filtered.reduce((sum, collection) => sum + collection.amount, 0);
  const totalRecords = filtered.length;
  const uniqueReps = new Set(filtered.map((collection) => collection.mujtahid_representative_id))
    .size;

  const wakalaSummary = buildWakalaSummary(
    filtered,
    reps,
    mujtahids,
    wakalaTypes,
    obligationTypes,
    distributions,
    t,
  );
  const repSummary = buildRepSummary(
    filtered,
    reps,
    mujtahids,
    wakalaTypes,
    obligationTypes,
    distributions,
    t,
  );
  const typeBreakdown = buildTypeBreakdown(filtered, obligationTypes, t);
  const monthlyTrend = buildMonthlyTrend(filtered, t);

  const hasFilters =
    dateFrom ||
    dateTo ||
    repFilter !== "all" ||
    typeFilter !== "all" ||
    userFilter !== "all" ||
    search;

  const repOptions = (() => [
    { value: "all", label: t("obligations.summary.filters.allReps") },
    ...reps.map((rep) => ({ value: rep.id, label: rep.name })),
  ])();

  const typeOptions = (() => [
    { value: "all", label: t("obligations.summary.filters.allTypes") },
    ...obligationTypes.map((obligationType) => ({
      value: obligationType.id,
      label: obligationType.name,
    })),
  ])();

  const userOptions = (() => [
    { value: "all", label: t("obligations.summary.filters.allCollectors") },
    ...users.map((user) => ({
      value: user.id,
      label: user.name || user.loginEmail || String(user.id),
    })),
  ])();

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setRepFilter("all");
    setTypeFilter("all");
    setUserFilter("all");
    setSearch("");
  };

  return {
    t,
    COLORS,
    primary,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    repFilter,
    setRepFilter,
    typeFilter,
    setTypeFilter,
    userFilter,
    setUserFilter,
    search,
    setSearch,
    filtered,
    totalAmount,
    totalRecords,
    uniqueReps,
    wakalaSummary,
    repSummary,
    typeBreakdown,
    monthlyTrend,
    hasFilters,
    repOptions,
    typeOptions,
    userOptions,
    clearFilters,
  };
}
