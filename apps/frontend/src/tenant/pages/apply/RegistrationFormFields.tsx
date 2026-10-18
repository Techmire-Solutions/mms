import React from "react";
import type { PublicRegistrationView } from "@mms/shared";
import { Field, FormSelect } from "@/components/app/FormPrimitives";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/app/DatePicker";
import { useTranslation } from "@/hooks/useTranslation";
import type { RegistrationFormDraft } from "./useRegistrationForm";

export interface RegistrationFormFieldsProps {
  view: PublicRegistrationView;
  draft: RegistrationFormDraft;
  update: <K extends keyof RegistrationFormDraft>(key: K, value: RegistrationFormDraft[K]) => void;
  disabled: boolean;
}

/** Applicant fields for the public registration form (labels are visible; no placeholders-as-labels). */
export function RegistrationFormFields({
  view,
  draft,
  update,
  disabled,
}: RegistrationFormFieldsProps): React.JSX.Element {
  const { t } = useTranslation();
  const classLabel = (cls: PublicRegistrationView["classes"][number]) => {
    const ages =
      cls.minAge || cls.maxAge
        ? ` · ${t("apply.ages", { min: cls.minAge || 0, max: cls.maxAge || "+" })}`
        : "";
    return `${cls.name}${ages}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field id="apply-class" label={t("apply.class")} required>
          <FormSelect
            id="apply-class"
            name="classId"
            value={draft.classId}
            disabled={disabled}
            placeholder={t("common.selectPlaceholder")}
            onChange={(value) => update("classId", value)}
            options={view.classes.map((cls) => ({ value: cls.id, label: classLabel(cls) }))}
          />
        </Field>
      </div>
      <Field id="apply-name" label={t("apply.fullName")} required>
        <Input
          id="apply-name"
          name="fullName"
          autoComplete="name"
          className={FORM_INPUT}
          value={draft.fullName}
          maxLength={150}
          disabled={disabled}
          onChange={(event) => update("fullName", event.target.value)}
        />
      </Field>
      <Field id="apply-guardian" label={t("apply.guardianName")} required>
        <Input
          id="apply-guardian"
          name="guardianName"
          className={FORM_INPUT}
          value={draft.guardianName}
          maxLength={150}
          disabled={disabled}
          onChange={(event) => update("guardianName", event.target.value)}
        />
      </Field>
      <Field id="apply-dob" label={t("apply.dateOfBirth")} required>
        <DatePicker
          id="apply-dob"
          name="dateOfBirth"
          value={draft.dateOfBirth}
          disabled={disabled}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(value) => update("dateOfBirth", value)}
        />
      </Field>
      <Field id="apply-gender" label={t("apply.gender")} required>
        <FormSelect
          id="apply-gender"
          name="gender"
          value={draft.gender}
          disabled={disabled}
          placeholder={t("common.selectPlaceholder")}
          onChange={(value) =>
            update("gender", value === "female" ? "female" : value === "male" ? "male" : "")
          }
          options={[
            { value: "male", label: t("apply.male") },
            { value: "female", label: t("apply.female") },
          ]}
        />
      </Field>
      <Field id="apply-phone" label={t("apply.phone")} required>
        <Input
          id="apply-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={FORM_INPUT}
          value={draft.phone}
          maxLength={20}
          disabled={disabled}
          onChange={(event) => update("phone", event.target.value)}
        />
      </Field>
      <Field id="apply-email" label={t("apply.email")}>
        <Input
          id="apply-email"
          name="email"
          type="email"
          autoComplete="email"
          className={FORM_INPUT}
          value={draft.email}
          maxLength={200}
          disabled={disabled}
          onChange={(event) => update("email", event.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field id="apply-address" label={t("apply.address")}>
          <Textarea
            id="apply-address"
            name="address"
            rows={2}
            value={draft.address}
            maxLength={500}
            disabled={disabled}
            onChange={(event) => update("address", event.target.value)}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="apply-previous" label={t("apply.previousMadrasa")}>
          <Input
            id="apply-previous"
            name="previousMadrasa"
            className={FORM_INPUT}
            value={draft.previousMadrasa}
            maxLength={200}
            disabled={disabled}
            onChange={(event) => update("previousMadrasa", event.target.value)}
          />
        </Field>
      </div>
      {/* Honeypot: off-screen and skipped by keyboard / assistive tech; bots that fill it are rejected. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="apply-website">Website</label>
        <Input
          id="apply-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={draft.website}
          onChange={(event) => update("website", event.target.value)}
        />
      </div>
    </div>
  );
}
