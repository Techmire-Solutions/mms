import React, { lazy, Suspense } from "react";
import { Layers, Receipt, TrendingUp, Users } from "lucide-react";
import {
  useObligationsCollections,
  useObligationsCollectionsCollection,
  useObligationsTypes,
  useObligationsTypesCollection,
  useObligationsReps,
  useObligationsRepsCollection,
  useObligationsMujtahids,
  useObligationsMujtahidsCollection,
  useObligationsWakala,
  useObligationsWakalaCollection,
  useObligationsDistributions,
  useObligationsDistributionsCollection,
  useObligationsReportAggregates,
} from "@/tenant/features/obligations/hooks/useObligationsApi";
import { formatMoney, OBLIGATIONS_COLLECTIONS_MAX_LIMIT } from "@mms/shared";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { ObligationsRepDuesSection } from "./ObligationsRepDuesSection";

const ObligationsSummaryChartsSection = lazy(() =>
  import("./ObligationsSummaryChartsSection").then((mod) => ({
    default: mod.ObligationsSummaryChartsSection,
  })),
);
import { ObligationsTypeBreakdownSection } from "./ObligationsTypeBreakdownSection";
import { ObligationsWakalaSummarySection } from "./ObligationsWakalaSummarySection";
import { useObligationsSummaryModel } from "../hooks/useObligationsSummaryModel";
import { ObligationsSummaryFilters } from "./ObligationsSummaryFilters";
import { PinnedWidgets } from "@/tenant/components/reports";

export function ObligationsSummary() {
  const collections = useObligationsCollectionsCollection();
  const obligationTypes = useObligationsTypesCollection();
  const reps = useObligationsRepsCollection();
  const mujtahids = useObligationsMujtahidsCollection();
  const wakalaTypes = useObligationsWakalaCollection();
  const distributions = useObligationsDistributionsCollection();

  const collectionsQuery = useObligationsCollections();
  const typesQuery = useObligationsTypes();
  const repsQuery = useObligationsReps();
  const mujtahidsQuery = useObligationsMujtahids();
  const wakalaQuery = useObligationsWakala();
  const distQuery = useObligationsDistributions();
  const aggregatesQuery = useObligationsReportAggregates();

  const { formatCurrency, activeCurrency } = useFinanceCurrency();
  const formatValueOnly = (amount: number | string | null | undefined): string => {
    return formatMoney(amount, activeCurrency.code, { excludeCurrency: true });
  };

  const model = useObligationsSummaryModel(
    collections,
    obligationTypes,
    reps,
    mujtahids,
    wakalaTypes,
    distributions,
  );

  const isError =
    collectionsQuery.isError ||
    typesQuery.isError ||
    repsQuery.isError ||
    mujtahidsQuery.isError ||
    wakalaQuery.isError ||
    distQuery.isError;

  // The aggregate is only the unfiltered headline. If it fails, the charts (all client-side) stay
  // and the headline falls back to the client sum instead of blanking the whole tab.
  const aggregatesFailed = aggregatesQuery.isError;
  const serverTotals = model.hasFilters ? undefined : aggregatesQuery.data;
  const headlineRecords = serverTotals?.totalCollections ?? model.totalRecords;
  const headlineAmount = serverTotals?.totalAmount ?? model.totalAmount;
  const truncated = collections.length >= OBLIGATIONS_COLLECTIONS_MAX_LIMIT;
  // The charts are computed from the list, so waiting for it is the honest loading condition: the
  // tab used to render zeroed KPIs and no charts while the first fetch was in flight (audit F5).
  const summaryLoading = collectionsQuery.isLoading;

  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          title={model.t("obligations.loadFailed")}
          description={model.t("obligations.loadFailedHint")}
          onRetry={() => {
            void collectionsQuery.refetch();
            void typesQuery.refetch();
            void repsQuery.refetch();
            void mujtahidsQuery.refetch();
            void wakalaQuery.refetch();
            void distQuery.refetch();
            void aggregatesQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ObligationsSummaryFilters
        search={model.search}
        dateFrom={model.dateFrom}
        dateTo={model.dateTo}
        repFilter={model.repFilter}
        typeFilter={model.typeFilter}
        userFilter={model.userFilter}
        hasFilters={model.hasFilters}
        repOptions={model.repOptions}
        typeOptions={model.typeOptions}
        userOptions={model.userOptions}
        onSearchChange={model.setSearch}
        onDateFromChange={model.setDateFrom}
        onDateToChange={model.setDateTo}
        onRepFilterChange={model.setRepFilter}
        onTypeFilterChange={model.setTypeFilter}
        onUserFilterChange={model.setUserFilter}
        onClearFilters={model.clearFilters}
      />

      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }, (_unused, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      <section aria-label={model.t("obligations.summary.kpi.aria")} hidden={summaryLoading}>
        <ModuleCommandMetricsGrid
          items={[
            {
              icon: Receipt,
              label: model.t("obligations.summary.kpi.totalCollections"),
              value: headlineRecords,
              accent: "primary",
            },
            {
              icon: TrendingUp,
              label: model.t("obligations.summary.kpi.totalAmountReceived"),
              value: formatCurrency(headlineAmount),
              accent: "success",
            },
            {
              icon: Users,
              label: model.t("obligations.summary.kpi.activeReps"),
              value: model.uniqueReps,
              accent: "info",
            },
            {
              icon: Layers,
              label: model.t("obligations.summary.kpi.obligationTypes"),
              value: model.typeBreakdown.length,
              accent: "warning",
            },
          ]}
        />
      </section>

      {truncated && model.hasFilters ? (
        <p role="status" className="text-xs text-muted-foreground">
          {model.t("obligations.summary.truncated")}
        </p>
      ) : null}
      {aggregatesFailed ? (
        <p role="status" className="text-xs text-muted-foreground">
          {model.t("obligations.summary.aggregatesUnavailable")}
        </p>
      ) : null}

      <Suspense fallback={<Skeleton className="h-chart-md w-full rounded-xl" />}>
        <ObligationsSummaryChartsSection
          filteredCount={model.filtered.length}
          typeBreakdown={model.typeBreakdown}
          monthlyTrend={model.monthlyTrend}
          colors={model.COLORS}
          primary={model.primary}
          formatCurrency={formatCurrency}
        />
      </Suspense>

      <ObligationsWakalaSummarySection
        wakalaSummary={model.wakalaSummary}
        totalAmount={model.totalAmount}
        activeCurrencyCode={activeCurrency.code}
        formatCurrency={formatCurrency}
      />

      <ObligationsRepDuesSection
        repSummary={model.repSummary}
        totalAmount={model.totalAmount}
        activeCurrencyCode={activeCurrency.code}
        formatCurrency={formatCurrency}
        formatValueOnly={formatValueOnly}
      />

      <ObligationsTypeBreakdownSection
        typeBreakdown={model.typeBreakdown}
        colors={model.COLORS}
        totalAmount={model.totalAmount}
        activeCurrencyCode={activeCurrency.code}
        formatCurrency={formatCurrency}
        formatValueOnly={formatValueOnly}
      />

      <PinnedWidgets category="obligations" />
    </div>
  );
}
