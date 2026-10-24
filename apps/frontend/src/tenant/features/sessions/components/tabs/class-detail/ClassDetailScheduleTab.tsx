import React from "react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  FormCardTypeSelect,
  FormCollectionShell,
  FormListFieldCard,
  FormSelect,
  TYPE_SELECT_WIDTH,
  EditableMultiSelect,
} from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { AcademicCatalogSelect } from "@/components/common/catalog/AcademicCatalogSelect";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import {
  formatFacultyDisplayName,
  SESSIONS_MODULE_MANIFEST,
  type FacultyMember,
} from "@mms/shared";
import type { SessionClassSchedule, SessionClassTimetablePeriod } from "@/lib/data/sessionsData";

interface ClassDetailScheduleTabProps {
  schedules: SessionClassSchedule[];
  periods: SessionClassTimetablePeriod[];
  allFaculty?: FacultyMember[];
  onAddSchedule: () => void;
  onRemoveSchedule: (id: string) => void;
  onUpdateSchedule: (id: string, patch: Partial<SessionClassSchedule>) => void;
  onAddPeriod: () => void;
  onRemovePeriod: (id: string) => void;
  onUpdatePeriod: (id: string, patch: Partial<SessionClassTimetablePeriod>) => void;
}

export function ClassDetailScheduleTab({
  schedules,
  periods,
  allFaculty = [],
  onAddSchedule,
  onRemoveSchedule,
  onUpdateSchedule,
  onAddPeriod,
  onRemovePeriod,
  onUpdatePeriod,
}: ClassDetailScheduleTabProps): React.JSX.Element {
  const { canEditSetup: canCreateSubject } = useModulePermissions(SESSIONS_MODULE_MANIFEST);
  const { t } = useTranslation();
  const facultyMembers = allFaculty;

  return (
    <div className="space-y-6">
      <FormCollectionShell
        isEmpty={schedules.length === 0}
        emptyMessage={t("sessions.classes.detail.schedule.empty")}
        addLabel={t("sessions.classes.detail.schedule.add")}
        onAdd={onAddSchedule}
        listKey="class-schedules"
      >
        {schedules.map((sch, index) => (
          <FormListFieldCard
            key={sch.id}
            id={sch.id}
            index={index}
            typeSelect={
              <FormCardTypeSelect label={t("sessions.classes.detail.schedule.title")}>
                <FormSelect
                  id={`sch-type-${sch.id}`}
                  name="scheduleType"
                  aria-label={t("sessions.classes.detail.schedule.title")}
                  value={sch.scheduleType?.toLowerCase() || "daily"}
                  onChange={(val) => onUpdateSchedule(sch.id, { scheduleType: val })}
                  options={[
                    { value: "daily", label: t("sessions.classes.detail.schedule.daily") },
                    { value: "weekly", label: t("sessions.classes.detail.schedule.weekly") },
                    { value: "monthly", label: t("sessions.classes.detail.schedule.monthly") },
                    { value: "custom", label: t("sessions.classes.detail.schedule.custom") },
                  ]}
                  className={TYPE_SELECT_WIDTH}
                />
              </FormCardTypeSelect>
            }
            removeLabel={t("sessions.classes.detail.removeItem")}
            onRemove={() => onRemoveSchedule(sch.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={sch.startDate}
                onChange={(e) => onUpdateSchedule(sch.id, { startDate: e.target.value })}
                aria-label={t("common.startDate")}
                className="text-xs"
              />
              <span className="text-xs text-muted-foreground">
                {t("sessions.classes.detail.to")}
              </span>
              <Input
                type="date"
                value={sch.endDate}
                onChange={(e) => onUpdateSchedule(sch.id, { endDate: e.target.value })}
                aria-label={t("common.endDate")}
                className="text-xs"
              />
            </div>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>

      <FormCollectionShell
        title={t("sessions.classes.detail.timetable.title")}
        icon={Clock}
        isEmpty={periods.length === 0}
        emptyMessage={t("sessions.classes.detail.timetable.empty")}
        addLabel={t("sessions.classes.detail.timetable.add")}
        onAdd={onAddPeriod}
        listKey="class-periods"
      >
        {periods.map((period, index) => (
          <FormListFieldCard
            key={period.id}
            id={period.id}
            index={index}
            removeLabel={t("sessions.classes.detail.removeItem")}
            onRemove={() => onRemovePeriod(period.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="time"
                value={period.startTime}
                onChange={(e) => onUpdatePeriod(period.id, { startTime: e.target.value })}
                aria-label={t("sessions.timetable.form.startTime")}
                className="w-28 text-xs"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="time"
                value={period.endTime}
                onChange={(e) => onUpdatePeriod(period.id, { endTime: e.target.value })}
                aria-label={t("sessions.timetable.form.endTime")}
                className="w-28 text-xs"
              />
              <div className="min-w-40 flex-1">
                <AcademicCatalogSelect
                  kind="subjects"
                  id={`period-subject-${period.id}`}
                  name="subjectId"
                  aria-label={t("sessions.classes.detail.timetable.subjectPlaceholder")}
                  value={period.subjectId ?? ""}
                  onChange={(subjectId, subject) =>
                    onUpdatePeriod(period.id, { subjectId, subject: subject?.name ?? "" })
                  }
                  canCreate={canCreateSubject}
                />
              </div>
              <FormSelect
                id={`period-faculty-${period.id}`}
                name="facultyName"
                aria-label={t("sessions.classes.detail.timetable.selectFaculty")}
                value={period.facultyName || ""}
                onChange={(val) => {
                  const found = facultyMembers.find(
                    (member) =>
                      formatFacultyDisplayName(member) === val ||
                      (member.name || "").trim() === val,
                  );
                  const id = found?.id ? String(found.id) : period.facultyId;
                  onUpdatePeriod(period.id, {
                    facultyName: val,
                    facultyId: id,
                  });
                }}
                options={[
                  { value: "", label: t("sessions.classes.detail.timetable.selectFaculty") },
                  ...facultyMembers.map((member) => {
                    const label = formatFacultyDisplayName(member);
                    return { value: label, label };
                  }),
                ]}
                className="w-44 min-w-40 shrink-0 text-xs"
              />
            </div>
            <div className="mt-2">
              <EditableMultiSelect
                id={`period-assistants-${period.id}`}
                placeholder={t("sessions.periods.assistants")}
                options={facultyMembers
                  .filter((m) => String(m.id) !== period.facultyId)
                  .map((m) => formatFacultyDisplayName(m))}
                values={facultyMembers
                  .filter((m) => (period.assistantFacultyIds ?? []).includes(String(m.id)))
                  .map((m) => formatFacultyDisplayName(m))}
                onChange={(labels) =>
                  onUpdatePeriod(period.id, {
                    assistantFacultyIds: facultyMembers
                      .filter((m) => labels.includes(formatFacultyDisplayName(m)))
                      .map((m) => String(m.id)),
                  })
                }
                maxVisible={3}
              />
            </div>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
    </div>
  );
}
