import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/app/DatePicker";
import { TimePicker } from "@/components/app/TimePicker";
import { useTranslation } from "@/hooks/useTranslation";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import { StatusToggle } from "@/tenant/features/attendance/components/StatusToggle";
import type { AttendanceRow } from "@/tenant/features/attendance/lib/markAttendanceTypes";
import type { ModuleFieldDef } from "@mms/shared";

export interface MarkAttendanceFieldControlProps {
  row: AttendanceRow;
  field: ModuleFieldDef;
  idPrefix: string;
  onFieldChange: (studentId: string, key: string, value: unknown) => void;
}

export function MarkAttendanceFieldControl({
  row,
  field,
  idPrefix,
  onFieldChange,
}: MarkAttendanceFieldControlProps): React.JSX.Element {
  const { t } = useTranslation();
  const inputId = `${idPrefix}-${field.id}-${row.studentId}`;

  if (field.id === "status") {
    return (
      <StatusToggle
        value={row.status}
        onChange={(value) =>
          onFieldChange(row.studentId, "status", value as AttendanceRecord["status"])
        }
      />
    );
  }

  if (field.id === "timeIn" || field.id === "timeOut") {
    const value = field.id === "timeIn" ? row.timeIn : row.timeOut;
    return (
      <>
        <label htmlFor={inputId} className="sr-only">
          {field.label}
        </label>
        <TimePicker
          id={inputId}
          name={field.id}
          value={value}
          onChange={(nextValue) => onFieldChange(row.studentId, field.id, nextValue)}
          disabled={row.status === "absent"}
          className="w-full min-w-attendance-status text-xs disabled:opacity-40 md:max-w-attendance-status"
        />
      </>
    );
  }

  if (field.id === "notes") {
    return (
      <>
        <label htmlFor={inputId} className="sr-only">
          {field.label}
        </label>
        <Input
          id={inputId}
          name={field.id}
          type="text"
          value={row.notes}
          placeholder={t("attendance.mark.notesPlaceholder")}
          onChange={(event) => onFieldChange(row.studentId, "notes", event.target.value)}
          className="w-full min-w-0 text-xs"
        />
      </>
    );
  }

  const rawValue = row[field.id];
  const stringValue =
    typeof rawValue === "string" || typeof rawValue === "number" ? String(rawValue) : "";

  if (field.type === "select") {
    return (
      <FormSelect
        id={inputId}
        name={field.id}
        value={stringValue}
        onChange={(value: string) => onFieldChange(row.studentId, field.id, value)}
        options={field.options || []}
        placeholder={t("common.selectPlaceholder")}
        className="w-full min-w-filter-sm"
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="flex min-h-11 min-w-11 items-center justify-center">
        <label htmlFor={inputId} className="sr-only">
          {field.label}
        </label>
        <Checkbox
          id={inputId}
          name={field.id}
          checked={Boolean(rawValue)}
          onCheckedChange={(checked) => onFieldChange(row.studentId, field.id, !!checked)}
          className="cursor-pointer"
        />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <>
        <label htmlFor={inputId} className="sr-only">
          {field.label}
        </label>
        <DatePicker
          id={inputId}
          name={field.id}
          value={stringValue}
          onChange={(value) => onFieldChange(row.studentId, field.id, value)}
          required={field.required}
          className="w-full min-w-0 text-xs"
        />
      </>
    );
  }

  return (
    <>
      <label htmlFor={inputId} className="sr-only">
        {field.label}
      </label>
      <Input
        id={inputId}
        name={field.id}
        type="text"
        inputMode={field.type === "number" ? "numeric" : undefined}
        value={stringValue}
        onChange={(event) => onFieldChange(row.studentId, field.id, event.target.value)}
        placeholder={field.placeholder || t("common.enterPlaceholder")}
        className="w-full min-w-0 text-xs"
      />
    </>
  );
}
