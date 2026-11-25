import React from "react";
import { BookOpen, Phone, User } from "lucide-react";
import type { PublicRegistrationView } from "@mms/shared";
import { Field, FormSelect } from "@/components/app/FormPrimitives";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/app/DatePicker";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { RegistrationFormDraft } from "./useRegistrationForm";

export interface RegistrationFormFieldsProps {
  view: PublicRegistrationView;
  draft: RegistrationFormDraft;
  update: <K extends keyof RegistrationFormDraft>(key: K, value: RegistrationFormDraft[K]) => void;
  disabled: boolean;
  errors?: Partial<Record<keyof RegistrationFormDraft, string>>;
}

/**
 * Applicant fields for the public registration form grouped into structured,
 * visually clear sections (Academic, Student & Guardian, Contact & Background)
 * with mobile-friendly touch targets (min-h-[44px]).
 */
export function RegistrationFormFields({
  view,
  draft,
  update,
  disabled,
  errors = {},
}: RegistrationFormFieldsProps): React.JSX.Element {
  const { t } = useTranslation();

  const classLabel = (cls: PublicRegistrationView["classes"][number]) => {
    const ages =
      cls.minAge || cls.maxAge
        ? ` · ${t("apply.ages", { min: cls.minAge || 0, max: cls.maxAge || "+" })}`
        : "";
    return `${cls.name}${ages}`;
  };

  const inputClass = cn(FORM_INPUT, "min-h-11");

  return (
    <div className="space-y-6">
      {/* 1. Academic Selection Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <BookOpen className="size-4 text-primary" aria-hidden />
          <span>{t("apply.sectionAcademic")}</span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <Field id="apply-class" label={t("apply.class")} required error={errors.classId}>
            <FormSelect
              id="apply-class"
              name="classId"
              value={draft.classId}
              disabled={disabled}
              placeholder={t("common.selectPlaceholder")}
              required
              className="min-h-11"
              onChange={(value) => update("classId", value)}
              options={view.classes.map((cls) => ({ value: cls.id, label: classLabel(cls) }))}
            />
          </Field>
        </div>
      </section>

      {/* 2. Student & Guardian Details Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <User className="size-4 text-primary" aria-hidden />
          <span>{t("apply.sectionStudent")}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="apply-name" label={t("apply.fullName")} required error={errors.fullName}>
            <Input
              id="apply-name"
              name="fullName"
              autoComplete="name"
              required
              className={inputClass}
              value={draft.fullName}
              maxLength={150}
              disabled={disabled}
              onChange={(event) => update("fullName", event.target.value)}
            />
          </Field>

          <Field
            id="apply-guardian"
            label={t("apply.guardianName")}
            required
            error={errors.guardianName}
          >
            <Input
              id="apply-guardian"
              name="guardianName"
              required
              className={inputClass}
              value={draft.guardianName}
              maxLength={150}
              disabled={disabled}
              onChange={(event) => update("guardianName", event.target.value)}
            />
          </Field>

          <Field id="apply-dob" label={t("apply.dateOfBirth")} required error={errors.dateOfBirth}>
            <DatePicker
              id="apply-dob"
              name="dateOfBirth"
              required
              value={draft.dateOfBirth}
              disabled={disabled}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(value) => update("dateOfBirth", value)}
            />
          </Field>

          <Field id="apply-gender" label={t("apply.gender")} required error={errors.gender}>
            <FormSelect
              id="apply-gender"
              name="gender"
              required
              value={draft.gender}
              disabled={disabled}
              placeholder={t("common.selectPlaceholder")}
              className="min-h-11"
              onChange={(value) =>
                update("gender", value === "female" ? "female" : value === "male" ? "male" : "")
              }
              options={[
                { value: "male", label: t("apply.male") },
                { value: "female", label: t("apply.female") },
              ]}
            />
          </Field>
        </div>
      </section>

      {/* 3. Contact & Background Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Phone className="size-4 text-primary" aria-hidden />
          <span>{t("apply.sectionContact")}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="apply-phone" label={t("apply.phone")} required error={errors.phone}>
            <Input
              id="apply-phone"
              name="phone"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
              value={draft.phone}
              maxLength={20}
              disabled={disabled}
              onChange={(event) => update("phone", event.target.value)}
            />
          </Field>

          <Field id="apply-email" label={t("apply.email")} error={errors.email}>
            <Input
              id="apply-email"
              name="email"
              type="email"
              autoComplete="email"
              className={inputClass}
              value={draft.email}
              maxLength={200}
              disabled={disabled}
              onChange={(event) => update("email", event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field id="apply-address" label={t("apply.address")} error={errors.address}>
              <Textarea
                id="apply-address"
                name="address"
                rows={2}
                className="min-h-11"
                value={draft.address}
                maxLength={500}
                disabled={disabled}
                onChange={(event) => update("address", event.target.value)}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              id="apply-previous"
              label={t("apply.previousMadrasa")}
              error={errors.previousMadrasa}
            >
              <Input
                id="apply-previous"
                name="previousMadrasa"
                className={inputClass}
                value={draft.previousMadrasa}
                maxLength={200}
                disabled={disabled}
                onChange={(event) => update("previousMadrasa", event.target.value)}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Honeypot: off-screen and skipped by keyboard / assistive tech; bots that fill it are rejected. */}
      <div aria-hidden="true" className="sr-only">
        <Label htmlFor="apply-website" className="sr-only">
          Website
        </Label>
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
