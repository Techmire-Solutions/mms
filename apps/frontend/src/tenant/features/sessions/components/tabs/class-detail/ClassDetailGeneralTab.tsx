import React from "react";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/FormSelect";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { Field } from "@/components/ui/FormField";
import { useTranslation } from "@/hooks/useTranslation";
import { formatFacultyDisplayName, type FacultyMember } from "@mms/shared";
import type { Class } from "@/lib/data/sessionsData";

interface ClassDetailGeneralTabProps {
  classDraft: Class;
  updateDraft: <K extends keyof Class>(field: K, value: Class[K]) => void;
  errors: Record<string, string>;
  allFaculty: FacultyMember[];
}

export function ClassDetailGeneralTab({
  classDraft,
  updateDraft,
  errors,
  allFaculty,
}: ClassDetailGeneralTabProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="class-name" label={t("sessions.classes.form.name")} required error={errors.name}>
          <Input
            id="class-name"
            name="name"
            value={classDraft.name}
            onChange={(e) => updateDraft("name", e.target.value)}
            placeholder={t("sessions.classes.form.namePlaceholder")}
            className={errors.name ? FORM_INPUT_ERROR : undefined}
          />
        </Field>

        <Field id="class-gender" label={t("sessions.classes.detail.genderGroup")}>
          <FormSelect
            id="class-gender"
            name="gender"
            value={classDraft.gender}
            onChange={(val) => updateDraft("gender", val as "male" | "female" | "mixed")}
            options={[
              { value: "mixed", label: t("sessions.classes.detail.gender.mixed") },
              { value: "male", label: t("sessions.classes.detail.gender.male") },
              { value: "female", label: t("sessions.classes.detail.gender.female") },
            ]}
            className="w-full"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field id="class-min-age" label={t("sessions.classes.form.minAge")}>
          <Input
            id="class-min-age"
            name="minAge"
            type="text"
            inputMode="numeric"
            value={classDraft.minAge ?? 0}
            onChange={(e) => updateDraft("minAge", parseInt(e.target.value, 10) || 0)}
          />
        </Field>

        <Field id="class-max-age" label={t("sessions.classes.form.maxAge")} error={errors.maxAge}>
          <Input
            id="class-max-age"
            name="maxAge"
            type="text"
            inputMode="numeric"
            value={classDraft.maxAge ?? 0}
            onChange={(e) => updateDraft("maxAge", parseInt(e.target.value, 10) || 0)}
            className={errors.maxAge ? FORM_INPUT_ERROR : undefined}
          />
        </Field>

        <Field id="class-calc-date" label={t("sessions.classes.detail.ageCalculationDate")}>
          <Input
            id="class-calc-date"
            name="ageCalculationDate"
            type="date"
            value={classDraft.ageCalculationDate}
            onChange={(e) => updateDraft("ageCalculationDate", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field id="class-capacity" label={t("sessions.classes.form.capacity")}>
          <Input
            id="class-capacity"
            name="maxStudents"
            type="text"
            inputMode="numeric"
            value={classDraft.maxStudents ?? 0}
            onChange={(e) => updateDraft("maxStudents", parseInt(e.target.value, 10) || 0)}
          />
        </Field>

        <Field id="class-deadline" label={t("sessions.classes.detail.enrollmentDeadline")}>
          <Input
            id="class-deadline"
            name="enrollmentDeadline"
            type="date"
            value={classDraft.enrollmentDeadline}
            onChange={(e) => updateDraft("enrollmentDeadline", e.target.value)}
          />
        </Field>

        <Field id="class-status" label={t("common.status")}>
          <FormSelect
            id="class-status"
            name="status"
            value={classDraft.status}
            onChange={(val) => updateDraft("status", val as "active" | "inactive")}
            options={[
              { value: "active", label: t("sessions.status.active") },
              { value: "inactive", label: t("sessions.classes.detail.status.inactive") },
            ]}
            className="w-full"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="class-faculty" label={t("sessions.classes.detail.leadInstructor")}>
          <FormSelect
            id="class-faculty"
            name="facultyId"
            value={classDraft.facultyId || ""}
            onChange={(val) => {
              const faculty = allFaculty.find((f) => String(f.id) === val);
              const displayName = faculty ? formatFacultyDisplayName(faculty) : "";
              updateDraft("facultyId", val);
              updateDraft("facultyName", displayName);
            }}
            options={[
              { value: "", label: t("sessions.classes.unassigned") },
              ...allFaculty.map((faculty) => ({
                value: String(faculty.id),
                label: formatFacultyDisplayName(faculty),
              })),
            ]}
            className="w-full"
          />
        </Field>

        <Field id="class-room" label={t("sessions.classes.detail.classroom")}>
          <Input
            id="class-room"
            value={classDraft.room || ""}
            onChange={(e) => updateDraft("room", e.target.value)}
            placeholder={t("sessions.classes.form.roomPlaceholder")}
          />
        </Field>
      </div>
    </div>
  );
}
