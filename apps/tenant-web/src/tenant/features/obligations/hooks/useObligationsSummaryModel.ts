import { useCallback, useMemo, useState } from "react";
import type {
  ObligationCollection,
  ObligationDistribution,
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
} from "@/lib/data/obligationsData";
import { useMergedObligationUsers } from "@/tenant/features/obligations/hooks/useObligationLookups";
import { useDebounce } from "@mms/fe-core/hooks";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useTranslation } from "@mms/fe-core/i18n";

import {
  buildWakalaSummary,
  buildRepSummary,
  buildTypeBreakdown,
  buildMonthlyTrend,
  sumAmounts,
} from "../lib/obligationsSummaryCalculations";

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
  const receiverIds = useMemo(
    () => collections.map((collection) => collection.received_by),
    [collections],
  );
  const usersRaw = useMergedObligationUsers(receiverIds);
  const users = useMemo(() => (Array.isArray(usersRaw) ? usersRaw : []), [usersRaw]);
  const { primary, secondary, charts } = useBrandPalette();
  const COLORS = useMemo(
    () => [primary, charts[3], secondary, charts[4], charts[0], charts[2]],
    [primary, secondary, charts],
  );

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [repFilter, setRepFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(
    () =>
      collections.filter((collection) => {
        if (typeFilter !== "all" && collection.obligation_type_id !== typeFilter) return false;
        if (repFilter !== "all" && collection.mujtahid_representative_id !== repFilter)
          return false;
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
      }),
    [
      collections,
      obligationTypes,
      reps,
      typeFilter,
      repFilter,
      userFilter,
      dateFrom,
      dateTo,
      debouncedSearch,
    ],
  );

  // Integer cents, like every other total in the module: a float reduce drifts by fractions of a
  // paisa and then disagrees with the sections that use cents (frontend audit).
  const totalAmount = sumAmounts(filtered.map((collection) => collection.amount));
  const totalRecords = filtered.length;
  const uniqueReps = new Set(filtered.map((collection) => collection.mujtahid_representative_id))
    .size;

  const wakalaSummary = useMemo(
    () =>
      buildWakalaSummary(filtered, reps, mujtahids, wakalaTypes, obligationTypes, distributions, t),
    [filtered, reps, mujtahids, wakalaTypes, obligationTypes, distributions, t],
  );
  const repSummary = useMemo(
    () =>
      buildRepSummary(filtered, reps, mujtahids, wakalaTypes, obligationTypes, distributions, t),
    [filtered, reps, mujtahids, wakalaTypes, obligationTypes, distributions, t],
  );
  const typeBreakdown = useMemo(
    () => buildTypeBreakdown(filtered, obligationTypes, t),
    [filtered, obligationTypes, t],
  );
  const monthlyTrend = useMemo(() => buildMonthlyTrend(filtered, t), [filtered, t]);

  const hasFilters =
    dateFrom ||
    dateTo ||
    repFilter !== "all" ||
    typeFilter !== "all" ||
    userFilter !== "all" ||
    search;

  const repOptions = useMemo(
    () => [
      { value: "all", label: t("obligations.summary.filters.allReps") },
      ...reps.map((rep) => ({ value: rep.id, label: rep.name })),
    ],
    [t, reps],
  );

  const typeOptions = useMemo(
    () => [
      { value: "all", label: t("obligations.summary.filters.allTypes") },
      ...obligationTypes.map((obligationType) => ({
        value: obligationType.id,
        label: obligationType.name,
      })),
    ],
    [t, obligationTypes],
  );

  const userOptions = useMemo(
    () => [
      { value: "all", label: t("obligations.summary.filters.allCollectors") },
      ...users.map((user) => ({
        value: user.id,
        label: user.name || user.loginEmail || String(user.id),
      })),
    ],
    [t, users],
  );

  const clearFilters = useCallback(() => {
    setDateFrom("");
    setDateTo("");
    setRepFilter("all");
    setTypeFilter("all");
    setUserFilter("all");
    setSearch("");
  }, []);

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
