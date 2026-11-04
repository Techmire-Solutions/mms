import React, { useCallback, useMemo } from "react";
import { Users, Filter, Clock, AlertTriangle, Copy } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactsMetrics } from "@/tenant/features/contacts/hooks/useContacts";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";

export interface ContactsCommandMetricsProps {
  shown: number;
  pendingCount: number;
  conflictCount: number;
  flushing: boolean;
  onFlushPending?: () => void;
  onReviewConflicts?: () => void;
  onReviewDuplicates?: () => void;
}

/** Permission-scoped quick metrics for the Contacts module command centre (globle1 §2.1). */
export const ContactsCommandMetrics = React.memo(function ContactsCommandMetrics({
  shown,
  pendingCount,
  conflictCount,
  flushing,
  onFlushPending,
  onReviewConflicts,
  onReviewDuplicates,
}: ContactsCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics, isLoading: metricsLoading } = useContactsMetrics();

  const metrics = useMemo(
    () => ({
      total: serverMetrics?.total ?? 0,
      newThisPeriod: serverMetrics?.newThisPeriod ?? 0,
      whatsappCount: serverMetrics?.whatsappCount ?? 0,
      incompleteCount: serverMetrics?.incompleteCount ?? 0,
      duplicatePairCount: serverMetrics?.duplicatePairCount ?? 0,
    }),
    [serverMetrics],
  );

  // Server-backed counts render as "—" until the metrics query settles, so the
  // command centre never flashes a false 0.
  const serverValue = useCallback(
    (value: number): number | string => (metricsLoading ? "—" : value),
    [metricsLoading],
  );

  const items = useMemo(
    () => [
      {
        icon: Users,
        label: t("contacts.metrics.total"),
        value: serverValue(metrics.total),
        accent: "primary" as const,
      },
      {
        icon: Filter,
        label: t("contacts.metrics.filtered"),
        value: shown,
        accent: "info" as const,
      },
      {
        icon: Clock,
        label: t("contacts.metrics.pendingSync"),
        value: pendingCount,
        accent: "warning" as const,
        onClick: pendingCount > 0 && !flushing && onFlushPending ? onFlushPending : undefined,
      },
      {
        icon: AlertTriangle,
        label: t("contacts.metrics.syncConflicts"),
        value: conflictCount,
        accent: "destructive" as const,
        onClick: conflictCount > 0 ? onReviewConflicts : undefined,
      },
      {
        icon: Copy,
        label: t("contacts.metrics.duplicates"),
        value: serverValue(metrics.duplicatePairCount),
        accent: "warning" as const,
        onClick:
          metrics.duplicatePairCount > 0 && onReviewDuplicates ? onReviewDuplicates : undefined,
      },
    ],
    [
      t,
      metrics.total,
      shown,
      pendingCount,
      flushing,
      onFlushPending,
      conflictCount,
      onReviewConflicts,
      metrics.duplicatePairCount,
      serverValue,
      onReviewDuplicates,
    ],
  );

  return <ModuleCommandMetricsGrid items={items} />;
});
