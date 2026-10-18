import React, { useMemo } from "react";
import { Users, Filter, Clock, AlertTriangle } from "lucide-react";
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
}

/** Permission-scoped quick metrics for the Contacts module command centre (globle1 §2.1). */
export const ContactsCommandMetrics = React.memo(function ContactsCommandMetrics({
  shown,
  pendingCount,
  conflictCount,
  flushing,
  onFlushPending,
  onReviewConflicts,
}: ContactsCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics } = useContactsMetrics();

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

  const items = useMemo(
    () => [
      {
        icon: Users,
        label: t("contacts.metrics.total"),
        value: metrics.total,
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
    ],
  );

  return <ModuleCommandMetricsGrid items={items} />;
});
