import React, { useState } from "react";
import { User, Calendar } from "lucide-react";
import { SearchBar } from "@/components/ui/SearchBar";
import { STUDENTS_MODULE_MANIFEST } from "@mms/shared";
import { calcAge, type Student } from "@/lib/data/studentsData";
import { type Session } from "@/lib/data/sessionsData";
import { WIZARD_SELECTION_DOT } from "@/lib/semanticTone";
import { useStudentsByIds, useStudentsContractList } from "@/tenant/hooks/collections/students";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { studentStatusBadgeConfig } from "@/lib/students/studentStatusUi";
import { genderStatusBadgeConfig } from "@/lib/genderStatusBadge";

export interface Step1SelectStudentProps {
  value: Student | null | undefined;
  onChange: (student: Student) => void;
  sessions?: Session[];
}

/**
 * Step 1 component for selecting a student to enroll.
 */
export function Step1SelectStudent({
  value,
  onChange,
  sessions = [],
}: Step1SelectStudentProps): React.JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState<string>("");
  const statusBadgeConfig = (() => studentStatusBadgeConfig(t))();
  const genderConfig = (() => genderStatusBadgeConfig(t))();

  const { data: studentPage, isFetching } = useStudentsContractList({
    page: 1,
    limit: STUDENTS_MODULE_MANIFEST.maxPageSize,
    search,
    status: "active",
  });

  const selectedId = value?.id ? String(value.id) : "";
  const pageStudents: Student[] = Array.isArray(studentPage?.body?.students)
    ? (studentPage.body.students as Student[])
    : [];
  const valueInPage = pageStudents.some((student) => String(student.id) === selectedId);
  const { data: resolvedSelected = [] } = useStudentsByIds(
    selectedId && !valueInPage ? [selectedId] : [],
  );

  const students = (() => {
    const rows = pageStudents;
    if (value && !rows.some((student) => String(student.id) === String(value.id))) {
      return [value, ...rows];
    }
    if (
      resolvedSelected.length > 0 &&
      !rows.some((student) => String(student.id) === String(resolvedSelected[0].id))
    ) {
      return [resolvedSelected[0], ...rows];
    }
    return rows;
  })();

  const sessionName = (sessionId: string): string =>
    sessions.find((session) => session.id === sessionId)?.name || sessionId;
  const hasMore = Boolean(studentPage?.body?.hasMore);

  return (
    <section className="space-y-4" aria-labelledby="step1-title">
      <div>
        <h3 id="step1-title" className="text-base font-bold text-foreground">
          {t("enrollments.wizard.step1Title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("enrollments.wizard.step1Desc")}</p>
      </div>

      <SearchBar
        id="enrollment-wizard-student-search"
        name="studentSearch"
        value={search}
        onChange={setSearch}
        placeholder={t("enrollments.wizard.searchPlaceholder")}
        className="w-full"
      />

      <div
        className="space-y-2 max-h-80 overflow-y-auto pe-1"
        role="radiogroup"
        aria-label={t("enrollments.wizard.step1StudentsAria")}
      >
        {!isFetching && students.length === 0 && (
          <EmptyState title={t("enrollments.wizard.noStudents")} compact icon={null} />
        )}
        {students.map((student) => {
          const age = calcAge(student.dob);
          const selected = value?.id === student.id;
          return (
            <Button
              key={student.id}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(student)}
              variant="outline"
              className={`w-full text-start flex items-start gap-3 p-4 rounded-xl border-2 transition-all h-auto justify-start hover:bg-transparent ${
                selected
                  ? "border-primary bg-primary/5 hover:bg-primary/5 text-foreground hover:text-foreground"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30 text-foreground hover:text-foreground"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-foreground">{student.name}</p>
                  {student.grNumber && (
                    <span className="bg-primary/5 text-primary text-xs px-1.5 py-0.5 rounded border border-primary/10 font-bold uppercase tracking-wider">
                      {t("enrollments.wizard.step1GrPrefix")}: {student.grNumber}
                    </span>
                  )}
                  <StatusBadge status={student.gender || "male"} config={genderConfig} size="sm" />
                  <StatusBadge
                    status={student.status || "active"}
                    size="sm"
                    config={statusBadgeConfig}
                  />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />{" "}
                    {t("enrollments.wizard.step1Age", { age: age ?? "?" })}
                  </span>
                  <span>
                    {t("students.columns.parents")}:{" "}
                    {student.fatherName || student.guardianName || "—"}
                  </span>
                  {student.city && <span>{student.city}</span>}
                </div>
                {student.enrolledSessions && student.enrolledSessions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {student.enrolledSessions.map((sessionId: string) => (
                      <Badge key={sessionId} pill tone="muted" className="px-1.5 font-medium">
                        {sessionName(sessionId)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {selected && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className={`h-2 w-2 rounded-full ${WIZARD_SELECTION_DOT}`} />
                </div>
              )}
            </Button>
          );
        })}
      </div>
      {hasMore && (
        <p className="text-xs text-muted-foreground">{t("registryPerson.refineSearch")}</p>
      )}
    </section>
  );
}
