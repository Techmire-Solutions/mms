import React from "react";
import { m } from "framer-motion";
import { formatDayName, formatLongDate, formatHijriDate } from "@mms/contracts";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { useTranslation } from "@mms/fe-core/i18n";
import { useReducedMotion } from "@mms/fe-core/tenant";
import { SectionLabel } from "@mms/ui";
import {
  DASHBOARD_ROLE_GREETING_KEYS,
  DASHBOARD_ROLE_BADGE_KEYS,
  resolveDashboardWelcomeSubtitle,
  type DashboardRole,
} from "../../../lib/dashboardRole";

interface WelcomeBannerProps {
  dashboardRole: DashboardRole;
  /** Active sessions from server metrics (faculty subtitle). */
  activeSessionsCount: number;
  /** Active student count from student metrics (admin subtitle). */
  activeStudentCount: number;
  /** Optional page actions (print/customize) rendered with the date chips. */
  actions?: React.ReactNode;
}

const DATE_CHIP_CLASS =
  "border border-foreground/10 bg-muted/30 hover:bg-muted/50 rounded-xl px-3 py-1.5 transition-colors duration-150 ease-out flex items-center gap-1.5 shadow-2xs print:bg-transparent print:border-border print:text-foreground print:shadow-none";

/** Dashboard welcome header with dashboardRole-specific messaging and localized date. */
export function WelcomeBanner({
  dashboardRole,
  activeSessionsCount,
  activeStudentCount,
  actions,
}: WelcomeBannerProps): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();

  const now = new Date();
  const dayName = formatDayName(now);
  const gregDate = formatLongDate(now);
  const hijriDate = formatHijriDate(now);

  const userName = user?.name ?? "";

  const subtitle = resolveDashboardWelcomeSubtitle(
    dashboardRole,
    { activeSessionsCount, activeStudentCount },
    t,
  );

  return (
    <m.header
      // Content header: the global print rule only hides chrome headers.
      data-print-header
      initial={reducedMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-card p-4 md:p-5 text-card-foreground shadow-xs print:bg-none print:border print:border-border print:shadow-none print:p-4"
    >
      <div className="relative z-elevated flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5">
        {/* `min-w-0 flex-1` keeps the greeting from being squeezed into a narrow
            column by the date chips + page actions on medium laptop widths. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <SectionLabel toneClassName="text-primary font-bold">
              {t(DASHBOARD_ROLE_BADGE_KEYS[dashboardRole])}
            </SectionLabel>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight m-0 text-foreground text-balance">
            {userName
              ? t("dashboard.greeting.personal", { name: userName })
              : t(DASHBOARD_ROLE_GREETING_KEYS[dashboardRole])}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-xl mb-0 font-medium leading-relaxed text-pretty">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col items-start xl:items-end gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className={DATE_CHIP_CLASS}>
              <span className="w-1.5 h-1.5 rounded-xs bg-primary print:hidden" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground whitespace-nowrap tracking-wide">
                {dayName}
              </span>
            </div>
            <div className={DATE_CHIP_CLASS}>
              <span className="w-1.5 h-1.5 rounded-xs bg-info print:hidden" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground whitespace-nowrap tracking-wide">
                {gregDate}
              </span>
            </div>
            {hijriDate ? (
              <div className={DATE_CHIP_CLASS}>
                <span
                  className="w-1.5 h-1.5 rounded-xs bg-success print:hidden"
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-foreground whitespace-nowrap tracking-wide">
                  {hijriDate}
                </span>
              </div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:justify-end print:hidden">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </m.header>
  );
}

export default WelcomeBanner;
