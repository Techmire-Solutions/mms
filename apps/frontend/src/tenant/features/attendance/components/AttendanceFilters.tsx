import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { DatePicker } from "@/components/app/DatePicker";
import { SectionFilterField } from "@/components/common/SectionFilterField";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/app/FormField";
import { FormSelect } from "@/components/app/FormSelect";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useFacultyContractList } from "@/tenant/hooks/collections/faculty";
import { FACULTY_MODULE_MANIFEST, todayISOInTimeZone, type FacultyMember } from "@mms/shared";
import { activeFacultyForAssignment, resolveClassFacultyId } from "@/lib/faculty/facultyAssignment";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";

export interface AttendanceFilterState {
  sessionId: string;
  classId: string;
  /** Narrows the roster to one section of the class (empty = all sections). */
  sectionId?: string;
  facultyId: string;
  date: string;
}

export interface AttendanceFiltersProps {
  filters: AttendanceFilterState;
  onChange: (newFilters: AttendanceFilterState) => void;
}

/**
 * AttendanceFilters
 *
 * A collapsible filter component for the attendance records view.
 * Allows filtering by session, class, faculty, and date.
 *
 * @param props - The component props.
 * @returns The rendered filters component.
 */
export function AttendanceFilters({
  filters,
  onChange,
}: AttendanceFiltersProps): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const sessions = useSessionsCollection();
  const { data: activeFacultyPage } = useFacultyContractList({
    page: 1,
    limit: FACULTY_MODULE_MANIFEST.maxPageSize,
    status: "active",
  });
  const assignableFaculty = activeFacultyForAssignment(
    (activeFacultyPage?.body?.faculty ?? []) as FacultyMember[],
  );

  const allClasses = sessions.flatMap((session) =>
    (session.classes || []).map((sessionClass) => ({
      ...sessionClass,
      sessionId: session.id,
      sessionName: session.name,
    })),
  );

  const setFilterValue = (key: keyof AttendanceFilterState, value: string) =>
    onChange({ ...filters, [key]: value });

  const sessionClasses = allClasses.filter(
    (sessionClass) =>
      (!filters.sessionId || sessionClass.sessionId === filters.sessionId) &&
      (!filters.facultyId || resolveClassFacultyId(sessionClass) === filters.facultyId),
  );

  const setRelationFilter = (key: "sessionId" | "facultyId", value: string): void => {
    const nextFilters = { ...filters, [key]: value };
    const selectedClassRemainsAvailable = allClasses.some(
      (sessionClass) =>
        sessionClass.id === filters.classId &&
        (!nextFilters.sessionId || sessionClass.sessionId === nextFilters.sessionId) &&
        (!nextFilters.facultyId || resolveClassFacultyId(sessionClass) === nextFilters.facultyId),
    );
    onChange({
      ...nextFilters,
      classId: selectedClassRemainsAvailable ? filters.classId : "",
    });
  };

  // The marking day is the workspace's calendar day (the server gates writes on it), so "is this a
  // non-default day?" cannot use the device clock.
  const { timezone } = useGlobalSettings();
  const today = todayISOInTimeZone(timezone);

  const activeCount = [
    filters.sessionId,
    filters.classId,
    filters.facultyId,
    filters.date && filters.date !== today,
  ].filter(Boolean).length;

  const reset = () =>
    onChange({
      sessionId: "",
      classId: "",
      facultyId: "",
      date: today,
    });

  return (
    <Card accentColor="primary" className="p-0 overflow-hidden">
      {/* The Clear action is a sibling of the toggle, never a descendant: a button inside the
          `role="button"` header is a nested-interactive axe violation (serious). */}
      <div className="flex w-full min-h-11 items-center gap-2 px-4 py-3 border-b border-transparent hover:bg-muted/50 transition-colors text-foreground">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((isOpen) => !isOpen)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((isOpen) => !isOpen);
            }
          }}
          aria-expanded={open}
          aria-controls="filters-panel"
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer select-none items-center justify-between gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Filter className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground m-0 truncate">
              {t("attendance.filters.title")}
            </h2>
            {activeCount > 0 && (
              <Badge pill className="px-1.5 font-bold">
                {activeCount}
              </Badge>
            )}
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            className="shrink-0 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors min-h-11 px-2 hover:bg-transparent"
          >
            <X className="w-3 h-3" aria-hidden="true" /> {t("attendance.filters.clear")}
          </Button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <m.div
            id="filters-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Session */}
              <Field id="filter-session" label={t("attendance.filters.session")}>
                <FormSelect
                  id="filter-session"
                  name="sessionId"
                  value={filters.sessionId}
                  onChange={(value) => setRelationFilter("sessionId", value)}
                  placeholder={t("attendance.filters.allSessions")}
                  options={sessions.map((session) => ({ value: session.id, label: session.name }))}
                />
              </Field>

              {/* Class */}
              <Field id="filter-class" label={t("attendance.filters.class")}>
                <FormSelect
                  id="filter-class"
                  name="classId"
                  value={filters.classId}
                  onChange={(value) => onChange({ ...filters, classId: value, sectionId: "" })}
                  placeholder={t("attendance.filters.allClasses")}
                  options={sessionClasses.map((sessionClass) => ({
                    value: sessionClass.id,
                    label: sessionClass.name,
                  }))}
                />
              </Field>

              <SectionFilterField
                sections={
                  allClasses.find((sessionClass) => sessionClass.id === filters.classId)
                    ?.sections ?? []
                }
                value={filters.sectionId ?? ""}
                onChange={(value) => setFilterValue("sectionId", value)}
              />

              {/* Faculty */}
              <Field
                id="filter-faculty"
                label={t("attendance.filters.faculty") || t("nav.faculty")}
              >
                <FormSelect
                  id="filter-faculty"
                  name="facultyId"
                  value={filters.facultyId}
                  onChange={(value) => setRelationFilter("facultyId", value)}
                  placeholder={t("attendance.filters.allFaculty")}
                  options={assignableFaculty.map((member) => ({
                    value: member.id,
                    label: member.name || "Unknown",
                  }))}
                />
              </Field>

              {/* Date */}
              <Field id="filter-date" label={t("attendance.filters.date")}>
                <DatePicker
                  id="filter-date"
                  name="date"
                  value={filters.date}
                  onChange={(value) => setFilterValue("date", value)}
                />
              </Field>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
