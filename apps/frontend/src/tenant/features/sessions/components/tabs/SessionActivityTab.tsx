import React from "react";
import { History } from "lucide-react";
import { formatDate, type AppTranslationKey, type Session } from "@mms/shared";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessionActivity } from "@/tenant/features/sessions/hooks/useSessionLifecycleOps";

const KIND_LABELS: Record<string, AppTranslationKey> = {
  transferred: "sessions.activity.kind.transferred",
  withdrawn: "sessions.activity.kind.withdrawn",
  readmitted: "sessions.activity.kind.readmitted",
  suspended: "sessions.activity.kind.suspended",
  cancelled: "sessions.activity.kind.cancelled",
  staff_assigned: "sessions.activity.kind.staffAssigned",
  staff_ended: "sessions.activity.kind.staffEnded",
  section_closed: "sessions.activity.kind.sectionClosed",
  calendar_holiday: "sessions.activity.kind.holiday",
  calendar_makeup_day: "sessions.activity.kind.makeupDay",
  calendar_exam_period: "sessions.activity.kind.examPeriod",
  calendar_event: "sessions.activity.kind.event",
};

/** Session → Activity: dated changes (enrollments, staff, sections, calendar), newest first. */
export function SessionActivityTab({ session }: { session: Session }): React.JSX.Element {
  const { t } = useTranslation();
  const activity = useSessionActivity(String(session.id));

  if (activity.isError)
    return (
      <ErrorState
        title={t("sessions.activity.loadFailed")}
        onRetry={() => void activity.refetch()}
      />
    );
  if (activity.isLoading)
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  const items = activity.data ?? [];
  if (items.length === 0)
    return (
      <EmptyState icon={History} title={t("sessions.activity.empty")} compact variant="dashed" />
    );

  return (
    <ol className="space-y-2" aria-label={t("sessions.activity.title")}>
      {items.map((item, index) => {
        const labelKey = KIND_LABELS[item.kind];
        return (
          <li
            key={`${item.on}-${item.kind}-${index}`}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="text-sm font-medium">{labelKey ? t(labelKey) : item.kind}</span>
              <span className="text-sm text-muted-foreground"> · {item.title}</span>
              {item.detail ? (
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              ) : null}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDate(item.on)}
              {item.actor ? ` · ${item.actor}` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
