import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { AuthPageFrame } from "@/components/entry";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { useTranslation } from "@/hooks/useTranslation";
import { useTenant } from "@/lib/contexts/TenantContext";
import { ROUTES } from "@/lib/config/routes";
import { openRegistrationsQueryOptions } from "@/lib/query/registrationQueries";
import { AdmissionsBrandHeader } from "./AdmissionsBrandHeader";
import { AdmissionsCard } from "./AdmissionsCard";

/** Public "open sessions" board at `/apply` (no sign-in). */
export default function OpenRegistrationsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { workspace, publicBranding } = useTenant();
  const query = useQuery(openRegistrationsQueryOptions());

  if (query.isPending) return <RouteStatusFallback fullScreen />;

  const items = query.data ?? [];
  const effectiveMadrasaName =
    items[0]?.madrasaName || workspace?.madrasaName || publicBranding?.madrasaName || "";
  const effectiveLogoUrl = items[0]?.logoUrl ?? publicBranding?.logoUrl ?? null;

  const gridClass =
    items.length === 1
      ? "grid grid-cols-1 max-w-md mx-auto"
      : items.length === 2
        ? "grid grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto gap-6"
        : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  return (
    <AuthPageFrame>
      <div className="relative z-elevated w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 sm:space-y-10">
        <AdmissionsBrandHeader
          logoUrl={effectiveLogoUrl}
          institutionName={effectiveMadrasaName}
          heroTitle={t("apply.openTitle")}
          heroSubtitle={t("apply.openHeroSubtitle")}
        />

        {query.isError ? (
          <div className="max-w-md mx-auto">
            <ErrorState title={t("apply.loadFailed")} onRetry={() => void query.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="max-w-md mx-auto">
            <EmptyState
              icon={ClipboardList}
              title={t("apply.noneOpen")}
              description={t("apply.noneOpenDesc")}
              action={
                <Link
                  to={ROUTES.login}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("apply.signIn")}
                </Link>
              }
            />
          </div>
        ) : (
          <ul className={gridClass}>
            {items.map((item) => (
              <li key={item.slug} className="h-full">
                <AdmissionsCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AuthPageFrame>
  );
}
