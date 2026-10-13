import type React from "react";
import type { ComponentType } from "react";
import { Field, FieldErrorMessage } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveRegistryLabel } from "@/lib/contacts/contactI18n";
import type { AppTranslationKey, FieldDefinition } from "@mms/shared";

export type StudentFieldErrorGetter = (fieldId: string) => string | undefined;

export interface StudentStatusSelectOption {
  value: string;
  label: string;
}

function findStudentTabField(
  fields: Record<string, FieldDefinition[]>,
  tabId: string,
  key: string,
): FieldDefinition | undefined {
  return (fields[tabId] ?? []).find((field) => field.key === key);
}

/** Registry label with form-copy fallback when the seed field is missing from settings. */
export function resolveStudentFieldLabel(
  fields: Record<string, FieldDefinition[]>,
  tabId: string,
  key: string,
  fallbackKey: AppTranslationKey,
  t: (key: AppTranslationKey) => string,
): string {
  const field = findStudentTabField(fields, tabId, key);
  return field ? resolveRegistryLabel(field, t) : t(fallbackKey);
}

export { FieldErrorMessage as FieldError };

import { cn } from "@/lib/utils";

export interface ContactProfileValueProps {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  error?: string;
}

export function ContactProfileValue({
  label,
  value,
  icon,
  iconClassName,
  error,
}: ContactProfileValueProps): React.JSX.Element {
  const { t } = useTranslation();
  const Icon = icon;
  const hasValue = value.trim().length > 0;

  return (
    <Field label={label} hint={t("students.form.contactFieldHint")} error={error}>
      <div
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-lg border px-3.5 py-2.5",
          error ? "border-destructive bg-destructive/10" : "border-border/60 bg-muted/40",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            error ? "text-destructive" : iconClassName || "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "text-sm font-semibold",
            hasValue ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {hasValue ? value : t("students.form.notSetOnContact")}
        </span>
      </div>
    </Field>
  );
}
