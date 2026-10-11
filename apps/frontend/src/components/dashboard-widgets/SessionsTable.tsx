import React from "react";
import { Link } from "react-router-dom";
import { Users, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import type { SessionsReportTodaySession } from "@mms/shared";
import { useSessionsReportAggregates } from "@/tenant/hooks/collections/sessions";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { WidgetCardHeader } from "@/components/ui/WidgetCardHeader";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPagination } from "@/components/ui/ListPagination";
import { Badge } from "@/components/ui/badge";
import { useLocalPagination } from "@/hooks/useLocalPagination";
import { ROUTES } from "@/lib/config/routes";

export interface UpcomingSessionItem {
  id: string;
  name: string;
  teacher: string;
  time: string;
  room: string;
  students: number;
  status: "live" | "upcoming";
}

interface SessionsTableProps {
  title?: string;
  /** When provided (Reports path), skip self-fetch and render these rows. */
  items?: SessionsReportTodaySession[];
}

function mapTodayRows(
  rows: SessionsReportTodaySession[],
  t: TranslationFunction,
): UpcomingSessionItem[] {
  return rows.map((item) => ({
    ...item,
    teacher: item.teacher || t("sessions.classes.unassigned"),
    time: item.time || t("dashboard.widgets.defaultSessionTime"),
    room: item.room || t("common.notAvailable"),
  }));
}

const SESSION_SEARCH_FIELDS = (session: UpcomingSessionItem) => [
  session.name,
  session.teacher,
  session.room,
];

/**
 * Today's scheduled sessions widget — rows from report-aggregates (or parent `items`).
 */
export default function SessionsTable({ title, items }: SessionsTableProps) {
  const { t } = useTranslation();
  const { data: reportAggregates } = useSessionsReportAggregates({
    enabled: items == null,
  });

  const sessions = ((): UpcomingSessionItem[] => {
    const rows = items ?? reportAggregates?.todaysSessions ?? [];
    return mapTodayRows(rows, t);
  })();

  const {
    searchQuery,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    paginatedItems: paginatedSessions,
    filteredItems: filteredSessions,
    totalPages,
  } = useLocalPagination({
    items: sessions,
    pageSize: 5,
    searchFields: SESSION_SEARCH_FIELDS,
  });

  return (
    <WidgetCard ariaLabelledby="sessions-table-heading" accentColor="primary">
      <WidgetCardHeader
        headingId="sessions-table-heading"
        title={title || t("dashboard.widgets.todaysSessions")}
        badge={
          <Badge pill tone="primary" className="uppercase tracking-wider font-bold">
            {t("dashboard.widgets.sessionsScheduled", { count: filteredSessions.length })}
          </Badge>
        }
        actions={
          <Link
            to={ROUTES.sessions}
            className="inline-flex min-h-11 shrink-0 items-center text-xs font-bold text-primary hover:underline"
          >
            {t("dashboard.widgets.viewAll")}
          </Link>
        }
      />

      <div className="p-3 px-6 border-b border-border/40 flex items-center gap-2 bg-muted/10">
        <SearchBar
          placeholder={t("contacts.searchPlaceholder")}
          value={searchQuery}
          onChange={handleSearchChange}
          className="flex-1"
        />
      </div>

      <div className="divide-y divide-border/40 min-h-chart-md">
        {paginatedSessions.length === 0 ? (
          <EmptyState
            title={t("sessions.report.noData")}
            compact
            icon={null}
            className="select-none"
          />
        ) : (
          paginatedSessions.map((session, sessionIndex) => (
            <motion.article
              key={session.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: sessionIndex * 0.03, duration: 0.15, ease: "easeOut" }}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors duration-150 ease-out"
            >
              <div className="w-24 flex-shrink-0 text-start">
                <p className="text-sm font-bold text-foreground m-0 tabular-nums">{session.time}</p>
              </div>

              <div className="flex-shrink-0">
                {session.status === "live" ? (
                  <Badge
                    as="span"
                    pill
                    tone="success"
                    className="gap-1.5 font-black uppercase tracking-wider select-none"
                    aria-label={t("dashboard.widgets.sessionLiveAria")}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                    <span>{t("dashboard.widgets.live")}</span>
                  </Badge>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-border/80 ms-2" aria-hidden="true" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate m-0">{session.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 m-0 font-medium">
                  {session.teacher}
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-3.5 text-xs text-muted-foreground flex-shrink-0 font-semibold select-none">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="sr-only">{t("dashboard.widgets.roomLabel")}</span> {session.room}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="sr-only">{t("sessions.report.studentsLabel")}</span>{" "}
                  <span className="tabular-nums">{session.students}</span>
                </span>
              </div>
            </motion.article>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <footer className="px-5 py-3.5 border-t border-border/40 flex items-center justify-end gap-2 bg-muted/10 select-none">
          <ListPagination
            variant="compact"
            page={currentPage}
            total={totalPages}
            limit={1}
            onPageChange={setCurrentPage}
          />
        </footer>
      )}
    </WidgetCard>
  );
}
