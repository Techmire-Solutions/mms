import React from "react";
import { BarChart3 } from "lucide-react";
import { StatCard } from "@/components/app/StatCard";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformContactsMetrics } from "@/platform/features/contacts/hooks/usePlatformContacts";

/** Contacts → Reports: directory reachability + kind breakdown. */
export function ContactsReportsTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { data } = usePlatformContactsMetrics();
  const metrics = (data ?? {}) as {
    total?: number;
    reachableEmail?: number;
    reachablePhone?: number;
    byKind?: Record<string, number>;
  };

  return (
    <SectionCard title={t("platform.contacts.reportsTitle")} icon={BarChart3}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("platform.contacts.total")} value={String(metrics.total ?? 0)} />
        <StatCard
          label={t("platform.contacts.reachableEmail")}
          value={String(metrics.reachableEmail ?? 0)}
        />
        <StatCard
          label={t("platform.contacts.reachablePhone")}
          value={String(metrics.reachablePhone ?? 0)}
        />
      </div>
    </SectionCard>
  );
}
