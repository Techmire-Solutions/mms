import React, { useMemo, useState } from "react";
import {
  formatDate,
  listWorkshopDays,
  WORKSHOP_ATTENDANCE_STATUSES,
  type WorkshopAttendanceStatus,
  type WorkshopDetail,
} from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useSaveWorkshopAttendance } from "../hooks/useWorkshopsApi";

export interface WorkshopCheckInSectionProps {
  detail: WorkshopDetail;
  canWrite: boolean;
}

const STATUS_LABEL_KEYS = {
  present: "workshops.attendance.present",
  absent: "workshops.attendance.absent",
  late: "workshops.attendance.late",
  excused: "workshops.attendance.excused",
} as const satisfies Record<WorkshopAttendanceStatus, string>;

function isAttendanceStatus(value: string): value is WorkshopAttendanceStatus {
  return WORKSHOP_ATTENDANCE_STATUSES.some((status) => status === value);
}

/** One day's check-in grid: pick a day, set each participant's status, save in one upsert. */
export function WorkshopCheckInSection({
  detail,
  canWrite,
}: WorkshopCheckInSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { workshop, participants, attendance } = detail;
  const days = useMemo(
    () => listWorkshopDays(workshop.startDate, workshop.endDate),
    [workshop.startDate, workshop.endDate],
  );
  const [pickedDay, setPickedDay] = useState("");
  // Unsaved edits per day; everything else is derived from the stored attendance.
  const [edits, setEdits] = useState<Record<string, Record<string, WorkshopAttendanceStatus>>>({});
  const save = useSaveWorkshopAttendance();

  const dayOn = days.includes(pickedDay) ? pickedDay : (days[0] ?? "");
  const marks = useMemo(() => {
    const saved: Record<string, WorkshopAttendanceStatus> = {};
    for (const mark of attendance) {
      if (mark.dayOn === dayOn) saved[mark.participantId] = mark.status;
    }
    return { ...saved, ...edits[dayOn] };
  }, [attendance, dayOn, edits]);

  if (days.length === 0 || participants.length === 0) {
    return (
      <section aria-labelledby="workshop-checkin-heading" className="space-y-2">
        <h3 id="workshop-checkin-heading" className="text-sm font-semibold text-foreground">
          {t("workshops.checkIn")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {days.length === 0 ? t("workshops.checkInNeedsDates") : t("workshops.noParticipants")}
        </p>
      </section>
    );
  }

  const editable = canWrite && !workshop.deletedAt;
  const statusOptions = WORKSHOP_ATTENDANCE_STATUSES.map((status) => ({
    value: status,
    label: t(STATUS_LABEL_KEYS[status]),
  }));

  const handleSave = async () => {
    const entries = Object.entries(marks);
    if (entries.length === 0) return;
    try {
      await save.mutateAsync({
        id: workshop.id,
        body: {
          dayOn,
          marks: entries.map(([participantId, status]) => ({ participantId, status })),
        },
      });
      setEdits((current) => ({ ...current, [dayOn]: {} }));
      notify.success(t("workshops.checkInSaved"));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t("workshops.saveFailed"));
    }
  };

  return (
    <section aria-labelledby="workshop-checkin-heading" className="space-y-3">
      <h3 id="workshop-checkin-heading" className="text-sm font-semibold text-foreground">
        {t("workshops.checkIn")}
      </h3>
      <Field id="workshop-checkin-day" label={t("workshops.checkInDay")}>
        <FormSelect
          id="workshop-checkin-day"
          name="dayOn"
          value={dayOn}
          onChange={(value) => setPickedDay(value)}
          options={days.map((day) => ({ value: day, label: formatDate(day) }))}
        />
      </Field>
      <ul className="divide-y divide-border rounded-md border border-border">
        {participants.map((participant) => {
          const selectId = `workshop-checkin-${participant.id}`;
          return (
            <li key={participant.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <label htmlFor={selectId} className="min-w-0 flex-1 truncate text-sm text-foreground">
                {participant.contactName || participant.contactId}
              </label>
              <div className="w-40">
                <FormSelect
                  id={selectId}
                  name={selectId}
                  value={marks[participant.id] ?? ""}
                  disabled={!editable}
                  placeholder={t("workshops.attendance.unmarked")}
                  onChange={(value) => {
                    if (isAttendanceStatus(value)) {
                      setEdits((current) => ({
                        ...current,
                        [dayOn]: { ...current[dayOn], [participant.id]: value },
                      }));
                    }
                  }}
                  options={statusOptions}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {editable ? (
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={save.isPending || Object.keys(marks).length === 0}
          className="min-h-11"
        >
          {t("workshops.saveCheckIn")}
        </Button>
      ) : null}
    </section>
  );
}
