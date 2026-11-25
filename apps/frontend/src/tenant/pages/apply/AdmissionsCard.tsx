import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, GraduationCap, Users } from "lucide-react";
import { formatDate, type PublicRegistrationView } from "@mms/shared";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/config/routes";

export interface AdmissionsCardProps {
  item: PublicRegistrationView;
}

/**
 * Elevated admission card displaying session title, brand accent, status badge,
 * session dates, classes with capacity, deadline, and a full-width Apply Now CTA.
 */
export function AdmissionsCard({ item }: AdmissionsCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const sessionDates = [
    item.startDate && formatDate(item.startDate),
    item.endDate && formatDate(item.endDate),
  ]
    .filter(Boolean)
    .join(" – ");

  const hasSeatsAvailable = item.classes.some((cls) => cls.seatsLeft === null || cls.seatsLeft > 0);

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
      {/* Brand accent bar */}
      <div
        className="h-1.5 w-full bg-primary transition-colors group-hover:bg-primary/90"
        aria-hidden
      />

      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success border border-success/30">
              <span className="size-1.5 rounded-full bg-success animate-pulse" aria-hidden />
              <span>{hasSeatsAvailable ? t("apply.seatsOpen") : t("apply.waitlistOnly")}</span>
            </span>

            {item.closesAt && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-warning" aria-hidden />
                <span>{t("apply.closesOn", { date: formatDate(item.closesAt) })}</span>
              </span>
            )}
          </div>

          <h2 className="text-balance text-lg font-bold text-foreground leading-snug transition-colors group-hover:text-primary">
            {item.title}
          </h2>
        </div>

        {/* Structured metadata rows */}
        <div className="space-y-2.5 text-xs sm:text-sm">
          {sessionDates && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
              <span>{sessionDates}</span>
            </div>
          )}

          {item.classes.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground uppercase tracking-wider">
                <GraduationCap className="size-3.5 text-primary" aria-hidden />
                <span>{t("apply.class")}</span>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {item.classes.map((cls) => (
                  <li key={cls.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {cls.name}
                      {cls.minAge || cls.maxAge
                        ? ` · ${t("apply.ages", { min: cls.minAge || 0, max: cls.maxAge || "+" })}`
                        : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 text-3xs font-medium text-muted-foreground">
                      <Users className="size-3 shrink-0" aria-hidden />
                      {cls.seatsLeft === null
                        ? t("apply.seatsOpen")
                        : cls.seatsLeft > 0
                          ? t("apply.seatsLeft", { count: cls.seatsLeft })
                          : t("apply.waitlistOnly")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Full-width, high-contrast Apply Now button */}
        <Link
          to={`${ROUTES.apply}/${item.slug}`}
          className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden touch-manipulation"
        >
          <span>{t("apply.applyNow")}</span>
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}
