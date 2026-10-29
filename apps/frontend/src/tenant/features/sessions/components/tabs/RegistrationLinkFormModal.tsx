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

export interface RegistrationLinkFormModalProps {
  open: boolean;
  session: Session;
  entry: RegistrationLink | null;
  isPending: boolean;
  onClose: () => void;
  onSave: (body: RegistrationLinkWrite) => Promise<boolean>;
}

/** Day boundaries are sent as instants (start / end of the chosen local day). */
const dayStart = (day: string) => (day ? new Date(`${day}T00:00:00`).toISOString() : null);
const dayEnd = (day: string) => (day ? new Date(`${day}T23:59:59`).toISOString() : null);
const toDay = (instant: string | null) =>
  instant ? new Date(instant).toLocaleDateString("en-CA") : "";

/** Create/edit a public registration link for a session. */
export function RegistrationLinkFormModal({
  open,
  session,
  entry,
  isPending,
  onClose,
  onSave,
}: RegistrationLinkFormModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const [title, setTitle] = useState("");
  const [opensOn, setOpensOn] = useState("");
  const [closesOn, setClosesOn] = useState("");
  const [maxSubmissions, setMaxSubmissions] = useState("");
  const [requiresReview, setRequiresReview] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [classIds, setClassIds] = useState<string[]>([]);

  // Reset the form from the edited link on every (re)open — render-phase reset, no effect.
  const [prevForm, setPrevForm] = useState<{
    open: boolean;
    entry: RegistrationLink | null;
  } | null>(null);
  if (!prevForm || prevForm.open !== open || prevForm.entry !== entry) {
    setPrevForm({ open, entry });
    if (open) {
      setTitle(entry?.title ?? "");
      setOpensOn(toDay(entry?.opensAt ?? null));
      setClosesOn(toDay(entry?.closesAt ?? null));
      setMaxSubmissions(entry?.maxSubmissions ? String(entry.maxSubmissions) : "");
      setRequiresReview(entry?.requiresReview ?? true);
      setIsActive(entry?.isActive ?? true);
      setClassIds(entry?.classIds ?? []);
    }
  }

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
      isDirty
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("sessions.registration.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={() =>
        void (async () => {
          const saved = await onSave({
            title: title.trim() || null,
            isActive,
            requiresReview,
            maxSubmissions: cap,
            classIds,
            opensAt: dayStart(opensOn),
            closesAt: dayEnd(closesOn),
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
