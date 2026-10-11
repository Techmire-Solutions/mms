import React from "react";
import { motion } from "framer-motion";
import { formatDayName, formatLongDate, formatHijriDate } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SectionLabel } from "@/components/ui/SectionLabel";
import {
  DASHBOARD_ROLE_GREETING_KEYS,
  DASHBOARD_ROLE_BADGE_KEYS,
  resolveDashboardWelcomeSubtitle,
  type DashboardRole,
} from "@/lib/dashboardRole";

interface WelcomeBannerProps {
  dashboardRole: DashboardRole;
  /** Active sessions from server metrics (faculty subtitle). */
  activeSessionsCount: number;
  /** Active student count from student metrics (admin subtitle). */
  activeStudentCount: number;
}

const DATE_CHIP_CLASS =
  "border border-foreground/10 bg-muted/30 hover:bg-muted/50 rounded-xl px-3.5 py-2 transition-colors duration-150 ease-out flex items-center gap-2 shadow-2xs print:bg-transparent print:border-border print:text-foreground print:shadow-none";

/** Dashboard welcome header with dashboardRole-specific messaging and localized date. */
export function WelcomeBanner({
  dashboardRole,
  activeSessionsCount,
  activeStudentCount,
}: WelcomeBannerProps): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();

  const now = (() => new Date())();
  const dayName = (() => formatDayName(now))();
  const gregDate = (() => formatLongDate(now))();
  const hijriDate = (() => formatHijriDate(now))();

  const userName = user?.name ?? "";

  const subtitle = (() =>
    resolveDashboardWelcomeSubtitle(
      dashboardRole,
      { activeSessionsCount, activeStudentCount },
      t,
    ))();

  return (
    <motion.header
      initial={reducedMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-card p-6 md:p-8 text-card-foreground shadow-xs print:bg-none print:border print:border-border print:shadow-none print:p-4"
    >
      <div className="relative z-elevated flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SectionLabel toneClassName="text-primary font-bold">
              {t(DASHBOARD_ROLE_BADGE_KEYS[dashboardRole])}
            </SectionLabel>
          </div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight m-0 text-foreground">
            {userName
              ? t("dashboard.greeting.personal", { name: userName })
              : t(DASHBOARD_ROLE_GREETING_KEYS[dashboardRole])}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-2 max-w-lg mb-0 font-medium leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="flex-shrink-0 flex items-center gap-3 self-start lg:self-auto flex-wrap">
          <div className={DATE_CHIP_CLASS}>
            <span className="w-1.5 h-1.5 rounded-full bg-primary print:hidden" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground whitespace-nowrap tracking-wide">
              {dayName}
            </span>
          </div>
          <div className={DATE_CHIP_CLASS}>
            <span className="w-1.5 h-1.5 rounded-full bg-info print:hidden" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground whitespace-nowrap tracking-wide">
              {gregDate}
            </span>
          </div>
          {hijriDate ? (
            <div className={DATE_CHIP_CLASS}>
              <span
                className="w-1.5 h-1.5 rounded-full bg-success print:hidden"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-foreground whitespace-nowrap tracking-wide">
                {hijriDate}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </motion.header>
  );
}

export default WelcomeBanner;
