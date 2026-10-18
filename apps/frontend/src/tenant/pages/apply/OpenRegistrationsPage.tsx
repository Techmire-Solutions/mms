import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Users } from "lucide-react";
import { formatDate } from "@mms/shared";
import { AuthPageFrame } from "@/components/entry";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { useTranslation } from "@/hooks/useTranslation";
import { useTenant } from "@/lib/contexts/TenantContext";
import { ROUTES } from "@/lib/config/routes";
import { openRegistrationsQueryOptions } from "@/lib/query/registrationQueries";

/** Public "open sessions" board at `/apply` (no sign-in). */
export default function OpenRegistrationsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { workspace } = useTenant();
  const query = useQuery(openRegistrationsQueryOptions());

  if (query.isPending) return <RouteStatusFallback fullScreen />;

  return (
    <AuthPageFrame>
      <div className="relative z-elevated w-full max-w-3xl space-y-4">
        <header className="space-y-1 text-center">
          <p className="text-sm text-muted-foreground">{workspace?.madrasaName}</p>
          <h1 className="text-balance text-2xl font-semibold">{t("apply.openTitle")}</h1>
        </header>
        {query.isError ? (
          <ErrorState title={t("apply.loadFailed")} onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t("apply.noneOpen")} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {query.data.map((item) => (
              <li key={item.slug}>
                <Card className="flex h-full flex-col gap-3 p-4">
                  <div>
                    <h2 className="text-balance text-base font-semibold">{item.title}</h2>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5" aria-hidden />
                      {[
                        item.startDate && formatDate(item.startDate),
                        item.endDate && formatDate(item.endDate),
                      ]
                        .filter(Boolean)
                        .join(" – ")}
                    </p>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {item.classes.map((cls) => (
                      <li
                        key={cls.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>
                          {cls.name}
                          {cls.minAge || cls.maxAge
                            ? ` · ${t("apply.ages", { min: cls.minAge || 0, max: cls.maxAge || "+" })}`
                            : ""}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-3.5" aria-hidden />
                          {cls.seatsLeft === null
                            ? t("apply.seatsOpen")
                            : cls.seatsLeft > 0
                              ? t("apply.seatsLeft", { count: cls.seatsLeft })
                              : t("apply.waitlistOnly")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {item.closesAt ? (
                    <p className="text-xs text-muted-foreground">
                      {t("apply.closesOn", { date: formatDate(item.closesAt) })}
                    </p>
                  ) : null}
                  <Link
                    to={`${ROUTES.apply}/${item.slug}`}
                    className="mt-auto inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("apply.applyNow")}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AuthPageFrame>
  );
}
