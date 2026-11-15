import type React from "react";
import type { FieldDefinition } from "@mms/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/app/DatePicker";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resolveRegistryLabel } from "@/lib/contacts/contactI18n";
import { useTranslation } from "@/hooks/useTranslation";

export interface RegistryCustomFieldControlProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  /** Namespace for DOM ids so multiple rows/grids stay unique. */
  idPrefix?: string;
  disabled?: boolean;
}

function isMultiSelectType(type: FieldDefinition["type"]): boolean {
  return type === "multi_select" || type === "multiselect";
}

/**
 * One tenant-registry custom field rendered from its `FieldDefinition` metadata.
 * Every module form uses this control so field type/options/labels never drift.
 */
export function RegistryCustomFieldControl({
  field,
  value,
  onChange,
  error,
  idPrefix = "registry-field",
  disabled = false,
}: RegistryCustomFieldControlProps): React.JSX.Element {
  const { t } = useTranslation();
  const label = resolveRegistryLabel(field, t);
  const id = `${idPrefix}-${field.key}`;
  const common = { id, name: field.key, disabled };

  const control = (() => {
    if (field.type === "textarea") {
      return (
        <Textarea
          {...common}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }
    if (field.type === "date") {
      return (
        <DatePicker
          {...common}
          value={typeof value === "string" && value ? value : undefined}
          onChange={(next) => onChange(next)}
        />
      );
    }
    if (field.type === "select" || field.type === "single_select") {
      return (
        <FormSelect
          {...common}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(next) => onChange(next)}
          options={(field.options ?? []).map((option) => ({
            value: String(option),
            label: String(option),
          }))}
        />
      );
    }
    if (isMultiSelectType(field.type)) {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <div className="space-y-1 rounded-md border border-border p-2">
          {(field.options ?? []).map((option) => {
            const optionValue = String(option);
            const optionId = `${id}-${optionValue}`;
            return (
              <div
                key={optionValue}
                className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-muted/50"
              >
                <Checkbox
                  id={optionId}
                  checked={selected.includes(optionValue)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selected, optionValue]
                        : selected.filter((item) => item !== optionValue),
                    )
                  }
                />
                <label htmlFor={optionId} className="cursor-pointer text-sm select-none">
                  {optionValue}
                </label>
              </div>
            );
          })}
        </div>
      );
    }
    if (field.type === "boolean") {
      return (
        <label
          htmlFor={id}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm"
        >
          <Checkbox
            id={id}
            checked={Boolean(value)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
          <span className="sr-only">{label}</span>
        </label>
      );
    }
    if (field.type === "number" || field.type === "currency") {
      return (
        <Input
          {...common}
          type="text"
          inputMode="decimal"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }
    return (
      <Input
        {...common}
        type={
          field.type === "email" || field.type === "url"
            ? field.type
            : field.type === "datetime"
              ? "datetime-local"
              : "text"
        }
        value={String(value ?? "")}
        placeholder={field.placeholder}
        aria-invalid={Boolean(error) || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  })();

  return (
    <Field id={id} label={label} required={Boolean(field.required)} error={error}>
      {control}
    </Field>
  );
}
