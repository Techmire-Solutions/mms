import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addIsoDays,
  hijriDayOfMonth,
  hijriMonthSpanLabel,
  instructionalDayDecision,
  isoWeekday,
  weekdayIndexes,
  WEEKDAY_NAMES,
  type AcademicCalendarEvent,
  type AcademicCalendarEventKind,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export interface AcademicCalendarMonthViewProps {
  /** First day of the month shown (`YYYY-MM-01`). */
  month: string;
  onMonthChange: (month: string) => void;
  events: readonly AcademicCalendarEvent[];
  workingDays: readonly string[];
  onDayClick?: (date: string) => void;
  onEventClick?: (event: AcademicCalendarEvent) => void;
}

const KIND_TONE: Record<AcademicCalendarEventKind, string> = {
  holiday: "bg-destructive/10 text-destructive",
  makeup_day: "bg-success/10 text-success",
  exam_period: "bg-warning/10 text-warning",
  event: "bg-info/10 text-info",
};

function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta, 1);
  return date.toISOString().slice(0, 10);
}

/** Workspace-level month grid: off-days muted, holidays / make-up days / exams / events as chips. */
export function AcademicCalendarMonthView({
  month,
  onMonthChange,
  events,
  workingDays,
  onDayClick,
  onEventClick,
}: AcademicCalendarMonthViewProps): React.JSX.Element {
  const { t, language } = useTranslation();
  const weekdays = useMemo(() => weekdayIndexes(workingDays), [workingDays]);
  const monthLabel = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}T00:00:00Z`));
  const hijriLabel = useMemo(
    () => hijriMonthSpanLabel(month, addIsoDays(shiftMonth(month, 1), -1), language),
    [month, language],
  );
  const dayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { weekday: "short", timeZone: "UTC" });
    return WEEKDAY_NAMES.map((_, index) => format.format(Date.UTC(2023, 0, 1 + index)));
  }, [language]);

  const days = useMemo(() => {
    const next = shiftMonth(month, 1);
    const list: string[] = [];
    for (let date = month; date < next; date = addIsoDays(date, 1)) list.push(date);
    return list;
  }, [month]);
  const leading = isoWeekday(month);
  const hijriDays = useMemo(
    () => Object.fromEntries(days.map((date) => [date, hijriDayOfMonth(date)])),
    [days],
  );

  return (
    <section aria-label={monthLabel} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label={t("attendance.calendar.previousMonth")}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
        <div className="min-w-0 text-center">
          <h3 className="text-balance text-base font-semibold">{monthLabel}</h3>
          {hijriLabel ? (
            <p className="text-2xs text-muted-foreground" dir="auto">
              {hijriLabel}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label={t("attendance.calendar.nextMonth")}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
      <div
        className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground"
        aria-hidden
      >
        {dayNames.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }, (_, index) => (
          <li key={`pad-${index}`} aria-hidden />
        ))}
        {days.map((date) => {
          const dayEvents = events.filter((event) => event.startOn <= date && date <= event.endOn);
          const teaching = instructionalDayDecision(date, {
            workingWeekdays: weekdays,
            events: dayEvents.filter((event) => event.scope === "workspace"),
          }).instructional;
          return (
            <li
              key={date}
              className={cn(
                "flex min-h-20 min-w-0 flex-col gap-1 rounded-md border border-border/60 p-1",
                !teaching && "bg-muted/50",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 justify-between gap-1 px-1 text-xs"
                aria-label={`${date}${teaching ? "" : ` — ${t("attendance.calendar.nonTeachingDay")}`}`}
                onClick={() => onDayClick?.(date)}
              >
                <span>{Number(date.slice(8))}</span>
                {hijriDays[date] != null ? (
                  <span className="text-2xs font-normal text-muted-foreground" aria-hidden>
                    {hijriDays[date]}
                  </span>
                ) : null}
              </Button>
              {dayEvents.slice(0, 2).map((event) => (
                <Button
                  key={event.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto min-h-11 justify-start truncate px-1 py-0.5 text-2xs",
                    KIND_TONE[event.kind],
                  )}
                  onClick={() => onEventClick?.(event)}
                >
                  <span className="truncate">{event.title}</span>
                </Button>
              ))}
              {dayEvents.length > 2 ? (
                <span className="text-2xs text-muted-foreground">+{dayEvents.length - 2}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
