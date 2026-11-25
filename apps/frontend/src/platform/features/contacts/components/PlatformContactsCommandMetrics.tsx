import React from "react";
import { Users, Mail, Phone } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { StatsSkeleton } from "@mms/ui";
import { usePlatformContactsMetrics } from "@/platform/features/contacts/hooks/usePlatformContacts";

interface ContactsMetrics {
  total?: number;
  reachableEmail?: number;
  reachablePhone?: number;
}

/** Contacts command metrics strip (directory KPIs, visible across all tiers). */
export function PlatformContactsCommandMetrics(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { data, isLoading, isError } = usePlatformContactsMetrics();
  const metrics = (data ?? {}) as ContactsMetrics;

  if (isError) return null;
  if (isLoading) return <StatsSkeleton count={3} />;

  return (
    <ModuleCommandMetricsGrid
      items={[
        {
          icon: Users,
          label: t("platform.contacts.total"),
          value: metrics.total ?? 0,
          accent: "primary",
        },
        {
          icon: Mail,
          label: t("platform.contacts.reachableEmail"),
          value: metrics.reachableEmail ?? 0,
          accent: "success",
        },
        {
          icon: Phone,
          label: t("platform.contacts.reachablePhone"),
          value: metrics.reachablePhone ?? 0,
          accent: "info",
        },
      ]}
    />
  );
}
