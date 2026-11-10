import React, { useState } from "react";
import { Link2 } from "lucide-react";
import type { RegistrationLink, RegistrationLinkWrite, Session } from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/app/DatePicker";
import { ToggleRow } from "@shared/ui";
import { FormCheckboxCard } from "@/components/app/FormCheckboxCard";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { dateInTimeZone, endOfDayInstant, startOfDayInstant } from "@/lib/date/zonedDay";

export interface RegistrationLinkFormModalProps {
  open: boolean;
  session: Session;
  entry: RegistrationLink | null;
  isPending: boolean;
  onClose: () => void;
  onSave: (body: RegistrationLinkWrite) => Promise<boolean>;
  serverError?: string | null;
}

/** Create/edit a public registration link for a session. */
export function RegistrationLinkFormModal({
  open,
  session,
  entry,
  isPending,
  onClose,
  onSave,
  serverError,
}: RegistrationLinkFormModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const { timezone } = useGlobalSettings();
  const [title, setTitle] = useState("");
  const [opensOn, setOpensOn] = useState("");
  const [closesOn, setClosesOn] = useState("");
  const [maxSubmissions, setMaxSubmissions] = useState("");
  const [requiresReview, setRequiresReview] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [baseline, setBaseline] = useState<string | null>(null);

  // Reset the form from the edited link on every (re)open — render-phase reset, no effect.
  const [prevForm, setPrevForm] = useState<{
    open: boolean;
    entry: RegistrationLink | null;
  } | null>(null);
  if (!prevForm || prevForm.open !== open || prevForm.entry !== entry) {
    setPrevForm({ open, entry });
    if (open) {
      const nextTitle = entry?.title ?? "";
      const nextOpens = entry?.opensAt ? dateInTimeZone(entry.opensAt, timezone) : "";
      const nextCloses = entry?.closesAt ? dateInTimeZone(entry.closesAt, timezone) : "";
      const nextCap = entry?.maxSubmissions ? String(entry.maxSubmissions) : "";
      const nextReview = entry?.requiresReview ?? true;
      const nextActive = entry?.isActive ?? true;
      const nextClasses = entry?.classIds ?? [];
      setTitle(nextTitle);
      setOpensOn(nextOpens);
      setClosesOn(nextCloses);
      setMaxSubmissions(nextCap);
      setRequiresReview(nextReview);
      setIsActive(nextActive);
      setClassIds(nextClasses);
      setBaseline(
        JSON.stringify({
          title: nextTitle,
          opensOn: nextOpens,
          closesOn: nextCloses,
          maxSubmissions: nextCap,
          requiresReview: nextReview,
          isActive: nextActive,
          classIds: nextClasses,
        }),
      );
    }
  }

  const snapshot = JSON.stringify({
    title,
    opensOn,
    closesOn,
    maxSubmissions,
    requiresReview,
    isActive,
    classIds,
  });
  const isDirty = baseline !== null && snapshot !== baseline;
  const cap = maxSubmissions.trim() ? Number(maxSubmissions) : null;
  const capInvalid = cap !== null && (!Number.isInteger(cap) || cap < 1);
  const windowInvalid = Boolean(opensOn && closesOn && closesOn < opensOn);
  const toggleClass = (classId: string, checked: boolean) =>
    setClassIds((current) =>
      checked ? [...current, classId] : current.filter((id) => id !== classId),
    );

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={entry ? t("sessions.registration.edit") : t("sessions.registration.add")}
      subtitle={t("sessions.registration.formSubtitle")}
      icon={Link2}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      saving={isPending}
      saveDisabled={isPending || capInvalid || windowInvalid}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("sessions.registration.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      error={serverError ?? undefined}
      onSave={() =>
        void (async () => {
          const saved = await onSave({
            title: title.trim() || null,
            isActive,
            requiresReview,
            maxSubmissions: cap,
            classIds,
            opensAt: startOfDayInstant(opensOn, timezone),
            closesAt: endOfDayInstant(closesOn, timezone),
          });
          if (saved) onClose();
        })()
      }
    >
      <div className="space-y-4 py-1 text-start">
        <Field
          id="reg-link-title"
          label={t("sessions.registration.title")}
          hint={t("sessions.registration.titleHint")}
        >
          <Input
            id="reg-link-title"
            name="title"
            className={FORM_INPUT}
            value={title}
            maxLength={150}
            placeholder={session.name}
            disabled={isPending}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="reg-link-opens" label={t("sessions.registration.opensOn")}>
            <DatePicker
              id="reg-link-opens"
              name="opensOn"
              value={opensOn}
              disabled={isPending}
              onChange={setOpensOn}
            />
          </Field>
          <Field
            id="reg-link-closes"
            label={t("sessions.registration.closesOn")}
            error={windowInvalid ? t("sessions.registration.windowInvalid") : undefined}
          >
            <DatePicker
              id="reg-link-closes"
              name="closesOn"
              value={closesOn}
              min={opensOn || undefined}
              disabled={isPending}
              onChange={setClosesOn}
            />
          </Field>
          <Field
            id="reg-link-cap"
            label={t("sessions.registration.maxSubmissions")}
            error={capInvalid ? t("sessions.registration.capInvalid") : undefined}
          >
            <Input
              id="reg-link-cap"
              name="maxSubmissions"
              inputMode="numeric"
              className={FORM_INPUT}
              value={maxSubmissions}
              disabled={isPending}
              onChange={(event) => setMaxSubmissions(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">
            {t("sessions.registration.classes", { classes: terms.class.plural })}
          </legend>
          <p className="text-xs text-muted-foreground">{t("sessions.registration.classesHint")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {session.classes.map((cls) => (
              <FormCheckboxCard
                key={cls.id}
                id={`reg-link-class-${cls.id}`}
                name="classIds"
                label={cls.name}
                checked={classIds.includes(cls.id)}
                disabled={isPending}
                onCheckedChange={(checked) => toggleClass(cls.id, checked)}
              />
            ))}
          </div>
        </fieldset>
        <ToggleRow
          label={t("sessions.registration.requiresReview")}
          description={t("sessions.registration.requiresReviewHint")}
          value={requiresReview}
          onChange={setRequiresReview}
        />
        <ToggleRow
          label={t("sessions.registration.active")}
          description={t("sessions.registration.activeHint")}
          value={isActive}
          onChange={setIsActive}
        />
      </div>
    </FormModal>
  );
}
