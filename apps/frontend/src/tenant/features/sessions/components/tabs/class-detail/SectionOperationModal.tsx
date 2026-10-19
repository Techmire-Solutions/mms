import React, { useEffect, useState } from "react";
import { Combine, Split, XCircle, type LucideIcon } from "lucide-react";
import {
  enrollmentHoldsSeat,
  todayISO,
  type AppTranslationKey,
  type SectionCloseBody,
  type SectionMergeBody,
  type SectionSplitBody,
  type SessionClassSection,
} from "@mms/shared";
import { Field, FormSelect } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { FormCheckboxCard } from "@/components/app/FormCheckboxCard";
import { DatePicker } from "@/components/app/DatePicker";
import { WarningCallout } from "@/components/app/WarningCallout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useEnrollmentsCollection } from "@/tenant/hooks/collections/enrollments";

export type SectionOperationKind = "merge" | "split" | "close";

const KINDS: Record<
  SectionOperationKind,
  {
    title: AppTranslationKey;
    callout: AppTranslationKey;
    save: AppTranslationKey;
    icon: LucideIcon;
  }
> = {
  merge: {
    title: "sessions.sections.ops.mergeTitle",
    callout: "sessions.sections.ops.mergeHint",
    save: "sessions.sections.ops.merge",
    icon: Combine,
  },
  split: {
    title: "sessions.sections.ops.splitTitle",
    callout: "sessions.sections.ops.splitHint",
    save: "sessions.sections.ops.splitAction",
    icon: Split,
  },
  close: {
    title: "sessions.sections.ops.closeTitle",
    callout: "sessions.sections.ops.closeHint",
    save: "sessions.sections.ops.close",
    icon: XCircle,
  },
};

export interface SectionOperationModalProps {
  kind: SectionOperationKind | null;
  classId: string;
  section: SessionClassSection;
  /** Other active, saved sections of the class (merge targets). */
  siblings: SessionClassSection[];
  isPending: boolean;
  onDismiss: () => void;
  onMerge: (body: SectionMergeBody) => Promise<boolean>;
  onSplit: (body: SectionSplitBody) => Promise<boolean>;
  onCloseSection: (body: SectionCloseBody) => Promise<boolean>;
}

/** Dated, reasoned structural change of one section: merge into another, split off students, close. */
export function SectionOperationModal(props: SectionOperationModalProps): React.JSX.Element {
  const { kind, classId, section, siblings, isPending, onDismiss } = props;
  const { t } = useTranslation();
  const today = todayISO();
  const config = KINDS[kind ?? "merge"];
  const roster = useEnrollmentsCollection({ enabled: kind === "split", classId }).filter(
    (enrollment) => enrollment.sectionId === section.id && enrollmentHoldsSeat(enrollment.status),
  );
  const [targetId, setTargetId] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("30");
  const [chosen, setChosen] = useState<string[]>([]);
  const [day, setDay] = useState(today);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!kind) return;
    setTargetId("");
    setName("");
    setCapacity("30");
    setChosen([]);
    setDay(today);
    setReason("");
  }, [kind, section.id, today]);

  const reasonValid = reason.trim().length >= 3;
  const occupied = (section.enrolled ?? 0) > 0;
  const capacityNumber = Number(capacity);
  const kindValid =
    kind === "merge"
      ? Boolean(targetId)
      : kind === "split"
        ? Boolean(name.trim()) && chosen.length > 0 && capacityNumber >= chosen.length
        : !occupied;
  const canSave = !isPending && reasonValid && Boolean(day) && kindValid;

  const submit = async () => {
    const common = { effectiveOn: day, reason: reason.trim() };
    const saved =
      kind === "merge"
        ? await props.onMerge({ ...common, targetSectionId: targetId })
        : kind === "split"
          ? await props.onSplit({
              ...common,
              name: name.trim(),
              capacity: capacityNumber,
              enrollmentIds: chosen,
            })
          : await props.onCloseSection(common);
    if (saved) onDismiss();
  };

  return (
    <FormModal
      open={kind !== null}
      onClose={onDismiss}
      title={t(config.title, { section: section.name })}
      icon={config.icon}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={t(config.save)}
      saving={isPending}
      saveDisabled={!canSave}
      isDirty={reason.trim().length > 0}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("enrollments.ops.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={() => void submit()}
    >
      <div className="space-y-4 py-1 text-start">
        <WarningCallout
          density="compact"
          description={
            kind === "close" && occupied
              ? t("sessions.sections.ops.closeOccupied", { count: section.enrolled ?? 0 })
              : t(config.callout)
          }
        />
        {kind === "merge" ? (
          <Field id={`${classId}-merge-target`} label={t("sessions.sections.ops.target")} required>
            <FormSelect
              id={`${classId}-merge-target`}
              name="targetSectionId"
              value={targetId}
              placeholder={t("common.selectPlaceholder")}
              disabled={isPending}
              onChange={setTargetId}
              options={siblings.map((row) => ({
                value: row.id,
                label: `${row.name} (${row.enrolled ?? 0}/${row.capacity ?? 0})`,
              }))}
            />
          </Field>
        ) : null}
        {kind === "split" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${classId}-split-name`} label={t("sessions.sections.name")} required>
                <Input
                  id={`${classId}-split-name`}
                  className={FORM_INPUT}
                  value={name}
                  maxLength={50}
                  disabled={isPending}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field
                id={`${classId}-split-capacity`}
                label={t("sessions.sections.capacity")}
                required
              >
                <Input
                  id={`${classId}-split-capacity`}
                  className={FORM_INPUT}
                  inputMode="numeric"
                  value={capacity}
                  disabled={isPending}
                  onChange={(event) => setCapacity(event.target.value.replace(/[^0-9]/g, ""))}
                />
              </Field>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">
                {t("sessions.sections.ops.students")}
              </legend>
              {roster.map((enrollment) => (
                <FormCheckboxCard
                  key={enrollment.id}
                  id={`split-${enrollment.id}`}
                  name="enrollmentIds"
                  label={enrollment.studentName || enrollment.studentId}
                  checked={chosen.includes(enrollment.id)}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    setChosen((current) =>
                      checked
                        ? [...current, enrollment.id]
                        : current.filter((id) => id !== enrollment.id),
                    )
                  }
                />
              ))}
            </fieldset>
          </>
        ) : null}
        <Field id={`${classId}-section-op-date`} label={t("enrollments.ops.effectiveOn")} required>
          <DatePicker
            id={`${classId}-section-op-date`}
            name="effectiveOn"
            value={day}
            max={today}
            disabled={isPending}
            onChange={setDay}
          />
        </Field>
        <Field
          id={`${classId}-section-op-reason`}
          label={t("enrollments.ops.reason")}
          hint={t("enrollments.ops.reasonHint")}
          error={reason && !reasonValid ? t("enrollments.ops.reasonRequired") : undefined}
          required
        >
          <Textarea
            id={`${classId}-section-op-reason`}
            name="reason"
            className={FORM_INPUT}
            rows={3}
            maxLength={500}
            value={reason}
            disabled={isPending}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </div>
    </FormModal>
  );
}
